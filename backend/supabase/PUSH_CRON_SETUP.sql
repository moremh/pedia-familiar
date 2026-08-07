create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret(
  'https://gatkzjldibknvprgjvxi.supabase.co',
  'mipeque_project_url'
);

select vault.create_secret(
  'cdfe5eb17eac763eb2d0bb7a405306ba4420809e5207f26e36303aa1e309e3d8',
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
