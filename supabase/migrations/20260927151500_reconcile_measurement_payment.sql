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
  v_measurement_id uuid;
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
  ELSE
    SELECT d.measurement_id INTO v_measurement_id
    FROM public.billing_documents d
    WHERE d.id=v_charge.billing_document_id
      AND d.company_id=v_company;

    IF v_measurement_id IS NOT NULL THEN
      UPDATE public.transactions t
      SET status='paid'
      FROM public.get_service_order_settlements() s
      JOIN public.service_measurement_items mi
        ON mi.service_order_id=s.service_order_id
       AND mi.company_id=v_company
      WHERE mi.measurement_id=v_measurement_id
        AND s.transaction_id=t.id
        AND t.company_id=v_company;
    END IF;
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