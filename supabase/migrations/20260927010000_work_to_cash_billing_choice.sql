-- TerraGes Work-to-Cash foundation: service -> measurement -> document -> charge -> payment.
ALTER TABLE public.service_orders
  ADD COLUMN IF NOT EXISTS billing_document_type text NOT NULL DEFAULT 'receipt',
  ADD COLUMN IF NOT EXISTS billing_document_status text NOT NULL DEFAULT 'not_issued';

ALTER TABLE public.service_orders DROP CONSTRAINT IF EXISTS service_orders_billing_document_type_check;
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_billing_document_type_check
  CHECK (billing_document_type IN ('nfse','receipt','deferred'));
ALTER TABLE public.service_orders DROP CONSTRAINT IF EXISTS service_orders_billing_document_status_check;
ALTER TABLE public.service_orders ADD CONSTRAINT service_orders_billing_document_status_check
  CHECK (billing_document_status IN ('not_issued','awaiting_approval','ready','issued','deferred','cancelled','error'));

CREATE TABLE IF NOT EXISTS public.service_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company_info(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES auth.users(id),
  client text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','billed','cancelled')),
  total_value numeric NOT NULL DEFAULT 0 CHECK (total_value >= 0),
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (period_end >= period_start)
);

CREATE TABLE IF NOT EXISTS public.service_measurement_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  measurement_id uuid NOT NULL REFERENCES public.service_measurements(id) ON DELETE CASCADE,
  service_order_id uuid NOT NULL UNIQUE REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL REFERENCES public.company_info(id) ON DELETE RESTRICT,
  amount numeric NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.billing_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company_info(id) ON DELETE RESTRICT,
  service_order_id uuid REFERENCES public.service_orders(id) ON DELETE RESTRICT,
  measurement_id uuid REFERENCES public.service_measurements(id) ON DELETE RESTRICT,
  document_type text NOT NULL CHECK (document_type IN ('nfse','receipt','deferred')),
  status text NOT NULL DEFAULT 'awaiting_approval'
    CHECK (status IN ('awaiting_approval','ready','issued','deferred','cancelled','error')),
  amount numeric NOT NULL CHECK (amount >= 0),
  document_number text,
  provider text,
  external_id text,
  pdf_path text,
  xml_path text,
  issued_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((service_order_id IS NOT NULL)::int + (measurement_id IS NOT NULL)::int = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS billing_documents_service_order_unique
  ON public.billing_documents(service_order_id) WHERE service_order_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.billing_charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company_info(id) ON DELETE RESTRICT,
  billing_document_id uuid REFERENCES public.billing_documents(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE RESTRICT,
  client text NOT NULL,
  amount numeric NOT NULL CHECK (amount >= 0),
  due_date date,
  method text CHECK (method IS NULL OR method IN ('pix','boleto','transferencia','dinheiro','cartao','outro')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','paid','overdue','cancelled')),
  provider text,
  external_id text,
  pix_copy_paste text,
  payment_url text,
  sent_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payment_reconciliations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company_info(id) ON DELETE RESTRICT,
  charge_id uuid NOT NULL UNIQUE REFERENCES public.billing_charges(id) ON DELETE RESTRICT,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE RESTRICT,
  amount numeric NOT NULL CHECK (amount >= 0),
  paid_at timestamptz NOT NULL,
  provider_reference text,
  reconciled_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.service_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_measurement_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reconciliations ENABLE ROW LEVEL SECURITY;

DO $$ DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['service_measurements','service_measurement_items','billing_documents','billing_charges','payment_reconciliations'] LOOP
  EXECUTE format('DROP POLICY IF EXISTS tenant_read ON public.%I',t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_insert ON public.%I',t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_update ON public.%I',t);
  EXECUTE format('DROP POLICY IF EXISTS tenant_delete ON public.%I',t);
  EXECUTE format('CREATE POLICY tenant_read ON public.%I FOR SELECT TO authenticated USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()))',t);
  EXECUTE format('CREATE POLICY tenant_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()))',t);
  EXECUTE format('CREATE POLICY tenant_update ON public.%I FOR UPDATE TO authenticated USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager())) WITH CHECK (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()))',t);
  EXECUTE format('CREATE POLICY tenant_delete ON public.%I FOR DELETE TO authenticated USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()))',t);
 END LOOP;
END $$;

-- Completed orders freeze the document choice too.
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
   OR NEW.billing_document_type NOT IN ('nfse','receipt','deferred')
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
    'date',NEW.date,'client',NEW.client,'machine_id',NEW.machine_id,'start_hour',NEW.start_hour,'end_hour',NEW.end_hour,
    'hourly_rate',NEW.hourly_rate,'total_value',NEW.total_value,'owner_id',NEW.user_id,'billing_document_type',NEW.billing_document_type))
   ON CONFLICT(service_order_id) DO NOTHING RETURNING service_order_id INTO claimed;

  IF claimed IS NOT NULL THEN
   INSERT INTO public.transactions(title,amount,type,category,date,status,user_id,company_id)
    VALUES('Serviço #'||substring(NEW.id::text,1,8)||' - '||NEW.client,NEW.total_value,'income','Serviços',NEW.date,
     'pending',coalesce(auth.uid(),NEW.user_id),NEW.company_id) RETURNING id INTO txid;
   UPDATE private.service_order_settlements SET transaction_id=txid WHERE service_order_id=NEW.id;

   docstatus := CASE NEW.billing_document_type
     WHEN 'nfse' THEN 'awaiting_approval'
     WHEN 'receipt' THEN 'ready'
     ELSE 'deferred'
   END;
   INSERT INTO public.billing_documents(company_id,service_order_id,document_type,status,amount)
   VALUES(NEW.company_id,NEW.id,NEW.billing_document_type,docstatus,NEW.total_value)
   ON CONFLICT DO NOTHING;

   UPDATE public.service_orders
      SET billing_document_status=CASE NEW.billing_document_type
        WHEN 'nfse' THEN 'awaiting_approval'
        WHEN 'receipt' THEN 'ready'
        ELSE 'deferred'
      END
    WHERE id=NEW.id;
  END IF;
 END IF;
 RETURN NEW;
END $$;

INSERT INTO public.agent_module_knowledge(
 module_key,module_name,purpose,source_tables,required_fields,optional_fields,generated_fields,states,permissions,business_rules,agent_actions,aliases,knowledge_version,active
) VALUES (
 'faturamento_cobranca','Faturamento e cobrança',
 'Transforma serviços concluídos em documento, cobrança e recebimento com aprovação humana para emissão fiscal.',
 ARRAY['service_orders','service_measurements','service_measurement_items','billing_documents','billing_charges','payment_reconciliations','transactions'],
 '[{"name":"service_order_id","type":"uuid_reference","reference":"service_orders"},{"name":"billing_document_type","type":"enum","values":["nfse","receipt","deferred"]}]'::jsonb,
 '[{"name":"due_date","type":"date"},{"name":"charge_method","type":"enum","values":["pix","boleto","transferencia","dinheiro","cartao","outro"]}]'::jsonb,
 '[{"name":"company_id","source":"verified_membership"},{"name":"amount","source":"service_order_total"},{"name":"billing_document_status","source":"workflow"}]'::jsonb,
 '{"document_type":{"nfse":"Emitir NFS-e após aprovação","receipt":"Gerar OS/recibo sem NFS-e","deferred":"Faturar depois"},"document_status":{"awaiting_approval":"Aguardando aprovação fiscal","ready":"Documento interno pronto","issued":"Emitido","deferred":"Faturamento adiado","error":"Erro"}}'::jsonb,
 '{"read":["admin","gestor"],"create":["admin","gestor"],"approve_nfse":["admin","gestor"],"charge":["admin","gestor"],"reconcile":["admin","gestor"]}'::jsonb,
 '[
  "Nunca inferir que todo serviço exige NFS-e. Cada serviço deve usar a escolha nfse, receipt ou deferred.",
  "OS/recibo registra a execução do serviço e não substitui documento fiscal quando a legislação aplicável exigir NFS-e.",
  "Nunca emitir NFS-e sem aprovação explícita de administrador ou gestor e sem conector fiscal configurado.",
  "A IA interpreta intenção e prepara dados; valores, vencimentos, impostos e emissão são executados por regras determinísticas e integrações.",
  "Se o usuário disser que é um serviço pequeno e não quer NF, oferecer receipt; se quiser decidir depois, usar deferred.",
  "Pagamento só vira recebido após confirmação ou conciliação; gerar cobrança não marca a receita como paga."
 ]'::jsonb,
 '[
  {"mode":"read","action":"list_billable_services","manager_only":true},
  {"mode":"confirmed_write","action":"choose_billing_document","manager_only":true},
  {"mode":"confirmed_write","action":"approve_nfse","manager_only":true},
  {"mode":"confirmed_write","action":"create_charge","manager_only":true},
  {"mode":"confirmed_write","action":"reconcile_payment","manager_only":true}
 ]'::jsonb,
 ARRAY['faturar','faturamento','nota fiscal','nfse','nfs-e','recibo','cobrança','cobranca','medição','medicao','receber','a receber'],
 1,true
)
ON CONFLICT(module_key) DO UPDATE SET
 module_name=EXCLUDED.module_name,purpose=EXCLUDED.purpose,source_tables=EXCLUDED.source_tables,
 required_fields=EXCLUDED.required_fields,optional_fields=EXCLUDED.optional_fields,generated_fields=EXCLUDED.generated_fields,
 states=EXCLUDED.states,permissions=EXCLUDED.permissions,business_rules=EXCLUDED.business_rules,agent_actions=EXCLUDED.agent_actions,
 aliases=EXCLUDED.aliases,knowledge_version=public.agent_module_knowledge.knowledge_version+1,active=true,updated_at=now();

NOTIFY pgrst,'reload schema';
