-- Tenant containment. Existing records without trustworthy ownership remain inaccessible.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;
CREATE TABLE private.tenant_memberships (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 company_id uuid REFERENCES public.company_info(id),
 role text NOT NULL CHECK (role IN ('admin','gestor','operator')),
 active boolean NOT NULL DEFAULT false,
 CHECK (NOT active OR company_id IS NOT NULL)
);
ALTER TABLE private.tenant_memberships ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.tenant_memberships FROM PUBLIC, anon, authenticated;
GRANT ALL ON private.tenant_memberships TO service_role;
-- Never infer company membership from email, phone, name or client-controlled metadata.
DROP TRIGGER IF EXISTS on_profile_updated ON public.profiles;
DO $backfill$
DECLARE p record; cid uuid;
BEGIN
 FOR p IN SELECT id,company_id,role FROM public.profiles LOOP
  cid := p.company_id;
  IF cid IS NULL AND p.role IN ('admin','gestor') THEN
   INSERT INTO public.company_info(name) VALUES ('Empresa — configuração pendente') RETURNING id INTO cid;
   UPDATE public.profiles SET company_id=cid WHERE id=p.id;
  END IF;
  INSERT INTO private.tenant_memberships(user_id,company_id,role,active)
  VALUES(p.id,cid,coalesce(p.role,'operator'),cid IS NOT NULL);
 END LOOP;
END $backfill$;
CREATE FUNCTION private.current_company() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.company_id FROM private.tenant_memberships m WHERE m.user_id=(SELECT auth.uid()) AND m.active AND auth.uid() IS NOT NULL
$$;
CREATE FUNCTION private.is_manager() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.tenant_memberships m WHERE m.user_id=(SELECT auth.uid()) AND m.active AND m.role IN ('admin','gestor'))
$$;
CREATE FUNCTION private.owner_company(uid uuid) RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.company_id FROM private.tenant_memberships m WHERE m.user_id=uid AND m.active
$$;
-- owner_company is internal only; exposing it would disclose membership.
REVOKE ALL ON FUNCTION private.owner_company(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.current_company(), private.is_manager() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.current_company(), private.is_manager() TO authenticated;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE cid uuid;
BEGIN
 INSERT INTO public.company_info(name) VALUES ('Empresa — configuração pendente') RETURNING id INTO cid;
 INSERT INTO public.profiles(id,email,name,role,company_id,permissions)
 VALUES(NEW.id,NEW.email,coalesce(NEW.raw_user_meta_data->>'name','Novo usuário'),'admin',cid,'{}');
 INSERT INTO private.tenant_memberships(user_id,company_id,role,active) VALUES(NEW.id,cid,'admin',true);
 RETURN NEW;
END $$;
-- Authoritative access never uses editable profiles.role/permissions or user_metadata.
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
UPDATE public.machines t SET company_id=private.owner_company(t.user_id) WHERE t.company_id IS NULL;
CREATE INDEX IF NOT EXISTS machines_tenant_owner_idx ON public.machines(company_id,user_id);
ALTER TABLE public.rdos ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
UPDATE public.rdos t SET company_id=private.owner_company(t.user_id) WHERE t.company_id IS NULL;
CREATE INDEX IF NOT EXISTS rdos_tenant_owner_idx ON public.rdos(company_id,user_id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
UPDATE public.transactions t SET company_id=private.owner_company(t.user_id) WHERE t.company_id IS NULL;
CREATE INDEX IF NOT EXISTS transactions_tenant_owner_idx ON public.transactions(company_id,user_id);
ALTER TABLE public.maintenance_records ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
UPDATE public.maintenance_records t SET company_id=private.owner_company(t.user_id) WHERE t.company_id IS NULL;
CREATE INDEX IF NOT EXISTS maintenance_records_tenant_owner_idx ON public.maintenance_records(company_id,user_id);
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
UPDATE public.schedules t SET company_id=private.owner_company(t.user_id) WHERE t.company_id IS NULL;
CREATE INDEX IF NOT EXISTS schedules_tenant_owner_idx ON public.schedules(company_id,user_id);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
UPDATE public.projects t SET company_id=private.owner_company(t.user_id) WHERE t.company_id IS NULL;
CREATE INDEX IF NOT EXISTS projects_tenant_owner_idx ON public.projects(company_id,user_id);
ALTER TABLE public.insights ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
UPDATE public.insights t SET company_id=private.owner_company(t.user_id) WHERE t.company_id IS NULL;
CREATE INDEX IF NOT EXISTS insights_tenant_owner_idx ON public.insights(company_id,user_id);
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
UPDATE public.employees t SET company_id=private.owner_company(t.user_id) WHERE t.company_id IS NULL;
CREATE INDEX IF NOT EXISTS employees_tenant_owner_idx ON public.employees(company_id,user_id);
ALTER TABLE public.service_orders ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
UPDATE public.service_orders t SET company_id=private.owner_company(t.user_id) WHERE t.company_id IS NULL;
CREATE INDEX IF NOT EXISTS service_orders_tenant_owner_idx ON public.service_orders(company_id,user_id);
ALTER TABLE public.orcamentos ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
UPDATE public.orcamentos t SET company_id=private.owner_company(t.user_id) WHERE t.company_id IS NULL;
CREATE INDEX IF NOT EXISTS orcamentos_tenant_owner_idx ON public.orcamentos(company_id,user_id);
ALTER TABLE public.hora_maquina ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
UPDATE public.hora_maquina t SET company_id=private.owner_company(t.user_id) WHERE t.company_id IS NULL;
CREATE INDEX IF NOT EXISTS hora_maquina_tenant_owner_idx ON public.hora_maquina(company_id,user_id);
ALTER TABLE public.chat_memories ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
UPDATE public.chat_memories t SET company_id=private.owner_company(t.user_id) WHERE t.company_id IS NULL;
CREATE INDEX IF NOT EXISTS chat_memories_tenant_owner_idx ON public.chat_memories(company_id,user_id);
-- Existing declarations that disagree with verified ownership are quarantined, never reassigned.
UPDATE public.employees SET company_id=NULL WHERE company_id IS NOT NULL AND private.owner_company(user_id) IS DISTINCT FROM company_id;
UPDATE public.insights SET company_id=NULL WHERE company_id IS NOT NULL AND private.owner_company(user_id) IS DISTINCT FROM company_id;
ALTER TABLE public.rdo_ai_analysis ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
ALTER TABLE public.rdo_ai_analysis ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
UPDATE public.rdo_ai_analysis t SET user_id=p.user_id,company_id=p.company_id FROM public.rdos p WHERE p.id=t.rdo_id;
ALTER TABLE public.rdo_tags ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
ALTER TABLE public.rdo_tags ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
UPDATE public.rdo_tags t SET user_id=p.user_id,company_id=p.company_id FROM public.rdos p WHERE p.id=t.rdo_id;
ALTER TABLE public.machine_impact ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
ALTER TABLE public.machine_impact ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
UPDATE public.machine_impact t SET user_id=p.user_id,company_id=p.company_id FROM public.rdos p WHERE p.id=t.rdo_id;
ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
ALTER TABLE public.whatsapp_conversations ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
UPDATE public.whatsapp_conversations t SET user_id=p.id,company_id=p.company_id FROM public.profiles p WHERE p.id=t.profile_id;
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.whatsapp_messages ADD COLUMN IF NOT EXISTS input_type text;
UPDATE public.whatsapp_messages m SET company_id=c.company_id,user_id=c.user_id FROM public.whatsapp_conversations c WHERE c.id=m.conversation_id;
ALTER TABLE public.conversation_sessions ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
ALTER TABLE public.conversation_sessions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.pending_actions ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
ALTER TABLE public.pending_actions ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.scheduled_notifications ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
ALTER TABLE public.scheduled_notifications ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);
ALTER TABLE public.upx_accounts ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
ALTER TABLE public.upx_balances ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);
ALTER TABLE public.upx_transactions ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company_info(id);

CREATE TABLE public.machine_assignments (
 company_id uuid NOT NULL REFERENCES public.company_info(id),
 machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 PRIMARY KEY(machine_id,user_id)
);
CREATE TABLE private.whatsapp_bindings (
 instance_name text NOT NULL, phone text NOT NULL CHECK(phone ~ '^[1-9][0-9]{7,14}$'),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES public.company_info(id), verified_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(instance_name,phone), UNIQUE(instance_name,user_id)
);
ALTER TABLE private.whatsapp_bindings ENABLE ROW LEVEL SECURITY;
CREATE TABLE private.whatsapp_pairing (
 token_hash text PRIMARY KEY,user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES public.company_info(id),expires_at timestamptz NOT NULL
);
ALTER TABLE private.whatsapp_pairing ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.whatsapp_inbound_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES public.company_info(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),instance_name text NOT NULL,message_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('text','audio','image','document')),
 status text NOT NULL DEFAULT 'received' CHECK(status IN ('received','processing','needs_review','processed','failed','rejected')),
 text_content text,media_path text,media_mime text,media_sha256 text,extracted_data jsonb,
 error_code text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(instance_name,message_id)
);
CREATE INDEX whatsapp_inbound_events_owner_idx ON public.whatsapp_inbound_events(company_id,user_id,created_at);
-- Operator visibility: own records and machines explicitly assigned to that operator.
CREATE FUNCTION private.can_use_machine(mid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.machines m WHERE m.id=mid AND m.company_id=private.current_company()
 AND (private.is_manager() OR m.user_id=auth.uid() OR EXISTS(SELECT 1 FROM public.machine_assignments a WHERE a.machine_id=m.id AND a.user_id=auth.uid() AND a.company_id=m.company_id)))
$$;
REVOKE ALL ON FUNCTION private.can_use_machine(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_use_machine(uuid) TO authenticated;
CREATE FUNCTION private.enforce_tenant_row() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d jsonb:=to_jsonb(NEW); oldd jsonb; uid uuid:=auth.uid(); cid uuid; ownerid uuid; parentcid uuid; k text; tab text; value text; mid uuid;
BEGIN
 cid:=(d->>'company_id')::uuid; ownerid:=(d->>'user_id')::uuid;
 IF uid IS NOT NULL THEN
  IF private.current_company() IS NULL THEN RAISE EXCEPTION 'tenant_membership_required' USING ERRCODE='42501'; END IF;
  IF cid IS NOT NULL AND cid<>private.current_company() THEN RAISE EXCEPTION 'tenant_mismatch' USING ERRCODE='42501'; END IF;
  cid:=private.current_company();
  IF TG_TABLE_NAME<>'machine_assignments' THEN
   IF TG_OP='INSERT' THEN
    IF ownerid IS NOT NULL AND ownerid<>uid THEN RAISE EXCEPTION 'owner_mismatch' USING ERRCODE='42501'; END IF;
    ownerid:=uid;
   ELSE
    oldd:=to_jsonb(OLD);
    IF ownerid IS DISTINCT FROM (oldd->>'user_id')::uuid OR cid IS DISTINCT FROM (oldd->>'company_id')::uuid THEN RAISE EXCEPTION 'immutable_ownership' USING ERRCODE='42501'; END IF;
   END IF;
  ELSIF NOT private.is_manager() THEN RAISE EXCEPTION 'manager_required' USING ERRCODE='42501';
  END IF;
 END IF;
 IF cid IS NULL OR ownerid IS NULL OR private.owner_company(ownerid) IS DISTINCT FROM cid THEN RAISE EXCEPTION 'unverified_ownership' USING ERRCODE='42501'; END IF;
 -- All foreign references must belong to the same tenant, including service-role writes.
 FOREACH k IN ARRAY ARRAY['machine_id','project_id','operator_id','rdo_id','profile_id','conversation_id','created_by'] LOOP
  value:=d->>k;
  IF value IS NOT NULL THEN
   tab:=CASE k WHEN 'machine_id' THEN 'machines' WHEN 'project_id' THEN 'projects' WHEN 'operator_id' THEN 'employees' WHEN 'rdo_id' THEN 'rdos' WHEN 'profile_id' THEN 'profiles' WHEN 'conversation_id' THEN 'whatsapp_conversations' ELSE 'profiles' END;
   EXECUTE format('SELECT company_id FROM public.%I WHERE id=$1',tab) INTO parentcid USING value::uuid;
   IF parentcid IS DISTINCT FROM cid THEN RAISE EXCEPTION 'cross_tenant_reference' USING ERRCODE='42501'; END IF;
   IF uid IS NOT NULL AND NOT private.is_manager() AND k='machine_id' AND NOT private.can_use_machine(value::uuid) THEN RAISE EXCEPTION 'machine_not_assigned' USING ERRCODE='42501'; END IF;
   IF uid IS NOT NULL AND NOT private.is_manager() AND k='operator_id' AND NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.id=value::uuid AND e.user_id=uid) THEN RAISE EXCEPTION 'operator_mismatch' USING ERRCODE='42501'; END IF;
  END IF;
 END LOOP;
 IF d ? 'machine_ids' AND jsonb_typeof(d->'machine_ids')='array' THEN
  FOR value IN SELECT jsonb_array_elements_text(d->'machine_ids') LOOP
   SELECT company_id INTO parentcid FROM public.machines WHERE id=value::uuid;
   IF parentcid IS DISTINCT FROM cid OR (uid IS NOT NULL AND NOT private.is_manager() AND NOT private.can_use_machine(value::uuid)) THEN RAISE EXCEPTION 'machine_not_assigned' USING ERRCODE='42501'; END IF;
  END LOOP;
 END IF;
 NEW:=jsonb_populate_record(NEW,jsonb_build_object('company_id',cid,'user_id',ownerid));
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.enforce_tenant_row() FROM PUBLIC,anon,authenticated;
-- Every public table gets RLS; replace permissive legacy policies rather than adding to them.
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',r.tablename);
 END LOOP;
 FOR r IN SELECT tablename,policyname FROM pg_policies WHERE schemaname='public' LOOP
  EXECUTE format('DROP POLICY %I ON public.%I',r.policyname,r.tablename);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon,authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC,anon,authenticated;
CREATE POLICY own_profile ON public.profiles FOR SELECT TO authenticated USING(id=(SELECT auth.uid()));
CREATE POLICY update_own_profile ON public.profiles FOR UPDATE TO authenticated USING(id=(SELECT auth.uid())) WITH CHECK(id=(SELECT auth.uid()));
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE(name,avatar_url,onboarding_completed,updated_at) ON public.profiles TO authenticated;
CREATE POLICY own_company ON public.company_info FOR SELECT TO authenticated USING(id=(SELECT private.current_company()));
CREATE POLICY edit_company ON public.company_info FOR UPDATE TO authenticated USING(id=(SELECT private.current_company()) AND (SELECT private.is_manager())) WITH CHECK(id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
GRANT SELECT ON public.company_info TO authenticated;
GRANT UPDATE(name,description,settings) ON public.company_info TO authenticated;
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.machines FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.machines TO authenticated;
CREATE POLICY tenant_read ON public.machines FOR SELECT TO authenticated USING(private.can_use_machine(id));
GRANT INSERT,UPDATE,DELETE ON public.machines TO authenticated;
CREATE POLICY tenant_insert ON public.machines FOR INSERT TO authenticated WITH CHECK(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_update ON public.machines FOR UPDATE TO authenticated USING(private.can_use_machine(id)) WITH CHECK(private.can_use_machine(id));
CREATE POLICY tenant_delete ON public.machines FOR DELETE TO authenticated USING(private.can_use_machine(id));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.rdos FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.rdos TO authenticated;
CREATE POLICY tenant_read ON public.rdos FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
GRANT INSERT,UPDATE,DELETE ON public.rdos TO authenticated;
CREATE POLICY tenant_insert ON public.rdos FOR INSERT TO authenticated WITH CHECK(company_id=(SELECT private.current_company()) AND user_id=(SELECT auth.uid()));
CREATE POLICY tenant_update ON public.rdos FOR UPDATE TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid()))) WITH CHECK(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
CREATE POLICY tenant_delete ON public.rdos FOR DELETE TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.transactions TO authenticated;
CREATE POLICY tenant_read ON public.transactions FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
GRANT INSERT,UPDATE,DELETE ON public.transactions TO authenticated;
CREATE POLICY tenant_insert ON public.transactions FOR INSERT TO authenticated WITH CHECK(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_update ON public.transactions FOR UPDATE TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager())) WITH CHECK(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_delete ON public.transactions FOR DELETE TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.maintenance_records FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.maintenance_records TO authenticated;
CREATE POLICY tenant_read ON public.maintenance_records FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
GRANT INSERT,UPDATE,DELETE ON public.maintenance_records TO authenticated;
CREATE POLICY tenant_insert ON public.maintenance_records FOR INSERT TO authenticated WITH CHECK(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_update ON public.maintenance_records FOR UPDATE TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager())) WITH CHECK(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_delete ON public.maintenance_records FOR DELETE TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.schedules FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.schedules TO authenticated;
CREATE POLICY tenant_read ON public.schedules FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
GRANT INSERT,UPDATE,DELETE ON public.schedules TO authenticated;
CREATE POLICY tenant_insert ON public.schedules FOR INSERT TO authenticated WITH CHECK(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_update ON public.schedules FOR UPDATE TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager())) WITH CHECK(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_delete ON public.schedules FOR DELETE TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.projects TO authenticated;
CREATE POLICY tenant_read ON public.projects FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
GRANT INSERT,UPDATE,DELETE ON public.projects TO authenticated;
CREATE POLICY tenant_insert ON public.projects FOR INSERT TO authenticated WITH CHECK(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_update ON public.projects FOR UPDATE TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager())) WITH CHECK(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_delete ON public.projects FOR DELETE TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.insights FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.insights TO authenticated;
CREATE POLICY tenant_read ON public.insights FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.employees FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.employees TO authenticated;
CREATE POLICY tenant_read ON public.employees FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
GRANT INSERT,UPDATE,DELETE ON public.employees TO authenticated;
CREATE POLICY tenant_insert ON public.employees FOR INSERT TO authenticated WITH CHECK(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_update ON public.employees FOR UPDATE TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager())) WITH CHECK(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_delete ON public.employees FOR DELETE TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.service_orders FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.service_orders TO authenticated;
CREATE POLICY tenant_read ON public.service_orders FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
GRANT INSERT,UPDATE,DELETE ON public.service_orders TO authenticated;
CREATE POLICY tenant_insert ON public.service_orders FOR INSERT TO authenticated WITH CHECK(company_id=(SELECT private.current_company()) AND user_id=(SELECT auth.uid()));
CREATE POLICY tenant_update ON public.service_orders FOR UPDATE TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid()))) WITH CHECK(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
CREATE POLICY tenant_delete ON public.service_orders FOR DELETE TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.orcamentos FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.orcamentos TO authenticated;
CREATE POLICY tenant_read ON public.orcamentos FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
GRANT INSERT,UPDATE,DELETE ON public.orcamentos TO authenticated;
CREATE POLICY tenant_insert ON public.orcamentos FOR INSERT TO authenticated WITH CHECK(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_update ON public.orcamentos FOR UPDATE TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager())) WITH CHECK(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_delete ON public.orcamentos FOR DELETE TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.hora_maquina FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.hora_maquina TO authenticated;
CREATE POLICY tenant_read ON public.hora_maquina FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
GRANT INSERT,UPDATE,DELETE ON public.hora_maquina TO authenticated;
CREATE POLICY tenant_insert ON public.hora_maquina FOR INSERT TO authenticated WITH CHECK(company_id=(SELECT private.current_company()) AND user_id=(SELECT auth.uid()));
CREATE POLICY tenant_update ON public.hora_maquina FOR UPDATE TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid()))) WITH CHECK(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
CREATE POLICY tenant_delete ON public.hora_maquina FOR DELETE TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.chat_memories FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.chat_memories TO authenticated;
CREATE POLICY tenant_read ON public.chat_memories FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.rdo_ai_analysis FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.rdo_ai_analysis TO authenticated;
CREATE POLICY tenant_read ON public.rdo_ai_analysis FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.rdo_tags FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.rdo_tags TO authenticated;
CREATE POLICY tenant_read ON public.rdo_tags FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.machine_impact FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.machine_impact TO authenticated;
CREATE POLICY tenant_read ON public.machine_impact FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.whatsapp_conversations FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.whatsapp_conversations TO authenticated;
CREATE POLICY tenant_read ON public.whatsapp_conversations FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.whatsapp_messages FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.whatsapp_messages TO authenticated;
CREATE POLICY tenant_read ON public.whatsapp_messages FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.conversation_sessions FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.pending_actions FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.pending_actions TO authenticated;
CREATE POLICY tenant_read ON public.pending_actions FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.scheduled_notifications FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.machine_assignments FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.machine_assignments TO authenticated;
CREATE POLICY tenant_read ON public.machine_assignments FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));
GRANT INSERT,UPDATE,DELETE ON public.machine_assignments TO authenticated;
CREATE POLICY tenant_insert ON public.machine_assignments FOR INSERT TO authenticated WITH CHECK(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_update ON public.machine_assignments FOR UPDATE TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager())) WITH CHECK(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE POLICY tenant_delete ON public.machine_assignments FOR DELETE TO authenticated USING(company_id=(SELECT private.current_company()) AND (SELECT private.is_manager()));
CREATE TRIGGER enforce_tenant BEFORE INSERT OR UPDATE ON public.whatsapp_inbound_events FOR EACH ROW EXECUTE FUNCTION private.enforce_tenant_row();
GRANT SELECT ON public.whatsapp_inbound_events TO authenticated;
CREATE POLICY tenant_read ON public.whatsapp_inbound_events FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND ((SELECT private.is_manager()) OR user_id=(SELECT auth.uid())));

-- Operational vector data and external finance remain server-only until their tenant lineage is verified.
-- Shared reference knowledge can be read, but never edited by customers.
GRANT SELECT ON public.machine_knowledge TO authenticated;
CREATE POLICY curated_knowledge ON public.machine_knowledge FOR SELECT TO authenticated USING((SELECT private.current_company()) IS NOT NULL);
-- Make the legacy receipts bucket private. Unowned legacy objects are deliberately inaccessible.
UPDATE storage.buckets SET public=false,file_size_limit=10485760,allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','application/pdf'] WHERE id='service-receipts';
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES
 ('whatsapp-media','whatsapp-media',false,10485760,ARRAY['image/jpeg','image/png','image/webp','audio/ogg','audio/mpeg','audio/wav','audio/mp4','application/pdf','text/plain','text/csv']),
 ('avatars','avatars',false,5242880,ARRAY['image/jpeg','image/png','image/webp']),
 ('company-logos','company-logos',false,5242880,ARRAY['image/jpeg','image/png','image/webp'])
 ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
DO $$ DECLARE r record; BEGIN
 FOR r IN SELECT policyname FROM pg_policies WHERE schemaname='storage' AND tablename='objects' LOOP
  EXECUTE format('DROP POLICY %I ON storage.objects',r.policyname);
 END LOOP;
END $$;
-- Freeze verified ownership of legacy paths; never derive it from an editable receipt URL.
CREATE TABLE private.legacy_storage_ownership (
 bucket_id text NOT NULL,name text NOT NULL,company_id uuid NOT NULL,user_id uuid NOT NULL,
 PRIMARY KEY(bucket_id,name)
);
ALTER TABLE private.legacy_storage_ownership ENABLE ROW LEVEL SECURITY;
INSERT INTO private.legacy_storage_ownership(bucket_id,name,company_id,user_id)
SELECT o.bucket_id,o.name,m.company_id,m.user_id FROM storage.objects o
JOIN private.tenant_memberships m ON m.user_id::text=o.owner_id
WHERE o.bucket_id='service-receipts' AND m.active;
CREATE FUNCTION private.can_read_legacy_object(bucket text,path text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.legacy_storage_ownership o WHERE o.bucket_id=bucket AND o.name=path AND o.company_id=private.current_company() AND (o.user_id=auth.uid() OR private.is_manager()))
$$;
REVOKE ALL ON FUNCTION private.can_read_legacy_object(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.can_read_legacy_object(text,text) TO authenticated;
CREATE POLICY tenant_files_read ON storage.objects FOR SELECT TO authenticated USING(
 bucket_id IN ('service-receipts','whatsapp-media','avatars','company-logos') AND (SELECT private.current_company()) IS NOT NULL AND
 ((split_part(name,'/',1)=(SELECT private.current_company())::text AND (split_part(name,'/',2)=(SELECT auth.uid())::text OR (SELECT private.is_manager())))
 OR private.can_read_legacy_object(bucket_id,name)
 )
);
CREATE POLICY tenant_files_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(
 bucket_id IN ('service-receipts','avatars','company-logos') AND split_part(name,'/',1)=(SELECT private.current_company())::text AND split_part(name,'/',2)=(SELECT auth.uid())::text AND owner_id=(SELECT auth.uid())::text
);
-- Immutable uploads: new objects for replacements, no cross-user overwrite or deletion.
CREATE FUNCTION public.create_whatsapp_pairing() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE token text; uid uuid:=auth.uid(); cid uuid:=private.current_company();
BEGIN
 IF uid IS NULL OR cid IS NULL THEN RAISE EXCEPTION 'tenant_membership_required' USING ERRCODE='42501'; END IF;
 token:=replace(gen_random_uuid()::text,'-','');
 INSERT INTO private.whatsapp_pairing(token_hash,user_id,company_id,expires_at)
 VALUES(encode(extensions.digest(token,'sha256'),'hex'),uid,cid,now()+interval '10 minutes')
 ON CONFLICT(user_id) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at,company_id=excluded.company_id;
 RETURN 'VINCULAR '||token;
END $$;
REVOKE ALL ON FUNCTION public.create_whatsapp_pairing() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_whatsapp_pairing() TO authenticated;
CREATE FUNCTION public.verify_whatsapp_pairing(p_instance text,p_phone text,p_token text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE pair private.whatsapp_pairing%rowtype;
BEGIN
 IF auth.role()<>'service_role' THEN RAISE EXCEPTION 'server_only' USING ERRCODE='42501'; END IF;
 SELECT * INTO pair FROM private.whatsapp_pairing WHERE token_hash=encode(extensions.digest(p_token,'sha256'),'hex') AND expires_at>now() FOR UPDATE;
 IF NOT FOUND OR private.owner_company(pair.user_id) IS DISTINCT FROM pair.company_id THEN RETURN false; END IF;
 -- Never silently transfer a WhatsApp identity between users or companies.
 IF EXISTS(SELECT 1 FROM private.whatsapp_bindings WHERE instance_name=p_instance AND (phone=p_phone OR user_id=pair.user_id) AND (user_id<>pair.user_id OR phone<>p_phone OR company_id<>pair.company_id)) THEN RETURN false; END IF;
 INSERT INTO private.whatsapp_bindings(instance_name,phone,user_id,company_id) VALUES(p_instance,p_phone,pair.user_id,pair.company_id) ON CONFLICT(instance_name,phone) DO NOTHING;
 DELETE FROM private.whatsapp_pairing WHERE user_id=pair.user_id;
 UPDATE public.profiles SET phone=p_phone WHERE id=pair.user_id;
 RETURN true;
END $$;
CREATE FUNCTION public.resolve_whatsapp_identity(p_instance text,p_phone text) RETURNS TABLE(user_id uuid,company_id uuid,role text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT b.user_id,b.company_id,m.role FROM private.whatsapp_bindings b JOIN private.tenant_memberships m USING(user_id)
 WHERE auth.role()='service_role' AND b.instance_name=p_instance AND b.phone=p_phone AND m.active AND m.company_id=b.company_id
$$;
REVOKE ALL ON FUNCTION public.verify_whatsapp_pairing(text,text,text),public.resolve_whatsapp_identity(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_whatsapp_pairing(text,text,text),public.resolve_whatsapp_identity(text,text) TO service_role;
REVOKE ALL ON ALL TABLES IN SCHEMA private FROM PUBLIC,anon,authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA private TO service_role;
NOTIFY pgrst,'reload schema';

CREATE FUNCTION public.my_whatsapp_status() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.whatsapp_bindings b WHERE b.user_id=auth.uid() AND b.company_id=private.current_company())
$$;
REVOKE ALL ON FUNCTION public.my_whatsapp_status() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.my_whatsapp_status() TO authenticated;

GRANT SELECT,INSERT,UPDATE ON public.whatsapp_inbound_events TO service_role;
