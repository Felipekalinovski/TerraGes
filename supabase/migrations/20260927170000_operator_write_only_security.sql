-- TerraGes operator write-only security boundary.
-- Operators can submit field facts but cannot read company/financial/operational history.
-- Managers/admins review submissions, define commercial values and continue billing.

CREATE TABLE IF NOT EXISTS public.field_service_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company_info(id) ON DELETE CASCADE,
  submitted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  source text NOT NULL DEFAULT 'app' CHECK (source IN ('app','whatsapp','import')),
  service_date date NOT NULL,
  client_name text NOT NULL,
  location text,
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE RESTRICT,
  start_meter numeric NOT NULL,
  end_meter numeric NOT NULL,
  total_hours numeric GENERATED ALWAYS AS (end_meter - start_meter) STORED,
  description text NOT NULL,
  occurrences text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','converted','rejected')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  service_order_id uuid REFERENCES public.service_orders(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (length(trim(client_name)) BETWEEN 1 AND 200),
  CHECK (length(trim(description)) BETWEEN 1 AND 4000),
  CHECK (start_meter >= 0 AND start_meter <= 10000000),
  CHECK (end_meter > start_meter AND end_meter - start_meter <= 24)
);

ALTER TABLE public.field_service_entries ENABLE ROW LEVEL SECURITY;
GRANT INSERT, SELECT, UPDATE, DELETE ON public.field_service_entries TO authenticated;

CREATE INDEX IF NOT EXISTS field_service_entries_company_created_idx
  ON public.field_service_entries(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS field_service_entries_submitted_by_idx
  ON public.field_service_entries(submitted_by);
CREATE INDEX IF NOT EXISTS field_service_entries_machine_idx
  ON public.field_service_entries(machine_id);
CREATE INDEX IF NOT EXISTS field_service_entries_status_idx
  ON public.field_service_entries(company_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION private."current_role"()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT m.role
  FROM private.tenant_memberships m
  WHERE m.user_id=(SELECT auth.uid())
    AND m.active
    AND m.company_id=private.current_company()
  LIMIT 1
$function$
;

CREATE OR REPLACE FUNCTION private.is_operator()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT coalesce(private.current_role() IN ('operator','operador'),false)
$function$
;

CREATE OR REPLACE FUNCTION private.can_submit_machine(mid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT EXISTS(
    SELECT 1
    FROM public.machines m
    WHERE m.id=mid
      AND m.company_id=private.current_company()
      AND (
        private.is_manager()
        OR m.user_id=(SELECT auth.uid())
        OR EXISTS(
          SELECT 1 FROM public.machine_assignments a
          WHERE a.machine_id=m.id
            AND a.user_id=(SELECT auth.uid())
            AND a.company_id=m.company_id
        )
      )
  )
$function$
;

DROP POLICY IF EXISTS field_entry_insert ON public.field_service_entries;
DROP POLICY IF EXISTS field_entry_manager_read ON public.field_service_entries;
DROP POLICY IF EXISTS field_entry_manager_update ON public.field_service_entries;
DROP POLICY IF EXISTS field_entry_manager_delete ON public.field_service_entries;

CREATE POLICY field_entry_insert ON public.field_service_entries
FOR INSERT TO authenticated
WITH CHECK (
  company_id=(SELECT private.current_company())
  AND submitted_by=(SELECT auth.uid())
  AND ((SELECT private.is_manager()) OR (SELECT private.is_operator()))
  AND private.can_submit_machine(machine_id)
);
CREATE POLICY field_entry_manager_read ON public.field_service_entries
FOR SELECT TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY field_entry_manager_update ON public.field_service_entries
FOR UPDATE TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()))
WITH CHECK (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY field_entry_manager_delete ON public.field_service_entries
FOR DELETE TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));

CREATE TABLE IF NOT EXISTS public.manager_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company_info(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'field_entry',
  title text NOT NULL,
  message text NOT NULL,
  field_entry_id uuid REFERENCES public.field_service_entries(id) ON DELETE CASCADE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manager_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.manager_notifications FROM anon, authenticated;
GRANT SELECT ON public.manager_notifications TO authenticated;
GRANT UPDATE (read_at) ON public.manager_notifications TO authenticated;

CREATE INDEX IF NOT EXISTS manager_notifications_recipient_idx
  ON public.manager_notifications(recipient_user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS manager_notifications_company_idx
  ON public.manager_notifications(company_id, created_at DESC);

DROP POLICY IF EXISTS manager_notification_read ON public.manager_notifications;
DROP POLICY IF EXISTS manager_notification_mark_read ON public.manager_notifications;
CREATE POLICY manager_notification_read ON public.manager_notifications
FOR SELECT TO authenticated
USING (
  recipient_user_id=(SELECT auth.uid())
  AND company_id=(SELECT private.current_company())
  AND (SELECT private.is_manager())
);
CREATE POLICY manager_notification_mark_read ON public.manager_notifications
FOR UPDATE TO authenticated
USING (
  recipient_user_id=(SELECT auth.uid())
  AND company_id=(SELECT private.current_company())
  AND (SELECT private.is_manager())
)
WITH CHECK (
  recipient_user_id=(SELECT auth.uid())
  AND company_id=(SELECT private.current_company())
  AND (SELECT private.is_manager())
);

CREATE OR REPLACE FUNCTION private.notify_managers_field_entry()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_machine text;
BEGIN
  SELECT m.name INTO v_machine
  FROM public.machines m
  WHERE m.id=NEW.machine_id AND m.company_id=NEW.company_id;

  INSERT INTO public.manager_notifications(
    company_id,recipient_user_id,type,title,message,field_entry_id
  )
  SELECT
    NEW.company_id,
    tm.user_id,
    'field_entry',
    'Novo registro de campo',
    left(
      'Operador enviou dados do serviço de '||NEW.client_name||
      coalesce(' · Máquina: '||v_machine,'')||
      ' · '||NEW.total_hours::text||' h. Revisar para faturamento.',
      1000
    ),
    NEW.id
  FROM private.tenant_memberships tm
  WHERE tm.company_id=NEW.company_id
    AND tm.active
    AND tm.role IN ('admin','gestor');

  RETURN NEW;
END
$function$
;

DROP TRIGGER IF EXISTS trg_notify_managers_field_entry ON public.field_service_entries;
CREATE TRIGGER trg_notify_managers_field_entry
AFTER INSERT ON public.field_service_entries
FOR EACH ROW EXECUTE FUNCTION private.notify_managers_field_entry();

CREATE OR REPLACE FUNCTION private.get_operator_machine_options()
 RETURNS TABLE(id uuid, name text, type text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT m.id,m.name,m.type
  FROM public.machines m
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND m.company_id=private.current_company()
    AND (
      private.is_manager()
      OR m.user_id=(SELECT auth.uid())
      OR EXISTS(
        SELECT 1 FROM public.machine_assignments a
        WHERE a.machine_id=m.id
          AND a.user_id=(SELECT auth.uid())
          AND a.company_id=m.company_id
      )
    )
  ORDER BY m.name
$function$
;
REVOKE ALL ON FUNCTION private.get_operator_machine_options() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.get_operator_machine_options() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_operator_machine_options()
 RETURNS TABLE(id uuid, name text, type text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  SELECT * FROM private.get_operator_machine_options()
$function$
;
REVOKE ALL ON FUNCTION public.get_operator_machine_options() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_operator_machine_options() TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_field_service_entry(p_service_date date, p_client_name text, p_location text, p_machine_id uuid, p_start_meter numeric, p_end_meter numeric, p_description text, p_occurrences text DEFAULT NULL::text, p_source text DEFAULT 'app'::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING ERRCODE='42501';
  END IF;
  IF NOT (private.is_manager() OR private.is_operator()) THEN
    RAISE EXCEPTION 'field_entry_not_allowed' USING ERRCODE='42501';
  END IF;
  IF p_source NOT IN ('app','whatsapp','import') THEN
    RAISE EXCEPTION 'invalid_source';
  END IF;
  IF p_service_date IS NULL OR p_service_date<'2000-01-01' OR p_service_date>current_date+1 THEN
    RAISE EXCEPTION 'invalid_service_date';
  END IF;
  IF length(trim(coalesce(p_client_name,''))) NOT BETWEEN 1 AND 200
     OR length(trim(coalesce(p_description,''))) NOT BETWEEN 1 AND 4000 THEN
    RAISE EXCEPTION 'invalid_field_text';
  END IF;
  IF p_start_meter IS NULL OR p_end_meter IS NULL OR p_start_meter<0
     OR p_end_meter<=p_start_meter OR p_end_meter-p_start_meter>24 THEN
    RAISE EXCEPTION 'invalid_meter_range';
  END IF;

  INSERT INTO public.field_service_entries(
    company_id,submitted_by,source,service_date,client_name,location,machine_id,
    start_meter,end_meter,description,occurrences
  ) VALUES(
    private.current_company(),auth.uid(),p_source,p_service_date,trim(p_client_name),
    nullif(trim(coalesce(p_location,'')),''),
    p_machine_id,p_start_meter,p_end_meter,trim(p_description),
    nullif(trim(coalesce(p_occurrences,'')),'')
  );

  RETURN true;
END
$function$
;
REVOKE ALL ON FUNCTION public.submit_field_service_entry(date,text,text,uuid,numeric,numeric,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_field_service_entry(date,text,text,uuid,numeric,numeric,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.convert_field_entry_to_service_order(p_entry_id uuid, p_hourly_rate numeric, p_billing_document_type text DEFAULT 'accountant'::text, p_payment_method text DEFAULT 'Faturado'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_company uuid;
  v_entry public.field_service_entries%rowtype;
  v_operator_id uuid;
  v_order uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_manager() THEN
    RAISE EXCEPTION 'manager_required' USING ERRCODE='42501';
  END IF;
  IF p_hourly_rate IS NULL OR p_hourly_rate<0 OR p_hourly_rate>1000000 THEN
    RAISE EXCEPTION 'invalid_hourly_rate';
  END IF;
  IF p_billing_document_type NOT IN ('accountant','receipt','deferred') THEN
    RAISE EXCEPTION 'invalid_billing_document_type';
  END IF;
  IF p_payment_method NOT IN ('Pix','Cartão','Boleto','Faturado','Dinheiro') THEN
    RAISE EXCEPTION 'invalid_payment_method';
  END IF;

  v_company:=private.current_company();

  SELECT * INTO v_entry
  FROM public.field_service_entries
  WHERE id=p_entry_id
    AND company_id=v_company
    AND status='submitted'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'field_entry_not_available';
  END IF;

  SELECT e.id INTO v_operator_id
  FROM public.employees e
  WHERE e.company_id=v_company
    AND e.user_id=v_entry.submitted_by
  ORDER BY e.created_at
  LIMIT 1;

  INSERT INTO public.service_orders(
    date,client,machine_id,operator_id,start_hour,end_hour,hourly_rate,
    payment_method,description,status,billing_document_type,user_id,company_id,location
  ) VALUES(
    v_entry.service_date,v_entry.client_name,v_entry.machine_id,v_operator_id,
    v_entry.start_meter,v_entry.end_meter,p_hourly_rate,p_payment_method,
    concat_ws(E'\n',v_entry.description,
      CASE WHEN nullif(trim(coalesce(v_entry.occurrences,'')),'') IS NOT NULL
        THEN 'Ocorrências: '||v_entry.occurrences END),
    'completed',p_billing_document_type,auth.uid(),v_company,v_entry.location
  )
  RETURNING id INTO v_order;

  UPDATE public.field_service_entries
  SET status='converted',
      reviewed_by=auth.uid(),
      reviewed_at=now(),
      service_order_id=v_order,
      updated_at=now()
  WHERE id=v_entry.id;

  UPDATE public.manager_notifications
  SET read_at=coalesce(read_at,now())
  WHERE field_entry_id=v_entry.id
    AND recipient_user_id=auth.uid()
    AND company_id=v_company;

  RETURN v_order;
END
$function$
;
REVOKE ALL ON FUNCTION public.convert_field_entry_to_service_order(uuid,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.convert_field_entry_to_service_order(uuid,numeric,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.reject_field_service_entry(p_entry_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_company uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_manager() THEN
    RAISE EXCEPTION 'manager_required' USING ERRCODE='42501';
  END IF;
  v_company:=private.current_company();

  UPDATE public.field_service_entries
  SET status='rejected',
      occurrences=CASE
        WHEN nullif(trim(coalesce(p_reason,'')),'') IS NULL THEN occurrences
        ELSE concat_ws(E'\n',occurrences,'Rejeitado pelo gestor: '||left(trim(p_reason),1000))
      END,
      reviewed_by=auth.uid(),
      reviewed_at=now(),
      updated_at=now()
  WHERE id=p_entry_id AND company_id=v_company AND status='submitted';

  IF NOT FOUND THEN RAISE EXCEPTION 'field_entry_not_available'; END IF;

  UPDATE public.manager_notifications
  SET read_at=coalesce(read_at,now())
  WHERE field_entry_id=p_entry_id
    AND recipient_user_id=auth.uid()
    AND company_id=v_company;

  RETURN true;
END
$function$
;
REVOKE ALL ON FUNCTION public.reject_field_service_entry(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reject_field_service_entry(uuid,text) TO authenticated;

-- Company information and operational/financial data are manager/admin read-only surfaces.
DROP POLICY IF EXISTS own_company ON public.company_info;
CREATE POLICY own_company ON public.company_info
FOR SELECT TO authenticated
USING (id=(SELECT private.current_company()) AND (SELECT private.is_manager()));

DROP POLICY IF EXISTS tenant_read ON public.service_orders;
DROP POLICY IF EXISTS tenant_insert ON public.service_orders;
DROP POLICY IF EXISTS tenant_update ON public.service_orders;
DROP POLICY IF EXISTS tenant_delete ON public.service_orders;
CREATE POLICY tenant_read ON public.service_orders FOR SELECT TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_insert ON public.service_orders FOR INSERT TO authenticated
WITH CHECK (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_update ON public.service_orders FOR UPDATE TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()))
WITH CHECK (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_delete ON public.service_orders FOR DELETE TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));

DROP POLICY IF EXISTS tenant_read ON public.rdos;
DROP POLICY IF EXISTS tenant_update ON public.rdos;
DROP POLICY IF EXISTS tenant_delete ON public.rdos;
CREATE POLICY tenant_read ON public.rdos FOR SELECT TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_update ON public.rdos FOR UPDATE TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()))
WITH CHECK (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_delete ON public.rdos FOR DELETE TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));

DROP POLICY IF EXISTS tenant_read ON public.hora_maquina;
DROP POLICY IF EXISTS tenant_insert ON public.hora_maquina;
DROP POLICY IF EXISTS tenant_update ON public.hora_maquina;
DROP POLICY IF EXISTS tenant_delete ON public.hora_maquina;
CREATE POLICY tenant_read ON public.hora_maquina FOR SELECT TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_insert ON public.hora_maquina FOR INSERT TO authenticated
WITH CHECK (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_update ON public.hora_maquina FOR UPDATE TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()))
WITH CHECK (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_delete ON public.hora_maquina FOR DELETE TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));

DROP POLICY IF EXISTS tenant_read ON public.machines;
DROP POLICY IF EXISTS tenant_update ON public.machines;
DROP POLICY IF EXISTS tenant_delete ON public.machines;
CREATE POLICY tenant_read ON public.machines FOR SELECT TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_update ON public.machines FOR UPDATE TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()))
WITH CHECK (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_delete ON public.machines FOR DELETE TO authenticated
USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'chat_memories','insights','machine_assignments','machine_impact','pending_actions',
    'rdo_ai_analysis','rdo_tags','whatsapp_conversations','whatsapp_drafts',
    'whatsapp_inbound_events','whatsapp_messages'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS tenant_read ON public.%I',t);
    EXECUTE format(
      'CREATE POLICY tenant_read ON public.%I FOR SELECT TO authenticated USING (company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()))',
      t
    );
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.run_whatsapp_operational_query(p_event_id uuid, p_query_type text, p_machine_query text DEFAULT NULL::text, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_limit integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
 c jsonb; company uuid; role_name text; q text:=left(trim(coalesce(p_machine_query,'')),100);
 start_on date:=coalesce(p_start_date,current_date-30);
 end_on date:=coalesce(p_end_date,current_date);
 row_limit integer:=greatest(1,least(coalesce(p_limit,10),10));
 rows jsonb;
BEGIN
 IF p_query_type NOT IN ('machine_status','maintenance_alerts','open_service_orders','recent_rdos','expense_summary','financial_summary') THEN
  RAISE EXCEPTION 'unsupported_query_type' USING ERRCODE='22023';
 END IF;
 c:=public.get_whatsapp_action_context(p_event_id);
 company:=(c->>'company_id')::uuid;
 role_name:=c->>'role';

 IF role_name NOT IN ('admin','gestor') THEN
  RAISE EXCEPTION 'operator_read_forbidden' USING ERRCODE='42501';
 END IF;

 IF start_on<'2000-01-01' OR end_on<start_on OR end_on>current_date+1 OR end_on-start_on>366 THEN
  RAISE EXCEPTION 'invalid_query_period' USING ERRCODE='22023';
 END IF;

 IF p_query_type='machine_status' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name',z.name,'type',z.type,'status',z.status,'hours',z.hours,
    'next_maintenance',z.next_maintenance,'last_maintenance',z.last_maintenance,
    'health_status',z.health_status,'health_reason',z.health_reason
  )),'[]'::jsonb) INTO rows
  FROM (
    SELECT x.name,x.type,x.status,x.hours,x.next_maintenance,x.last_maintenance,x.health_status,x.health_reason
    FROM public.machines x
    WHERE x.company_id=company
      AND (q='' OR lower(x.name) LIKE '%'||lower(q)||'%')
    ORDER BY x.name LIMIT row_limit
  ) z;
 ELSIF p_query_type='maintenance_alerts' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'machine',z.name,'type',z.type,'status',z.status,'hours',z.hours,
    'next_maintenance',z.next_maintenance,'health_status',z.health_status,'health_reason',z.health_reason
  )),'[]'::jsonb) INTO rows
  FROM (
    SELECT x.name,x.type,x.status,x.hours,x.next_maintenance,x.health_status,x.health_reason
    FROM public.machines x
    WHERE x.company_id=company AND x.next_maintenance IS NOT NULL AND x.next_maintenance<=current_date+30
    ORDER BY x.next_maintenance,x.name LIMIT row_limit
  ) z;
 ELSIF p_query_type='open_service_orders' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'date',z.date,'client',z.client,'machine',z.machine,'status',z.status,
    'location',z.location,'total_hours',z.total_hours,'total_value',z.total_value
  )),'[]'::jsonb) INTO rows
  FROM (
    SELECT s.date,s.client,m.name machine,s.status,s.location,s.total_hours,s.total_value
    FROM public.service_orders s
    LEFT JOIN public.machines m ON m.id=s.machine_id AND m.company_id=s.company_id
    WHERE s.company_id=company
      AND coalesce(lower(s.status),'pending') NOT IN ('completed','concluida','concluído','cancelled','cancelada')
    ORDER BY s.date DESC NULLS LAST,s.created_at DESC LIMIT row_limit
  ) z;
 ELSIF p_query_type='recent_rdos' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'date',z.date,'activity',z.activity,'project',z.project,
    'machines',z.machines,'status',z.status,'occurrences',z.occurrences
  )),'[]'::jsonb) INTO rows
  FROM (
    SELECT r.date::date,r.activity,r.project,r.machines,r.status,r.occurrences
    FROM public.rdos r
    WHERE r.company_id=company AND r.date::date BETWEEN start_on AND end_on
    ORDER BY r.date DESC LIMIT row_limit
  ) z;
 ELSIF p_query_type='expense_summary' THEN
  SELECT jsonb_build_object(
    'total',coalesce(sum(t.amount),0),'count',count(*),
    'by_category',coalesce((
      SELECT jsonb_object_agg(grouped.category,grouped.total)
      FROM (
        SELECT coalesce(nullif(x.category,''),'Sem categoria') category,sum(x.amount) total
        FROM public.transactions x
        WHERE x.company_id=company AND lower(x.type)='expense' AND x.date BETWEEN start_on AND end_on
        GROUP BY 1 ORDER BY total DESC LIMIT 10
      ) grouped
    ),'{}'::jsonb)
  ) INTO rows
  FROM public.transactions t
  WHERE t.company_id=company AND lower(t.type)='expense' AND t.date BETWEEN start_on AND end_on;
 ELSIF p_query_type='financial_summary' THEN
  SELECT jsonb_build_object(
    'income',coalesce(sum(t.amount) FILTER(WHERE lower(t.type)='income'),0),
    'expenses',coalesce(sum(t.amount) FILTER(WHERE lower(t.type)='expense'),0),
    'pending',coalesce(sum(t.amount) FILTER(WHERE lower(t.status)='pending'),0),
    'balance',coalesce(sum(CASE WHEN lower(t.type)='income' THEN t.amount WHEN lower(t.type)='expense' THEN -t.amount ELSE 0 END),0)
  ) INTO rows
  FROM public.transactions t
  WHERE t.company_id=company AND t.date BETWEEN start_on AND end_on;
 END IF;

 RETURN jsonb_build_object('query_type',p_query_type,'start_date',start_on,'end_date',end_on,'rows',coalesce(rows,'[]'::jsonb));
END
$function$
;

CREATE OR REPLACE FUNCTION public.prepare_whatsapp_action(p_event_id uuid, p_action_type text, p_slots jsonb, p_preview text, p_ready boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
 c jsonb; s private.whatsapp_action_sessions%rowtype; d public.whatsapp_drafts%rowtype;
 source_id uuid; v jsonb; kind text; mid uuid; role_name text; resolved_name text; resolved_hours numeric;
BEGIN
 IF p_action_type NOT IN ('create_rdo','update_machine_meter','create_expense','create_service_order','submit_field_service')
  OR jsonb_typeof(p_slots)<>'object' OR octet_length(p_slots::text)>20000
  OR length(p_preview) NOT BETWEEN 1 AND 4096 THEN
  RAISE EXCEPTION 'invalid_action_draft';
 END IF;

 c:=public.get_whatsapp_action_context(p_event_id); role_name:=c->>'role';

 SELECT * INTO s
 FROM private.whatsapp_action_sessions
 WHERE company_id=(c->>'company_id')::uuid
   AND user_id=(c->>'user_id')::uuid
   AND instance_name=c->>'instance_name'
   AND phone=c->>'phone'
   AND state IN ('collecting','awaiting_confirmation')
 FOR UPDATE;

 IF s.company_id IS NOT NULL AND s.action_type<>p_action_type THEN
  UPDATE public.whatsapp_drafts
  SET state='discarded',reviewed_by=(c->>'user_id')::uuid,updated_at=now()
  WHERE id=s.draft_id AND state='draft';
 END IF;

 source_id:=CASE WHEN s.company_id IS NOT NULL AND s.action_type=p_action_type THEN s.source_event_id ELSE p_event_id END;

 v:=CASE p_action_type
  WHEN 'create_rdo' THEN jsonb_strip_nulls(jsonb_build_object(
    'date',p_slots->'date','description',p_slots->'description',
    'machine_query',p_slots->'machine_query','machine_id',p_slots->'machine_id','machine_name',p_slots->'machine_name'
  ))
  WHEN 'update_machine_meter' THEN jsonb_strip_nulls(jsonb_build_object(
    'machine_query',p_slots->'machine_query','machine_id',p_slots->'machine_id',
    'machine_name',p_slots->'machine_name','meter_hours',p_slots->'meter_hours','current_meter_hours',p_slots->'current_meter_hours'
  ))
  WHEN 'create_expense' THEN jsonb_strip_nulls(jsonb_build_object(
    'date',p_slots->'date','description',p_slots->'description','amount',p_slots->'amount',
    'category',p_slots->'category','liters',p_slots->'liters','unit_price',p_slots->'unit_price'
  ))
  WHEN 'submit_field_service' THEN jsonb_strip_nulls(jsonb_build_object(
    'date',p_slots->'date','description',p_slots->'description','client',p_slots->'client',
    'location',p_slots->'location','occurrences',p_slots->'occurrences',
    'machine_query',p_slots->'machine_query','machine_id',p_slots->'machine_id','machine_name',p_slots->'machine_name',
    'start_hour',p_slots->'start_hour','end_hour',p_slots->'end_hour'
  ))
  ELSE jsonb_strip_nulls(jsonb_build_object(
    'date',p_slots->'date','description',p_slots->'description','client',p_slots->'client',
    'machine_query',p_slots->'machine_query','machine_id',p_slots->'machine_id','machine_name',p_slots->'machine_name',
    'start_hour',p_slots->'start_hour','end_hour',p_slots->'end_hour',
    'hourly_rate',p_slots->'hourly_rate','billing_document_type',p_slots->'billing_document_type'
  ))
 END;

 IF p_action_type IN ('create_expense','create_service_order','update_machine_meter') AND role_name NOT IN ('admin','gestor') THEN
  RAISE EXCEPTION 'manager_required' USING ERRCODE='42501';
 END IF;
 IF p_action_type='submit_field_service' AND role_name NOT IN ('operator','operador','admin','gestor') THEN
  RAISE EXCEPTION 'operator_or_manager_required' USING ERRCODE='42501';
 END IF;

 IF v ? 'machine_id' THEN
  mid:=(v->>'machine_id')::uuid;
  IF NOT EXISTS(
    SELECT 1 FROM public.machines x
    WHERE x.id=mid
      AND x.company_id=(c->>'company_id')::uuid
      AND (
        role_name IN ('admin','gestor')
        OR x.user_id=(c->>'user_id')::uuid
        OR EXISTS(
          SELECT 1 FROM public.machine_assignments a
          WHERE a.machine_id=x.id AND a.user_id=(c->>'user_id')::uuid AND a.company_id=x.company_id
        )
      )
  ) THEN
    RAISE EXCEPTION 'machine_not_assigned' USING ERRCODE='42501';
  END IF;
  SELECT x.name,x.hours INTO resolved_name,resolved_hours
  FROM public.machines x
  WHERE x.id=mid AND x.company_id=(c->>'company_id')::uuid;
  v:=v||jsonb_build_object('machine_name',resolved_name,'current_meter_hours',coalesce(resolved_hours,0));
 END IF;

 IF p_ready THEN
  IF p_action_type='create_rdo' AND (
    coalesce(v->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    OR length(trim(coalesce(v->>'description',''))) NOT BETWEEN 1 AND 4000
    OR mid IS NULL
  ) THEN RAISE EXCEPTION 'invalid_rdo'; END IF;

  IF p_action_type='update_machine_meter' AND (
    mid IS NULL
    OR coalesce(v->>'meter_hours','') !~ '^[0-9]+([.][0-9]{1,2})?$'
    OR (v->>'meter_hours')::numeric>10000000
  ) THEN RAISE EXCEPTION 'invalid_machine_meter'; END IF;

  IF p_action_type='create_expense' AND (
    coalesce(v->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    OR length(trim(coalesce(v->>'description',''))) NOT BETWEEN 1 AND 4000
    OR coalesce(v->>'amount','') !~ '^[0-9]+([.][0-9]{1,2})?$'
    OR (v->>'amount')::numeric<=0 OR (v->>'amount')::numeric>100000000
  ) THEN RAISE EXCEPTION 'invalid_expense'; END IF;

  IF p_action_type='submit_field_service' AND (
    coalesce(v->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    OR length(trim(coalesce(v->>'description',''))) NOT BETWEEN 1 AND 4000
    OR length(trim(coalesce(v->>'client',''))) NOT BETWEEN 1 AND 200
    OR mid IS NULL
    OR coalesce(v->>'start_hour','') !~ '^[0-9]+([.][0-9]{1,2})?$'
    OR coalesce(v->>'end_hour','') !~ '^[0-9]+([.][0-9]{1,2})?$'
    OR (v->>'end_hour')::numeric <= (v->>'start_hour')::numeric
    OR (v->>'end_hour')::numeric - (v->>'start_hour')::numeric > 24
  ) THEN RAISE EXCEPTION 'invalid_field_service'; END IF;

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

 kind:=CASE p_action_type
  WHEN 'create_rdo' THEN 'rdo'
  WHEN 'update_machine_meter' THEN 'machine_meter'
  WHEN 'create_expense' THEN 'expense'
  WHEN 'submit_field_service' THEN 'field_service'
  ELSE 'service_order'
 END;

 IF NOT p_ready AND s.draft_id IS NOT NULL THEN
  UPDATE public.whatsapp_drafts
  SET state='discarded',reviewed_by=(c->>'user_id')::uuid,version=version+1,updated_at=now()
  WHERE id=s.draft_id AND state='draft';
 END IF;

 IF p_ready THEN
  INSERT INTO public.whatsapp_drafts(event_id,company_id,user_id,kind,payload)
  VALUES(source_id,(c->>'company_id')::uuid,(c->>'user_id')::uuid,kind,v)
  ON CONFLICT(event_id) DO UPDATE
  SET kind=excluded.kind,payload=excluded.payload,state='draft',record_id=NULL,reviewed_by=NULL,
      version=public.whatsapp_drafts.version+1,updated_at=now()
  RETURNING * INTO d;
 END IF;

 INSERT INTO private.whatsapp_action_sessions(
  company_id,user_id,instance_name,phone,action_type,slots,state,source_event_id,draft_id,updated_at,expires_at
 )
 VALUES(
  (c->>'company_id')::uuid,(c->>'user_id')::uuid,c->>'instance_name',c->>'phone',
  p_action_type,v,CASE WHEN p_ready THEN 'awaiting_confirmation' ELSE 'collecting' END,
  source_id,CASE WHEN p_ready THEN d.id ELSE NULL END,now(),now()+interval '24 hours'
 )
 ON CONFLICT(company_id,user_id,instance_name,phone) DO UPDATE
 SET action_type=excluded.action_type,slots=excluded.slots,state=excluded.state,
     source_event_id=excluded.source_event_id,draft_id=excluded.draft_id,
     updated_at=now(),expires_at=excluded.expires_at
 RETURNING * INTO s;

 RETURN jsonb_build_object(
   'action_type',s.action_type,'state',s.state,'slots',s.slots,
   'draft_id',s.draft_id,'draft_version',d.version
 );
END
$function$
;

CREATE OR REPLACE FUNCTION public.confirm_whatsapp_action(p_event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
 c jsonb; s private.whatsapp_action_sessions%rowtype; d public.whatsapp_drafts%rowtype;
 v jsonb; rid uuid; mid uuid; machine_name text; current_hours numeric; new_hours numeric;
 dt date; n numeric; start_n numeric; end_n numeric; rate numeric; doc_type text; role_name text;
BEGIN
 c:=public.get_whatsapp_action_context(p_event_id); role_name:=c->>'role';

 SELECT * INTO s
 FROM private.whatsapp_action_sessions
 WHERE company_id=(c->>'company_id')::uuid
   AND user_id=(c->>'user_id')::uuid
   AND instance_name=c->>'instance_name'
   AND phone=c->>'phone'
   AND expires_at>now()
   AND (state='awaiting_confirmation' OR (state='complete' AND confirmation_event_id=p_event_id))
 FOR UPDATE;

 IF NOT FOUND THEN RAISE EXCEPTION 'action_confirmation_not_available'; END IF;

 SELECT * INTO d FROM public.whatsapp_drafts WHERE id=s.draft_id FOR UPDATE;
 IF d.state='confirmed' THEN
  RETURN jsonb_build_object('action_type',s.action_type,'record_id',d.record_id,'already_confirmed',true,'slots',d.payload);
 END IF;
 IF d.state<>'draft' OR d.company_id<>(c->>'company_id')::uuid OR d.user_id<>(c->>'user_id')::uuid THEN
  RAISE EXCEPTION 'invalid_action_draft';
 END IF;

 IF s.action_type IN ('create_expense','create_service_order','update_machine_meter') AND role_name NOT IN ('admin','gestor') THEN
  RAISE EXCEPTION 'manager_required' USING ERRCODE='42501';
 END IF;

 v:=d.payload; mid:=nullif(v->>'machine_id','')::uuid;
 IF mid IS NOT NULL THEN
  SELECT name,hours INTO machine_name,current_hours
  FROM public.machines
  WHERE id=mid AND company_id=d.company_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'machine_not_available'; END IF;
 END IF;

 IF s.action_type='create_rdo' THEN
  dt:=(v->>'date')::date;
  IF dt<'2000-01-01' OR dt>current_date+1 THEN RAISE EXCEPTION 'invalid_date'; END IF;
  INSERT INTO public.rdos(date,activities,description,machine_ids,machines,user_id,company_id,created_by)
  VALUES(dt::timestamp AT TIME ZONE 'America/Sao_Paulo',v->>'description',v->>'description',ARRAY[mid],ARRAY[machine_name],d.user_id,d.company_id,d.user_id)
  RETURNING id INTO rid;

 ELSIF s.action_type='submit_field_service' THEN
  dt:=(v->>'date')::date;
  start_n:=(v->>'start_hour')::numeric;
  end_n:=(v->>'end_hour')::numeric;
  IF dt<'2000-01-01' OR dt>current_date+1 OR start_n<0 OR end_n<=start_n OR end_n-start_n>24 THEN
    RAISE EXCEPTION 'invalid_field_service';
  END IF;
  INSERT INTO public.field_service_entries(
    company_id,submitted_by,source,service_date,client_name,location,machine_id,
    start_meter,end_meter,description,occurrences
  ) VALUES(
    d.company_id,d.user_id,'whatsapp',dt,v->>'client',nullif(v->>'location',''),mid,
    start_n,end_n,v->>'description',nullif(v->>'occurrences','')
  )
  RETURNING id INTO rid;

 ELSIF s.action_type='update_machine_meter' THEN
  new_hours:=(v->>'meter_hours')::numeric;
  IF new_hours<coalesce(current_hours,0) OR new_hours-coalesce(current_hours,0)>1000 THEN
    RAISE EXCEPTION 'invalid_meter_progression';
  END IF;
  UPDATE public.machines SET hours=new_hours
  WHERE id=mid AND company_id=d.company_id
  RETURNING id INTO rid;

 ELSIF s.action_type='create_expense' THEN
  dt:=(v->>'date')::date; n:=(v->>'amount')::numeric;
  IF dt<'2000-01-01' OR dt>current_date+1 OR n<=0 OR n>100000000 OR scale(n)>2 THEN
    RAISE EXCEPTION 'invalid_expense';
  END IF;
  INSERT INTO public.transactions(title,date,amount,type,status,category,user_id,company_id)
  VALUES(left(v->>'description',4000),dt,n,'expense','pending',left(coalesce(nullif(v->>'category',''),'Outros'),100),d.user_id,d.company_id)
  RETURNING id INTO rid;

 ELSE
  dt:=(v->>'date')::date;
  start_n:=(v->>'start_hour')::numeric;
  end_n:=(v->>'end_hour')::numeric;
  rate:=(v->>'hourly_rate')::numeric;
  doc_type:=v->>'billing_document_type';
  IF dt<'2000-01-01' OR dt>current_date+1 OR start_n<0 OR end_n<=start_n OR end_n-start_n>24
     OR rate<0 OR rate>1000000 OR doc_type NOT IN ('accountant','receipt','deferred') THEN
    RAISE EXCEPTION 'invalid_service_order';
  END IF;
  INSERT INTO public.service_orders(
    date,client,machine_id,start_hour,end_hour,hourly_rate,description,status,
    billing_document_type,user_id,company_id
  )
  VALUES(dt,v->>'client',mid,start_n,end_n,rate,v->>'description','pending',doc_type,d.user_id,d.company_id)
  RETURNING id INTO rid;
 END IF;

 UPDATE public.whatsapp_drafts
 SET state='confirmed',record_id=rid,reviewed_by=d.user_id,version=version+1,updated_at=now()
 WHERE id=d.id
 RETURNING * INTO d;

 UPDATE private.whatsapp_action_sessions
 SET state='complete',confirmation_event_id=p_event_id,updated_at=now()
 WHERE company_id=s.company_id AND user_id=s.user_id AND instance_name=s.instance_name AND phone=s.phone;

 INSERT INTO private.whatsapp_review_audit(draft_id,actor_id,action,version,payload)
 VALUES(d.id,d.user_id,'confirm_whatsapp',d.version,d.payload);

 RETURN jsonb_build_object(
   'action_type',s.action_type,'record_id',rid,'already_confirmed',false,
   'machine_name',machine_name,'slots',v
 );
END
$function$
;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime'
      AND schemaname='public'
      AND tablename='manager_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.manager_notifications;
  END IF;
END $$;

NOTIFY pgrst,'reload schema';
