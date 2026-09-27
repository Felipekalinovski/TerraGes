-- Finance UI API for Work-to-Cash. RLS remains authoritative.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_measurements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_measurement_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.billing_charges TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_reconciliations TO authenticated;

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
  v_client text;
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

  SELECT count(*),count(DISTINCT client),min(client),min(date),max(date),coalesce(sum(total_value),0)
    INTO v_count,v_clients,v_client,v_start,v_end,v_total
  FROM public.service_orders
  WHERE id=ANY(p_service_order_ids)
    AND company_id=v_company
    AND status='completed';

  IF v_count<>cardinality(p_service_order_ids) THEN
    RAISE EXCEPTION 'service_order_not_billable';
  END IF;
  IF v_clients<>1 THEN
    RAISE EXCEPTION 'measurement_requires_single_client';
  END IF;
  IF EXISTS(
    SELECT 1 FROM public.service_measurement_items
    WHERE company_id=v_company AND service_order_id=ANY(p_service_order_ids)
  ) THEN
    RAISE EXCEPTION 'service_order_already_measured';
  END IF;

  INSERT INTO public.service_measurements(company_id,created_by,client,period_start,period_end,status,total_value)
  VALUES(v_company,auth.uid(),v_client,v_start,v_end,'draft',v_total)
  RETURNING id INTO v_measurement;

  INSERT INTO public.service_measurement_items(measurement_id,service_order_id,company_id,amount)
  SELECT v_measurement,id,v_company,total_value
  FROM public.service_orders
  WHERE id=ANY(p_service_order_ids) AND company_id=v_company;

  RETURN v_measurement;
END $$;

REVOKE ALL ON FUNCTION public.create_service_measurement_from_orders(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_service_measurement_from_orders(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_nfse_document(p_document_id uuid)
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
  SET status='ready',approved_by=auth.uid(),approved_at=now(),error_message=NULL
  WHERE id=p_document_id
    AND company_id=v_company
    AND document_type='nfse'
    AND status='awaiting_approval'
  RETURNING service_order_id INTO v_order;

  IF NOT FOUND THEN RAISE EXCEPTION 'nfse_document_not_approvable'; END IF;
  IF v_order IS NOT NULL THEN
    UPDATE public.service_orders
    SET billing_document_status='ready'
    WHERE id=v_order AND company_id=v_company;
  END IF;
  RETURN p_document_id;
END $$;

REVOKE ALL ON FUNCTION public.approve_nfse_document(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.approve_nfse_document(uuid) TO authenticated;

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

  IF NOT FOUND OR v_doc.status NOT IN ('ready','issued') THEN
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

REVOKE ALL ON FUNCTION public.create_billing_charge(uuid,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_billing_charge(uuid,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.confirm_billing_charge_payment(
  p_charge_id uuid,
  p_paid_at timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $$
DECLARE
  v_company uuid;
  v_charge public.billing_charges%rowtype;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_manager() THEN
    RAISE EXCEPTION 'manager_required' USING ERRCODE='42501';
  END IF;
  v_company:=private.current_company();

  SELECT * INTO v_charge
  FROM public.billing_charges
  WHERE id=p_charge_id AND company_id=v_company
  FOR UPDATE;

  IF NOT FOUND OR v_charge.status='cancelled' THEN
    RAISE EXCEPTION 'charge_not_payable';
  END IF;

  UPDATE public.billing_charges
  SET status='paid',paid_at=coalesce(p_paid_at,now())
  WHERE id=v_charge.id;

  IF v_charge.transaction_id IS NOT NULL THEN
    UPDATE public.transactions
    SET status='paid'
    WHERE id=v_charge.transaction_id AND company_id=v_company;
  END IF;

  INSERT INTO public.payment_reconciliations(
    company_id,charge_id,transaction_id,amount,paid_at,reconciled_by
  ) VALUES(
    v_company,v_charge.id,v_charge.transaction_id,v_charge.amount,coalesce(p_paid_at,now()),auth.uid()
  )
  ON CONFLICT(charge_id) DO NOTHING;

  RETURN v_charge.id;
END $$;

REVOKE ALL ON FUNCTION public.confirm_billing_charge_payment(uuid,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.confirm_billing_charge_payment(uuid,timestamptz) TO authenticated;

NOTIFY pgrst,'reload schema';
