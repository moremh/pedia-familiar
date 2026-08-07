-- =========================================================
-- MiPeque - Notificaciones Web Push
-- =========================================================

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null
    references public.families(id) on delete cascade,
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh_key text not null,
  auth_key text not null,
  user_agent text not null default '',
  timezone text not null default 'America/Argentina/Buenos_Aires',
  notify_medication_due boolean not null default true,
  notify_medication_overdue boolean not null default true,
  notify_vaccines boolean not null default true,
  notify_expirations boolean not null default true,
  notify_stock boolean not null default true,
  notify_followups boolean not null default true,
  show_details boolean not null default false,
  is_enabled boolean not null default true,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_family_id_idx
on public.push_subscriptions(family_id);

create index if not exists push_subscriptions_user_id_idx
on public.push_subscriptions(user_id);

create index if not exists push_subscriptions_enabled_idx
on public.push_subscriptions(is_enabled)
where is_enabled = true;

create table if not exists public.push_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null
    references public.push_subscriptions(id) on delete cascade,
  family_id uuid not null
    references public.families(id) on delete cascade,
  user_id uuid not null
    references public.profiles(id) on delete cascade,
  category text not null,
  reference_id text not null default '',
  dedupe_key text not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (subscription_id, dedupe_key)
);

create index if not exists push_notification_deliveries_family_idx
on public.push_notification_deliveries(family_id, sent_at desc);

create index if not exists push_notification_deliveries_reference_idx
on public.push_notification_deliveries(category, reference_id);

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;
alter table public.push_notification_deliveries enable row level security;

-- El usuario solo puede ver y administrar sus propios dispositivos.
drop policy if exists "Own push subscriptions select" on public.push_subscriptions;
create policy "Own push subscriptions select"
on public.push_subscriptions for select to authenticated
using (
  user_id = auth.uid()
  and public.is_family_member(family_id)
);

drop policy if exists "Own push subscriptions update" on public.push_subscriptions;
create policy "Own push subscriptions update"
on public.push_subscriptions for update to authenticated
using (
  user_id = auth.uid()
  and public.is_family_member(family_id)
)
with check (
  user_id = auth.uid()
  and public.is_family_member(family_id)
);

drop policy if exists "Own push subscriptions delete" on public.push_subscriptions;
create policy "Own push subscriptions delete"
on public.push_subscriptions for delete to authenticated
using (
  user_id = auth.uid()
  and public.is_family_member(family_id)
);

-- No se expone el historial de entregas al cliente.
-- Solo la Edge Function con service_role lo utiliza.

revoke all on public.push_subscriptions from anon, authenticated;
revoke all on public.push_notification_deliveries from anon, authenticated;

grant select, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
grant all on public.push_notification_deliveries to service_role;

-- Registro seguro del dispositivo. Permite reasociar un endpoint existente
-- al usuario actual si el dispositivo cambió de cuenta.
create or replace function public.register_push_subscription(
  p_family_id uuid,
  p_endpoint text,
  p_p256dh_key text,
  p_auth_key text,
  p_user_agent text default '',
  p_timezone text default 'America/Argentina/Buenos_Aires',
  p_notify_medication_due boolean default true,
  p_notify_medication_overdue boolean default true,
  p_notify_vaccines boolean default true,
  p_notify_expirations boolean default true,
  p_notify_stock boolean default true,
  p_notify_followups boolean default true,
  p_show_details boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_subscription_id uuid;
begin
  if v_user_id is null then
    raise exception 'La sesión no es válida.';
  end if;

  if not public.is_family_member(p_family_id) then
    raise exception 'La cuenta no pertenece a esta familia.';
  end if;

  if nullif(trim(p_endpoint), '') is null
    or nullif(trim(p_p256dh_key), '') is null
    or nullif(trim(p_auth_key), '') is null then
    raise exception 'La suscripción push está incompleta.';
  end if;

  insert into public.push_subscriptions (
    family_id,
    user_id,
    endpoint,
    p256dh_key,
    auth_key,
    user_agent,
    timezone,
    notify_medication_due,
    notify_medication_overdue,
    notify_vaccines,
    notify_expirations,
    notify_stock,
    notify_followups,
    show_details,
    is_enabled,
    last_seen_at
  ) values (
    p_family_id,
    v_user_id,
    trim(p_endpoint),
    trim(p_p256dh_key),
    trim(p_auth_key),
    coalesce(p_user_agent, ''),
    coalesce(nullif(trim(p_timezone), ''), 'America/Argentina/Buenos_Aires'),
    coalesce(p_notify_medication_due, true),
    coalesce(p_notify_medication_overdue, true),
    coalesce(p_notify_vaccines, true),
    coalesce(p_notify_expirations, true),
    coalesce(p_notify_stock, true),
    coalesce(p_notify_followups, true),
    coalesce(p_show_details, false),
    true,
    now()
  )
  on conflict (endpoint) do update
  set
    family_id = excluded.family_id,
    user_id = excluded.user_id,
    p256dh_key = excluded.p256dh_key,
    auth_key = excluded.auth_key,
    user_agent = excluded.user_agent,
    timezone = excluded.timezone,
    notify_medication_due = excluded.notify_medication_due,
    notify_medication_overdue = excluded.notify_medication_overdue,
    notify_vaccines = excluded.notify_vaccines,
    notify_expirations = excluded.notify_expirations,
    notify_stock = excluded.notify_stock,
    notify_followups = excluded.notify_followups,
    show_details = excluded.show_details,
    is_enabled = true,
    last_seen_at = now(),
    updated_at = now()
  returning id into v_subscription_id;

  return v_subscription_id;
end;
$$;

create or replace function public.detach_push_subscription(
  p_endpoint text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_count integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  delete from public.push_subscriptions
  where endpoint = p_endpoint
    and user_id = auth.uid();

  get diagnostics v_deleted_count = row_count;
  return v_deleted_count > 0;
end;
$$;

revoke all on function public.register_push_subscription(
  uuid,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
) from public;

revoke all on function public.detach_push_subscription(text) from public;

grant execute on function public.register_push_subscription(
  uuid,
  text,
  text,
  text,
  text,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean
) to authenticated;

grant execute on function public.detach_push_subscription(text) to authenticated;
