-- Extend WhatsApp confirmed OS creation with explicit billing document choice.
CREATE OR REPLACE FUNCTION public.prepare_whatsapp_action(p_event_id uuid, p_action_type text, p_slots jsonb, p_preview text, p_ready boolean)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
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
   OR coalesce(v->>'billing_document_type','') NOT IN ('nfse','receipt','deferred')
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
END $function$;

CREATE OR REPLACE FUNCTION public.confirm_whatsapp_action(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
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
  IF dt<'2000-01-01' OR dt>current_date+1 OR start_n<0 OR end_n<=start_n OR end_n-start_n>24 OR rate<0 OR rate>1000000 OR doc_type NOT IN ('nfse','receipt','deferred') THEN RAISE EXCEPTION 'invalid_service_order'; END IF;
  INSERT INTO public.service_orders(date,client,machine_id,start_hour,end_hour,hourly_rate,description,status,billing_document_type,user_id,company_id)
  VALUES(dt,v->>'client',mid,start_n,end_n,rate,v->>'description','pending',doc_type,d.user_id,d.company_id) RETURNING id INTO rid;
 END IF;
 UPDATE public.whatsapp_drafts SET state='confirmed',record_id=rid,reviewed_by=d.user_id,version=version+1,updated_at=now() WHERE id=d.id RETURNING * INTO d;
 UPDATE private.whatsapp_action_sessions SET state='complete',confirmation_event_id=p_event_id,updated_at=now() WHERE company_id=s.company_id AND user_id=s.user_id AND instance_name=s.instance_name AND phone=s.phone;
 INSERT INTO private.whatsapp_review_audit(draft_id,actor_id,action,version,payload) VALUES(d.id,d.user_id,'confirm_whatsapp',d.version,d.payload);
 RETURN jsonb_build_object('action_type',s.action_type,'record_id',rid,'already_confirmed',false,'machine_name',machine_name,'slots',v);
END $function$;

NOTIFY pgrst,'reload schema';