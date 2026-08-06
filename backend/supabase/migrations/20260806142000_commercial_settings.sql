-- =========================================================
-- MiPeque
-- Precios administrables y promociones
-- Precio inicial mensual: $15.000
-- Precio inicial anual: $100.000
-- =========================================================

create table if not exists public.subscription_plans (
  id text primary key
    check (id in ('monthly', 'annual')),
  name text not null,
  short_name text not null,
  duration_label text not null,
  duration_months integer not null
    check (duration_months > 0),
  price_ars integer not null
    check (price_ars > 0),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists subscription_plans_set_updated_at
on public.subscription_plans;

create trigger subscription_plans_set_updated_at
before update on public.subscription_plans
for each row
execute function public.set_updated_at();

insert into public.subscription_plans (
  id,
  name,
  short_name,
  duration_label,
  duration_months,
  price_ars,
  is_active,
  display_order
)
values
  (
    'monthly',
    'Plan mensual',
    'Mensual',
    '1 mes',
    1,
    15000,
    true,
    1
  ),
  (
    'annual',
    'Plan anual',
    'Anual',
    '1 año',
    12,
    100000,
    true,
    2
  )
on conflict (id)
do update set
  name = excluded.name,
  short_name = excluded.short_name,
  duration_label = excluded.duration_label,
  duration_months = excluded.duration_months,
  price_ars = excluded.price_ars,
  is_active = excluded.is_active,
  display_order = excluded.display_order,
  updated_at = now();

create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null
    check (char_length(trim(name)) >= 3),
  description text not null default '',
  plan_id text
    references public.subscription_plans(id)
    on delete cascade,
  promotion_type text not null
    check (
      promotion_type in (
        'fixed_price',
        'percentage',
        'fixed_discount'
      )
    ),
  value numeric(12, 2) not null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  priority integer not null default 0
    check (priority >= 0),
  created_by uuid
    references public.profiles(id)
    on delete set null
    default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint promotions_valid_value check (
    (
      promotion_type = 'percentage'
      and value > 0
      and value <= 100
    )
    or
    (
      promotion_type in (
        'fixed_price',
        'fixed_discount'
      )
      and value > 0
    )
  ),
  constraint promotions_valid_period check (
    ends_at is null
    or ends_at > starts_at
  )
);

create index if not exists promotions_plan_id_idx
on public.promotions(plan_id);

create index if not exists promotions_active_period_idx
on public.promotions(
  is_active,
  starts_at,
  ends_at
);

drop trigger if exists promotions_set_updated_at
on public.promotions;

create trigger promotions_set_updated_at
before update on public.promotions
for each row
execute function public.set_updated_at();

alter table public.subscriptions
add column if not exists base_amount_ars integer;

alter table public.subscriptions
add column if not exists promotion_id uuid
references public.promotions(id)
on delete set null;

alter table public.subscriptions
add column if not exists promotion_name text
not null default '';

alter table public.subscriptions
add column if not exists discount_amount_ars integer
not null default 0;

update public.subscriptions
set base_amount_ars = amount_ars
where base_amount_ars is null;

alter table public.subscriptions
alter column base_amount_ars set not null;

alter table public.subscription_payments
add column if not exists base_amount_ars integer;

alter table public.subscription_payments
add column if not exists promotion_id uuid
references public.promotions(id)
on delete set null;

alter table public.subscription_payments
add column if not exists promotion_name text
not null default '';

alter table public.subscription_payments
add column if not exists discount_amount_ars integer
not null default 0;

update public.subscription_payments
set base_amount_ars = amount_ars
where base_amount_ars is null;

alter table public.subscription_payments
alter column base_amount_ars set not null;

create or replace function public.get_subscription_offers()
returns table (
  id text,
  name text,
  short_name text,
  duration_label text,
  duration_months integer,
  base_amount_ars integer,
  amount_ars integer,
  is_active boolean,
  display_order integer,
  promotion_id uuid,
  promotion_name text,
  promotion_description text,
  promotion_type text,
  promotion_value numeric,
  promotion_ends_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    plan.id,
    plan.name,
    plan.short_name,
    plan.duration_label,
    plan.duration_months,
    plan.price_ars as base_amount_ars,
    case
      when promotion.id is null then
        plan.price_ars
      when promotion.promotion_type = 'fixed_price' then
        greatest(
          1,
          round(promotion.value)::integer
        )
      when promotion.promotion_type = 'percentage' then
        greatest(
          1,
          round(
            plan.price_ars *
            (100 - promotion.value) /
            100
          )::integer
        )
      when promotion.promotion_type = 'fixed_discount' then
        greatest(
          1,
          plan.price_ars -
          round(promotion.value)::integer
        )
      else
        plan.price_ars
    end as amount_ars,
    plan.is_active,
    plan.display_order,
    promotion.id,
    promotion.name,
    promotion.description,
    promotion.promotion_type,
    promotion.value,
    promotion.ends_at
  from public.subscription_plans as plan
  left join lateral (
    select candidate.*
    from public.promotions as candidate
    where candidate.is_active = true
      and (
        candidate.plan_id is null
        or candidate.plan_id = plan.id
      )
      and candidate.starts_at <= now()
      and (
        candidate.ends_at is null
        or candidate.ends_at > now()
      )
    order by
      candidate.priority desc,
      candidate.created_at desc
    limit 1
  ) as promotion on true
  where plan.is_active = true
  order by plan.display_order;
$$;

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
  v_offer record;
begin
  if not public.is_family_member(p_family_id) then
    raise exception 'No perteneces a esta familia.';
  end if;

  if exists (
    select 1
    from public.families
    where id = p_family_id
      and access_status = 'suspended'
  ) then
    raise exception 'La cuenta está suspendida.';
  end if;

  select *
  into v_offer
  from public.get_subscription_offers()
  where id = p_plan;

  if not found then
    raise exception 'El plan seleccionado no está disponible.';
  end if;

  update public.subscriptions
  set
    status = 'cancelled',
    updated_at = now()
  where family_id = p_family_id
    and status = 'pending';

  insert into public.subscriptions (
    family_id,
    plan,
    status,
    amount_ars,
    base_amount_ars,
    promotion_id,
    promotion_name,
    discount_amount_ars,
    requested_by
  )
  values (
    p_family_id,
    p_plan,
    'pending',
    v_offer.amount_ars,
    v_offer.base_amount_ars,
    v_offer.promotion_id,
    coalesce(v_offer.promotion_name, ''),
    greatest(
      v_offer.base_amount_ars -
      v_offer.amount_ars,
      0
    ),
    auth.uid()
  )
  returning id
  into v_subscription_id;

  update public.families
  set
    access_status = 'pending_payment',
    requested_plan = p_plan
  where id = p_family_id;

  return jsonb_build_object(
    'subscriptionId', v_subscription_id,
    'familyId', p_family_id,
    'plan', p_plan,
    'status', 'pending',
    'baseAmount', v_offer.base_amount_ars,
    'amount', v_offer.amount_ars,
    'promotionId', v_offer.promotion_id,
    'promotionName', v_offer.promotion_name
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
  v_offer record;
  v_pending record;
  v_base_amount integer;
  v_amount integer;
  v_promotion_id uuid;
  v_promotion_name text;
  v_start timestamptz := now();
  v_subscription_start timestamptz;
  v_end timestamptz;
  v_current_end timestamptz;
  v_current_status text;
begin
  if not public.is_app_admin() then
    raise exception 'No tienes permiso para activar planes.';
  end if;

  select
    current_period_end,
    access_status
  into
    v_current_end,
    v_current_status
  from public.families
  where id = p_family_id;

  if not found then
    raise exception 'La familia seleccionada no existe.';
  end if;

  select
    id,
    amount_ars,
    base_amount_ars,
    promotion_id,
    promotion_name
  into v_pending
  from public.subscriptions
  where family_id = p_family_id
    and plan = p_plan
    and status = 'pending'
  order by requested_at desc
  limit 1;

  if found then
    v_base_amount := v_pending.base_amount_ars;
    v_amount := v_pending.amount_ars;
    v_promotion_id := v_pending.promotion_id;
    v_promotion_name := v_pending.promotion_name;
  else
    select *
    into v_offer
    from public.get_subscription_offers()
    where id = p_plan;

    if not found then
      raise exception 'El plan seleccionado no está disponible.';
    end if;

    v_base_amount := v_offer.base_amount_ars;
    v_amount := v_offer.amount_ars;
    v_promotion_id := v_offer.promotion_id;
    v_promotion_name := coalesce(v_offer.promotion_name, '');
  end if;

  if
    v_current_status = 'active'
    and v_current_end is not null
    and v_current_end > v_start
  then
    v_subscription_start := v_current_end;
  else
    v_subscription_start := v_start;
  end if;

  if p_plan = 'monthly' then
    v_end :=
      v_subscription_start + interval '1 month';
  elsif p_plan = 'annual' then
    v_end :=
      v_subscription_start + interval '1 year';
  else
    raise exception 'El plan seleccionado no es válido.';
  end if;

  update public.subscriptions
  set
    status = case
      when status = 'active' then 'expired'
      else 'cancelled'
    end,
    updated_at = now()
  where family_id = p_family_id
    and status in ('active', 'pending');

  insert into public.subscriptions (
    family_id,
    plan,
    status,
    amount_ars,
    base_amount_ars,
    promotion_id,
    promotion_name,
    discount_amount_ars,
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
    v_base_amount,
    v_promotion_id,
    coalesce(v_promotion_name, ''),
    greatest(
      v_base_amount - v_amount,
      0
    ),
    auth.uid(),
    v_start,
    v_subscription_start,
    v_end
  )
  returning id
  into v_subscription_id;

  insert into public.subscription_payments (
    family_id,
    subscription_id,
    amount_ars,
    base_amount_ars,
    promotion_id,
    promotion_name,
    discount_amount_ars,
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
    v_base_amount,
    v_promotion_id,
    coalesce(v_promotion_name, ''),
    greatest(
      v_base_amount - v_amount,
      0
    ),
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
    current_period_start = case
      when
        v_current_status = 'active'
        and v_current_end is not null
        and v_current_end > v_start
      then current_period_start
      else v_start
    end,
    current_period_end = v_end
  where id = p_family_id;

  return jsonb_build_object(
    'subscriptionId', v_subscription_id,
    'familyId', p_family_id,
    'plan', p_plan,
    'status', 'active',
    'startsAt', v_subscription_start,
    'endsAt', v_end,
    'baseAmount', v_base_amount,
    'amount', v_amount,
    'promotionId', v_promotion_id,
    'promotionName', v_promotion_name
  );
end;
$$;

alter table public.subscription_plans
  enable row level security;

alter table public.promotions
  enable row level security;

drop policy if exists
  "Anyone can view available subscription plans"
on public.subscription_plans;

create policy
  "Anyone can view available subscription plans"
on public.subscription_plans
for select
to anon, authenticated
using (
  is_active = true
  or public.is_app_admin()
);

drop policy if exists
  "Admins manage subscription plans"
on public.subscription_plans;

create policy
  "Admins manage subscription plans"
on public.subscription_plans
for all
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

drop policy if exists
  "Anyone can view current promotions"
on public.promotions;

create policy
  "Anyone can view current promotions"
on public.promotions
for select
to anon, authenticated
using (
  public.is_app_admin()
  or (
    is_active = true
    and starts_at <= now()
    and (
      ends_at is null
      or ends_at > now()
    )
  )
);

drop policy if exists
  "Admins manage promotions"
on public.promotions;

create policy
  "Admins manage promotions"
on public.promotions
for all
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

revoke all
on public.subscription_plans
from anon, authenticated;

revoke all
on public.promotions
from anon, authenticated;

grant select
on public.subscription_plans
  to anon, authenticated;

grant select
on public.promotions
  to anon, authenticated;

grant insert, update, delete
on public.subscription_plans
  to authenticated;

grant insert, update, delete
on public.promotions
  to authenticated;

revoke all
on function public.get_subscription_offers()
from public;

grant execute
on function public.get_subscription_offers()
to anon, authenticated;

revoke all
on function public.request_family_plan(uuid, text)
from public, anon;

grant execute
on function public.request_family_plan(uuid, text)
to authenticated;

revoke all
on function public.activate_family_subscription(uuid, text, text, text)
from public, anon;

grant execute
on function public.activate_family_subscription(uuid, text, text, text)
to authenticated;

-- Actualiza solicitudes pendientes existentes con los precios nuevos.
update public.subscriptions as subscription
set
  base_amount_ars = offer.base_amount_ars,
  amount_ars = offer.amount_ars,
  promotion_id = offer.promotion_id,
  promotion_name = coalesce(offer.promotion_name, ''),
  discount_amount_ars = greatest(
    offer.base_amount_ars - offer.amount_ars,
    0
  ),
  updated_at = now()
from public.get_subscription_offers() as offer
where subscription.status = 'pending'
  and subscription.plan = offer.id;
