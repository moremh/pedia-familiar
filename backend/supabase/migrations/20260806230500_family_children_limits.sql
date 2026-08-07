-- =========================================================
-- MiPeque
-- Límite de hijos por familia + cupos extra administrables
-- Base inicial: 3 hijos por familia
-- Valor inicial de referencia por hijo extra: $5.000 ARS
-- =========================================================

alter table public.families
add column if not exists children_limit_override integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'families_children_limit_override_check'
      and conrelid = 'public.families'::regclass
  ) then
    alter table public.families
    add constraint families_children_limit_override_check
    check (
      children_limit_override is null
      or children_limit_override between 1 and 20
    );
  end if;
end;
$$;

create table if not exists public.child_limit_settings (
  id boolean primary key default true
    check (id = true),
  base_children_limit integer not null default 3
    check (base_children_limit between 1 and 20),
  extra_child_price_ars integer not null default 5000
    check (extra_child_price_ars >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists child_limit_settings_set_updated_at
on public.child_limit_settings;

create trigger child_limit_settings_set_updated_at
before update on public.child_limit_settings
for each row
execute function public.set_updated_at();

insert into public.child_limit_settings (
  id,
  base_children_limit,
  extra_child_price_ars
)
values (true, 3, 5000)
on conflict (id) do nothing;

-- Si ya existe una familia con más hijos que el límite inicial,
-- conservamos como mínimo la cantidad que ya tiene registrada.
update public.families family
set children_limit_override = greatest(
  family.children_count,
  coalesce(family.children_limit_override, 0)
)
where family.children_count > (
  select settings.base_children_limit
  from public.child_limit_settings settings
  where settings.id = true
)
and (
  family.children_limit_override is null
  or family.children_limit_override < family.children_count
);

-- =========================================================
-- Consultar cupo de una familia
-- =========================================================

create or replace function public.get_family_child_capacity(
  p_family_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base_limit integer := 3;
  v_extra_price integer := 5000;
  v_override integer;
  v_current_count integer := 0;
  v_configured_limit integer;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.';
  end if;

  if not (
    public.is_app_admin()
    or public.is_family_member(p_family_id)
  ) then
    raise exception 'No tenés permiso para consultar esta familia.';
  end if;

  select
    settings.base_children_limit,
    settings.extra_child_price_ars
  into
    v_base_limit,
    v_extra_price
  from public.child_limit_settings settings
  where settings.id = true;

  select family.children_limit_override
  into v_override
  from public.families family
  where family.id = p_family_id;

  if not found then
    raise exception 'No se encontró la familia.';
  end if;

  select count(*)::integer
  into v_current_count
  from public.children child
  where child.family_id = p_family_id;

  v_base_limit := coalesce(v_base_limit, 3);
  v_extra_price := coalesce(v_extra_price, 5000);

  v_configured_limit := greatest(
    v_base_limit,
    coalesce(v_override, v_base_limit)
  );

  return jsonb_build_object(
    'baseChildrenLimit', v_base_limit,
    'currentCount', v_current_count,
    'configuredLimit', v_configured_limit,
    'effectiveLimit', greatest(v_current_count, v_configured_limit),
    'availableSlots', greatest(v_configured_limit - v_current_count, 0),
    'canAdd', v_current_count < v_configured_limit,
    'extraChildrenEnabled', greatest(v_configured_limit - v_base_limit, 0),
    'extraChildPrice', v_extra_price
  );
end;
$$;

-- =========================================================
-- Configuración global desde el panel administrador
-- =========================================================

create or replace function public.update_child_limit_settings(
  p_base_children_limit integer,
  p_extra_child_price_ars integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Solo administración puede modificar esta configuración.';
  end if;

  if p_base_children_limit is null
     or p_base_children_limit < 1
     or p_base_children_limit > 20 then
    raise exception 'El límite base debe estar entre 1 y 20 hijos.';
  end if;

  if p_extra_child_price_ars is null
     or p_extra_child_price_ars < 0 then
    raise exception 'El precio del hijo extra no es válido.';
  end if;

  insert into public.child_limit_settings (
    id,
    base_children_limit,
    extra_child_price_ars
  )
  values (
    true,
    p_base_children_limit,
    p_extra_child_price_ars
  )
  on conflict (id) do update set
    base_children_limit = excluded.base_children_limit,
    extra_child_price_ars = excluded.extra_child_price_ars,
    updated_at = now();

  -- Si el nuevo límite base baja, ninguna familia pierde perfiles
  -- que ya tenga cargados: su cupo queda como mínimo en el uso actual.
  update public.families family
  set children_limit_override = family.children_count
  where family.children_count > p_base_children_limit
    and (
      family.children_limit_override is null
      or family.children_limit_override < family.children_count
    );

  -- Los overrides que ya quedan cubiertos por el nuevo límite base
  -- dejan de ser necesarios.
  update public.families
  set children_limit_override = null
  where children_limit_override is not null
    and children_limit_override <= p_base_children_limit;

  return jsonb_build_object(
    'baseChildrenLimit', p_base_children_limit,
    'extraChildPrice', p_extra_child_price_ars
  );
end;
$$;

-- =========================================================
-- Habilitar o quitar cupos a una familia específica
-- =========================================================

create or replace function public.set_family_children_limit(
  p_family_id uuid,
  p_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base_limit integer := 3;
  v_current_count integer := 0;
  v_target_limit integer;
begin
  if not public.is_app_admin() then
    raise exception 'Solo administración puede modificar el cupo de una familia.';
  end if;

  if not exists (
    select 1
    from public.families family
    where family.id = p_family_id
  ) then
    raise exception 'No se encontró la familia.';
  end if;

  select coalesce(settings.base_children_limit, 3)
  into v_base_limit
  from public.child_limit_settings settings
  where settings.id = true;

  v_base_limit := coalesce(v_base_limit, 3);

  select count(*)::integer
  into v_current_count
  from public.children child
  where child.family_id = p_family_id;

  if p_limit is null then
    v_target_limit := v_base_limit;
  else
    v_target_limit := p_limit;
  end if;

  if v_target_limit < v_base_limit then
    raise exception 'El cupo de una familia no puede ser menor que el límite base de % hijos.', v_base_limit;
  end if;

  if v_target_limit > 20 then
    raise exception 'El límite máximo permitido es de 20 hijos.';
  end if;

  if v_target_limit < v_current_count then
    raise exception 'No podés reducir el cupo por debajo de los % hijos que la familia ya tiene registrados.', v_current_count;
  end if;

  update public.families
  set
    children_limit_override = case
      when v_target_limit = v_base_limit then null
      else v_target_limit
    end,
    updated_at = now()
  where id = p_family_id;

  return public.get_family_child_capacity(p_family_id);
end;
$$;

-- =========================================================
-- Protección real en base de datos
-- Evita superar el cupo incluso si se intenta insertar por fuera de la UI.
-- =========================================================

create or replace function public.enforce_family_children_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base_limit integer := 3;
  v_override integer;
  v_current_count integer := 0;
  v_allowed_limit integer;
begin
  if tg_op = 'UPDATE' and old.family_id = new.family_id then
    return new;
  end if;

  -- Serializa altas simultáneas de hijos de la misma familia.
  perform 1
  from public.families family
  where family.id = new.family_id
  for update;

  if not found then
    raise exception 'No se encontró la familia.';
  end if;

  select
    settings.base_children_limit
  into v_base_limit
  from public.child_limit_settings settings
  where settings.id = true;

  select family.children_limit_override
  into v_override
  from public.families family
  where family.id = new.family_id;

  v_base_limit := coalesce(v_base_limit, 3);
  v_allowed_limit := greatest(
    v_base_limit,
    coalesce(v_override, v_base_limit)
  );

  select count(*)::integer
  into v_current_count
  from public.children child
  where child.family_id = new.family_id;

  if v_current_count >= v_allowed_limit then
    raise exception 'La familia alcanzó el límite de % hijos. Administración debe habilitar un cupo adicional.', v_allowed_limit;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_family_children_limit_trigger
on public.children;

create trigger enforce_family_children_limit_trigger
before insert or update of family_id on public.children
for each row
execute function public.enforce_family_children_limit();

-- =========================================================
-- RLS y permisos
-- =========================================================

alter table public.child_limit_settings
enable row level security;

drop policy if exists "Authenticated read child limit settings"
on public.child_limit_settings;

create policy "Authenticated read child limit settings"
on public.child_limit_settings
for select
to authenticated
using (true);

drop policy if exists "Admin manage child limit settings"
on public.child_limit_settings;

create policy "Admin manage child limit settings"
on public.child_limit_settings
for all
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

revoke all on public.child_limit_settings from anon, authenticated;
grant select on public.child_limit_settings to authenticated;

revoke all on function public.get_family_child_capacity(uuid) from public;
revoke all on function public.update_child_limit_settings(integer, integer) from public;
revoke all on function public.set_family_children_limit(uuid, integer) from public;
revoke all on function public.enforce_family_children_limit() from public;

grant execute on function public.get_family_child_capacity(uuid) to authenticated;
grant execute on function public.update_child_limit_settings(integer, integer) to authenticated;
grant execute on function public.set_family_children_limit(uuid, integer) to authenticated;
