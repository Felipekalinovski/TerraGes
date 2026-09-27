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
  SET status='ready',error_message=NULL
  WHERE id=p_document_id
    AND company_id=v_company
    AND document_type='deferred'
    AND status='deferred'
  RETURNING service_order_id INTO v_order;

  IF NOT FOUND THEN RAISE EXCEPTION 'deferred_document_not_resumable'; END IF;
  IF v_order IS NOT NULL THEN
    UPDATE public.service_orders SET billing_document_status='ready'
    WHERE id=v_order AND company_id=v_company;
  END IF;
  RETURN p_document_id;
END $$;

REVOKE ALL ON FUNCTION public.resume_deferred_billing_document(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.resume_deferred_billing_document(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';