-- =========================================================
-- MiPeque
-- Eliminación segura de datos familiares
--
-- Conserva:
-- - familia y suscripción
-- - pagos e historial comercial
-- - cuenta del responsable principal
-- - responsables e invitaciones
--
-- Elimina:
-- - hijos
-- - consultas
-- - tratamientos
-- - acciones de tomas
-- - vacunas
-- - documentos médicos
-- - botiquín y consumos de stock
-- - preferencias familiares personalizadas
-- =========================================================

create or replace function public.clear_family_data(
  p_family_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_is_owner boolean;
  v_children integer := 0;
  v_consultations integer := 0;
  v_treatments integer := 0;
  v_reminders integer := 0;
  v_vaccines integer := 0;
  v_documents integer := 0;
  v_cabinet integer := 0;
  v_usage integer := 0;
begin
  if p_family_id is null then
    raise exception
      'No se encontró la familia seleccionada.';
  end if;

  select exists (
    select 1
    from public.family_members member
    inner join public.profiles profile
      on profile.id = member.user_id
    where member.family_id = p_family_id
      and member.user_id = auth.uid()
      and member.member_role = 'owner'
      and member.status = 'active'
      and profile.status = 'active'
  )
  into v_is_owner;

  if not v_is_owner
     and not public.is_app_admin() then
    raise exception
      'Solo el responsable principal puede eliminar todos los datos familiares.';
  end if;

  if not exists (
    select 1
    from public.families
    where id = p_family_id
  ) then
    raise exception
      'La familia seleccionada no existe.';
  end if;

  select count(*)::integer
  into v_children
  from public.children
  where family_id = p_family_id;

  select count(*)::integer
  into v_consultations
  from public.consultations
  where family_id = p_family_id;

  select count(*)::integer
  into v_treatments
  from public.treatments
  where family_id = p_family_id;

  select count(*)::integer
  into v_reminders
  from public.reminder_records
  where family_id = p_family_id;

  select count(*)::integer
  into v_vaccines
  from public.vaccines
  where family_id = p_family_id;

  select count(*)::integer
  into v_documents
  from public.medical_documents
  where family_id = p_family_id;

  select count(*)::integer
  into v_cabinet
  from public.medicine_cabinet_items
  where family_id = p_family_id;

  select count(*)::integer
  into v_usage
  from public.medicine_stock_usage
  where family_id = p_family_id;

  delete from public.medicine_stock_usage
  where family_id = p_family_id;

  delete from public.medical_documents
  where family_id = p_family_id;

  delete from public.vaccines
  where family_id = p_family_id;

  delete from public.reminder_records
  where family_id = p_family_id;

  delete from public.medicine_cabinet_items
  where family_id = p_family_id;

  delete from public.treatments
  where family_id = p_family_id;

  delete from public.consultations
  where family_id = p_family_id;

  delete from public.children
  where family_id = p_family_id;

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
    '',
    '',
    '',
    null,
    15,
    30,
    30,
    true,
    true,
    true,
    true
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

  update public.families
  set
    children_count = 0,
    updated_at = now()
  where id = p_family_id;

  return jsonb_build_object(
    'familyId', p_family_id,
    'children', v_children,
    'consultations', v_consultations,
    'treatments', v_treatments,
    'reminders', v_reminders,
    'vaccines', v_vaccines,
    'documents', v_documents,
    'medicineCabinet', v_cabinet,
    'stockUsage', v_usage,
    'status', 'cleared'
  );
end;
$$;

revoke all on function public.clear_family_data(uuid)
from public;

revoke all on function public.clear_family_data(uuid)
from anon;

revoke all on function public.clear_family_data(uuid)
from authenticated;

grant execute on function public.clear_family_data(uuid)
to authenticated;
