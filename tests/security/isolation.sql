-- Run in ONE transaction after the migration and ROLLBACK. No fixtures may be committed.
INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES
 ('a1000000-0000-4000-8000-000000000001','tenant-a@terrages-test.invalid','{}'),
 ('b1000000-0000-4000-8000-000000000001','tenant-b@terrages-test.invalid','{}'),
 ('a1000000-0000-4000-8000-000000000002','operator-a@terrages-test.invalid','{}'),
 ('a1000000-0000-4000-8000-000000000003','operator-a2@terrages-test.invalid','{}');
UPDATE private.tenant_memberships SET company_id=(SELECT company_id FROM private.tenant_memberships WHERE user_id='a1000000-0000-4000-8000-000000000001'),role='operator' WHERE user_id IN ('a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003');
UPDATE public.profiles p SET company_id=m.company_id,role=m.role FROM private.tenant_memberships m WHERE p.id=m.user_id AND p.id IN ('a1000000-0000-4000-8000-000000000002','a1000000-0000-4000-8000-000000000003');
INSERT INTO public.machines(id,name,type,user_id,company_id) VALUES
 ('a2000000-0000-4000-8000-000000000001','isolation-fixture-a','excavator','a1000000-0000-4000-8000-000000000001',private.owner_company('a1000000-0000-4000-8000-000000000001')),
 ('b2000000-0000-4000-8000-000000000001','isolation-fixture-b','excavator','b1000000-0000-4000-8000-000000000001',private.owner_company('b1000000-0000-4000-8000-000000000001'));
INSERT INTO public.machine_assignments(company_id,machine_id,user_id) VALUES(private.owner_company('a1000000-0000-4000-8000-000000000002'),'a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000002');
INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES
 ('whatsapp-media',private.owner_company('b1000000-0000-4000-8000-000000000001')::text||'/b1000000-0000-4000-8000-000000000001/secret.pdf','b1000000-0000-4000-8000-000000000001'),
 ('whatsapp-media',private.owner_company('a1000000-0000-4000-8000-000000000002')::text||'/a1000000-0000-4000-8000-000000000002/audio.ogg','a1000000-0000-4000-8000-000000000002');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $$ BEGIN
 IF (SELECT count(*) FROM public.machines WHERE name LIKE 'isolation-fixture-%')<>1 THEN RAISE EXCEPTION 'FAIL: manager sees foreign machines'; END IF;
 IF (SELECT count(*) FROM public.profiles)<>1 THEN RAISE EXCEPTION 'FAIL: profile visibility'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE name LIKE '%/secret.pdf') THEN RAISE EXCEPTION 'FAIL: other company media'; END IF;
 IF (SELECT count(*) FROM public.company_info)<>1 THEN RAISE EXCEPTION 'FAIL: company visibility'; END IF;
 BEGIN
  UPDATE public.profiles SET role='admin',company_id='00000000-0000-4000-8000-000000000000' WHERE id=auth.uid();
  RAISE EXCEPTION 'FAIL: mutable authorization';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.hora_maquina(machine_name,date,start_time,end_time,machine_id) VALUES('bad','2026-09-14','08:00','09:00','b2000000-0000-4000-8000-000000000001');
  RAISE EXCEPTION 'FAIL: cross-company foreign key accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.get_relevant_memories(NULL,5,NULL);
  RAISE EXCEPTION 'FAIL: privileged legacy RPC accessible';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated","user_metadata":{"role":"admin","company_id":"b1000000-0000-4000-8000-000000000001"}}',true);
INSERT INTO public.hora_maquina(id,machine_name,project_name,date,start_time,end_time,total_hours,machine_id) VALUES('a3000000-0000-4000-8000-000000000002','isolation-fixture-hours','Obra de teste','2026-09-14','08:00','09:00',1,'a2000000-0000-4000-8000-000000000001');
INSERT INTO public.service_orders(id,date,client,machine_id,start_hour,end_hour,hourly_rate,status)
VALUES('a4000000-0000-4000-8000-000000000002','2026-09-14','isolation-fixture-client','a2000000-0000-4000-8000-000000000001',10,11,100,'pending');
DO $$ BEGIN
 IF private.is_manager() THEN RAISE EXCEPTION 'FAIL: metadata role escalation'; END IF;
 IF (SELECT count(*) FROM public.machines WHERE name LIKE 'isolation-fixture-%')<>1 THEN RAISE EXCEPTION 'FAIL: assigned asset visibility'; END IF;
 IF (SELECT user_id FROM public.hora_maquina WHERE id='a3000000-0000-4000-8000-000000000002')<>auth.uid() THEN RAISE EXCEPTION 'FAIL: missing owner'; END IF;
 IF EXISTS(SELECT 1 FROM public.transactions) THEN RAISE EXCEPTION 'FAIL: operator financial access'; END IF;
 BEGIN
  INSERT INTO public.machine_assignments(company_id,machine_id,user_id) VALUES(private.current_company(),'a2000000-0000-4000-8000-000000000001','a1000000-0000-4000-8000-000000000003');
  RAISE EXCEPTION 'FAIL: operator grants access';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO storage.objects(bucket_id,name,owner_id) VALUES('service-receipts','foreign-company/foreign-user/test.pdf',auth.uid()::text);
  RAISE EXCEPTION 'FAIL: cross-tenant upload';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.hora_maquina WHERE id='a3000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'FAIL: operator sees colleague record'; END IF;
 IF EXISTS(SELECT 1 FROM storage.objects WHERE name LIKE '%/audio.ogg') THEN RAISE EXCEPTION 'FAIL: operator sees colleague media'; END IF;
 IF EXISTS(SELECT 1 FROM public.machines WHERE id='a2000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'FAIL: unassigned machine visible'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.hora_maquina WHERE id='a3000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'FAIL: manager cannot see own team'; END IF;
 UPDATE public.service_orders SET status='completed' WHERE id='a4000000-0000-4000-8000-000000000002';
 IF NOT EXISTS(SELECT 1 FROM public.transactions WHERE title LIKE '%isolation-fixture-client' AND company_id=private.current_company()) THEN RAISE EXCEPTION 'FAIL: manager completion of operator order'; END IF;

 IF public.create_whatsapp_pairing() NOT LIKE 'VINCULAR %' THEN RAISE EXCEPTION 'FAIL: pairing'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.hora_maquina WHERE id='a3000000-0000-4000-8000-000000000002') THEN RAISE EXCEPTION 'FAIL: other company sees record'; END IF;
 UPDATE public.hora_maquina SET observations='attacked' WHERE id='a3000000-0000-4000-8000-000000000002';
 IF FOUND THEN RAISE EXCEPTION 'FAIL: cross-company UPDATE'; END IF;
 DELETE FROM public.hora_maquina WHERE id='a3000000-0000-4000-8000-000000000002';
 IF FOUND THEN RAISE EXCEPTION 'FAIL: cross-company DELETE'; END IF;
END $$;
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
DO $$ BEGIN
 BEGIN PERFORM * FROM public.profiles; RAISE EXCEPTION 'FAIL: anonymous profile access'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN PERFORM * FROM public.pending_actions; RAISE EXCEPTION 'FAIL: anonymous pending actions'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
INSERT INTO public.whatsapp_inbound_events(company_id,user_id,instance_name,message_id,kind)
SELECT company_id,id,'test-instance','test-inbound-id','text' FROM public.profiles WHERE id='a1000000-0000-4000-8000-000000000002';
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
DO $$ DECLARE token text; cid uuid; BEGIN
 SELECT token_hash,company_id INTO token,cid FROM private.whatsapp_pairing WHERE user_id='a1000000-0000-4000-8000-000000000001';
 -- Known synthetic challenge, consumed only by a service role provider call.
 UPDATE private.whatsapp_pairing SET token_hash=encode(extensions.digest(repeat('a',32),'sha256'),'hex') WHERE user_id='a1000000-0000-4000-8000-000000000001';
 PERFORM set_config('request.jwt.claims','{"role":"service_role"}',true);
 IF NOT public.verify_whatsapp_pairing('test-instance','5541999999999',repeat('a',32)) THEN RAISE EXCEPTION 'FAIL: valid pairing rejected'; END IF;
 IF public.verify_whatsapp_pairing('test-instance','5541999999999',repeat('a',32)) THEN RAISE EXCEPTION 'FAIL: reused token accepted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.resolve_whatsapp_identity('test-instance','5541999999999') r WHERE r.company_id=cid AND r.user_id='a1000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'FAIL: wrong binding'; END IF;
 IF EXISTS(SELECT 1 FROM public.resolve_whatsapp_identity('other-instance','5541999999999')) THEN RAISE EXCEPTION 'FAIL: cross-instance binding'; END IF;
 PERFORM set_config('request.jwt.claims','{}',true);
END $$;
SELECT 'PASS: tenant, operator, mutation, metadata, RPC, storage and pairing checks' AS test_result;
