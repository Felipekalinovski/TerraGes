CREATE OR REPLACE FUNCTION public.save_client_billing_profile(p_client_id uuid, p_data jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path=''
AS $$
DECLARE
  v_company uuid;
  v_id uuid;
  v_name text;
  v_document_type text;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_manager() THEN
    RAISE EXCEPTION 'manager_required' USING ERRCODE='42501';
  END IF;
  IF jsonb_typeof(p_data)<>'object' OR octet_length(p_data::text)>20000 THEN
    RAISE EXCEPTION 'invalid_client_data';
  END IF;

  v_company:=private.current_company();
  v_name:=trim(coalesce(p_data->>'name',''));
  v_document_type:=nullif(trim(coalesce(p_data->>'document_type','')),'');

  IF length(v_name) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'invalid_client_name';
  END IF;
  IF v_document_type IS NOT NULL AND v_document_type NOT IN ('cpf','cnpj','other') THEN
    RAISE EXCEPTION 'invalid_client_document_type';
  END IF;

  IF p_client_id IS NULL THEN
    INSERT INTO public.clients(
      company_id,name,legal_name,document_type,document_number,email,phone,billing_email,billing_contact,
      address_line,address_number,address_complement,neighborhood,city,state,postal_code,notes,created_by
    ) VALUES (
      v_company,
      v_name,
      nullif(trim(coalesce(p_data->>'legal_name','')),''),
      v_document_type,
      nullif(trim(coalesce(p_data->>'document_number','')),''),
      nullif(trim(coalesce(p_data->>'email','')),''),
      nullif(trim(coalesce(p_data->>'phone','')),''),
      nullif(trim(coalesce(p_data->>'billing_email','')),''),
      nullif(trim(coalesce(p_data->>'billing_contact','')),''),
      nullif(trim(coalesce(p_data->>'address_line','')),''),
      nullif(trim(coalesce(p_data->>'address_number','')),''),
      nullif(trim(coalesce(p_data->>'address_complement','')),''),
      nullif(trim(coalesce(p_data->>'neighborhood','')),''),
      nullif(trim(coalesce(p_data->>'city','')),''),
      upper(nullif(trim(coalesce(p_data->>'state','')),'')),
      nullif(trim(coalesce(p_data->>'postal_code','')),''),
      nullif(trim(coalesce(p_data->>'notes','')),''),
      auth.uid()
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.clients SET
      name=v_name,
      legal_name=nullif(trim(coalesce(p_data->>'legal_name','')),''),
      document_type=v_document_type,
      document_number=nullif(trim(coalesce(p_data->>'document_number','')),''),
      email=nullif(trim(coalesce(p_data->>'email','')),''),
      phone=nullif(trim(coalesce(p_data->>'phone','')),''),
      billing_email=nullif(trim(coalesce(p_data->>'billing_email','')),''),
      billing_contact=nullif(trim(coalesce(p_data->>'billing_contact','')),''),
      address_line=nullif(trim(coalesce(p_data->>'address_line','')),''),
      address_number=nullif(trim(coalesce(p_data->>'address_number','')),''),
      address_complement=nullif(trim(coalesce(p_data->>'address_complement','')),''),
      neighborhood=nullif(trim(coalesce(p_data->>'neighborhood','')),''),
      city=nullif(trim(coalesce(p_data->>'city','')),''),
      state=upper(nullif(trim(coalesce(p_data->>'state','')),'')),
      postal_code=nullif(trim(coalesce(p_data->>'postal_code','')),''),
      notes=nullif(trim(coalesce(p_data->>'notes','')),''),
      updated_at=now()
    WHERE id=p_client_id AND company_id=v_company
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN RAISE EXCEPTION 'client_not_available'; END IF;
  END IF;

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.save_client_billing_profile(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_client_billing_profile(uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';