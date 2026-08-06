-- =========================================================
-- MiPeque - Botiquín y movimientos de stock
-- =========================================================

create table public.medicine_cabinet_items (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_id uuid not null,
  treatment_id uuid,
  medicine_name text not null
    check (char_length(trim(medicine_name)) >= 2),
  presentation text not null default '',
  current_stock numeric(10, 2) not null default 0
    check (current_stock >= 0),
  initial_stock numeric(10, 2) not null default 0
    check (initial_stock >= 0),
  minimum_stock numeric(10, 2) not null default 0
    check (minimum_stock >= 0),
  consumption_per_dose numeric(10, 2) not null default 1
    check (consumption_per_dose > 0),
  stock_unit text not null default 'dose',
  expiration_date date,
  lot_number text not null default '',
  storage_location text not null default '',
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (child_id, family_id)
    references public.children(id, family_id) on delete cascade,
  foreign key (treatment_id)
    references public.treatments(id) on delete set null
);

create index medicine_cabinet_family_id_idx
on public.medicine_cabinet_items(family_id);
create index medicine_cabinet_child_id_idx
on public.medicine_cabinet_items(child_id);
create index medicine_cabinet_treatment_id_idx
on public.medicine_cabinet_items(treatment_id);
create index medicine_cabinet_expiration_date_idx
on public.medicine_cabinet_items(expiration_date);

create or replace function public.validate_medicine_cabinet_treatment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.treatment_id is not null and not exists (
    select 1
    from public.treatments
    where id = new.treatment_id
      and family_id = new.family_id
      and child_id = new.child_id
  ) then
    raise exception 'El tratamiento no pertenece al mismo hijo y familia.';
  end if;

  return new;
end;
$$;

create trigger medicine_cabinet_validate_treatment
before insert or update on public.medicine_cabinet_items
for each row execute function public.validate_medicine_cabinet_treatment();

create trigger medicine_cabinet_set_audit_fields
before insert or update on public.medicine_cabinet_items
for each row execute function public.set_audit_fields();

create table public.medicine_stock_usage (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null
    references public.families(id) on delete cascade,
  reminder_id text not null unique
    references public.reminder_records(id) on delete cascade,
  treatment_id uuid not null
    references public.treatments(id) on delete cascade,
  item_id uuid not null
    references public.medicine_cabinet_items(id) on delete cascade,
  consumed_amount numeric(10, 2) not null check (consumed_amount >= 0),
  previous_stock numeric(10, 2) not null check (previous_stock >= 0),
  resulting_stock numeric(10, 2) not null check (resulting_stock >= 0),
  created_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  created_at timestamptz not null default now()
);

create index medicine_stock_usage_family_id_idx
on public.medicine_stock_usage(family_id);
create index medicine_stock_usage_treatment_id_idx
on public.medicine_stock_usage(treatment_id);
create index medicine_stock_usage_item_id_idx
on public.medicine_stock_usage(item_id);

create or replace function public.consume_medicine_stock_for_reminder(
  p_reminder_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reminder public.reminder_records%rowtype;
  v_item public.medicine_cabinet_items%rowtype;
  v_consumed numeric(10, 2);
  v_resulting numeric(10, 2);
  v_usage_id uuid;
begin
  select * into v_reminder
  from public.reminder_records
  where id = p_reminder_id
  for update;

  if not found then
    raise exception 'No se encontró el recordatorio.';
  end if;

  if not public.has_family_access(v_reminder.family_id) then
    raise exception 'No tenés permiso para modificar este stock.';
  end if;

  if exists (
    select 1 from public.medicine_stock_usage
    where reminder_id = p_reminder_id
  ) then
    return jsonb_build_object('updated', false, 'reason', 'already_consumed');
  end if;

  select * into v_item
  from public.medicine_cabinet_items
  where family_id = v_reminder.family_id
    and treatment_id = v_reminder.treatment_id
    and current_stock > 0
  order by expiration_date asc nulls last, created_at asc
  limit 1
  for update;

  if not found then
    return jsonb_build_object('updated', false, 'reason', 'no_linked_stock');
  end if;

  v_consumed := least(v_item.current_stock, v_item.consumption_per_dose);
  v_resulting := greatest(v_item.current_stock - v_consumed, 0);

  update public.medicine_cabinet_items
  set current_stock = v_resulting
  where id = v_item.id;

  insert into public.medicine_stock_usage (
    family_id,
    reminder_id,
    treatment_id,
    item_id,
    consumed_amount,
    previous_stock,
    resulting_stock,
    created_by
  )
  values (
    v_reminder.family_id,
    p_reminder_id,
    v_reminder.treatment_id,
    v_item.id,
    v_consumed,
    v_item.current_stock,
    v_resulting,
    auth.uid()
  )
  returning id into v_usage_id;

  return jsonb_build_object(
    'updated', true,
    'usageId', v_usage_id,
    'itemId', v_item.id,
    'consumedAmount', v_consumed,
    'previousStock', v_item.current_stock,
    'resultingStock', v_resulting
  );
end;
$$;

create or replace function public.restore_medicine_stock_for_reminder(
  p_reminder_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usage public.medicine_stock_usage%rowtype;
begin
  select * into v_usage
  from public.medicine_stock_usage
  where reminder_id = p_reminder_id
  for update;

  if not found then
    return jsonb_build_object('updated', false, 'reason', 'usage_not_found');
  end if;

  if not public.has_family_access(v_usage.family_id) then
    raise exception 'No tenés permiso para modificar este stock.';
  end if;

  update public.medicine_cabinet_items
  set current_stock = current_stock + v_usage.consumed_amount
  where id = v_usage.item_id;

  delete from public.medicine_stock_usage
  where id = v_usage.id;

  return jsonb_build_object('updated', true, 'itemId', v_usage.item_id);
end;
$$;

alter table public.medicine_cabinet_items enable row level security;
alter table public.medicine_stock_usage enable row level security;

create policy "Family access cabinet select"
on public.medicine_cabinet_items for select to authenticated
using (public.has_family_access(family_id));
create policy "Family access cabinet insert"
on public.medicine_cabinet_items for insert to authenticated
with check (public.has_family_access(family_id));
create policy "Family access cabinet update"
on public.medicine_cabinet_items for update to authenticated
using (public.has_family_access(family_id))
with check (public.has_family_access(family_id));
create policy "Family access cabinet delete"
on public.medicine_cabinet_items for delete to authenticated
using (public.has_family_access(family_id));

create policy "Family access stock usage select"
on public.medicine_stock_usage for select to authenticated
using (public.has_family_access(family_id));

revoke all on public.medicine_cabinet_items from anon, authenticated;
revoke all on public.medicine_stock_usage from anon, authenticated;

grant select, insert, update, delete on public.medicine_cabinet_items to authenticated;
grant select on public.medicine_stock_usage to authenticated;

revoke all on function public.consume_medicine_stock_for_reminder(text) from public, anon;
revoke all on function public.restore_medicine_stock_for_reminder(text) from public, anon;
grant execute on function public.consume_medicine_stock_for_reminder(text) to authenticated;
grant execute on function public.restore_medicine_stock_for_reminder(text) to authenticated;
