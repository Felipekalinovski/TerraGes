-- Durable intake jobs. Payloads and leases are never exposed to browser roles.
CREATE TABLE private.whatsapp_jobs (
 event_id uuid PRIMARY KEY REFERENCES public.whatsapp_inbound_events(id),
 input jsonb NOT NULL, attempts integer NOT NULL DEFAULT 0,
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','processing','done','dead')),
 available_at timestamptz NOT NULL DEFAULT now(), lease_until timestamptz, lease_token uuid
);
ALTER TABLE private.whatsapp_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.whatsapp_jobs FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.whatsapp_jobs TO service_role;
CREATE INDEX whatsapp_jobs_due ON private.whatsapp_jobs(available_at) WHERE state IN ('queued','processing');
ALTER TABLE public.whatsapp_inbound_events ADD COLUMN attempts integer NOT NULL DEFAULT 0;

CREATE FUNCTION public.enqueue_whatsapp_event(p_input jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE ident record; eid uuid; fresh boolean:=false;
BEGIN
 SELECT * INTO ident FROM public.resolve_whatsapp_identity(p_input->>'instance',p_input->>'phone');
 IF NOT FOUND THEN RAISE EXCEPTION 'verified_account_required' USING ERRCODE='42501'; END IF;
 INSERT INTO public.whatsapp_inbound_events(company_id,user_id,instance_name,message_id,kind,text_content)
 VALUES(ident.company_id,ident.user_id,p_input->>'instance',p_input->>'id',p_input->>'kind',p_input->>'text')
 ON CONFLICT(instance_name,message_id) DO NOTHING RETURNING id INTO eid;
 fresh:=FOUND;
 IF fresh THEN
  INSERT INTO private.whatsapp_jobs(event_id,input) VALUES(eid,p_input);
 ELSE
  SELECT id INTO eid FROM public.whatsapp_inbound_events WHERE instance_name=p_input->>'instance'
   AND message_id=p_input->>'id' AND user_id=ident.user_id AND company_id=ident.company_id;
 END IF;
 RETURN jsonb_build_object('id',eid,'duplicate',NOT fresh);
END $$;

GRANT EXECUTE ON FUNCTION private.owner_company(uuid) TO service_role;
CREATE FUNCTION public.claim_whatsapp_job(p_event_id uuid DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE j private.whatsapp_jobs%rowtype; e public.whatsapp_inbound_events%rowtype; token uuid:=gen_random_uuid();
BEGIN
 FOR j IN SELECT * FROM private.whatsapp_jobs WHERE (p_event_id IS NULL OR event_id=p_event_id)
  AND ((state='queued' AND available_at<=now()) OR (state='processing' AND lease_until<now()))
  ORDER BY available_at,event_id FOR UPDATE SKIP LOCKED LIMIT 20 LOOP
  SELECT * INTO e FROM public.whatsapp_inbound_events WHERE id=j.event_id;
  IF NOT pg_try_advisory_xact_lock(hashtextextended(e.user_id::text,0)) THEN CONTINUE; END IF;
  IF EXISTS(SELECT 1 FROM private.whatsapp_jobs x JOIN public.whatsapp_inbound_events y ON y.id=x.event_id
   WHERE y.user_id=e.user_id AND x.event_id<>j.event_id AND x.state='processing' AND x.lease_until>now()) THEN CONTINUE; END IF;
  IF private.owner_company(e.user_id) IS DISTINCT FROM e.company_id OR NOT EXISTS(
   SELECT 1 FROM private.whatsapp_bindings b WHERE b.instance_name=e.instance_name AND b.phone=j.input->>'phone'
    AND b.user_id=e.user_id AND b.company_id=e.company_id) THEN
   UPDATE private.whatsapp_jobs SET state='dead',lease_token=NULL WHERE event_id=j.event_id;
   CONTINUE;
  END IF;
  IF j.attempts>=5 THEN
   UPDATE private.whatsapp_jobs SET state='dead',lease_token=NULL WHERE event_id=j.event_id;
   UPDATE public.whatsapp_inbound_events SET status='failed',error_code='attempt_limit',updated_at=now() WHERE id=j.event_id;
   CONTINUE;
  END IF;
  UPDATE private.whatsapp_jobs SET state='processing',attempts=attempts+1,lease_token=token,lease_until=now()+interval '3 minutes' WHERE event_id=j.event_id;
  UPDATE public.whatsapp_inbound_events SET status='processing',attempts=j.attempts+1,error_code=NULL,updated_at=now() WHERE id=j.event_id;
  RETURN jsonb_build_object('event',to_jsonb(e),'input',j.input,'token',token);
 END LOOP;
 RETURN NULL;
END $$;

CREATE FUNCTION public.checkpoint_whatsapp_job(p_event_id uuid,p_token uuid,p_path text,p_mime text,p_sha text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 PERFORM 1 FROM private.whatsapp_jobs WHERE event_id=p_event_id AND lease_token=p_token AND state='processing' AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.whatsapp_inbound_events SET media_path=p_path,media_mime=p_mime,media_sha256=p_sha,updated_at=now() WHERE id=p_event_id;
 RETURN true;
END $$;
CREATE FUNCTION public.finish_whatsapp_job(p_event_id uuid,p_token uuid,p_text text,p_error text,p_retryable boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE n integer;
BEGIN
 SELECT attempts INTO n FROM private.whatsapp_jobs WHERE event_id=p_event_id AND lease_token=p_token AND state='processing' AND lease_until>now() FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE private.whatsapp_jobs SET state=CASE WHEN p_error IS NULL THEN 'done' WHEN p_retryable AND n<5 THEN 'queued' ELSE 'dead' END,
  available_at=now()+make_interval(secs=>least(3600,30*power(2,n)::integer)),lease_token=NULL,lease_until=NULL WHERE event_id=p_event_id;
 UPDATE public.whatsapp_inbound_events SET status=CASE WHEN p_error IS NULL THEN 'needs_review' WHEN p_retryable THEN 'failed' ELSE 'rejected' END,
  extracted_data=CASE WHEN p_error IS NULL THEN jsonb_build_object('text',left(p_text,64000),'requires_human_review',true) ELSE extracted_data END,
  error_code=p_error,updated_at=now() WHERE id=p_event_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.enqueue_whatsapp_event(jsonb),public.claim_whatsapp_job(uuid),public.checkpoint_whatsapp_job(uuid,uuid,text,text,text),public.finish_whatsapp_job(uuid,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_whatsapp_event(jsonb),public.claim_whatsapp_job(uuid),public.checkpoint_whatsapp_job(uuid,uuid,text,text,text),public.finish_whatsapp_job(uuid,uuid,text,text,boolean) TO service_role;

-- A private definer implements narrow transitions; public wrappers use invoker privileges.
CREATE FUNCTION private.retry_whatsapp_event(p_event_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.whatsapp_inbound_events%rowtype; j private.whatsapp_jobs%rowtype;
BEGIN
 IF auth.uid() IS NULL OR private.current_company() IS NULL THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO e FROM public.whatsapp_inbound_events WHERE id=p_event_id AND company_id=private.current_company()
  AND (user_id=auth.uid() OR private.is_manager());
 IF NOT FOUND THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO j FROM private.whatsapp_jobs WHERE event_id=p_event_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'legacy_event_requires_resend'; END IF;
 IF j.state='processing' AND j.lease_until>now() THEN RAISE EXCEPTION 'already_processing'; END IF;
 IF j.state='done' OR e.status='rejected' OR j.attempts>=5 THEN RAISE EXCEPTION 'retry_not_available'; END IF;
 IF j.available_at>now() THEN RAISE EXCEPTION 'retry_backoff'; END IF;
 UPDATE private.whatsapp_jobs SET state='queued',lease_token=NULL,lease_until=NULL WHERE event_id=p_event_id;
 RETURN p_event_id;
END $$;
CREATE FUNCTION public.retry_whatsapp_event(p_event_id uuid) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.retry_whatsapp_event(p_event_id) $$;
REVOKE ALL ON FUNCTION private.retry_whatsapp_event(uuid),public.retry_whatsapp_event(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.retry_whatsapp_event(uuid),public.retry_whatsapp_event(uuid) TO authenticated;

CREATE TABLE public.whatsapp_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),event_id uuid NOT NULL UNIQUE REFERENCES public.whatsapp_inbound_events(id),
 company_id uuid NOT NULL REFERENCES public.company_info(id),user_id uuid NOT NULL REFERENCES auth.users(id),
 kind text NOT NULL CHECK(kind IN ('rdo','expense','service_order')),payload jsonb NOT NULL,
 state text NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','confirmed','discarded')),
 version integer NOT NULL DEFAULT 1,record_id uuid,reviewed_by uuid REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_drafts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.whatsapp_drafts TO authenticated;
GRANT ALL ON public.whatsapp_drafts TO service_role;
CREATE POLICY tenant_read ON public.whatsapp_drafts FOR SELECT TO authenticated USING(company_id=(SELECT private.current_company()) AND (user_id=(SELECT auth.uid()) OR (SELECT private.is_manager())));
CREATE INDEX whatsapp_drafts_owner ON public.whatsapp_drafts(company_id,user_id);
CREATE TABLE private.whatsapp_review_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,draft_id uuid NOT NULL REFERENCES public.whatsapp_drafts(id),
 actor_id uuid NOT NULL,action text NOT NULL,version integer NOT NULL,payload jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE private.whatsapp_review_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.whatsapp_review_audit FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.whatsapp_review_audit TO service_role;

CREATE FUNCTION private.review_whatsapp_draft(p_event_id uuid,p_action text,p_kind text,p_payload jsonb,p_version integer) RETURNS public.whatsapp_drafts
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE e public.whatsapp_inbound_events%rowtype; d public.whatsapp_drafts%rowtype; rid uuid; v jsonb; mid uuid; dt date; n numeric; start_n numeric; end_n numeric; rate numeric;
BEGIN
 IF auth.uid() IS NULL OR private.current_company() IS NULL THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO e FROM public.whatsapp_inbound_events WHERE id=p_event_id AND company_id=private.current_company()
  AND (user_id=auth.uid() OR private.is_manager()) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'access_denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO d FROM public.whatsapp_drafts WHERE event_id=e.id FOR UPDATE;
 IF p_action NOT IN ('save','confirm','discard') OR p_action IS NULL THEN RAISE EXCEPTION 'invalid_action'; END IF;
 -- A repeated confirmation returns its original receipt, even after a lost HTTP response.
 IF d.state='confirmed' AND p_action='confirm' THEN RETURN d; END IF;
 IF d.state IN ('confirmed','discarded') OR e.status<>'needs_review' THEN RAISE EXCEPTION 'event_not_reviewable'; END IF;
 IF coalesce(d.version,0) IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'draft_version_conflict'; END IF;
 IF p_action='save' THEN
  IF p_kind NOT IN ('rdo','expense','service_order') OR p_kind IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object' OR octet_length(p_payload::text)>20000 THEN RAISE EXCEPTION 'invalid_draft'; END IF;
  -- Retain only business fields: no ownership, status, arbitrary SQL or caller-chosen record IDs.
  SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO v FROM jsonb_each(p_payload)
   WHERE key=ANY(ARRAY['date','description','machine_id','client','start_hour','end_hour','hourly_rate','amount','category']);
  INSERT INTO public.whatsapp_drafts(event_id,company_id,user_id,kind,payload)
   VALUES(e.id,e.company_id,e.user_id,p_kind,v)
   ON CONFLICT(event_id) DO UPDATE SET kind=excluded.kind,payload=excluded.payload,version=whatsapp_drafts.version+1,updated_at=now() RETURNING * INTO d;
 ELSE
  IF d.id IS NULL THEN RAISE EXCEPTION 'draft_required'; END IF;
  IF p_action='discard' THEN
   UPDATE public.whatsapp_drafts SET state='discarded',version=version+1,reviewed_by=auth.uid(),updated_at=now() WHERE id=d.id RETURNING * INTO d;
   UPDATE public.whatsapp_inbound_events SET status='processed',updated_at=now() WHERE id=e.id;
  ELSE
   v:=d.payload;
   IF d.kind IN ('expense','service_order') AND NOT private.is_manager() THEN RAISE EXCEPTION 'manager_required' USING ERRCODE='42501'; END IF;
   IF coalesce(v->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' OR length(trim(coalesce(v->>'description','')))=0 OR length(v->>'description')>4000 THEN RAISE EXCEPTION 'date_and_description_required'; END IF;
   dt:=(v->>'date')::date;
   IF dt<'2000-01-01'::date OR dt>current_date+1 THEN RAISE EXCEPTION 'invalid_date'; END IF;
   mid:=nullif(v->>'machine_id','')::uuid;
   IF mid IS NOT NULL AND NOT private.can_use_machine(mid) THEN RAISE EXCEPTION 'machine_not_assigned' USING ERRCODE='42501'; END IF;
   IF d.kind='rdo' THEN
    IF mid IS NULL THEN RAISE EXCEPTION 'machine_required'; END IF;
    INSERT INTO public.rdos(date,activities,description,machine_ids,machines,user_id,company_id,created_by)
     VALUES(dt::timestamp AT TIME ZONE 'America/Sao_Paulo',v->>'description',v->>'description',ARRAY[mid],ARRAY[mid::text],auth.uid(),e.company_id,auth.uid()) RETURNING id INTO rid;
   ELSIF d.kind='expense' THEN
    n:=(v->>'amount')::numeric;
    IF n IS NULL OR n<=0 OR n>100000000 OR n::text IN ('NaN','Infinity','-Infinity') OR scale(n)>2 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
    INSERT INTO public.transactions(title,date,amount,type,status,category,user_id,company_id)
     VALUES(v->>'description',dt,n,'expense','pending',left(coalesce(nullif(v->>'category',''),'Outros'),100),auth.uid(),e.company_id) RETURNING id INTO rid;
   ELSE
    start_n:=(v->>'start_hour')::numeric;end_n:=(v->>'end_hour')::numeric;rate:=(v->>'hourly_rate')::numeric;
    IF mid IS NULL OR length(trim(coalesce(v->>'client','')))=0 OR length(v->>'client')>200 OR start_n IS NULL OR end_n IS NULL OR rate IS NULL
     OR start_n<0 OR start_n>1000000 OR end_n<=start_n OR end_n-start_n>24 OR rate<0 OR rate>1000000
     OR start_n::text IN ('NaN','Infinity','-Infinity') OR end_n::text IN ('NaN','Infinity','-Infinity') OR rate::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'invalid_service_order'; END IF;
    INSERT INTO public.service_orders(date,client,machine_id,start_hour,end_hour,hourly_rate,description,status,user_id,company_id)
     VALUES(dt,v->>'client',mid,start_n,end_n,rate,v->>'description','pending',auth.uid(),e.company_id) RETURNING id INTO rid;
   END IF;
   UPDATE public.whatsapp_drafts SET state='confirmed',record_id=rid,reviewed_by=auth.uid(),version=version+1,updated_at=now() WHERE id=d.id RETURNING * INTO d;
   UPDATE public.whatsapp_inbound_events SET status='processed',updated_at=now() WHERE id=e.id;
  END IF;
 END IF;
 INSERT INTO private.whatsapp_review_audit(draft_id,actor_id,action,version,payload) VALUES(d.id,auth.uid(),p_action,d.version,d.payload);
 RETURN d;
END $$;
CREATE FUNCTION public.review_whatsapp_draft(p_event_id uuid,p_action text,p_kind text DEFAULT NULL,p_payload jsonb DEFAULT NULL,p_version integer DEFAULT 0)
RETURNS public.whatsapp_drafts LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$ SELECT private.review_whatsapp_draft(p_event_id,p_action,p_kind,p_payload,p_version) $$;
REVOKE ALL ON FUNCTION private.review_whatsapp_draft(uuid,text,text,jsonb,integer),public.review_whatsapp_draft(uuid,text,text,jsonb,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.review_whatsapp_draft(uuid,text,text,jsonb,integer),public.review_whatsapp_draft(uuid,text,text,jsonb,integer) TO authenticated;
NOTIFY pgrst,'reload schema';

-- Scheduler credentials are generated inside the DB, never emitted or committed.
CREATE EXTENSION IF NOT EXISTS pg_net;
REVOKE ALL ON SCHEMA net FROM PUBLIC,anon,authenticated;
CREATE TABLE private.whatsapp_worker_config (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),endpoint text,
 secret text NOT NULL DEFAULT (replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','')),
 CHECK(endpoint IS NULL OR endpoint ~ '^https://[a-z0-9]{20}\.supabase\.co/functions/v1/whatsapp-worker$')
);
ALTER TABLE private.whatsapp_worker_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.whatsapp_worker_config FROM PUBLIC,anon,authenticated;
GRANT SELECT ON private.whatsapp_worker_config TO service_role;
INSERT INTO private.whatsapp_worker_config(singleton) VALUES(true);
CREATE FUNCTION public.verify_whatsapp_worker(p_secret text) RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM private.whatsapp_worker_config WHERE length(p_secret)=64 AND extensions.digest(p_secret,'sha256')=extensions.digest(secret,'sha256'))
$$;
REVOKE ALL ON FUNCTION public.verify_whatsapp_worker(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.verify_whatsapp_worker(text) TO service_role;
CREATE FUNCTION private.dispatch_whatsapp_worker() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c private.whatsapp_worker_config%rowtype;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.whatsapp_jobs WHERE (state='queued' AND available_at<=now()) OR (state='processing' AND lease_until<now())) THEN RETURN; END IF;
 SELECT * INTO c FROM private.whatsapp_worker_config WHERE singleton;
 IF c.endpoint IS NULL THEN RETURN; END IF;
 PERFORM net.http_post(url:=c.endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-worker-secret',c.secret),body:='{}'::jsonb,timeout_milliseconds:=5000);
END $$;
REVOKE ALL ON FUNCTION private.dispatch_whatsapp_worker() FROM PUBLIC,anon,authenticated,service_role;
SELECT cron.schedule('terrages-whatsapp-recovery','* * * * *','select private.dispatch_whatsapp_worker()');
