-- =========================================================
-- MiPeque - Acceso limitado para responsables de tomas
-- =========================================================

alter table public.caregivers
add column if not exists system_access_level text not null default 'full_access';

alter table public.family_members
add column if not exists access_level text not null default 'full_access';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'caregivers_system_access_level_check'
  ) then
    alter table public.caregivers
      add constraint caregivers_system_access_level_check
      check (system_access_level in ('full_access', 'medication_only'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'family_members_access_level_check'
  ) then
    alter table public.family_members
      add constraint family_members_access_level_check
      check (access_level in ('full_access', 'medication_only'));
  end if;
end;
$$;

update public.family_members
set access_level = 'full_access'
where member_role = 'owner';

update public.caregivers
set system_access_level = 'full_access'
where is_primary = true;

create or replace function public.has_full_family_access(checked_family_id uuid)
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
        and member.access_level = 'full_access'
        and profile.status = 'active'
        and (
          (family.access_status = 'trial' and family.trial_ends_at > now())
          or
          (family.access_status = 'active' and family.current_period_end > now())
        )
    );
$$;

revoke all on function public.has_full_family_access(uuid) from public;
grant execute on function public.has_full_family_access(uuid) to authenticated;

create or replace function public.sync_caregiver_access_level()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    update public.family_members
    set
      access_level = case
        when member_role = 'owner' then 'full_access'
        else new.system_access_level
      end,
      updated_at = now()
    where family_id = new.family_id
      and user_id = new.user_id;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_caregiver_access_level() from public;

drop trigger if exists caregivers_sync_access_level on public.caregivers;
create trigger caregivers_sync_access_level
after insert or update of system_access_level, user_id on public.caregivers
for each row execute function public.sync_caregiver_access_level();

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
  v_access_level text;
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

  select full_name, relationship, system_access_level
  into v_caregiver_name, v_relationship, v_access_level
  from public.caregivers
  where id = v_invitation.caregiver_id;

  return jsonb_build_object(
    'valid', v_invitation.status = 'pending',
    'status', v_invitation.status,
    'familyId', v_invitation.family_id,
    'familyName', v_family_name,
    'caregiverName', v_caregiver_name,
    'relationship', v_relationship,
    'accessLevel', coalesce(v_access_level, 'full_access'),
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
  v_access_level text;
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

  select coalesce(system_access_level, 'full_access')
  into v_access_level
  from public.caregivers
  where id = v_invitation.caregiver_id;

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
    access_level,
    status,
    joined_at,
    revoked_at
  )
  values (
    v_invitation.family_id,
    v_user_id,
    v_invitation.caregiver_id,
    'member',
    v_access_level,
    'active',
    now(),
    null
  )
  on conflict (family_id, user_id) do update set
    caregiver_id = excluded.caregiver_id,
    member_role = 'member',
    access_level = excluded.access_level,
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
    'accessLevel', v_access_level,
    'status', 'accepted'
  );
end;
$$;

-- Solo una cuenta con acceso completo puede administrar familia, responsables y configuración.
drop policy if exists "Members update family name" on public.families;
create policy "Members update family name"
on public.families for update to authenticated
using (public.has_full_family_access(id) or public.is_app_admin())
with check (public.has_full_family_access(id) or public.is_app_admin());

drop policy if exists "Members create caregivers" on public.caregivers;
create policy "Members create caregivers"
on public.caregivers for insert to authenticated
with check (public.has_full_family_access(family_id));

drop policy if exists "Members update caregivers" on public.caregivers;
create policy "Members update caregivers"
on public.caregivers for update to authenticated
using (public.has_full_family_access(family_id))
with check (public.has_full_family_access(family_id));

drop policy if exists "Members delete caregivers" on public.caregivers;
create policy "Members delete caregivers"
on public.caregivers for delete to authenticated
using (
  public.has_full_family_access(family_id)
  and not exists (
    select 1 from public.family_members member
    where member.caregiver_id = caregivers.id
      and member.member_role = 'owner'
      and member.status = 'active'
  )
);

drop policy if exists "Members create family settings" on public.family_settings;
create policy "Members create family settings"
on public.family_settings for insert to authenticated
with check (public.has_full_family_access(family_id));

drop policy if exists "Members update family settings" on public.family_settings;
create policy "Members update family settings"
on public.family_settings for update to authenticated
using (public.has_full_family_access(family_id))
with check (public.has_full_family_access(family_id));

-- Datos médicos: lectura para todos los integrantes; escritura general solo para acceso completo.
do $$
declare
  table_name text;
  policy_prefix text;
begin
  foreach table_name in array array['children','consultations','treatments','vaccines'] loop
    policy_prefix := case table_name
      when 'children' then 'Family access children'
      when 'consultations' then 'Family access consultations'
      when 'treatments' then 'Family access treatments'
      when 'vaccines' then 'Family access vaccines'
    end;

    execute format('drop policy if exists %I on public.%I', policy_prefix || ' insert', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.has_full_family_access(family_id))', policy_prefix || ' insert', table_name);
    execute format('drop policy if exists %I on public.%I', policy_prefix || ' update', table_name);
    execute format('create policy %I on public.%I for update to authenticated using (public.has_full_family_access(family_id)) with check (public.has_full_family_access(family_id))', policy_prefix || ' update', table_name);
    execute format('drop policy if exists %I on public.%I', policy_prefix || ' delete', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using (public.has_full_family_access(family_id))', policy_prefix || ' delete', table_name);
  end loop;
end;
$$;

-- Los responsables de tomas pueden crear y actualizar registros de tomas, pero no eliminarlos.
drop policy if exists "Family access reminders insert" on public.reminder_records;
create policy "Family access reminders insert"
on public.reminder_records for insert to authenticated
with check (public.has_family_access(family_id));

drop policy if exists "Family access reminders update" on public.reminder_records;
create policy "Family access reminders update"
on public.reminder_records for update to authenticated
using (public.has_family_access(family_id))
with check (public.has_family_access(family_id));

drop policy if exists "Family access reminders delete" on public.reminder_records;
create policy "Family access reminders delete"
on public.reminder_records for delete to authenticated
using (public.has_full_family_access(family_id));

-- Documentos y archivos privados: escritura solo para acceso completo.
drop policy if exists "Family access documents insert" on public.medical_documents;
create policy "Family access documents insert"
on public.medical_documents for insert to authenticated
with check (public.has_full_family_access(family_id));

drop policy if exists "Family access documents update" on public.medical_documents;
create policy "Family access documents update"
on public.medical_documents for update to authenticated
using (public.has_full_family_access(family_id))
with check (public.has_full_family_access(family_id));

drop policy if exists "Family access documents delete" on public.medical_documents;
create policy "Family access documents delete"
on public.medical_documents for delete to authenticated
using (public.has_full_family_access(family_id));

drop policy if exists "Family uploads private medical files" on storage.objects;
create policy "Family uploads private medical files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'medical-files'
  and public.has_full_family_access(public.storage_family_id(name))
);

drop policy if exists "Family updates private medical files" on storage.objects;
create policy "Family updates private medical files"
on storage.objects for update to authenticated
using (
  bucket_id = 'medical-files'
  and public.has_full_family_access(public.storage_family_id(name))
)
with check (
  bucket_id = 'medical-files'
  and public.has_full_family_access(public.storage_family_id(name))
);

drop policy if exists "Family deletes private medical files" on storage.objects;
create policy "Family deletes private medical files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'medical-files'
  and public.has_full_family_access(public.storage_family_id(name))
);

-- Botiquín: visible para registrar tomas, administrable solo con acceso completo.
drop policy if exists "Family access cabinet insert" on public.medicine_cabinet_items;
create policy "Family access cabinet insert"
on public.medicine_cabinet_items for insert to authenticated
with check (public.has_full_family_access(family_id));

drop policy if exists "Family access cabinet update" on public.medicine_cabinet_items;
create policy "Family access cabinet update"
on public.medicine_cabinet_items for update to authenticated
using (public.has_full_family_access(family_id))
with check (public.has_full_family_access(family_id));

drop policy if exists "Family access cabinet delete" on public.medicine_cabinet_items;
create policy "Family access cabinet delete"
on public.medicine_cabinet_items for delete to authenticated
using (public.has_full_family_access(family_id));

grant insert (system_access_level) on public.caregivers to authenticated;
grant update (system_access_level) on public.caregivers to authenticated;

revoke all on function public.get_invitation_preview(text) from public;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;
revoke all on function public.accept_family_invitation(text) from public, anon;
grant execute on function public.accept_family_invitation(text) to authenticated;

-- Las invitaciones y revocaciones solo pueden gestionarlas cuentas con acceso completo.
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

  if not public.has_full_family_access(v_caregiver.family_id) then
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
    'accessLevel', v_caregiver.system_access_level,
    'expiresAt', v_expires_at
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

  if not public.has_full_family_access(v_caregiver.family_id) then
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

revoke all on function public.create_family_invitation(uuid, integer) from public, anon;
grant execute on function public.create_family_invitation(uuid, integer) to authenticated;
revoke all on function public.revoke_caregiver_access(uuid) from public, anon;
grant execute on function public.revoke_caregiver_access(uuid) to authenticated;

create or replace function public.is_full_family_member(checked_family_id uuid)
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
      where member.family_id = checked_family_id
        and member.user_id = auth.uid()
        and member.status = 'active'
        and member.access_level = 'full_access'
        and profile.status = 'active'
    );
$$;

revoke all on function public.is_full_family_member(uuid) from public;
grant execute on function public.is_full_family_member(uuid) to authenticated;

-- Mantiene precios y promociones dinámicos, pero solo el acceso completo puede solicitar un plan.
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
  if not public.is_full_family_member(p_family_id) then
    raise exception 'Solo el responsable con acceso completo puede solicitar un plan.';
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

revoke all on function public.request_family_plan(uuid, text) from public, anon;
grant execute on function public.request_family_plan(uuid, text) to authenticated;
