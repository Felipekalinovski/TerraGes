-- TerraGes: simplify fiscal flow to accountant-ready billing packages.
-- No NFS-e is emitted by TerraGes in this phase.

CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company_info(id) ON DELETE CASCADE,
  name text NOT NULL,
  legal_name text,
  document_type text CHECK (document_type IS NULL OR document_type IN ('cpf','cnpj','other')),
  document_number text,
  email text,
  phone text,
  billing_email text,
  billing_contact text,
  address_line text,
  address_number text,
  address_complement text,
  neighborhood text,
  city text,
  state text,
  postal_code text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(trim(name)) BETWEEN 1 AND 200),
  CHECK (document_number IS NULL OR length(trim(document_number)) BETWEEN 5 AND 32),
  CHECK (state IS NULL OR length(trim(state)) <= 2)
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;

DROP POLICY IF EXISTS tenant_read ON public.clients;
DROP POLICY IF EXISTS tenant_insert ON public.clients;
DROP POLICY IF EXISTS tenant_update ON public.clients;
DROP POLICY IF EXISTS tenant_delete ON public.clients;

CREATE POLICY tenant_read ON public.clients FOR SELECT TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_insert ON public.clients FOR INSERT TO authenticated
WITH CHECK (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_update ON public.clients FOR UPDATE TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()))
WITH CHECK (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_delete ON public.clients FOR DELETE TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));

CREATE INDEX IF NOT EXISTS clients_company_name_idx ON public.clients(company_id, lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS clients_company_document_unique
ON public.clients(company_id, lower(document_number))
WHERE document_number IS NOT NULL AND length(trim(document_number)) > 0;

ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.service_measurements ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.billing_documents ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE public.billing_documents ADD COLUMN IF NOT EXISTS package_data jsonb;
ALTER TABLE public.billing_documents ADD COLUMN IF NOT EXISTS prepared_by uuid REFERENCES auth.users(id);
ALTER TABLE public.billing_documents ADD COLUMN IF NOT EXISTS prepared_at timestamptz;
ALTER TABLE public.billing_documents ADD COLUMN IF NOT EXISTS sent_to_accountant_at timestamptz;
ALTER TABLE public.billing_documents ADD COLUMN IF NOT EXISTS sent_channel text;
ALTER TABLE public.billing_documents ADD COLUMN IF NOT EXISTS external_invoice_date date;

CREATE INDEX IF NOT EXISTS service_orders_client_idx ON public.service_orders(client_id);
CREATE INDEX IF NOT EXISTS service_measurements_client_idx ON public.service_measurements(client_id);
CREATE INDEX IF NOT EXISTS billing_documents_client_idx ON public.billing_documents(client_id);
CREATE INDEX IF NOT EXISTS billing_documents_prepared_by_idx ON public.billing_documents(prepared_by);

-- Keep legacy rows untouched. New rows use accountant-ready terminology.
ALTER TABLE public.service_orders DROP CONSTRAINT IF EXISTS service_orders_billing_document_type_check;
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_billing_document_type_check
  CHECK (billing_document_type IN ('accountant','receipt','deferred'));

ALTER TABLE public.service_orders ALTER COLUMN billing_document_status SET DEFAULT 'not_prepared';
ALTER TABLE public.service_orders DROP CONSTRAINT IF EXISTS service_orders_billing_document_status_check;
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_billing_document_status_check
  CHECK (billing_document_status IN (
    'not_issued','awaiting_approval','issued',
    'not_prepared','awaiting_client_data','ready','sent_to_accountant',
    'external_invoice_recorded','deferred','consolidated','cancelled','error'
  ));

ALTER TABLE public.billing_documents ALTER COLUMN status SET DEFAULT 'awaiting_client_data';
ALTER TABLE public.billing_documents DROP CONSTRAINT IF EXISTS billing_documents_document_type_check;
ALTER TABLE public.billing_documents ADD CONSTRAINT billing_documents_document_type_check
  CHECK (document_type IN ('nfse','accountant','receipt','deferred'));
ALTER TABLE public.billing_documents DROP CONSTRAINT IF EXISTS billing_documents_status_check;
ALTER TABLE public.billing_documents ADD CONSTRAINT billing_documents_status_check
  CHECK (status IN (
    'awaiting_approval','issued',
    'awaiting_client_data','ready','sent_to_accountant',
    'external_invoice_recorded','deferred','cancelled','error'
  ));

CREATE OR REPLACE FUNCTION private.guard_service_order_completion() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.status='completed' OR EXISTS(SELECT 1 FROM private.service_order_settlements WHERE service_order_id=OLD.id) THEN
   RAISE EXCEPTION 'completed_order_requires_adjustment' USING ERRCODE='42501';
  END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='UPDATE' AND OLD.status='completed' THEN
  IF ROW(NEW.id,NEW.status,NEW.date,NEW.client,NEW.machine_id,NEW.operator_id,NEW.start_hour,NEW.end_hour,NEW.hourly_rate,NEW.payment_method,NEW.billing_document_type)
   IS DISTINCT FROM ROW(OLD.id,OLD.status,OLD.date,OLD.client,OLD.machine_id,OLD.operator_id,OLD.start_hour,OLD.end_hour,OLD.hourly_rate,OLD.payment_method,OLD.billing_document_type) THEN
   RAISE EXCEPTION 'completed_order_requires_adjustment' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.status='completed' THEN
  IF auth.uid() IS NOT NULL AND NOT private.is_manager() THEN RAISE EXCEPTION 'manager_required' USING ERRCODE='42501'; END IF;
  IF NEW.machine_id IS NULL OR NEW.start_hour IS NULL OR NEW.end_hour IS NULL OR NEW.hourly_rate IS NULL
   OR NEW.start_hour<0 OR NEW.start_hour>1000000 OR NEW.end_hour<=NEW.start_hour OR NEW.end_hour-NEW.start_hour>24
   OR NEW.hourly_rate<0 OR NEW.hourly_rate>1000000
   OR NEW.start_hour::text IN ('NaN','Infinity','-Infinity')
   OR NEW.end_hour::text IN ('NaN','Infinity','-Infinity')
   OR NEW.hourly_rate::text IN ('NaN','Infinity','-Infinity')
   OR NEW.billing_document_type NOT IN ('accountant','receipt','deferred')
   OR length(trim(coalesce(NEW.client,'')))=0 THEN RAISE EXCEPTION 'invalid_service_order'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.create_transaction_from_so() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE claimed uuid; txid uuid; docstatus text;
BEGIN
 IF NEW.status='completed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
  INSERT INTO private.service_order_settlements(service_order_id,company_id,completed_by,snapshot)
   VALUES(NEW.id,NEW.company_id,auth.uid(),jsonb_build_object(
    'date',NEW.date,'client',NEW.client,'client_id',NEW.client_id,'machine_id',NEW.machine_id,'start_hour',NEW.start_hour,'end_hour',NEW.end_hour,
    'hourly_rate',NEW.hourly_rate,'total_value',NEW.total_value,'owner_id',NEW.user_id,'billing_document_type',NEW.billing_document_type))
   ON CONFLICT(service_order_id) DO NOTHING RETURNING service_order_id INTO claimed;

  IF claimed IS NOT NULL THEN
   INSERT INTO public.transactions(title,amount,type,category,date,status,user_id,company_id)
    VALUES('Serviço #'||substring(NEW.id::text,1,8)||' - '||NEW.client,NEW.total_value,'income','Serviços',NEW.date,
     'pending',coalesce(auth.uid(),NEW.user_id),NEW.company_id) RETURNING id INTO txid;
   UPDATE private.service_order_settlements SET transaction_id=txid WHERE service_order_id=NEW.id;

   docstatus := CASE NEW.billing_document_type
     WHEN 'accountant' THEN 'awaiting_client_data'
     WHEN 'receipt' THEN 'ready'
     ELSE 'deferred'
   END;
   INSERT INTO public.billing_documents(company_id,service_order_id,client_id,document_type,status,amount)
   VALUES(NEW.company_id,NEW.id,NEW.client_id,NEW.billing_document_type,docstatus,NEW.total_value)
   ON CONFLICT DO NOTHING;

   UPDATE public.service_orders
      SET billing_document_status=CASE NEW.billing_document_type
        WHEN 'accountant' THEN 'awaiting_client_data'
        WHEN 'receipt' THEN 'ready'
        ELSE 'deferred'
      END
    WHERE id=NEW.id;
  END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.create_service_measurement_from_orders(p_service_order_ids uuid[])
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $$
DECLARE
  v_company uuid;
  v_measurement uuid;
  v_count integer;
  v_distinct integer;
  v_clients integer;
  v_client_ids integer;
  v_client text;
  v_client_id uuid;
  v_start date;
  v_end date;
  v_total numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_manager() THEN
    RAISE EXCEPTION 'manager_required' USING ERRCODE='42501';
  END IF;
  IF p_service_order_ids IS NULL OR cardinality(p_service_order_ids)=0 OR cardinality(p_service_order_ids)>100 THEN
    RAISE EXCEPTION 'invalid_measurement_selection';
  END IF;

  SELECT count(DISTINCT x) INTO v_distinct FROM unnest(p_service_order_ids) x;
  IF v_distinct <> cardinality(p_service_order_ids) THEN
    RAISE EXCEPTION 'duplicate_service_order';
  END IF;

  v_company:=private.current_company();

  SELECT count(*),count(DISTINCT client),count(DISTINCT client_id),min(client),min(client_id),min(date),max(date),coalesce(sum(total_value),0)
    INTO v_count,v_clients,v_client_ids,v_client,v_client_id,v_start,v_end,v_total
  FROM public.service_orders
  WHERE id=ANY(p_service_order_ids)
    AND company_id=v_company
    AND status='completed'
    AND billing_document_type='accountant';

  IF v_count<>cardinality(p_service_order_ids) THEN
    RAISE EXCEPTION 'service_order_not_billable';
  END IF;
  IF v_clients<>1 OR v_client_ids>1 THEN
    RAISE EXCEPTION 'measurement_requires_single_client';
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.service_measurement_items
    WHERE company_id=v_company AND service_order_id=ANY(p_service_order_ids)
  ) THEN
    RAISE EXCEPTION 'service_order_already_measured';
  END IF;
  IF EXISTS(
    SELECT 1
    FROM public.billing_documents d
    JOIN public.billing_charges c ON c.billing_document_id=d.id AND c.company_id=v_company AND c.status<>'cancelled'
    WHERE d.company_id=v_company AND d.service_order_id=ANY(p_service_order_ids)
  ) OR EXISTS(
    SELECT 1 FROM public.billing_documents d
    WHERE d.company_id=v_company
      AND d.service_order_id=ANY(p_service_order_ids)
      AND d.status IN ('sent_to_accountant','external_invoice_recorded')
  ) THEN
    RAISE EXCEPTION 'service_order_billing_already_progressed';
  END IF;

  INSERT INTO public.service_measurements(company_id,created_by,client,client_id,period_start,period_end,status,total_value)
  VALUES(v_company,auth.uid(),v_client,v_client_id,v_start,v_end,'draft',v_total)
  RETURNING id INTO v_measurement;

  INSERT INTO public.service_measurement_items(measurement_id,service_order_id,company_id,amount)
  SELECT v_measurement,id,v_company,total_value
  FROM public.service_orders
  WHERE id=ANY(p_service_order_ids) AND company_id=v_company;

  UPDATE public.billing_documents
  SET status='cancelled',
      error_message='consolidated_in_measurement:'||v_measurement::text
  WHERE company_id=v_company
    AND service_order_id=ANY(p_service_order_ids)
    AND status NOT IN ('cancelled');

  UPDATE public.service_orders
  SET billing_document_status='consolidated'
  WHERE company_id=v_company AND id=ANY(p_service_order_ids);

  INSERT INTO public.billing_documents(company_id,measurement_id,client_id,document_type,status,amount)
  VALUES(v_company,v_measurement,v_client_id,'accountant','awaiting_client_data',v_total);

  RETURN v_measurement;
END $$;

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
    LEFT JOIN public.profiles p ON p.id=so.operator_id AND p.company_id=v_company
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
    LEFT JOIN public.profiles p ON p.id=so.operator_id AND p.company_id=v_company
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

REVOKE ALL ON FUNCTION public.prepare_accountant_billing_package(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prepare_accountant_billing_package(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_billing_package_sent(p_document_id uuid, p_channel text DEFAULT 'manual')
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $$
DECLARE
  v_company uuid;
  v_order uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_manager() THEN
    RAISE EXCEPTION 'manager_required' USING ERRCODE='42501';
  END IF;
  IF p_channel NOT IN ('manual','whatsapp','email','copy','other') THEN
    RAISE EXCEPTION 'invalid_delivery_channel';
  END IF;
  v_company:=private.current_company();

  UPDATE public.billing_documents
  SET status='sent_to_accountant',sent_to_accountant_at=now(),sent_channel=p_channel
  WHERE id=p_document_id AND company_id=v_company AND document_type='accountant' AND status='ready'
  RETURNING service_order_id INTO v_order;

  IF NOT FOUND THEN RAISE EXCEPTION 'billing_package_not_sendable'; END IF;
  IF v_order IS NOT NULL THEN
    UPDATE public.service_orders SET billing_document_status='sent_to_accountant'
    WHERE id=v_order AND company_id=v_company;
  END IF;
  RETURN p_document_id;
END $$;

REVOKE ALL ON FUNCTION public.mark_billing_package_sent(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mark_billing_package_sent(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_external_invoice(p_document_id uuid, p_invoice_number text, p_invoice_date date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $$
DECLARE
  v_company uuid;
  v_order uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_manager() THEN
    RAISE EXCEPTION 'manager_required' USING ERRCODE='42501';
  END IF;
  IF length(trim(coalesce(p_invoice_number,''))) NOT BETWEEN 1 AND 100 OR p_invoice_date IS NULL THEN
    RAISE EXCEPTION 'invalid_external_invoice';
  END IF;
  v_company:=private.current_company();

  UPDATE public.billing_documents
  SET status='external_invoice_recorded',
      document_number=trim(p_invoice_number),
      external_invoice_date=p_invoice_date,
      issued_at=(p_invoice_date::timestamp AT TIME ZONE 'America/Sao_Paulo')
  WHERE id=p_document_id
    AND company_id=v_company
    AND document_type='accountant'
    AND status IN ('ready','sent_to_accountant')
  RETURNING service_order_id INTO v_order;

  IF NOT FOUND THEN RAISE EXCEPTION 'external_invoice_not_recordable'; END IF;
  IF v_order IS NOT NULL THEN
    UPDATE public.service_orders SET billing_document_status='external_invoice_recorded'
    WHERE id=v_order AND company_id=v_company;
  END IF;
  RETURN p_document_id;
END $$;

REVOKE ALL ON FUNCTION public.record_external_invoice(uuid,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_external_invoice(uuid,text,date) TO authenticated;

CREATE OR REPLACE FUNCTION public.resume_deferred_billing_document(p_document_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $$
DECLARE
  v_company uuid;
  v_order uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_manager() THEN
    RAISE EXCEPTION 'manager_required' USING ERRCODE='42501';
  END IF;
  v_company:=private.current_company();

  UPDATE public.billing_documents
  SET document_type='accountant',status='awaiting_client_data',error_message=NULL
  WHERE id=p_document_id
    AND company_id=v_company
    AND document_type='deferred'
    AND status='deferred'
  RETURNING service_order_id INTO v_order;

  IF NOT FOUND THEN RAISE EXCEPTION 'deferred_document_not_resumable'; END IF;
  IF v_order IS NOT NULL THEN
    UPDATE public.service_orders SET billing_document_status='awaiting_client_data'
    WHERE id=v_order AND company_id=v_company;
  END IF;
  RETURN p_document_id;
END $$;

CREATE OR REPLACE FUNCTION public.create_billing_charge(
  p_document_id uuid,
  p_due_date date,
  p_method text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $$
DECLARE
  v_company uuid;
  v_doc public.billing_documents%rowtype;
  v_client text;
  v_tx uuid;
  v_charge uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_manager() THEN
    RAISE EXCEPTION 'manager_required' USING ERRCODE='42501';
  END IF;
  IF p_due_date IS NULL OR p_method NOT IN ('pix','boleto','transferencia','dinheiro','cartao','outro') THEN
    RAISE EXCEPTION 'invalid_charge';
  END IF;

  v_company:=private.current_company();
  SELECT * INTO v_doc
  FROM public.billing_documents
  WHERE id=p_document_id AND company_id=v_company
  FOR UPDATE;

  IF NOT FOUND OR v_doc.status NOT IN ('ready','sent_to_accountant','external_invoice_recorded') THEN
    RAISE EXCEPTION 'document_not_chargeable';
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.billing_charges
    WHERE billing_document_id=p_document_id AND company_id=v_company AND status<>'cancelled'
  ) THEN
    RAISE EXCEPTION 'charge_already_exists';
  END IF;

  IF v_doc.service_order_id IS NOT NULL THEN
    SELECT client INTO v_client FROM public.service_orders
      WHERE id=v_doc.service_order_id AND company_id=v_company;
    SELECT transaction_id INTO v_tx
      FROM public.get_service_order_settlements()
      WHERE service_order_id=v_doc.service_order_id
      LIMIT 1;
  ELSE
    SELECT client INTO v_client FROM public.service_measurements
      WHERE id=v_doc.measurement_id AND company_id=v_company;
  END IF;

  INSERT INTO public.billing_charges(
    company_id,billing_document_id,transaction_id,client,amount,due_date,method,status
  ) VALUES(
    v_company,p_document_id,v_tx,v_client,v_doc.amount,p_due_date,p_method,'pending'
  ) RETURNING id INTO v_charge;

  RETURN v_charge;
END $$;

-- WhatsApp OS actions now use accountant|receipt|deferred, never an NFS-e emission intent.
CREATE OR REPLACE FUNCTION public.prepare_whatsapp_action(p_event_id uuid, p_action_type text, p_slots jsonb, p_preview text, p_ready boolean)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE c jsonb; s private.whatsapp_action_sessions%rowtype; d public.whatsapp_drafts%rowtype; source_id uuid; v jsonb; kind text; mid uuid; role_name text; resolved_name text; resolved_hours numeric;
BEGIN
 IF p_action_type NOT IN ('create_rdo','update_machine_meter','create_expense','create_service_order') OR jsonb_typeof(p_slots)<>'object'
  OR octet_length(p_slots::text)>20000 OR length(p_preview) NOT BETWEEN 1 AND 4096 THEN RAISE EXCEPTION 'invalid_action_draft'; END IF;
 c:=public.get_whatsapp_action_context(p_event_id); role_name:=c->>'role';
 SELECT * INTO s FROM private.whatsapp_action_sessions WHERE company_id=(c->>'company_id')::uuid AND user_id=(c->>'user_id')::uuid
  AND instance_name=c->>'instance_name' AND phone=c->>'phone' AND state IN ('collecting','awaiting_confirmation') FOR UPDATE;
 IF s.company_id IS NOT NULL AND s.action_type<>p_action_type THEN
  UPDATE public.whatsapp_drafts SET state='discarded',reviewed_by=(c->>'user_id')::uuid,updated_at=now() WHERE id=s.draft_id AND state='draft';
 END IF;
 source_id:=CASE WHEN s.company_id IS NOT NULL AND s.action_type=p_action_type THEN s.source_event_id ELSE p_event_id END;
 v:=CASE p_action_type
  WHEN 'create_rdo' THEN jsonb_strip_nulls(jsonb_build_object('date',p_slots->'date','description',p_slots->'description','machine_query',p_slots->'machine_query','machine_id',p_slots->'machine_id','machine_name',p_slots->'machine_name'))
  WHEN 'update_machine_meter' THEN jsonb_strip_nulls(jsonb_build_object('machine_query',p_slots->'machine_query','machine_id',p_slots->'machine_id','machine_name',p_slots->'machine_name','meter_hours',p_slots->'meter_hours','current_meter_hours',p_slots->'current_meter_hours'))
  WHEN 'create_expense' THEN jsonb_strip_nulls(jsonb_build_object('date',p_slots->'date','description',p_slots->'description','amount',p_slots->'amount','category',p_slots->'category','liters',p_slots->'liters','unit_price',p_slots->'unit_price'))
  ELSE jsonb_strip_nulls(jsonb_build_object(
    'date',p_slots->'date','description',p_slots->'description','client',p_slots->'client','machine_query',p_slots->'machine_query',
    'machine_id',p_slots->'machine_id','machine_name',p_slots->'machine_name','start_hour',p_slots->'start_hour',
    'end_hour',p_slots->'end_hour','hourly_rate',p_slots->'hourly_rate','billing_document_type',p_slots->'billing_document_type'
  )) END;
 IF p_action_type IN ('create_expense','create_service_order') AND role_name NOT IN ('admin','gestor') THEN RAISE EXCEPTION 'manager_required' USING ERRCODE='42501'; END IF;
 IF v ? 'machine_id' THEN
  mid:=(v->>'machine_id')::uuid;
  IF NOT EXISTS(SELECT 1 FROM public.machines x WHERE x.id=mid AND x.company_id=(c->>'company_id')::uuid AND
   (role_name IN ('admin','gestor') OR x.user_id=(c->>'user_id')::uuid OR EXISTS(SELECT 1 FROM public.machine_assignments a WHERE a.machine_id=x.id AND a.user_id=(c->>'user_id')::uuid AND a.company_id=x.company_id)))
  THEN RAISE EXCEPTION 'machine_not_assigned' USING ERRCODE='42501'; END IF;
  SELECT x.name,x.hours INTO resolved_name,resolved_hours FROM public.machines x WHERE x.id=mid AND x.company_id=(c->>'company_id')::uuid;
  v:=v||jsonb_build_object('machine_name',resolved_name,'current_meter_hours',coalesce(resolved_hours,0));
 END IF;
 IF p_ready THEN
  IF p_action_type='create_rdo' AND (coalesce(v->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR length(trim(coalesce(v->>'description',''))) NOT BETWEEN 1 AND 4000 OR mid IS NULL) THEN RAISE EXCEPTION 'invalid_rdo'; END IF;
  IF p_action_type='update_machine_meter' AND (mid IS NULL OR coalesce(v->>'meter_hours','') !~ '^[0-9]+([.][0-9]{1,2})?$' OR (v->>'meter_hours')::numeric>10000000) THEN RAISE EXCEPTION 'invalid_machine_meter'; END IF;
  IF p_action_type='create_expense' AND (coalesce(v->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR length(trim(coalesce(v->>'description',''))) NOT BETWEEN 1 AND 4000 OR coalesce(v->>'amount','') !~ '^[0-9]+([.][0-9]{1,2})?$' OR (v->>'amount')::numeric<=0 OR (v->>'amount')::numeric>100000000) THEN RAISE EXCEPTION 'invalid_expense'; END IF;
  IF p_action_type='create_service_order' AND (
   coalesce(v->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   OR length(trim(coalesce(v->>'description',''))) NOT BETWEEN 1 AND 4000
   OR length(trim(coalesce(v->>'client',''))) NOT BETWEEN 1 AND 200
   OR mid IS NULL
   OR coalesce(v->>'start_hour','') !~ '^[0-9]+([.][0-9]{1,2})?$'
   OR coalesce(v->>'end_hour','') !~ '^[0-9]+([.][0-9]{1,2})?$'
   OR coalesce(v->>'hourly_rate','') !~ '^[0-9]+([.][0-9]{1,2})?$'
   OR coalesce(v->>'billing_document_type','') NOT IN ('accountant','receipt','deferred')
  ) THEN RAISE EXCEPTION 'invalid_service_order'; END IF;
 END IF;
 kind:=CASE p_action_type WHEN 'create_rdo' THEN 'rdo' WHEN 'update_machine_meter' THEN 'machine_meter' WHEN 'create_expense' THEN 'expense' ELSE 'service_order' END;
 IF NOT p_ready AND s.draft_id IS NOT NULL THEN
  UPDATE public.whatsapp_drafts SET state='discarded',reviewed_by=(c->>'user_id')::uuid,version=version+1,updated_at=now() WHERE id=s.draft_id AND state='draft';
 END IF;
 IF p_ready THEN
  INSERT INTO public.whatsapp_drafts(event_id,company_id,user_id,kind,payload)
  VALUES(source_id,(c->>'company_id')::uuid,(c->>'user_id')::uuid,kind,v)
  ON CONFLICT(event_id) DO UPDATE SET kind=excluded.kind,payload=excluded.payload,state='draft',record_id=NULL,reviewed_by=NULL,
   version=public.whatsapp_drafts.version+1,updated_at=now() RETURNING * INTO d;
 END IF;
 INSERT INTO private.whatsapp_action_sessions(company_id,user_id,instance_name,phone,action_type,slots,state,source_event_id,draft_id,updated_at,expires_at)
 VALUES((c->>'company_id')::uuid,(c->>'user_id')::uuid,c->>'instance_name',c->>'phone',p_action_type,v,
  CASE WHEN p_ready THEN 'awaiting_confirmation' ELSE 'collecting' END,source_id,CASE WHEN p_ready THEN d.id ELSE NULL END,now(),now()+interval '24 hours')
 ON CONFLICT(company_id,user_id,instance_name,phone) DO UPDATE SET action_type=excluded.action_type,slots=excluded.slots,state=excluded.state,
  source_event_id=excluded.source_event_id,draft_id=excluded.draft_id,updated_at=now(),expires_at=excluded.expires_at RETURNING * INTO s;
 RETURN jsonb_build_object('action_type',s.action_type,'state',s.state,'slots',s.slots,'draft_id',s.draft_id,'draft_version',d.version);
END $$;

CREATE OR REPLACE FUNCTION public.confirm_whatsapp_action(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $$
DECLARE c jsonb; s private.whatsapp_action_sessions%rowtype; d public.whatsapp_drafts%rowtype; v jsonb; rid uuid; mid uuid; machine_name text; current_hours numeric; new_hours numeric; dt date; n numeric; start_n numeric; end_n numeric; rate numeric; doc_type text;
BEGIN
 c:=public.get_whatsapp_action_context(p_event_id);
 SELECT * INTO s FROM private.whatsapp_action_sessions WHERE company_id=(c->>'company_id')::uuid AND user_id=(c->>'user_id')::uuid
  AND instance_name=c->>'instance_name' AND phone=c->>'phone' AND expires_at>now()
  AND (state='awaiting_confirmation' OR (state='complete' AND confirmation_event_id=p_event_id)) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'action_confirmation_not_available'; END IF;
 SELECT * INTO d FROM public.whatsapp_drafts WHERE id=s.draft_id FOR UPDATE;
 IF d.state='confirmed' THEN RETURN jsonb_build_object('action_type',s.action_type,'record_id',d.record_id,'already_confirmed',true,'slots',d.payload); END IF;
 IF d.state<>'draft' OR d.company_id<>(c->>'company_id')::uuid OR d.user_id<>(c->>'user_id')::uuid THEN RAISE EXCEPTION 'invalid_action_draft'; END IF;
 IF s.action_type IN ('create_expense','create_service_order') AND (c->>'role') NOT IN ('admin','gestor') THEN RAISE EXCEPTION 'manager_required' USING ERRCODE='42501'; END IF;
 v:=d.payload;mid:=nullif(v->>'machine_id','')::uuid;
 IF mid IS NOT NULL THEN SELECT name,hours INTO machine_name,current_hours FROM public.machines WHERE id=mid AND company_id=d.company_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'machine_not_available'; END IF; END IF;
 IF s.action_type='create_rdo' THEN
  dt:=(v->>'date')::date;
  IF dt<'2000-01-01' OR dt>current_date+1 THEN RAISE EXCEPTION 'invalid_date'; END IF;
  INSERT INTO public.rdos(date,activities,description,machine_ids,machines,user_id,company_id,created_by)
  VALUES(dt::timestamp AT TIME ZONE 'America/Sao_Paulo',v->>'description',v->>'description',ARRAY[mid],ARRAY[machine_name],d.user_id,d.company_id,d.user_id) RETURNING id INTO rid;
 ELSIF s.action_type='update_machine_meter' THEN
  new_hours:=(v->>'meter_hours')::numeric;
  IF new_hours<coalesce(current_hours,0) OR new_hours-coalesce(current_hours,0)>1000 THEN RAISE EXCEPTION 'invalid_meter_progression'; END IF;
  UPDATE public.machines SET hours=new_hours WHERE id=mid AND company_id=d.company_id RETURNING id INTO rid;
 ELSIF s.action_type='create_expense' THEN
  dt:=(v->>'date')::date;n:=(v->>'amount')::numeric;
  IF dt<'2000-01-01' OR dt>current_date+1 OR n<=0 OR n>100000000 OR scale(n)>2 THEN RAISE EXCEPTION 'invalid_expense'; END IF;
  INSERT INTO public.transactions(title,date,amount,type,status,category,user_id,company_id)
  VALUES(left(v->>'description',4000),dt,n,'expense','pending',left(coalesce(nullif(v->>'category',''),'Outros'),100),d.user_id,d.company_id) RETURNING id INTO rid;
 ELSE
  dt:=(v->>'date')::date;start_n:=(v->>'start_hour')::numeric;end_n:=(v->>'end_hour')::numeric;rate:=(v->>'hourly_rate')::numeric;doc_type:=v->>'billing_document_type';
  IF dt<'2000-01-01' OR dt>current_date+1 OR start_n<0 OR end_n<=start_n OR end_n-start_n>24 OR rate<0 OR rate>1000000 OR doc_type NOT IN ('accountant','receipt','deferred') THEN RAISE EXCEPTION 'invalid_service_order'; END IF;
  INSERT INTO public.service_orders(date,client,machine_id,start_hour,end_hour,hourly_rate,description,status,billing_document_type,user_id,company_id)
  VALUES(dt,v->>'client',mid,start_n,end_n,rate,v->>'description','pending',doc_type,d.user_id,d.company_id) RETURNING id INTO rid;
 END IF;
 UPDATE public.whatsapp_drafts SET state='confirmed',record_id=rid,reviewed_by=d.user_id,version=version+1,updated_at=now() WHERE id=d.id RETURNING * INTO d;
 UPDATE private.whatsapp_action_sessions SET state='complete',confirmation_event_id=p_event_id,updated_at=now() WHERE company_id=s.company_id AND user_id=s.user_id AND instance_name=s.instance_name AND phone=s.phone;
 INSERT INTO private.whatsapp_review_audit(draft_id,actor_id,action,version,payload) VALUES(d.id,d.user_id,'confirm_whatsapp',d.version,d.payload);
 RETURN jsonb_build_object('action_type',s.action_type,'record_id',rid,'already_confirmed',false,'machine_name',machine_name,'slots',v);
END $$;

DROP FUNCTION IF EXISTS public.approve_nfse_document(uuid);

INSERT INTO public.agent_module_knowledge(
 module_key,module_name,purpose,source_tables,required_fields,optional_fields,generated_fields,states,permissions,business_rules,agent_actions,aliases,knowledge_version,active
) VALUES (
 'faturamento_cobranca','Faturamento, contador e cobrança',
 'Transforma serviços concluídos em recibos ou pacotes de dados para o contador/sistema fiscal externo, depois acompanha cobrança e recebimento. O TerraGes não emite NFS-e.',
 ARRAY['clients','service_orders','service_measurements','service_measurement_items','billing_documents','billing_charges','payment_reconciliations','transactions'],
 '[{"name":"billing_document_type","type":"enum","values":["accountant","receipt","deferred"]}]'::jsonb,
 '[{"name":"client_id","type":"uuid_reference","reference":"clients"},{"name":"due_date","type":"date"},{"name":"charge_method","type":"enum","values":["pix","boleto","transferencia","dinheiro","cartao","outro"]}]'::jsonb,
 '[{"name":"company_id","source":"verified_membership"},{"name":"amount","source":"service_order_or_measurement_total"},{"name":"package_data","source":"deterministic_billing_package"}]'::jsonb,
 '{"document_type":{"accountant":"Preparar dados para contador/sistema fiscal externo","receipt":"Gerar OS/recibo sem emissão fiscal no TerraGes","deferred":"Decidir faturamento depois"},"document_status":{"awaiting_client_data":"Faltam dados do cliente/pacote","ready":"Pacote ou recibo pronto","sent_to_accountant":"Dados enviados ao contador","external_invoice_recorded":"Nota emitida externamente registrada","deferred":"Faturamento adiado"}}'::jsonb,
 '{"read":["admin","gestor"],"prepare_package":["admin","gestor"],"mark_sent":["admin","gestor"],"record_external_invoice":["admin","gestor"],"charge":["admin","gestor"],"reconcile":["admin","gestor"]}'::jsonb,
 '[
  "O TerraGes não emite NFS-e nesta fase e nunca deve afirmar que emitiu uma nota.",
  "Para accountant, organizar dados do cliente, serviço, período, máquina, horas, valor/hora e total para envio ao contador ou sistema fiscal externo.",
  "Nunca inventar CPF/CNPJ, endereço, código fiscal, imposto, número de nota ou qualquer dado tributário.",
  "OS/recibo registra a execução do serviço e não substitui documento fiscal quando houver obrigação legal.",
  "A nota emitida externamente pode ter número e data registrados no TerraGes apenas depois de confirmação do usuário.",
  "Pagamento só vira recebido após confirmação ou conciliação."
 ]'::jsonb,
 '[
  {"mode":"read","action":"list_billable_services","manager_only":true},
  {"mode":"confirmed_write","action":"choose_billing_document","manager_only":true},
  {"mode":"confirmed_write","action":"prepare_accountant_package","manager_only":true},
  {"mode":"confirmed_write","action":"record_external_invoice","manager_only":true},
  {"mode":"confirmed_write","action":"create_charge","manager_only":true},
  {"mode":"confirmed_write","action":"reconcile_payment","manager_only":true}
 ]'::jsonb,
 ARRAY['faturar','faturamento','contador','nota fiscal','nfse','nfs-e','recibo','cobrança','cobranca','medição','medicao','receber','a receber'],
 1,true
)
ON CONFLICT(module_key) DO UPDATE SET
 module_name=EXCLUDED.module_name,purpose=EXCLUDED.purpose,source_tables=EXCLUDED.source_tables,
 required_fields=EXCLUDED.required_fields,optional_fields=EXCLUDED.optional_fields,generated_fields=EXCLUDED.generated_fields,
 states=EXCLUDED.states,permissions=EXCLUDED.permissions,business_rules=EXCLUDED.business_rules,agent_actions=EXCLUDED.agent_actions,
 aliases=EXCLUDED.aliases,knowledge_version=public.agent_module_knowledge.knowledge_version+1,active=true,updated_at=now();

NOTIFY pgrst,'reload schema';
