-- Append to isolation.sql in one transaction, always ROLLBACK.
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
INSERT INTO private.whatsapp_bindings(instance_name,phone,user_id,company_id)
VALUES('workflow-test','5541999999998','a1000000-0000-4000-8000-000000000002',private.owner_company('a1000000-0000-4000-8000-000000000002'));
CREATE TEMP TABLE workflow_ids(key text PRIMARY KEY,id uuid,token uuid);
GRANT ALL ON workflow_ids TO service_role,authenticated;
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $$ DECLARE q jsonb; again jsonb; job jsonb; BEGIN
 q:=public.enqueue_whatsapp_event('{"instance":"workflow-test","phone":"5541999999998","jid":"5541999999998@s.whatsapp.net","id":"WORKFLOW_1","kind":"text","text":"Atividade sintética"}');
 again:=public.enqueue_whatsapp_event('{"instance":"workflow-test","phone":"5541999999998","id":"WORKFLOW_1","kind":"text","text":"mutated"}');
 IF q->>'id' IS DISTINCT FROM again->>'id' OR again->>'duplicate'<>'true' THEN RAISE EXCEPTION 'FAIL: durable deduplication'; END IF;
 INSERT INTO pg_temp.workflow_ids VALUES('event',(q->>'id')::uuid,NULL);
 job:=public.claim_whatsapp_job((q->>'id')::uuid);
 IF job IS NULL OR job->'input'->>'text'<>'Atividade sintética' THEN RAISE EXCEPTION 'FAIL: durable original input'; END IF;
 INSERT INTO pg_temp.workflow_ids VALUES('old',NULL,(job->>'token')::uuid);
 IF public.claim_whatsapp_job((q->>'id')::uuid) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: double claim'; END IF;
 IF public.finish_whatsapp_job((q->>'id')::uuid,gen_random_uuid(),'bad',NULL,false) THEN RAISE EXCEPTION 'FAIL: invalid lease accepted'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
UPDATE private.whatsapp_jobs SET lease_until=now()-interval '1 second' WHERE event_id=(SELECT id FROM workflow_ids WHERE key='event');
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $$ DECLARE eid uuid; job jsonb; oldtoken uuid; BEGIN
 SELECT id INTO eid FROM pg_temp.workflow_ids WHERE key='event'; SELECT token INTO oldtoken FROM pg_temp.workflow_ids WHERE key='old';
 job:=public.claim_whatsapp_job(eid);
 IF job IS NULL THEN RAISE EXCEPTION 'FAIL: interrupted event not recovered'; END IF;
 IF public.finish_whatsapp_job(eid,oldtoken,'stale',NULL,false) THEN RAISE EXCEPTION 'FAIL: expired worker overwrites result'; END IF;
 IF NOT public.finish_whatsapp_job(eid,(job->>'token')::uuid,'Conteúdo conferível',NULL,false) THEN RAISE EXCEPTION 'FAIL: recovery finalization'; END IF;
 IF public.claim_whatsapp_job(eid) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: finalized event reprocessed'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
DO $$ DECLARE d public.whatsapp_drafts; eid uuid; BEGIN
 SELECT id INTO eid FROM pg_temp.workflow_ids WHERE key='event';
 BEGIN PERFORM public.claim_whatsapp_job(eid); RAISE EXCEPTION 'FAIL: client claims job'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM private.whatsapp_jobs; RAISE EXCEPTION 'FAIL: queue payload exposed'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 d:=public.review_whatsapp_draft(eid,'save','expense','{"date":"2026-09-14","description":"Despesa sintética","amount":"120.50","company_id":"foreign","user_id":"foreign"}',0);
 IF d.payload ? 'company_id' OR d.payload ? 'user_id' THEN RAISE EXCEPTION 'FAIL: caller controls tenant'; END IF;
 BEGIN PERFORM public.review_whatsapp_draft(eid,'confirm',NULL,NULL,d.version); RAISE EXCEPTION 'FAIL: operator approves finance'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.review_whatsapp_draft(eid,'save','rdo','{}',0); RAISE EXCEPTION 'FAIL: stale version accepted'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%draft_version_conflict%' THEN RAISE; END IF; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.whatsapp_drafts WHERE event_id=(SELECT id FROM pg_temp.workflow_ids WHERE key='event')) THEN RAISE EXCEPTION 'FAIL: colleague draft visible'; END IF;
 BEGIN PERFORM public.review_whatsapp_draft((SELECT id FROM pg_temp.workflow_ids WHERE key='event'),'save','expense','{}',1); RAISE EXCEPTION 'FAIL: colleague draft writable'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $$ BEGIN
 BEGIN PERFORM public.review_whatsapp_draft((SELECT id FROM pg_temp.workflow_ids WHERE key='event'),'confirm',NULL,NULL,1); RAISE EXCEPTION 'FAIL: foreign approval'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM public.retry_whatsapp_event((SELECT id FROM pg_temp.workflow_ids WHERE key='event')); RAISE EXCEPTION 'FAIL: foreign retry'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $$ DECLARE d public.whatsapp_drafts; again public.whatsapp_drafts; eid uuid; BEGIN
 SELECT id INTO eid FROM pg_temp.workflow_ids WHERE key='event';
 d:=public.review_whatsapp_draft(eid,'confirm',NULL,NULL,1);
 again:=public.review_whatsapp_draft(eid,'confirm',NULL,NULL,1);
 IF d.record_id IS NULL OR d.record_id IS DISTINCT FROM again.record_id THEN RAISE EXCEPTION 'FAIL: repeated approval'; END IF;
 IF (SELECT count(*) FROM public.transactions WHERE title='Despesa sintética')<>1 THEN RAISE EXCEPTION 'FAIL: duplicated financial record'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.transactions WHERE id=d.record_id AND status='pending' AND amount=120.50 AND company_id=private.current_company()) THEN RAISE EXCEPTION 'FAIL: expense values'; END IF;
 BEGIN UPDATE public.whatsapp_drafts SET payload='{}' WHERE id=d.id; RAISE EXCEPTION 'FAIL: direct draft mutation'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
-- Two independent reviewable synthetic events, created with reliable owner data.
INSERT INTO public.whatsapp_inbound_events(id,company_id,user_id,instance_name,message_id,kind,status,text_content)
SELECT ('a5000000-0000-4000-8000-00000000000'||n)::uuid,company_id,user_id,'workflow-test','REVIEW_'||n,'text','needs_review','Synthetic'
FROM private.tenant_memberships CROSS JOIN generate_series(1,2) n WHERE user_id='a1000000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
DO $$ DECLARE d public.whatsapp_drafts; BEGIN
 d:=public.review_whatsapp_draft('a5000000-0000-4000-8000-000000000001','save','rdo','{"date":"2026-09-14","description":"Escavação sintética","machine_id":"b2000000-0000-4000-8000-000000000001"}',0);
 BEGIN PERFORM public.review_whatsapp_draft(d.event_id,'confirm',NULL,NULL,d.version); RAISE EXCEPTION 'FAIL: foreign machine'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 d:=public.review_whatsapp_draft(d.event_id,'save','rdo','{"date":"2026-09-14","description":"Escavação sintética","machine_id":"a2000000-0000-4000-8000-000000000001"}',d.version);
 d:=public.review_whatsapp_draft(d.event_id,'confirm',NULL,NULL,d.version);
 IF NOT EXISTS(SELECT 1 FROM public.rdos WHERE id=d.record_id AND user_id=auth.uid() AND machine_ids=ARRAY['a2000000-0000-4000-8000-000000000001'::uuid]) THEN RAISE EXCEPTION 'FAIL: RDO identity'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $$ DECLARE d public.whatsapp_drafts; BEGIN
 d:=public.review_whatsapp_draft('a5000000-0000-4000-8000-000000000002','save','service_order','{"date":"2026-09-14","description":"Serviço sintético","client":"Cliente sintético","machine_id":"a2000000-0000-4000-8000-000000000001","start_hour":"100","end_hour":"108","hourly_rate":"200"}',0);
 d:=public.review_whatsapp_draft(d.event_id,'confirm',NULL,NULL,d.version);
 IF NOT EXISTS(SELECT 1 FROM public.service_orders WHERE id=d.record_id AND total_hours=8 AND total_value=1600 AND status='pending') THEN RAISE EXCEPTION 'FAIL: service order calculation'; END IF;
 IF EXISTS(SELECT 1 FROM public.transactions WHERE title LIKE '%Cliente sintético') THEN RAISE EXCEPTION 'FAIL: premature revenue'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
SELECT 'PASS: durable queue, expired lease, deduplication, tenant/role isolation, draft versions, RDO, expense and OS confirmations' AS workflow_result;
-- Failure/backoff, bounded attempts and discard paths.
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $$ DECLARE q jsonb; j jsonb; eid uuid; BEGIN
 q:=public.enqueue_whatsapp_event('{"instance":"workflow-test","phone":"5541999999998","id":"RETRY_TEST","kind":"audio","mime":"audio/ogg","text":""}');eid:=(q->>'id')::uuid;
 INSERT INTO pg_temp.workflow_ids(key,id) VALUES('retry',eid);
 j:=public.claim_whatsapp_job(eid);
 PERFORM public.finish_whatsapp_job(eid,(j->>'token')::uuid,NULL,'transcription_failed',true);
 IF public.claim_whatsapp_job(eid) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: retry ignores backoff'; END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
DO $$ BEGIN
 BEGIN PERFORM public.retry_whatsapp_event((SELECT id FROM pg_temp.workflow_ids WHERE key='retry')); RAISE EXCEPTION 'FAIL: manual retry bypasses backoff'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%retry_backoff%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
UPDATE private.whatsapp_jobs SET attempts=5,available_at=now()-interval '1 second' WHERE event_id=(SELECT id FROM workflow_ids WHERE key='retry');
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
DO $$ BEGIN
 IF public.claim_whatsapp_job((SELECT id FROM pg_temp.workflow_ids WHERE key='retry')) IS NOT NULL THEN RAISE EXCEPTION 'FAIL: sixth attempt'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
INSERT INTO public.whatsapp_inbound_events(id,company_id,user_id,instance_name,message_id,kind,status)
SELECT 'a5000000-0000-4000-8000-000000000003',company_id,user_id,'workflow-test','DISCARD','text','needs_review' FROM private.tenant_memberships WHERE user_id='a1000000-0000-4000-8000-000000000001';
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $$ DECLARE d public.whatsapp_drafts; BEGIN
 d:=public.review_whatsapp_draft('a5000000-0000-4000-8000-000000000003','save','expense','{"date":"2026-09-14","description":"Bad value","amount":"NaN"}',0);
 BEGIN PERFORM public.review_whatsapp_draft(d.event_id,'confirm',NULL,NULL,d.version); RAISE EXCEPTION 'FAIL: invalid amount'; EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%invalid_amount%' THEN RAISE; END IF; END;
 d:=public.review_whatsapp_draft(d.event_id,'discard',NULL,NULL,d.version);
 IF d.state<>'discarded' OR d.record_id IS NOT NULL THEN RAISE EXCEPTION 'FAIL: discard produced record'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
SELECT 'PASS: workflow isolation, RDO/OS/expense, duplicate confirmation, fencing, retries/backoff/limits and discard' AS workflow_result;
