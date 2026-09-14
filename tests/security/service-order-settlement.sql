-- Append after tests/security/isolation.sql; always end transaction with ROLLBACK.
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
CREATE TEMP TABLE settlement_test_ids(id uuid);
GRANT ALL ON settlement_test_ids TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
INSERT INTO public.service_orders(id,date,client,machine_id,start_hour,end_hour,hourly_rate,payment_method,status)
VALUES('a6000000-0000-4000-8000-000000000001','2026-09-14','settlement-fixture','a2000000-0000-4000-8000-000000000001',100,108,200,'Pix','pending');
DO $$ BEGIN
 BEGIN
  UPDATE public.service_orders SET status='completed' WHERE id='a6000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'FAIL: operator completes finance';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF (SELECT status FROM public.service_orders WHERE id='a6000000-0000-4000-8000-000000000001')<>'pending' THEN RAISE EXCEPTION 'FAIL: rejected completion changed status'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"b1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
DO $$ BEGIN
 UPDATE public.service_orders SET status='completed' WHERE id='a6000000-0000-4000-8000-000000000001';
 IF FOUND THEN RAISE EXCEPTION 'FAIL: foreign company completes order'; END IF;
END $$;
SELECT set_config('request.jwt.claims','{"sub":"a1000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
UPDATE public.service_orders SET status='completed' WHERE id='a6000000-0000-4000-8000-000000000001';
UPDATE public.service_orders SET status='completed' WHERE id='a6000000-0000-4000-8000-000000000001';
DO $$ DECLARE t public.transactions; BEGIN
 IF (SELECT count(*) FROM public.transactions WHERE title LIKE '%settlement-fixture')<>1 THEN RAISE EXCEPTION 'FAIL: repeated completion creates duplicate'; END IF;
 SELECT * INTO t FROM public.transactions WHERE title LIKE '%settlement-fixture';
 IF t.amount<>1600 OR t.status<>'pending' OR t.company_id IS DISTINCT FROM private.current_company() OR t.user_id<>auth.uid() THEN RAISE EXCEPTION 'FAIL: invalid settlement or automatic paid status'; END IF;
 INSERT INTO pg_temp.settlement_test_ids VALUES(t.id);
 IF (SELECT hours FROM public.machines WHERE id='a2000000-0000-4000-8000-000000000001')<>108 THEN RAISE EXCEPTION 'FAIL: machine hours'; END IF;
 BEGIN
  UPDATE public.service_orders SET status='pending' WHERE id='a6000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'FAIL: settled order reopened';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  UPDATE public.service_orders SET hourly_rate=999 WHERE id='a6000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'FAIL: settled amount silently changed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  DELETE FROM public.service_orders WHERE id='a6000000-0000-4000-8000-000000000001';
  RAISE EXCEPTION 'FAIL: settlement source deleted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  DELETE FROM public.transactions WHERE id=t.id;
  RAISE EXCEPTION 'FAIL: generated transaction deleted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
 BEGIN
  UPDATE public.transactions SET amount=1 WHERE id=t.id;
  RAISE EXCEPTION 'FAIL: settled amount silently changed in finance';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 UPDATE public.transactions SET status='paid' WHERE id=t.id;
 IF NOT EXISTS(SELECT 1 FROM public.transactions WHERE id=t.id AND status='paid') THEN RAISE EXCEPTION 'FAIL: manager cannot confirm receipt'; END IF;
 BEGIN PERFORM * FROM private.service_order_settlements; RAISE EXCEPTION 'FAIL: private ledger visible'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
-- Older service cannot reduce the current meter.
INSERT INTO public.service_orders(id,date,client,machine_id,start_hour,end_hour,hourly_rate,payment_method,status)
VALUES('a6000000-0000-4000-8000-000000000002','2026-09-13','settlement-older-fixture','a2000000-0000-4000-8000-000000000001',90,95,100,'Faturado','completed');
DO $$ BEGIN
 IF (SELECT hours FROM public.machines WHERE id='a2000000-0000-4000-8000-000000000001')<>108 THEN RAISE EXCEPTION 'FAIL: meter regressed'; END IF;
 BEGIN
  INSERT INTO public.service_orders(date,client,machine_id,start_hour,end_hour,hourly_rate,status)
   VALUES('2026-09-14','invalid-settlement','a2000000-0000-4000-8000-000000000001',108,100,200,'completed');
  RAISE EXCEPTION 'FAIL: invalid hours accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE '%invalid_service_order%' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM public.transactions WHERE title LIKE '%invalid-settlement') THEN RAISE EXCEPTION 'FAIL: failed transaction left revenue'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{}',true);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM private.service_order_settlements WHERE service_order_id='a6000000-0000-4000-8000-000000000001'
  AND transaction_id=(SELECT id FROM pg_temp.settlement_test_ids)) THEN RAISE EXCEPTION 'FAIL: settlement audit link'; END IF;
END $$;
SELECT 'PASS: settlement authorization, isolation, duplicate prevention, payment confirmation, protected completion, rollback and machine meter' AS test_result;
