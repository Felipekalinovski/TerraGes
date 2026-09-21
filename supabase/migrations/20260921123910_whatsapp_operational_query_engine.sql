-- Controlled, tenant-scoped operational queries for the WhatsApp agent.
ALTER TABLE private.whatsapp_agent_turns DROP CONSTRAINT whatsapp_agent_turns_intent_check;
ALTER TABLE private.whatsapp_agent_turns ADD CONSTRAINT whatsapp_agent_turns_intent_check
 CHECK(intent IN ('earthwork_quote','terrages_action','terrages_query'));

CREATE FUNCTION public.run_whatsapp_operational_query(
 p_event_id uuid,
 p_query_type text,
 p_machine_query text DEFAULT NULL,
 p_start_date date DEFAULT NULL,
 p_end_date date DEFAULT NULL,
 p_limit integer DEFAULT 10
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c jsonb; company uuid; actor uuid; role_name text; q text:=left(trim(coalesce(p_machine_query,'')),100);
 start_on date:=coalesce(p_start_date,current_date-30); end_on date:=coalesce(p_end_date,current_date); row_limit integer:=greatest(1,least(coalesce(p_limit,10),10)); rows jsonb;
BEGIN
 IF p_query_type NOT IN ('machine_status','maintenance_alerts','open_service_orders','recent_rdos','expense_summary','financial_summary') THEN
  RAISE EXCEPTION 'unsupported_query_type' USING ERRCODE='22023';
 END IF;
 IF start_on<'2000-01-01' OR end_on<start_on OR end_on>current_date+1 OR end_on-start_on>366 THEN
  RAISE EXCEPTION 'invalid_query_period' USING ERRCODE='22023';
 END IF;
 c:=public.get_whatsapp_action_context(p_event_id);
 company:=(c->>'company_id')::uuid; actor:=(c->>'user_id')::uuid; role_name:=c->>'role';
 IF p_query_type IN ('maintenance_alerts','expense_summary','financial_summary') AND role_name NOT IN ('admin','gestor') THEN
  RAISE EXCEPTION 'manager_required' USING ERRCODE='42501';
 END IF;

 IF p_query_type='machine_status' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('name',z.name,'type',z.type,'status',z.status,'hours',z.hours,
   'next_maintenance',z.next_maintenance,'last_maintenance',z.last_maintenance,'health_status',z.health_status,'health_reason',z.health_reason)),'[]'::jsonb) INTO rows
  FROM (
   SELECT x.name,x.type,x.status,x.hours,x.next_maintenance,x.last_maintenance,x.health_status,x.health_reason
   FROM public.machines x WHERE x.company_id=company
    AND (role_name IN ('admin','gestor') OR x.user_id=actor OR EXISTS(SELECT 1 FROM public.machine_assignments a WHERE a.machine_id=x.id AND a.user_id=actor AND a.company_id=x.company_id))
    AND (q='' OR lower(x.name) LIKE '%'||lower(q)||'%')
   ORDER BY x.name LIMIT row_limit
  ) z;
 ELSIF p_query_type='maintenance_alerts' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('machine',z.name,'type',z.type,'status',z.status,'hours',z.hours,'next_maintenance',z.next_maintenance,'health_status',z.health_status,'health_reason',z.health_reason)),'[]'::jsonb) INTO rows
  FROM (
   SELECT x.name,x.type,x.status,x.hours,x.next_maintenance,x.health_status,x.health_reason
   FROM public.machines x WHERE x.company_id=company AND x.next_maintenance IS NOT NULL AND x.next_maintenance<=current_date+30
   ORDER BY x.next_maintenance,x.name LIMIT row_limit
  ) z;
 ELSIF p_query_type='open_service_orders' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('date',z.date,'client',z.client,'machine',z.machine,'status',z.status,'location',z.location,'total_hours',z.total_hours,'total_value',z.total_value)),'[]'::jsonb) INTO rows
  FROM (
   SELECT s.date,s.client,m.name machine,s.status,s.location,s.total_hours,s.total_value
   FROM public.service_orders s LEFT JOIN public.machines m ON m.id=s.machine_id AND m.company_id=s.company_id
   WHERE s.company_id=company AND (role_name IN ('admin','gestor') OR s.user_id=actor)
    AND coalesce(lower(s.status),'pending') NOT IN ('completed','concluida','concluído','cancelled','cancelada')
   ORDER BY s.date DESC NULLS LAST,s.created_at DESC LIMIT row_limit
  ) z;
 ELSIF p_query_type='recent_rdos' THEN
  SELECT coalesce(jsonb_agg(jsonb_build_object('date',z.date,'activity',z.activity,'project',z.project,'machines',z.machines,'status',z.status,'occurrences',z.occurrences)),'[]'::jsonb) INTO rows
  FROM (
   SELECT r.date::date,r.activity,r.project,r.machines,r.status,r.occurrences
   FROM public.rdos r WHERE r.company_id=company AND r.date::date BETWEEN start_on AND end_on AND (role_name IN ('admin','gestor') OR r.user_id=actor)
   ORDER BY r.date DESC LIMIT row_limit
  ) z;
 ELSIF p_query_type='expense_summary' THEN
  SELECT jsonb_build_object('total',coalesce(sum(t.amount),0),'count',count(*),'by_category',coalesce((
   SELECT jsonb_object_agg(grouped.category,grouped.total) FROM (
    SELECT coalesce(nullif(x.category,''),'Sem categoria') category,sum(x.amount) total FROM public.transactions x
    WHERE x.company_id=company AND lower(x.type)='expense' AND x.date BETWEEN start_on AND end_on GROUP BY 1 ORDER BY total DESC LIMIT 10
   ) grouped),'{}'::jsonb)) INTO rows
  FROM public.transactions t WHERE t.company_id=company AND lower(t.type)='expense' AND t.date BETWEEN start_on AND end_on;
 ELSIF p_query_type='financial_summary' THEN
  SELECT jsonb_build_object('income',coalesce(sum(t.amount) FILTER(WHERE lower(t.type)='income'),0),'expenses',coalesce(sum(t.amount) FILTER(WHERE lower(t.type)='expense'),0),'pending',coalesce(sum(t.amount) FILTER(WHERE lower(t.status)='pending'),0),'balance',coalesce(sum(CASE WHEN lower(t.type)='income' THEN t.amount WHEN lower(t.type)='expense' THEN -t.amount ELSE 0 END),0)) INTO rows
  FROM public.transactions t WHERE t.company_id=company AND t.date BETWEEN start_on AND end_on;
 END IF;
 RETURN jsonb_build_object('query_type',p_query_type,'start_date',start_on,'end_date',end_on,'rows',coalesce(rows,'[]'::jsonb));
END $$;

CREATE FUNCTION public.save_whatsapp_query_response(p_event_id uuid,p_input_text text,p_query jsonb,p_response_text text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c jsonb; t private.whatsapp_agent_turns%rowtype; inserted boolean;
BEGIN
 IF jsonb_typeof(p_query)<>'object' OR octet_length(p_query::text)>4000 OR octet_length(coalesce(p_input_text,''))>64000 OR length(p_response_text) NOT BETWEEN 1 AND 4096 THEN RAISE EXCEPTION 'invalid_query_response'; END IF;
 c:=public.get_whatsapp_action_context(p_event_id);
 INSERT INTO private.whatsapp_agent_turns(event_id,company_id,user_id,instance_name,phone,input_text,intent,slots,response_text)
 VALUES(p_event_id,(c->>'company_id')::uuid,(c->>'user_id')::uuid,c->>'instance_name',c->>'phone',p_input_text,'terrages_query',p_query,p_response_text)
 ON CONFLICT(event_id) DO NOTHING RETURNING * INTO t;
 inserted:=FOUND; IF NOT inserted THEN SELECT * INTO t FROM private.whatsapp_agent_turns WHERE event_id=p_event_id; END IF;
 RETURN jsonb_build_object('created',inserted,'delivery_state',t.delivery_state,'response_text',t.response_text,'phone',t.phone,'instance_name',t.instance_name);
END $$;

REVOKE ALL ON FUNCTION public.run_whatsapp_operational_query(uuid,text,text,date,date,integer),public.save_whatsapp_query_response(uuid,text,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.run_whatsapp_operational_query(uuid,text,text,date,date,integer),public.save_whatsapp_query_response(uuid,text,jsonb,text) TO service_role;
