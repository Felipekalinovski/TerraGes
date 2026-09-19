-- Private, tenant-bound state for the WhatsApp quote assistant.
CREATE TABLE private.whatsapp_agent_sessions (
 company_id uuid NOT NULL REFERENCES public.company_info(id),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 instance_name text NOT NULL,
 phone text NOT NULL CHECK(phone ~ '^[1-9][0-9]{7,14}$'),
 intent text NOT NULL DEFAULT 'earthwork_quote' CHECK(intent IN ('earthwork_quote')),
 slots jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(slots)='object' AND octet_length(slots::text)<=16000),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','complete','cancelled')),
 last_event_id uuid REFERENCES public.whatsapp_inbound_events(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now()+interval '24 hours',
 PRIMARY KEY(company_id,user_id,instance_name,phone)
);
ALTER TABLE private.whatsapp_agent_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_agent_sessions_service_only ON private.whatsapp_agent_sessions
 FOR ALL TO service_role USING(true) WITH CHECK(true);
REVOKE ALL ON private.whatsapp_agent_sessions FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.whatsapp_agent_sessions TO service_role;

CREATE TABLE private.whatsapp_agent_turns (
 event_id uuid PRIMARY KEY REFERENCES public.whatsapp_inbound_events(id) ON DELETE CASCADE,
 company_id uuid NOT NULL REFERENCES public.company_info(id),
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 instance_name text NOT NULL,phone text NOT NULL CHECK(phone ~ '^[1-9][0-9]{7,14}$'),
 input_text text NOT NULL CHECK(octet_length(input_text)<=64000),
 intent text NOT NULL CHECK(intent IN ('earthwork_quote')),
 slots jsonb NOT NULL CHECK(jsonb_typeof(slots)='object' AND octet_length(slots::text)<=16000),
 response_text text NOT NULL CHECK(length(response_text) BETWEEN 1 AND 4096),
 delivery_state text NOT NULL DEFAULT 'planned' CHECK(delivery_state IN ('planned','sending','sent','failed')),
 provider_message_id text CHECK(provider_message_id IS NULL OR length(provider_message_id)<=256),
 error_code text CHECK(error_code IS NULL OR length(error_code)<=128),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),sent_at timestamptz
);
ALTER TABLE private.whatsapp_agent_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_agent_turns_service_only ON private.whatsapp_agent_turns
 FOR ALL TO service_role USING(true) WITH CHECK(true);
REVOKE ALL ON private.whatsapp_agent_turns FROM PUBLIC,anon,authenticated;
GRANT ALL ON private.whatsapp_agent_turns TO service_role;
CREATE INDEX whatsapp_agent_sessions_active_idx ON private.whatsapp_agent_sessions(instance_name,phone,expires_at) WHERE status='active';
CREATE INDEX whatsapp_agent_sessions_user_idx ON private.whatsapp_agent_sessions(user_id);
CREATE INDEX whatsapp_agent_sessions_event_idx ON private.whatsapp_agent_sessions(last_event_id);
CREATE INDEX whatsapp_agent_turns_company_idx ON private.whatsapp_agent_turns(company_id);
CREATE INDEX whatsapp_agent_turns_user_idx ON private.whatsapp_agent_turns(user_id);

CREATE FUNCTION public.get_whatsapp_agent_context(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE e public.whatsapp_inbound_events%rowtype; b private.whatsapp_bindings%rowtype; s private.whatsapp_agent_sessions%rowtype;
BEGIN
 SELECT * INTO e FROM public.whatsapp_inbound_events WHERE id=p_event_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'event_not_found' USING ERRCODE='P0002'; END IF;
 SELECT * INTO b FROM private.whatsapp_bindings WHERE instance_name=e.instance_name AND user_id=e.user_id AND company_id=e.company_id;
 IF NOT FOUND OR private.owner_company(e.user_id) IS DISTINCT FROM e.company_id THEN RAISE EXCEPTION 'verified_account_required' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM private.whatsapp_agent_sessions WHERE company_id=e.company_id AND user_id=e.user_id
  AND instance_name=e.instance_name AND phone=b.phone AND status='active' AND expires_at>now();
 RETURN jsonb_build_object('company_id',e.company_id,'user_id',e.user_id,'instance_name',e.instance_name,'phone',b.phone,
  'session',CASE WHEN s.company_id IS NULL THEN NULL ELSE jsonb_build_object('intent',s.intent,'slots',s.slots,'status',s.status,'expires_at',s.expires_at) END);
END $$;

CREATE FUNCTION public.save_whatsapp_agent_turn(p_event_id uuid,p_input_text text,p_intent text,p_slots jsonb,p_response_text text,p_session_status text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c jsonb; inserted boolean:=false; t private.whatsapp_agent_turns%rowtype;
BEGIN
 IF p_intent<>'earthwork_quote' OR p_session_status NOT IN ('active','complete','cancelled')
  OR jsonb_typeof(p_slots)<>'object' OR octet_length(p_slots::text)>16000
  OR p_input_text IS NULL OR octet_length(p_input_text)>64000
  OR length(p_response_text) NOT BETWEEN 1 AND 4096 THEN RAISE EXCEPTION 'invalid_agent_turn'; END IF;
 c:=public.get_whatsapp_agent_context(p_event_id);
 INSERT INTO private.whatsapp_agent_sessions(company_id,user_id,instance_name,phone,intent,slots,status,last_event_id,updated_at,expires_at)
 VALUES((c->>'company_id')::uuid,(c->>'user_id')::uuid,c->>'instance_name',c->>'phone',p_intent,p_slots,p_session_status,p_event_id,now(),now()+interval '24 hours')
 ON CONFLICT(company_id,user_id,instance_name,phone) DO UPDATE SET intent=EXCLUDED.intent,slots=EXCLUDED.slots,status=EXCLUDED.status,
  last_event_id=EXCLUDED.last_event_id,updated_at=now(),expires_at=EXCLUDED.expires_at;
 INSERT INTO private.whatsapp_agent_turns(event_id,company_id,user_id,instance_name,phone,input_text,intent,slots,response_text)
 VALUES(p_event_id,(c->>'company_id')::uuid,(c->>'user_id')::uuid,c->>'instance_name',c->>'phone',p_input_text,p_intent,p_slots,p_response_text)
 ON CONFLICT(event_id) DO NOTHING RETURNING * INTO t;
 inserted:=FOUND;
 IF NOT inserted THEN SELECT * INTO t FROM private.whatsapp_agent_turns WHERE event_id=p_event_id; END IF;
 RETURN jsonb_build_object('created',inserted,'delivery_state',t.delivery_state,'response_text',t.response_text,'phone',t.phone,'instance_name',t.instance_name);
END $$;

CREATE FUNCTION public.claim_whatsapp_agent_outbound(p_event_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t private.whatsapp_agent_turns%rowtype;
BEGIN
 SELECT * INTO t FROM private.whatsapp_agent_turns WHERE event_id=p_event_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'agent_turn_not_found' USING ERRCODE='P0002'; END IF;
 IF t.delivery_state='planned' THEN
  UPDATE private.whatsapp_agent_turns SET delivery_state='sending',updated_at=now() WHERE event_id=p_event_id RETURNING * INTO t;
 END IF;
 RETURN jsonb_build_object('delivery_state',t.delivery_state,'response_text',t.response_text,'phone',t.phone,'instance_name',t.instance_name);
END $$;

CREATE FUNCTION public.finish_whatsapp_agent_outbound(p_event_id uuid,p_success boolean,p_provider_message_id text DEFAULT NULL,p_error text DEFAULT NULL) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
BEGIN
 IF length(coalesce(p_provider_message_id,''))>256 OR length(coalesce(p_error,''))>128 THEN RAISE EXCEPTION 'invalid_delivery_result'; END IF;
 UPDATE private.whatsapp_agent_turns SET delivery_state=CASE WHEN p_success THEN 'sent' ELSE 'failed' END,
  provider_message_id=left(p_provider_message_id,256),error_code=left(p_error,128),updated_at=now(),sent_at=CASE WHEN p_success THEN now() ELSE NULL END
 WHERE event_id=p_event_id AND delivery_state='sending';
 RETURN FOUND;
END $$;

CREATE FUNCTION public.complete_whatsapp_agent_event(p_event_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE t private.whatsapp_agent_turns%rowtype;
BEGIN
 SELECT * INTO t FROM private.whatsapp_agent_turns WHERE event_id=p_event_id AND delivery_state='sent';
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.whatsapp_inbound_events SET status='processed',error_code=NULL,updated_at=now(),
  extracted_data=jsonb_build_object('text',t.input_text,'agent_intent',t.intent,'agent_slots',t.slots,'agent_response',t.response_text,'requires_human_review',false)
 WHERE id=p_event_id AND company_id=t.company_id AND user_id=t.user_id AND instance_name=t.instance_name;
 RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.get_whatsapp_agent_context(uuid),public.save_whatsapp_agent_turn(uuid,text,text,jsonb,text,text),
 public.claim_whatsapp_agent_outbound(uuid),public.finish_whatsapp_agent_outbound(uuid,boolean,text,text),public.complete_whatsapp_agent_event(uuid)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_whatsapp_agent_context(uuid),public.save_whatsapp_agent_turn(uuid,text,text,jsonb,text,text),
 public.claim_whatsapp_agent_outbound(uuid),public.finish_whatsapp_agent_outbound(uuid,boolean,text,text),public.complete_whatsapp_agent_event(uuid)
 TO service_role;
