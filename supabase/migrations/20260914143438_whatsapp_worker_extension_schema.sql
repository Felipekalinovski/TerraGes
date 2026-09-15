-- pg_net was just introduced and has no queued requests. Recreate its extension metadata outside the public API schema.
DO $$ BEGIN IF EXISTS(SELECT 1 FROM net.http_request_queue) OR EXISTS(SELECT 1 FROM private.whatsapp_jobs WHERE state IN ('queued','processing')) THEN RAISE EXCEPTION 'worker_queue_must_be_idle'; END IF; END $$;
DROP EXTENSION pg_net;
CREATE EXTENSION pg_net WITH SCHEMA extensions;
REVOKE ALL ON SCHEMA net FROM PUBLIC,anon,authenticated;
