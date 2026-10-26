create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Reemplazá estos placeholders antes de ejecutar este archivo.
-- Nunca guardes secretos reales en Git.
select vault.create_secret(
  'https://TU-PROYECTO.supabase.co',
  'mipeque_project_url'
);

select vault.create_secret(
  'TU_CRON_SECRET',
  'mipeque_push_cron_secret'
);

select cron.schedule(
  'mipeque-push-notifications',
  '* * * * *',
  $$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'mipeque_project_url'
        limit 1
      ) || '/functions/v1/push-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-mipeque-cron-secret', (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'mipeque_push_cron_secret'
          limit 1
        )
      ),
      body := '{"mode":"dispatch"}'::jsonb
    ) as request_id;
  $$
);
