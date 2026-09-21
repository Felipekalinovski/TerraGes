-- Conversation state for confirmed business actions initiated through WhatsApp.
CREATE TABLE private.whatsapp_action_sessions (
 company_id uuid NOT NULL REFERENCES public.company_info(id),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 instance_name text NOT NULL,
 phone text NOT NULL CHECK(phone ~ '^[1-9][0-9]{7,14}$'),
 action_type text NOT NULL CHECK(action_type IN ('create_rdo','update_machine_meter','create_expense','create_service_order')),
 slots jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(slots)='object' AND octet_length(slots::text)<=20000),
 state text NOT NULL DEFAULT 'collecting' CHECK(state IN ('collecting','awaiting_confirmation','complete','cancelled')),
 source_event_id uuid NOT NULL REFERENCES public.whatsapp_inbound_events(id),
 confirmation_event_id uuid REFERENCES public.whatsapp_inbound_events(id),
 draft_id uuid REFERENCES public.whatsapp_drafts(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
 PRIMARY KEY(company_id,user_id,instance_name,phone)
);
ALTER TABLE private.whatsapp_action_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_action_sessions_service_only ON private.whatsapp_action_sessions
 FOR ALL TO service_role USING(true) WITH CHECK(true);
REVOKE ALL ON private.whatsapp_action_sessions FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.whatsapp_action_sessions TO service_role;
CREATE INDEX whatsapp_action_sessions_user_idx ON private.whatsapp_action_sessions(user_id);
CREATE INDEX whatsapp_action_sessions_source_idx ON private.whatsapp_action_sessions(source_event_id);
CREATE INDEX whatsapp_action_sessions_confirmation_idx ON private.whatsapp_action_sessions(confirmation_event_id);
CREATE INDEX whatsapp_action_sessions_draft_idx ON private.whatsapp_action_sessions(draft_id);
CREATE INDEX whatsapp_action_sessions_active_idx ON private.whatsapp_action_sessions(instance_name,phone,expires_at)
 WHERE state IN ('collecting','awaiting_confirmation');

ALTER TABLE public.whatsapp_drafts DROP CONSTRAINT whatsapp_drafts_kind_check;
ALTER TABLE public.whatsapp_drafts ADD CONSTRAINT whatsapp_drafts_kind_check
 CHECK(kind IN ('rdo','expense','service_order','machine_meter'));
ALTER TABLE private.whatsapp_agent_turns DROP CONSTRAINT whatsapp_agent_turns_intent_check;
ALTER TABLE private.whatsapp_agent_turns ADD CONSTRAINT whatsapp_agent_turns_intent_check
 CHECK(intent IN ('earthwork_quote','terrages_action'));

CREATE FUNCTION public.get_whatsapp_action_context(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.whatsapp_inbound_events%rowtype; b private.whatsapp_bindings%rowtype; m private.tenant_memberships%rowtype; s private.whatsapp_action_sessions%rowtype;
BEGIN
 SELECT * INTO e FROM public.whatsapp_inbound_events WHERE id=p_event_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'event_not_found' USING ERRCODE='P0002'; END IF;
 SELECT * INTO b FROM private.whatsapp_bindings WHERE instance_name=e.instance_name AND user_id=e.user_id AND company_id=e.company_id;
 SELECT * INTO m FROM private.tenant_memberships WHERE user_id=e.user_id AND company_id=e.company_id AND active;
 IF b.user_id IS NULL OR m.user_id IS NULL OR private.owner_company(e.user_id) IS DISTINCT FROM e.company_id THEN
  RAISE EXCEPTION 'verified_account_required' USING ERRCODE='42501';
 END IF;
 SELECT * INTO s FROM private.whatsapp_action_sessions WHERE company_id=e.company_id AND user_id=e.user_id
  AND instance_name=e.instance_name AND phone=b.phone AND expires_at>now()
  AND (state IN ('collecting','awaiting_confirmation') OR (state='complete' AND confirmation_event_id=p_event_id));
 RETURN jsonb_build_object('company_id',e.company_id,'user_id',e.user_id,'instance_name',e.instance_name,'phone',b.phone,'role',m.role,
  'session',CASE WHEN s.company_id IS NULL THEN NULL ELSE jsonb_build_object('action_type',s.action_type,'slots',s.slots,'state',s.state,
   'source_event_id',s.source_event_id,'draft_id',s.draft_id,'expires_at',s.expires_at) END);
END $$;

CREATE FUNCTION public.resolve_whatsapp_action_machine(p_event_id uuid,p_query text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c jsonb; candidates jsonb; total integer; q text:=left(trim(coalesce(p_query,'')),100);
BEGIN
 IF length(q)<2 THEN RETURN jsonb_build_object('status','missing','candidates','[]'::jsonb); END IF;
 c:=public.get_whatsapp_action_context(p_event_id);
 WITH allowed AS (
  SELECT x.id,x.name,x.hours FROM public.machines x
  WHERE x.company_id=(c->>'company_id')::uuid
   AND ((c->>'role') IN ('admin','gestor') OR x.user_id=(c->>'user_id')::uuid OR EXISTS(
    SELECT 1 FROM public.machine_assignments a WHERE a.machine_id=x.id AND a.user_id=(c->>'user_id')::uuid AND a.company_id=x.company_id))
   AND position(lower(q) in lower(x.name))>0 ORDER BY (lower(x.name)=lower(q)) DESC,length(x.name),x.name LIMIT 6
 ), counted AS (SELECT count(*) OVER() AS total,id,name,hours FROM allowed)
 SELECT coalesce(max(total),0),coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'hours',hours)),'[]'::jsonb)
 INTO total,candidates FROM counted;
 RETURN jsonb_build_object('status',CASE WHEN total=1 THEN 'resolved' WHEN total=0 THEN 'not_found' ELSE 'ambiguous' END,
  'machine',CASE WHEN total=1 THEN candidates->0 ELSE NULL END,'candidates',candidates);
END $$;

CREATE FUNCTION public.prepare_whatsapp_action(p_event_id uuid,p_action_type text,p_slots jsonb,p_preview text,p_ready boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
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
  ELSE jsonb_strip_nulls(jsonb_build_object('date',p_slots->'date','description',p_slots->'description','client',p_slots->'client','machine_query',p_slots->'machine_query','machine_id',p_slots->'machine_id','machine_name',p_slots->'machine_name','start_hour',p_slots->'start_hour','end_hour',p_slots->'end_hour','hourly_rate',p_slots->'hourly_rate')) END;
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
  IF p_action_type='create_service_order' AND (coalesce(v->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' OR length(trim(coalesce(v->>'description',''))) NOT BETWEEN 1 AND 4000 OR length(trim(coalesce(v->>'client',''))) NOT BETWEEN 1 AND 200 OR mid IS NULL OR coalesce(v->>'start_hour','') !~ '^[0-9]+([.][0-9]{1,2})?$' OR coalesce(v->>'end_hour','') !~ '^[0-9]+([.][0-9]{1,2})?$' OR coalesce(v->>'hourly_rate','') !~ '^[0-9]+([.][0-9]{1,2})?$') THEN RAISE EXCEPTION 'invalid_service_order'; END IF;
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

CREATE FUNCTION public.confirm_whatsapp_action(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c jsonb; s private.whatsapp_action_sessions%rowtype; d public.whatsapp_drafts%rowtype; v jsonb; rid uuid; mid uuid; machine_name text; current_hours numeric; new_hours numeric; dt date; n numeric; start_n numeric; end_n numeric; rate numeric;
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
  dt:=(v->>'date')::date;start_n:=(v->>'start_hour')::numeric;end_n:=(v->>'end_hour')::numeric;rate:=(v->>'hourly_rate')::numeric;
  IF dt<'2000-01-01' OR dt>current_date+1 OR start_n<0 OR end_n<=start_n OR end_n-start_n>24 OR rate<0 OR rate>1000000 THEN RAISE EXCEPTION 'invalid_service_order'; END IF;
  INSERT INTO public.service_orders(date,client,machine_id,start_hour,end_hour,hourly_rate,description,status,user_id,company_id)
  VALUES(dt,v->>'client',mid,start_n,end_n,rate,v->>'description','pending',d.user_id,d.company_id) RETURNING id INTO rid;
 END IF;
 UPDATE public.whatsapp_drafts SET state='confirmed',record_id=rid,reviewed_by=d.user_id,version=version+1,updated_at=now() WHERE id=d.id RETURNING * INTO d;
 UPDATE private.whatsapp_action_sessions SET state='complete',confirmation_event_id=p_event_id,updated_at=now() WHERE company_id=s.company_id AND user_id=s.user_id AND instance_name=s.instance_name AND phone=s.phone;
 INSERT INTO private.whatsapp_review_audit(draft_id,actor_id,action,version,payload) VALUES(d.id,d.user_id,'confirm_whatsapp',d.version,d.payload);
 RETURN jsonb_build_object('action_type',s.action_type,'record_id',rid,'already_confirmed',false,'machine_name',machine_name,'slots',v);
END $$;

CREATE FUNCTION public.discard_whatsapp_action(p_event_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c jsonb; s private.whatsapp_action_sessions%rowtype;
BEGIN
 c:=public.get_whatsapp_action_context(p_event_id);
 SELECT * INTO s FROM private.whatsapp_action_sessions WHERE company_id=(c->>'company_id')::uuid AND user_id=(c->>'user_id')::uuid
  AND instance_name=c->>'instance_name' AND phone=c->>'phone' AND state IN ('collecting','awaiting_confirmation') FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.whatsapp_drafts SET state='discarded',reviewed_by=s.user_id,version=version+1,updated_at=now() WHERE id=s.draft_id AND state='draft';
 UPDATE private.whatsapp_action_sessions SET state='cancelled',updated_at=now() WHERE company_id=s.company_id AND user_id=s.user_id AND instance_name=s.instance_name AND phone=s.phone;
 RETURN true;
END $$;

CREATE FUNCTION public.save_whatsapp_action_response(p_event_id uuid,p_input_text text,p_slots jsonb,p_response_text text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c jsonb; t private.whatsapp_agent_turns%rowtype; inserted boolean;
BEGIN
 IF jsonb_typeof(p_slots)<>'object' OR octet_length(p_slots::text)>16000 OR octet_length(coalesce(p_input_text,''))>64000 OR length(p_response_text) NOT BETWEEN 1 AND 4096 THEN RAISE EXCEPTION 'invalid_action_response'; END IF;
 c:=public.get_whatsapp_action_context(p_event_id);
 INSERT INTO private.whatsapp_agent_turns(event_id,company_id,user_id,instance_name,phone,input_text,intent,slots,response_text)
 VALUES(p_event_id,(c->>'company_id')::uuid,(c->>'user_id')::uuid,c->>'instance_name',c->>'phone',p_input_text,'terrages_action',p_slots,p_response_text)
 ON CONFLICT(event_id) DO NOTHING RETURNING * INTO t;
 inserted:=FOUND; IF NOT inserted THEN SELECT * INTO t FROM private.whatsapp_agent_turns WHERE event_id=p_event_id; END IF;
 RETURN jsonb_build_object('created',inserted,'delivery_state',t.delivery_state,'response_text',t.response_text,'phone',t.phone,'instance_name',t.instance_name);
END $$;

REVOKE ALL ON FUNCTION public.get_whatsapp_action_context(uuid),public.resolve_whatsapp_action_machine(uuid,text),
 public.prepare_whatsapp_action(uuid,text,jsonb,text,boolean),public.confirm_whatsapp_action(uuid),public.discard_whatsapp_action(uuid),
 public.save_whatsapp_action_response(uuid,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_action_context(uuid),public.resolve_whatsapp_action_machine(uuid,text),
 public.prepare_whatsapp_action(uuid,text,jsonb,text,boolean),public.confirm_whatsapp_action(uuid),public.discard_whatsapp_action(uuid),
 public.save_whatsapp_action_response(uuid,text,jsonb,text) TO service_role;
