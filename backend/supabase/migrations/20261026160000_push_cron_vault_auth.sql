-- =========================================================
-- MiPeque - autenticación del cron push mediante Vault
-- 2026-10-26
-- =========================================================

create or replace function public.is_valid_push_cron_secret(
  p_secret text
)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select
    coalesce(p_secret, '') <> ''
    and exists (
      select 1
      from vault.decrypted_secrets
      where name = 'mipeque_push_cron_secret'
        and decrypted_secret = p_secret
    );
$$;

revoke all
on function public.is_valid_push_cron_secret(text)
from public, anon, authenticated;

grant execute
on function public.is_valid_push_cron_secret(text)
to service_role;

do $$
declare
  v_secret_id uuid;
  v_new_secret text;
begin
  select id
  into v_secret_id
  from vault.decrypted_secrets
  where name = 'mipeque_push_cron_secret'
  limit 1;

  v_new_secret :=
    replace(
      gen_random_uuid()::text ||
      gen_random_uuid()::text,
      '-',
      ''
    );

  if v_secret_id is null then
    perform vault.create_secret(
      v_new_secret,
      'mipeque_push_cron_secret',
      'Secreto rotado para autenticar el cron de Web Push.'
    );
  else
    perform vault.update_secret(
      v_secret_id,
      v_new_secret,
      'mipeque_push_cron_secret',
      'Secreto rotado para autenticar el cron de Web Push.'
    );
  end if;
end
$$;
