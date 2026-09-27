CREATE INDEX IF NOT EXISTS clients_created_by_idx ON public.clients(created_by);

CREATE OR REPLACE FUNCTION public.prepare_accountant_billing_package(p_document_id uuid, p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $$
DECLARE
  v_company uuid;
  v_doc public.billing_documents%rowtype;
  v_client public.clients%rowtype;
  v_company_name text;
  v_package jsonb;
  v_items jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_manager() THEN
    RAISE EXCEPTION 'manager_required' USING ERRCODE='42501';
  END IF;
  v_company:=private.current_company();

  SELECT * INTO v_doc
  FROM public.billing_documents
  WHERE id=p_document_id AND company_id=v_company
  FOR UPDATE;

  IF NOT FOUND OR v_doc.document_type<>'accountant' OR v_doc.status NOT IN ('awaiting_client_data','ready') THEN
    RAISE EXCEPTION 'billing_package_not_preparable';
  END IF;

  SELECT * INTO v_client
  FROM public.clients
  WHERE id=p_client_id AND company_id=v_company;

  IF NOT FOUND THEN RAISE EXCEPTION 'client_not_available'; END IF;
  IF length(trim(coalesce(v_client.name,'')))=0 OR length(trim(coalesce(v_client.document_number,'')))<5 THEN
    RAISE EXCEPTION 'client_billing_data_incomplete';
  END IF;

  SELECT name INTO v_company_name FROM public.company_info WHERE id=v_company;

  IF v_doc.service_order_id IS NOT NULL THEN
    SELECT jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'service_order_id',so.id,
      'date',so.date,
      'description',so.description,
      'location',so.location,
      'machine_id',so.machine_id,
      'machine',m.name,
      'operator',p.name,
      'start_hour',so.start_hour,
      'end_hour',so.end_hour,
      'total_hours',so.total_hours,
      'hourly_rate',so.hourly_rate,
      'total_value',so.total_value
    ))) INTO v_items
    FROM public.service_orders so
    LEFT JOIN public.machines m ON m.id=so.machine_id AND m.company_id=v_company
    LEFT JOIN public.employees p ON p.id=so.operator_id AND p.company_id=v_company
    WHERE so.id=v_doc.service_order_id AND so.company_id=v_company;

    UPDATE public.service_orders
    SET client_id=p_client_id
    WHERE id=v_doc.service_order_id AND company_id=v_company;
  ELSE
    SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'service_order_id',so.id,
      'date',so.date,
      'description',so.description,
      'location',so.location,
      'machine_id',so.machine_id,
      'machine',m.name,
      'operator',p.name,
      'start_hour',so.start_hour,
      'end_hour',so.end_hour,
      'total_hours',so.total_hours,
      'hourly_rate',so.hourly_rate,
      'total_value',so.total_value
    )) ORDER BY so.date,so.id),'[]'::jsonb) INTO v_items
    FROM public.service_measurement_items mi
    JOIN public.service_orders so ON so.id=mi.service_order_id AND so.company_id=v_company
    LEFT JOIN public.machines m ON m.id=so.machine_id AND m.company_id=v_company
    LEFT JOIN public.employees p ON p.id=so.operator_id AND p.company_id=v_company
    WHERE mi.measurement_id=v_doc.measurement_id AND mi.company_id=v_company;

    UPDATE public.service_measurements
    SET client_id=p_client_id,updated_at=now()
    WHERE id=v_doc.measurement_id AND company_id=v_company;

    UPDATE public.service_orders so
    SET client_id=p_client_id
    FROM public.service_measurement_items mi
    WHERE mi.measurement_id=v_doc.measurement_id
      AND mi.company_id=v_company
      AND so.id=mi.service_order_id
      AND so.company_id=v_company;
  END IF;

  v_package:=jsonb_strip_nulls(jsonb_build_object(
    'version',1,
    'prepared_at',now(),
    'company',jsonb_build_object('name',v_company_name),
    'client',jsonb_strip_nulls(jsonb_build_object(
      'id',v_client.id,
      'name',v_client.name,
      'legal_name',v_client.legal_name,
      'document_type',v_client.document_type,
      'document_number',v_client.document_number,
      'email',v_client.email,
      'phone',v_client.phone,
      'billing_email',v_client.billing_email,
      'billing_contact',v_client.billing_contact,
      'address_line',v_client.address_line,
      'address_number',v_client.address_number,
      'address_complement',v_client.address_complement,
      'neighborhood',v_client.neighborhood,
      'city',v_client.city,
      'state',v_client.state,
      'postal_code',v_client.postal_code
    )),
    'source',CASE WHEN v_doc.service_order_id IS NOT NULL THEN 'service_order' ELSE 'measurement' END,
    'service_order_id',v_doc.service_order_id,
    'measurement_id',v_doc.measurement_id,
    'services',v_items,
    'total_value',v_doc.amount,
    'instructions','Dados preparados pelo TerraGes para conferência e emissão fiscal externa pelo contador ou sistema fiscal da empresa.'
  ));

  UPDATE public.billing_documents
  SET client_id=p_client_id,
      package_data=v_package,
      prepared_by=auth.uid(),
      prepared_at=now(),
      status='ready',
      error_message=NULL
  WHERE id=p_document_id AND company_id=v_company;

  IF v_doc.service_order_id IS NOT NULL THEN
    UPDATE public.service_orders SET billing_document_status='ready'
    WHERE id=v_doc.service_order_id AND company_id=v_company;
  END IF;

  RETURN v_package;
END $$;

NOTIFY pgrst,'reload schema';
