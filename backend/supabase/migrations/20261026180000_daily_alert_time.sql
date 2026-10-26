-- =========================================================
-- MiPeque - hora diaria configurable para avisos por fecha
-- 2026-10-26
-- =========================================================

alter table public.family_settings
  add column if not exists daily_alert_time time
  not null default '09:00';

create or replace function public.save_family_daily_alert_time(
  p_family_id uuid,
  p_daily_alert_time time default '09:00'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_family_id is null then
    raise exception
      'No se encontró la familia activa.';
  end if;

  if not public.has_full_family_access(
    p_family_id
  )
  and not public.is_app_admin() then
    raise exception
      'No tenés permiso para modificar la configuración de esta familia.';
  end if;

  insert into public.family_settings (
    family_id,
    daily_alert_time
  )
  values (
    p_family_id,
    coalesce(
      p_daily_alert_time,
      '09:00'::time
    )
  )
  on conflict (family_id)
  do update set
    daily_alert_time =
      excluded.daily_alert_time,
    updated_at = now();

  return jsonb_build_object(
    'familyId',
    p_family_id,
    'dailyAlertTime',
    to_char(
      coalesce(
        p_daily_alert_time,
        '09:00'::time
      ),
      'HH24:MI'
    ),
    'status',
    'saved'
  );
end;
$$;

revoke all
on function public.save_family_daily_alert_time(
  uuid,
  time
)
from public, anon;

grant execute
on function public.save_family_daily_alert_time(
  uuid,
  time
)
to authenticated;
