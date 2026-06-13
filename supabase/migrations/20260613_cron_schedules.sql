-- Agendamento das notificações via pg_cron
-- Requer extensão pg_cron habilitada no Supabase

-- End of shift: dias úteis às 17:55 (antes do fim do turno)
SELECT cron.schedule(
  'cron-end-of-shift',
  '55 17 * * 1-5',
  $$SELECT net.http_post(
    url:='https://gwusywstresijdjzkujn.supabase.co/functions/v1/cron-notifications',
    headers:='{"Content-Type":"application/json"}'::jsonb
  ) AS request_id;$$
);

-- Pending payments: dias úteis às 08:00
SELECT cron.schedule(
  'cron-pending-payments',
  '0 8 * * 1-5',
  $$SELECT net.http_post(
    url:='https://gwusywstresijdjzkujn.supabase.co/functions/v1/cron-notifications',
    headers:='{"Content-Type":"application/json"}'::jsonb
  ) AS request_id;$$
);

-- Machine maintenance: segunda-feira às 08:00
SELECT cron.schedule(
  'cron-machine-maintenance',
  '0 8 * * 1',
  $$SELECT net.http_post(
    url:='https://gwusywstresijdjzkujn.supabase.co/functions/v1/cron-notifications',
    headers:='{"Content-Type":"application/json"}'::jsonb
  ) AS request_id;$$
);

-- Daily report: domingo às 10:00
SELECT cron.schedule(
  'cron-daily-report',
  '0 10 * * 0',
  $$SELECT net.http_post(
    url:='https://gwusywstresijdjzkujn.supabase.co/functions/v1/cron-notifications',
    headers:='{"Content-Type":"application/json"}'::jsonb
  ) AS request_id;$$
);
