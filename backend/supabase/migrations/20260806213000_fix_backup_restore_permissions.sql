-- =========================================================
-- MiPeque
-- Corrige la restauración de copias de seguridad.
--
-- El error 403 ocurría al intentar hacer un UPSERT directo
-- sobre family_settings desde el navegador. Esta función
-- guarda la configuración desde PostgreSQL, después de
-- comprobar que la cuenta tiene acceso completo a la familia.
-- =========================================================

create or replace function public.save_family_settings_secure(
  p_family_id uuid,
  p_family_name text,
  p_contact_name text default '',
  p_contact_email text default '',
  p_phone text default '',
  p_default_caregiver_id uuid default null,
  p_reminder_advance_minutes integer default 15,
  p_expiration_warning_days integer default 30,
  p_vaccine_warning_days integer default 30,
  p_show_overdue_alerts boolean default true,
  p_show_stock_alerts boolean default true,
  p_show_expiration_alerts boolean default true,
  p_show_vaccine_alerts boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_has_full_access boolean := false;
begin
  if p_family_id is null then
    raise exception
      'No se encontró la familia activa.';
  end if;

  select exists (
    select 1
    from public.family_members member
    inner join public.profiles profile
      on profile.id = member.user_id
    where member.family_id = p_family_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and profile.status = 'active'
      and (
        member.member_role = 'owner'
        or coalesce(
          member.access_level,
          'full_access'
        ) = 'full_access'
      )
  )
  into v_has_full_access;

  if not v_has_full_access
     and not public.is_app_admin() then
    raise exception
      'No tenés permiso para modificar la configuración de esta familia.';
  end if;

  if not exists (
    select 1
    from public.families
    where id = p_family_id
  ) then
    raise exception
      'La familia seleccionada no existe.';
  end if;

  if p_default_caregiver_id is not null
     and not exists (
       select 1
       from public.caregivers
       where id = p_default_caregiver_id
         and family_id = p_family_id
         and is_active = true
     ) then
    raise exception
      'El responsable predeterminado no pertenece a esta familia o está desactivado.';
  end if;

  if coalesce(
    p_reminder_advance_minutes,
    15
  ) not between 0 and 1440 then
    raise exception
      'El aviso previo debe estar entre 0 y 1440 minutos.';
  end if;

  if coalesce(
    p_expiration_warning_days,
    30
  ) not between 1 and 365 then
    raise exception
      'El aviso de vencimiento debe estar entre 1 y 365 días.';
  end if;

  if coalesce(
    p_vaccine_warning_days,
    30
  ) not between 1 and 365 then
    raise exception
      'El aviso de vacunas debe estar entre 1 y 365 días.';
  end if;

  update public.families
  set
    family_name = coalesce(
      nullif(
        trim(p_family_name),
        ''
      ),
      family_name
    ),
    updated_at = now()
  where id = p_family_id;

  insert into public.family_settings (
    family_id,
    contact_name,
    contact_email,
    phone,
    default_caregiver_id,
    reminder_advance_minutes,
    expiration_warning_days,
    vaccine_warning_days,
    show_overdue_alerts,
    show_stock_alerts,
    show_expiration_alerts,
    show_vaccine_alerts
  )
  values (
    p_family_id,
    coalesce(
      trim(p_contact_name),
      ''
    ),
    lower(
      coalesce(
        trim(p_contact_email),
        ''
      )
    ),
    coalesce(
      trim(p_phone),
      ''
    ),
    p_default_caregiver_id,
    coalesce(
      p_reminder_advance_minutes,
      15
    ),
    coalesce(
      p_expiration_warning_days,
      30
    ),
    coalesce(
      p_vaccine_warning_days,
      30
    ),
    coalesce(
      p_show_overdue_alerts,
      true
    ),
    coalesce(
      p_show_stock_alerts,
      true
    ),
    coalesce(
      p_show_expiration_alerts,
      true
    ),
    coalesce(
      p_show_vaccine_alerts,
      true
    )
  )
  on conflict (family_id)
  do update set
    contact_name = excluded.contact_name,
    contact_email = excluded.contact_email,
    phone = excluded.phone,
    default_caregiver_id = excluded.default_caregiver_id,
    reminder_advance_minutes = excluded.reminder_advance_minutes,
    expiration_warning_days = excluded.expiration_warning_days,
    vaccine_warning_days = excluded.vaccine_warning_days,
    show_overdue_alerts = excluded.show_overdue_alerts,
    show_stock_alerts = excluded.show_stock_alerts,
    show_expiration_alerts = excluded.show_expiration_alerts,
    show_vaccine_alerts = excluded.show_vaccine_alerts,
    updated_at = now();

  return jsonb_build_object(
    'familyId', p_family_id,
    'status', 'saved'
  );
end;
$$;

revoke all on function public.save_family_settings_secure(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  integer,
  integer,
  integer,
  boolean,
  boolean,
  boolean,
  boolean
)
from public;

revoke all on function public.save_family_settings_secure(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  integer,
  integer,
  integer,
  boolean,
  boolean,
  boolean,
  boolean
)
from anon;

grant execute on function public.save_family_settings_secure(
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  integer,
  integer,
  integer,
  boolean,
  boolean,
  boolean,
  boolean
)
to authenticated;
