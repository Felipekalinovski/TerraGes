-- psql usage: psql ... -v project_ref=YOUR_PROJECT_REF -f supabase/operations/configure-whatsapp-worker.sql
-- Run only as the database administrator, after the stage-2 migrations and worker deployment.
-- Configures the endpoint without reading, copying or printing the worker secret.
\set ON_ERROR_STOP on
BEGIN;
UPDATE private.whatsapp_worker_config
SET endpoint = format('https://%s.supabase.co/functions/v1/whatsapp-worker', :'project_ref')
WHERE singleton;
SELECT jobname, schedule, active FROM cron.job WHERE jobname='terrages-whatsapp-recovery';
COMMIT;
