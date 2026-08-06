-- =========================================================
-- MiPeque - Núcleo: usuarios, familias, responsables,
-- invitaciones, prueba gratuita y suscripciones
-- =========================================================

create extension if not exists pgcrypto with schema extensions;

-- =========================================================
-- Utilidades
-- =========================================================

create or replace function public.normalize_phone(phone_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(
    regexp_replace(coalesce(phone_value, ''), '[^0-9]', '', 'g'),
    ''
  );
$$;

create or replace function public.hash_identity(identity_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(trim(identity_value), '') is null then null
    else encode(
      extensions.digest(lower(trim(identity_value)), 'sha256'),
      'hex'
    )
  end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- Perfiles
-- =========================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text not null default '',
  phone text,
  avatar_url text,
  app_role text not null default 'family'
    check (app_role in ('family', 'admin')),
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    phone
  )
  values (
    new.id,
    lower(new.email),
    trim(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )),
    public.normalize_phone(coalesce(
      new.raw_user_meta_data ->> 'phone',
      new.phone
    ))
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = case
      when excluded.full_name <> '' then excluded.full_name
      else public.profiles.full_name
    end,
    phone = coalesce(excluded.phone, public.profiles.phone),
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =========================================================
-- Familias
-- =========================================================

create table public.families (
  id uuid primary key default gen_random_uuid(),
  family_name text not null
    check (char_length(trim(family_name)) >= 2),
  created_by uuid not null
    references public.profiles(id) on delete restrict,
  access_status text not null default 'pending_payment'
    check (access_status in (
      'trial',
      'active',
      'pending_payment',
      'expired',
      'suspended'
    )),
  current_plan text not null default 'none'
    check (current_plan in ('none', 'trial', 'monthly', 'annual')),
  requested_plan text
    check (requested_plan is null or requested_plan in ('monthly', 'annual')),
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  children_count integer not null default 0
    check (children_count >= 0),
  members_count integer not null default 0
    check (members_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_trial_period check (
    trial_started_at is null
    or trial_ends_at is null
    or trial_ends_at > trial_started_at
  ),
  constraint valid_subscription_period check (
    current_period_start is null
    or current_period_end is null
    or current_period_end > current_period_start
  )
);

create index families_created_by_idx on public.families(created_by);
create index families_access_status_idx on public.families(access_status);

create trigger families_set_updated_at
before update on public.families
for each row execute function public.set_updated_at();

-- =========================================================
-- Responsables familiares
-- Incluye responsables con y sin acceso al sistema.
-- =========================================================

create table public.caregivers (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null
    references public.families(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  full_name text not null
    check (char_length(trim(full_name)) >= 2),
  relationship text not null default 'other'
    check (relationship in (
      'mother',
      'father',
      'tutor',
      'grandparent',
      'sibling',
      'babysitter',
      'other'
    )),
  phone text,
  email text,
  is_primary boolean not null default false,
  is_active boolean not null default true,
  has_system_access boolean not null default false,
  invitation_status text not null default 'none'
    check (invitation_status in (
      'none',
      'pending',
      'active',
      'revoked',
      'expired'
    )),
  notes text not null default '',
  invited_at timestamptz,
  invitation_accepted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index caregivers_family_id_idx on public.caregivers(family_id);
create index caregivers_user_id_idx on public.caregivers(user_id);
create unique index caregivers_family_user_unique
on public.caregivers(family_id, user_id)
where user_id is not null;
create unique index caregivers_one_primary_per_family
on public.caregivers(family_id)
where is_primary = true;

create trigger caregivers_set_updated_at
before update on public.caregivers
for each row execute function public.set_updated_at();

-- =========================================================
-- Cuentas vinculadas a una familia
-- =========================================================

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null
    references public.families(id) on delete cascade,
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  caregiver_id uuid
    references public.caregivers(id) on delete set null,
  member_role text not null default 'member'
    check (member_role in ('owner', 'member')),
  status text not null default 'active'
    check (status in ('active', 'revoked')),
  joined_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, user_id)
);

create index family_members_family_id_idx on public.family_members(family_id);
create index family_members_user_id_idx on public.family_members(user_id);
create index family_members_status_idx on public.family_members(status);
create unique index one_active_family_per_user
on public.family_members(user_id)
where status = 'active';

create trigger family_members_set_updated_at
before update on public.family_members
for each row execute function public.set_updated_at();

create or replace function public.sync_family_members_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_family_id uuid;
begin
  if tg_op = 'DELETE' then
    target_family_id := old.family_id;
  else
    target_family_id := new.family_id;
  end if;

  update public.families
  set members_count = (
    select count(*)::integer
    from public.family_members
    where family_id = target_family_id
      and status = 'active'
  )
  where id = target_family_id;

  if tg_op = 'UPDATE' and old.family_id <> new.family_id then
    update public.families
    set members_count = (
      select count(*)::integer
      from public.family_members
      where family_id = old.family_id
        and status = 'active'
    )
    where id = old.family_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_family_members_count() from public;

create trigger sync_family_members_count_trigger
after insert or update or delete on public.family_members
for each row execute function public.sync_family_members_count();

-- =========================================================
-- Configuración familiar
-- =========================================================

create table public.family_settings (
  family_id uuid primary key
    references public.families(id) on delete cascade,
  contact_name text not null default '',
  contact_email text not null default '',
  phone text not null default '',
  default_caregiver_id uuid
    references public.caregivers(id) on delete set null,
  reminder_advance_minutes integer not null default 15
    check (reminder_advance_minutes between 0 and 1440),
  expiration_warning_days integer not null default 30
    check (expiration_warning_days between 0 and 365),
  vaccine_warning_days integer not null default 30
    check (vaccine_warning_days between 0 and 365),
  show_overdue_alerts boolean not null default true,
  show_stock_alerts boolean not null default true,
  show_expiration_alerts boolean not null default true,
  show_vaccine_alerts boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger family_settings_set_updated_at
before update on public.family_settings
for each row execute function public.set_updated_at();

-- =========================================================
-- Uso de prueba gratuita
-- Se guardan hashes para evitar reutilización por correo o teléfono.
-- =========================================================

create table public.trial_usage (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null
    references public.families(id) on delete cascade,
  used_by uuid not null
    references public.profiles(id) on delete cascade,
  email_hash text,
  phone_hash text,
  used_at timestamptz not null default now(),
  check (email_hash is not null or phone_hash is not null)
);

create unique index trial_usage_email_hash_unique
on public.trial_usage(email_hash)
where email_hash is not null;

create unique index trial_usage_phone_hash_unique
on public.trial_usage(phone_hash)
where phone_hash is not null;

-- =========================================================
-- Suscripciones y pagos
-- =========================================================

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null
    references public.families(id) on delete cascade,
  plan text not null check (plan in ('monthly', 'annual')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'expired', 'cancelled')),
  amount_ars integer not null check (amount_ars > 0),
  requested_by uuid references public.profiles(id) on delete set null,
  activated_by uuid references public.profiles(id) on delete set null,
  requested_at timestamptz not null default now(),
  activated_at timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valid_subscription_dates check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);

create index subscriptions_family_id_idx on public.subscriptions(family_id);
create index subscriptions_status_idx on public.subscriptions(status);
create unique index one_active_subscription_per_family
on public.subscriptions(family_id)
where status = 'active';
create unique index one_pending_subscription_per_family
on public.subscriptions(family_id)
where status = 'pending';

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create table public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null
    references public.families(id) on delete cascade,
  subscription_id uuid
    references public.subscriptions(id) on delete set null,
  amount_ars integer not null check (amount_ars > 0),
  payment_method text not null default 'bank_transfer',
  payment_reference text not null default '',
  notes text not null default '',
  paid_at timestamptz not null default now(),
  recorded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index subscription_payments_family_id_idx
on public.subscription_payments(family_id);
create index subscription_payments_paid_at_idx
on public.subscription_payments(paid_at desc);

-- =========================================================
-- Invitaciones
-- El token visible no se guarda; solo se almacena su hash.
-- =========================================================

create table public.family_invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null
    references public.families(id) on delete cascade,
  caregiver_id uuid not null
    references public.caregivers(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'cancelled', 'revoked')),
  invited_by uuid references public.profiles(id) on delete set null,
  accepted_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index family_invitations_family_id_idx
on public.family_invitations(family_id);
create index family_invitations_caregiver_id_idx
on public.family_invitations(caregiver_id);
create index family_invitations_email_idx
on public.family_invitations(lower(email));
create unique index one_pending_invitation_per_caregiver
on public.family_invitations(caregiver_id)
where status = 'pending';

create trigger family_invitations_set_updated_at
before update on public.family_invitations
for each row execute function public.set_updated_at();

-- =========================================================
-- Funciones de seguridad
-- =========================================================

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and app_role = 'admin'
      and status = 'active'
  );
$$;

create or replace function public.is_family_member(checked_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members member
    inner join public.profiles profile on profile.id = member.user_id
    where member.family_id = checked_family_id
      and member.user_id = auth.uid()
      and member.status = 'active'
      and profile.status = 'active'
  );
$$;

create or replace function public.shares_family_with(checked_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.family_members current_member
    inner join public.family_members other_member
      on other_member.family_id = current_member.family_id
    where current_member.user_id = auth.uid()
      and current_member.status = 'active'
      and other_member.user_id = checked_user_id
      and other_member.status = 'active'
  );
$$;

create or replace function public.has_family_access(checked_family_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_app_admin()
    or exists (
      select 1
      from public.family_members member
      inner join public.profiles profile on profile.id = member.user_id
      inner join public.families family on family.id = member.family_id
      where member.family_id = checked_family_id
        and member.user_id = auth.uid()
        and member.status = 'active'
        and profile.status = 'active'
        and (
          (
            family.access_status = 'trial'
            and family.trial_ends_at > now()
          )
          or
          (
            family.access_status = 'active'
            and family.current_period_end > now()
          )
        )
    );
$$;

revoke all on function public.is_app_admin() from public;
revoke all on function public.is_family_member(uuid) from public;
revoke all on function public.shares_family_with(uuid) from public;
revoke all on function public.has_family_access(uuid) from public;

grant execute on function public.is_app_admin() to authenticated;
grant execute on function public.is_family_member(uuid) to authenticated;
grant execute on function public.shares_family_with(uuid) to authenticated;
grant execute on function public.has_family_access(uuid) to authenticated;

-- =========================================================
-- RPC: crear familia y otorgar prueba de 7 días
-- =========================================================

create or replace function public.create_family_with_trial(
  p_family_name text,
  p_responsible_name text,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_email text;
  v_phone text;
  v_family_id uuid := gen_random_uuid();
  v_caregiver_id uuid := gen_random_uuid();
  v_trial_granted boolean := false;
  v_now timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión para crear una familia.';
  end if;

  if char_length(trim(p_family_name)) < 2 then
    raise exception 'Ingresá un nombre válido para la familia.';
  end if;

  if char_length(trim(p_responsible_name)) < 3 then
    raise exception 'Ingresá el nombre y apellido del responsable.';
  end if;

  v_phone := public.normalize_phone(p_phone);

  if v_phone is null or char_length(v_phone) < 8 then
    raise exception 'Ingresá un número de teléfono válido.';
  end if;

  if exists (
    select 1 from public.family_members
    where user_id = v_user_id and status = 'active'
  ) then
    raise exception 'Esta cuenta ya pertenece a una familia.';
  end if;

  select lower(email) into v_email
  from auth.users
  where id = v_user_id;

  if v_email is null then
    raise exception 'No se encontró el correo de la cuenta.';
  end if;

  insert into public.profiles (id, email, full_name, phone)
  values (v_user_id, v_email, trim(p_responsible_name), v_phone)
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    phone = excluded.phone,
    updated_at = now();

  insert into public.families (
    id,
    family_name,
    created_by,
    access_status,
    current_plan
  )
  values (
    v_family_id,
    trim(p_family_name),
    v_user_id,
    'pending_payment',
    'none'
  );

  insert into public.caregivers (
    id,
    family_id,
    user_id,
    full_name,
    relationship,
    phone,
    email,
    is_primary,
    is_active,
    has_system_access,
    invitation_status,
    created_by
  )
  values (
    v_caregiver_id,
    v_family_id,
    v_user_id,
    trim(p_responsible_name),
    'other',
    v_phone,
    v_email,
    true,
    true,
    true,
    'active',
    v_user_id
  );

  insert into public.family_members (
    family_id,
    user_id,
    caregiver_id,
    member_role,
    status
  )
  values (
    v_family_id,
    v_user_id,
    v_caregiver_id,
    'owner',
    'active'
  );

  insert into public.family_settings (
    family_id,
    contact_name,
    contact_email,
    phone,
    default_caregiver_id
  )
  values (
    v_family_id,
    trim(p_responsible_name),
    v_email,
    v_phone,
    v_caregiver_id
  );

  begin
    insert into public.trial_usage (
      family_id,
      used_by,
      email_hash,
      phone_hash
    )
    values (
      v_family_id,
      v_user_id,
      public.hash_identity(v_email),
      public.hash_identity(v_phone)
    );

    v_trial_granted := true;
  exception
    when unique_violation then
      v_trial_granted := false;
  end;

  if v_trial_granted then
    update public.families
    set
      access_status = 'trial',
      current_plan = 'trial',
      trial_started_at = v_now,
      trial_ends_at = v_now + interval '7 days'
    where id = v_family_id;
  end if;

  return jsonb_build_object(
    'familyId', v_family_id,
    'caregiverId', v_caregiver_id,
    'trialGranted', v_trial_granted,
    'trialStartedAt', case when v_trial_granted then v_now else null end,
    'trialEndsAt', case when v_trial_granted then v_now + interval '7 days' else null end,
    'accessStatus', case when v_trial_granted then 'trial' else 'pending_payment' end
  );
end;
$$;

-- =========================================================
-- RPC: invitaciones
-- =========================================================

create or replace function public.create_family_invitation(
  p_caregiver_id uuid,
  p_expiration_days integer default 7
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caregiver public.caregivers%rowtype;
  v_raw_token text;
  v_invitation_id uuid;
  v_expires_at timestamptz;
begin
  select * into v_caregiver
  from public.caregivers
  where id = p_caregiver_id;

  if not found then
    raise exception 'No se encontró el responsable.';
  end if;

  if not public.has_family_access(v_caregiver.family_id) then
    raise exception 'No tenés permiso para invitar responsables.';
  end if;

  if v_caregiver.user_id is not null then
    raise exception 'Este responsable ya tiene acceso al sistema.';
  end if;

  if nullif(trim(v_caregiver.email), '') is null then
    raise exception 'Ingresá un correo para enviar la invitación.';
  end if;

  if p_expiration_days < 1 or p_expiration_days > 30 then
    raise exception 'La duración de la invitación no es válida.';
  end if;

  update public.family_invitations
  set status = 'cancelled', updated_at = now()
  where caregiver_id = p_caregiver_id
    and status = 'pending';

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at := now() + make_interval(days => p_expiration_days);

  insert into public.family_invitations (
    family_id,
    caregiver_id,
    email,
    token_hash,
    status,
    invited_by,
    expires_at
  )
  values (
    v_caregiver.family_id,
    v_caregiver.id,
    lower(trim(v_caregiver.email)),
    public.hash_identity(v_raw_token),
    'pending',
    auth.uid(),
    v_expires_at
  )
  returning id into v_invitation_id;

  update public.caregivers
  set
    has_system_access = true,
    invitation_status = 'pending',
    invited_at = now()
  where id = p_caregiver_id;

  return jsonb_build_object(
    'invitationId', v_invitation_id,
    'token', v_raw_token,
    'path', '/invite/' || v_raw_token,
    'email', lower(trim(v_caregiver.email)),
    'expiresAt', v_expires_at
  );
end;
$$;

create or replace function public.get_invitation_preview(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.family_invitations%rowtype;
  v_family_name text;
  v_caregiver_name text;
  v_relationship text;
begin
  select * into v_invitation
  from public.family_invitations
  where token_hash = public.hash_identity(p_token)
  limit 1;

  if not found then
    return jsonb_build_object('valid', false, 'reason', 'not_found');
  end if;

  if v_invitation.status = 'pending' and v_invitation.expires_at <= now() then
    update public.family_invitations
    set status = 'expired', updated_at = now()
    where id = v_invitation.id;

    update public.caregivers
    set invitation_status = 'expired'
    where id = v_invitation.caregiver_id;

    v_invitation.status := 'expired';
  end if;

  select family_name into v_family_name
  from public.families
  where id = v_invitation.family_id;

  select full_name, relationship
  into v_caregiver_name, v_relationship
  from public.caregivers
  where id = v_invitation.caregiver_id;

  return jsonb_build_object(
    'valid', v_invitation.status = 'pending',
    'status', v_invitation.status,
    'familyId', v_invitation.family_id,
    'familyName', v_family_name,
    'caregiverName', v_caregiver_name,
    'relationship', v_relationship,
    'email', v_invitation.email,
    'expiresAt', v_invitation.expires_at
  );
end;
$$;

create or replace function public.accept_family_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_invitation public.family_invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Debes iniciar sesión para aceptar la invitación.';
  end if;

  select lower(email) into v_user_email
  from auth.users
  where id = v_user_id;

  select * into v_invitation
  from public.family_invitations
  where token_hash = public.hash_identity(p_token)
  for update;

  if not found then
    raise exception 'La invitación no existe.';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'La invitación ya no está disponible.';
  end if;

  if v_invitation.expires_at <= now() then
    update public.family_invitations
    set status = 'expired', updated_at = now()
    where id = v_invitation.id;

    update public.caregivers
    set invitation_status = 'expired'
    where id = v_invitation.caregiver_id;

    raise exception 'La invitación venció.';
  end if;

  if lower(v_invitation.email) <> v_user_email then
    raise exception 'Ingresá con el correo al que se envió la invitación.';
  end if;

  if exists (
    select 1 from public.family_members
    where user_id = v_user_id
      and status = 'active'
      and family_id <> v_invitation.family_id
  ) then
    raise exception 'Esta cuenta ya pertenece a otra familia.';
  end if;

  update public.caregivers
  set
    user_id = v_user_id,
    has_system_access = true,
    invitation_status = 'active',
    invitation_accepted_at = now(),
    is_active = true
  where id = v_invitation.caregiver_id;

  insert into public.family_members (
    family_id,
    user_id,
    caregiver_id,
    member_role,
    status,
    joined_at,
    revoked_at
  )
  values (
    v_invitation.family_id,
    v_user_id,
    v_invitation.caregiver_id,
    'member',
    'active',
    now(),
    null
  )
  on conflict (family_id, user_id) do update set
    caregiver_id = excluded.caregiver_id,
    member_role = 'member',
    status = 'active',
    joined_at = now(),
    revoked_at = null,
    updated_at = now();

  update public.family_invitations
  set
    status = 'accepted',
    accepted_by = v_user_id,
    accepted_at = now(),
    updated_at = now()
  where id = v_invitation.id;

  return jsonb_build_object(
    'familyId', v_invitation.family_id,
    'caregiverId', v_invitation.caregiver_id,
    'status', 'accepted'
  );
end;
$$;

create or replace function public.revoke_caregiver_access(p_caregiver_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caregiver public.caregivers%rowtype;
  v_member_role text;
begin
  select * into v_caregiver
  from public.caregivers
  where id = p_caregiver_id;

  if not found then
    raise exception 'No se encontró el responsable.';
  end if;

  if not public.has_family_access(v_caregiver.family_id) then
    raise exception 'No tenés permiso para quitar accesos.';
  end if;

  select member_role into v_member_role
  from public.family_members
  where caregiver_id = p_caregiver_id
    and status = 'active'
  limit 1;

  if v_member_role = 'owner' then
    raise exception 'No se puede quitar el acceso al responsable principal.';
  end if;

  update public.family_members
  set status = 'revoked', revoked_at = now(), updated_at = now()
  where caregiver_id = p_caregiver_id
    and status = 'active';

  update public.family_invitations
  set status = 'revoked', updated_at = now()
  where caregiver_id = p_caregiver_id
    and status = 'pending';

  update public.caregivers
  set
    user_id = null,
    has_system_access = false,
    invitation_status = 'revoked'
  where id = p_caregiver_id;
end;
$$;

-- =========================================================
-- RPC: planes y administración
-- =========================================================

create or replace function public.request_family_plan(
  p_family_id uuid,
  p_plan text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscription_id uuid;
  v_amount integer;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'No perteneces a esta familia.';
  end if;

  if p_plan not in ('monthly', 'annual') then
    raise exception 'El plan seleccionado no es válido.';
  end if;

  if exists (
    select 1 from public.families
    where id = p_family_id and access_status = 'suspended'
  ) then
    raise exception 'La cuenta está suspendida.';
  end if;

  v_amount := case when p_plan = 'monthly' then 25000 else 150000 end;

  update public.subscriptions
  set status = 'cancelled', updated_at = now()
  where family_id = p_family_id and status = 'pending';

  insert into public.subscriptions (
    family_id,
    plan,
    status,
    amount_ars,
    requested_by
  )
  values (
    p_family_id,
    p_plan,
    'pending',
    v_amount,
    auth.uid()
  )
  returning id into v_subscription_id;

  update public.families
  set access_status = 'pending_payment', requested_plan = p_plan
  where id = p_family_id;

  return jsonb_build_object(
    'subscriptionId', v_subscription_id,
    'familyId', p_family_id,
    'plan', p_plan,
    'status', 'pending',
    'amount', v_amount
  );
end;
$$;

create or replace function public.activate_family_subscription(
  p_family_id uuid,
  p_plan text,
  p_payment_reference text default '',
  p_notes text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscription_id uuid;
  v_amount integer;
  v_start timestamptz := now();
  v_end timestamptz;
begin
  if not public.is_app_admin() then
    raise exception 'No tienes permiso para activar planes.';
  end if;

  if p_plan not in ('monthly', 'annual') then
    raise exception 'El plan seleccionado no es válido.';
  end if;

  if not exists (select 1 from public.families where id = p_family_id) then
    raise exception 'La familia seleccionada no existe.';
  end if;

  if p_plan = 'monthly' then
    v_amount := 25000;
    v_end := v_start + interval '1 month';
  else
    v_amount := 150000;
    v_end := v_start + interval '1 year';
  end if;

  update public.subscriptions
  set
    status = case when status = 'active' then 'expired' else 'cancelled' end,
    updated_at = now()
  where family_id = p_family_id
    and status in ('active', 'pending');

  insert into public.subscriptions (
    family_id,
    plan,
    status,
    amount_ars,
    activated_by,
    activated_at,
    starts_at,
    ends_at
  )
  values (
    p_family_id,
    p_plan,
    'active',
    v_amount,
    auth.uid(),
    v_start,
    v_start,
    v_end
  )
  returning id into v_subscription_id;

  insert into public.subscription_payments (
    family_id,
    subscription_id,
    amount_ars,
    payment_method,
    payment_reference,
    notes,
    paid_at,
    recorded_by
  )
  values (
    p_family_id,
    v_subscription_id,
    v_amount,
    'bank_transfer',
    trim(coalesce(p_payment_reference, '')),
    trim(coalesce(p_notes, '')),
    v_start,
    auth.uid()
  );

  update public.families
  set
    access_status = 'active',
    current_plan = p_plan,
    requested_plan = null,
    current_period_start = v_start,
    current_period_end = v_end
  where id = p_family_id;

  return jsonb_build_object(
    'subscriptionId', v_subscription_id,
    'familyId', p_family_id,
    'plan', p_plan,
    'status', 'active',
    'startsAt', v_start,
    'endsAt', v_end,
    'amount', v_amount
  );
end;
$$;

create or replace function public.set_family_suspended(
  p_family_id uuid,
  p_suspended boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if not public.is_app_admin() then
    raise exception 'No tienes permiso para modificar esta familia.';
  end if;

  if p_suspended then
    v_status := 'suspended';
  else
    select case
      when current_plan = 'trial' and trial_ends_at > now() then 'trial'
      when current_plan in ('monthly', 'annual') and current_period_end > now() then 'active'
      else 'expired'
    end
    into v_status
    from public.families
    where id = p_family_id;
  end if;

  update public.families
  set access_status = v_status
  where id = p_family_id;

  return v_status;
end;
$$;

-- Función administrativa sin permiso para clientes.
-- Se puede ejecutar desde SQL Editor para convertir una cuenta existente en admin.
create or replace function public.set_user_admin(p_email text, p_is_admin boolean default true)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set app_role = case when p_is_admin then 'admin' else 'family' end
  where lower(email) = lower(trim(p_email));

  if not found then
    raise exception 'No se encontró una cuenta con ese correo.';
  end if;
end;
$$;

-- =========================================================
-- RLS
-- =========================================================

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.caregivers enable row level security;
alter table public.family_members enable row level security;
alter table public.family_settings enable row level security;
alter table public.trial_usage enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_payments enable row level security;
alter table public.family_invitations enable row level security;

create policy "Profiles visible to self, family and admin"
on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.shares_family_with(id)
  or public.is_app_admin()
);

create policy "Users update own profile"
on public.profiles for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Members view family"
on public.families for select to authenticated
using (public.is_family_member(id) or public.is_app_admin());

create policy "Members update family name"
on public.families for update to authenticated
using (public.is_family_member(id) or public.is_app_admin())
with check (public.is_family_member(id) or public.is_app_admin());

create policy "Members view caregivers"
on public.caregivers for select to authenticated
using (public.is_family_member(family_id) or public.is_app_admin());

create policy "Members create caregivers"
on public.caregivers for insert to authenticated
with check (public.has_family_access(family_id));

create policy "Members update caregivers"
on public.caregivers for update to authenticated
using (public.has_family_access(family_id))
with check (public.has_family_access(family_id));

create policy "Members delete caregivers"
on public.caregivers for delete to authenticated
using (
  public.has_family_access(family_id)
  and not exists (
    select 1 from public.family_members member
    where member.caregiver_id = caregivers.id
      and member.member_role = 'owner'
      and member.status = 'active'
  )
);

create policy "Members view family members"
on public.family_members for select to authenticated
using (public.is_family_member(family_id) or public.is_app_admin());

create policy "Members view family settings"
on public.family_settings for select to authenticated
using (public.is_family_member(family_id) or public.is_app_admin());

create policy "Members create family settings"
on public.family_settings for insert to authenticated
with check (public.has_family_access(family_id));

create policy "Members update family settings"
on public.family_settings for update to authenticated
using (public.has_family_access(family_id))
with check (public.has_family_access(family_id));

create policy "Admins view trial usage"
on public.trial_usage for select to authenticated
using (public.is_app_admin());

create policy "Members view subscriptions"
on public.subscriptions for select to authenticated
using (public.is_family_member(family_id) or public.is_app_admin());

create policy "Members view payments"
on public.subscription_payments for select to authenticated
using (public.is_family_member(family_id) or public.is_app_admin());

create policy "Members view invitations"
on public.family_invitations for select to authenticated
using (public.is_family_member(family_id) or public.is_app_admin());

-- =========================================================
-- Permisos
-- =========================================================

revoke all on public.profiles from anon, authenticated;
revoke all on public.families from anon, authenticated;
revoke all on public.caregivers from anon, authenticated;
revoke all on public.family_members from anon, authenticated;
revoke all on public.family_settings from anon, authenticated;
revoke all on public.trial_usage from anon, authenticated;
revoke all on public.subscriptions from anon, authenticated;
revoke all on public.subscription_payments from anon, authenticated;
revoke all on public.family_invitations from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_url) on public.profiles to authenticated;

grant select on public.families to authenticated;
grant update (family_name) on public.families to authenticated;

grant select on public.caregivers to authenticated;
grant insert (
  family_id,
  full_name,
  relationship,
  phone,
  email,
  is_primary,
  is_active,
  notes
) on public.caregivers to authenticated;
grant update (
  full_name,
  relationship,
  phone,
  email,
  is_primary,
  is_active,
  notes
) on public.caregivers to authenticated;
grant delete on public.caregivers to authenticated;

grant select on public.family_members to authenticated;

grant select on public.family_settings to authenticated;
grant insert (
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
) on public.family_settings to authenticated;
grant update (
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
) on public.family_settings to authenticated;

grant select on public.trial_usage to authenticated;
grant select on public.subscriptions to authenticated;
grant select on public.subscription_payments to authenticated;
grant select on public.family_invitations to authenticated;

revoke all on function public.create_family_with_trial(text, text, text) from public, anon;
revoke all on function public.create_family_invitation(uuid, integer) from public, anon;
revoke all on function public.get_invitation_preview(text) from public;
revoke all on function public.accept_family_invitation(text) from public, anon;
revoke all on function public.revoke_caregiver_access(uuid) from public, anon;
revoke all on function public.request_family_plan(uuid, text) from public, anon;
revoke all on function public.activate_family_subscription(uuid, text, text, text) from public, anon;
revoke all on function public.set_family_suspended(uuid, boolean) from public, anon;
revoke all on function public.set_user_admin(text, boolean) from public, anon, authenticated;

grant execute on function public.create_family_with_trial(text, text, text) to authenticated;
grant execute on function public.create_family_invitation(uuid, integer) to authenticated;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;
grant execute on function public.accept_family_invitation(text) to authenticated;
grant execute on function public.revoke_caregiver_access(uuid) to authenticated;
grant execute on function public.request_family_plan(uuid, text) to authenticated;
grant execute on function public.activate_family_subscription(uuid, text, text, text) to authenticated;
grant execute on function public.set_family_suspended(uuid, boolean) to authenticated;
