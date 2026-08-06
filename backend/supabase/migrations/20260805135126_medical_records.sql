-- =========================================================
-- MiPeque - Hijos, consultas, tratamientos, recordatorios y vacunas
-- =========================================================

create or replace function public.set_audit_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then
      new.created_by := auth.uid();
    end if;
  end if;

  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

create table public.children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null
    references public.families(id) on delete cascade,
  full_name text not null
    check (char_length(trim(full_name)) >= 2),
  birth_date date not null,
  blood_type text
    check (blood_type is null or blood_type in (
      'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'
    )),
  weight numeric(6, 2) check (weight is null or weight > 0),
  height numeric(6, 2) check (height is null or height > 0),
  allergies text not null default '',
  medical_history text not null default '',
  health_insurance text not null default '',
  member_number text not null default '',
  pediatrician_name text not null default '',
  pediatrician_phone text not null default '',
  emergency_contact_name text not null default '',
  emergency_contact_phone text not null default '',
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, family_id)
);

create index children_family_id_idx on public.children(family_id);
create index children_birth_date_idx on public.children(birth_date);

create trigger children_set_audit_fields
before insert or update on public.children
for each row execute function public.set_audit_fields();

create or replace function public.sync_family_children_count()
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
  set children_count = (
    select count(*)::integer
    from public.children
    where family_id = target_family_id
  )
  where id = target_family_id;

  if tg_op = 'UPDATE' and old.family_id <> new.family_id then
    update public.families
    set children_count = (
      select count(*)::integer
      from public.children
      where family_id = old.family_id
    )
    where id = old.family_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_family_children_count() from public;

create trigger sync_family_children_count_trigger
after insert or update or delete on public.children
for each row execute function public.sync_family_children_count();

create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_id uuid not null,
  consultation_date date not null,
  consultation_time time,
  consultation_type text not null default 'pediatric',
  reason text not null check (char_length(trim(reason)) >= 2),
  symptoms text not null default '',
  diagnosis text not null default '',
  professional_name text not null default '',
  specialty text not null default '',
  medical_center text not null default '',
  weight numeric(6, 2) check (weight is null or weight > 0),
  temperature numeric(4, 1)
    check (temperature is null or temperature between 30 and 45),
  indications text not null default '',
  follow_up_date date,
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (child_id, family_id)
    references public.children(id, family_id) on delete cascade,
  unique (id, family_id, child_id)
);

create index consultations_family_id_idx on public.consultations(family_id);
create index consultations_child_id_idx on public.consultations(child_id);
create index consultations_date_idx on public.consultations(consultation_date desc);

create trigger consultations_set_audit_fields
before insert or update on public.consultations
for each row execute function public.set_audit_fields();

create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_id uuid not null,
  consultation_id uuid,
  medication_name text not null
    check (char_length(trim(medication_name)) >= 2),
  presentation text not null default '',
  dosage_instruction text not null
    check (char_length(trim(dosage_instruction)) >= 1),
  administration_route text not null default 'oral',
  start_date date not null,
  duration_days integer not null check (duration_days > 0),
  end_date date not null,
  frequency_mode text not null default 'interval'
    check (frequency_mode in ('interval', 'custom')),
  interval_hours integer
    check (interval_hours is null or interval_hours between 1 and 24),
  first_dose_time time,
  custom_times time[] not null default '{}',
  status text not null default 'active'
    check (status in ('active', 'scheduled', 'paused', 'completed')),
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (child_id, family_id)
    references public.children(id, family_id) on delete cascade,
  foreign key (consultation_id)
    references public.consultations(id) on delete set null,
  unique (id, family_id, child_id),
  constraint valid_treatment_dates check (end_date >= start_date),
  constraint valid_treatment_frequency check (
    (
      frequency_mode = 'interval'
      and interval_hours is not null
      and first_dose_time is not null
    )
    or
    (
      frequency_mode = 'custom'
      and cardinality(custom_times) > 0
    )
  )
);

create index treatments_family_id_idx on public.treatments(family_id);
create index treatments_child_id_idx on public.treatments(child_id);
create index treatments_status_idx on public.treatments(status);
create index treatments_start_date_idx on public.treatments(start_date desc);

create or replace function public.validate_treatment_consultation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.consultation_id is not null and not exists (
    select 1
    from public.consultations
    where id = new.consultation_id
      and family_id = new.family_id
      and child_id = new.child_id
  ) then
    raise exception 'La consulta no pertenece al mismo hijo y familia.';
  end if;

  return new;
end;
$$;

create trigger treatments_validate_consultation
before insert or update on public.treatments
for each row execute function public.validate_treatment_consultation();

create trigger treatments_set_audit_fields
before insert or update on public.treatments
for each row execute function public.set_audit_fields();

create table public.reminder_records (
  id text primary key,
  family_id uuid not null,
  treatment_id uuid not null,
  child_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'postponed', 'administered', 'omitted')),
  scheduled_at timestamptz not null,
  original_time time not null,
  postponed_until timestamptz,
  completed_at timestamptz,
  responsible_caregiver_id uuid
    references public.caregivers(id) on delete set null,
  responsible_name text not null default '',
  medication_name text not null default '',
  presentation text not null default '',
  dosage_instruction text not null default '',
  child_name text not null default '',
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (treatment_id, family_id, child_id)
    references public.treatments(id, family_id, child_id) on delete cascade
);

create index reminder_records_family_id_idx on public.reminder_records(family_id);
create index reminder_records_treatment_id_idx on public.reminder_records(treatment_id);
create index reminder_records_scheduled_at_idx on public.reminder_records(scheduled_at);
create index reminder_records_status_idx on public.reminder_records(status);

create trigger reminder_records_set_audit_fields
before insert or update on public.reminder_records
for each row execute function public.set_audit_fields();

create table public.vaccines (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_id uuid not null,
  vaccine_name text not null
    check (char_length(trim(vaccine_name)) >= 2),
  record_status text not null default 'applied'
    check (record_status in ('applied', 'pending')),
  application_date date,
  next_dose_date date,
  dose_label text not null default '',
  observations text not null default '',
  lot_number text not null default '',
  vaccination_center text not null default '',
  professional_name text not null default '',
  proof_storage_path text,
  proof_file_name text,
  proof_mime_type text,
  proof_size_bytes bigint check (proof_size_bytes is null or proof_size_bytes >= 0),
  created_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (child_id, family_id)
    references public.children(id, family_id) on delete cascade,
  constraint valid_vaccine_dates check (
    (
      record_status = 'applied'
      and application_date is not null
      and (next_dose_date is null or next_dose_date > application_date)
    )
    or
    (
      record_status = 'pending'
      and application_date is null
      and next_dose_date is not null
    )
  )
);

create index vaccines_family_id_idx on public.vaccines(family_id);
create index vaccines_child_id_idx on public.vaccines(child_id);
create index vaccines_next_dose_date_idx on public.vaccines(next_dose_date);

create trigger vaccines_set_audit_fields
before insert or update on public.vaccines
for each row execute function public.set_audit_fields();

-- =========================================================
-- RLS
-- =========================================================

alter table public.children enable row level security;
alter table public.consultations enable row level security;
alter table public.treatments enable row level security;
alter table public.reminder_records enable row level security;
alter table public.vaccines enable row level security;

create policy "Family access children select"
on public.children for select to authenticated
using (public.has_family_access(family_id));
create policy "Family access children insert"
on public.children for insert to authenticated
with check (public.has_family_access(family_id));
create policy "Family access children update"
on public.children for update to authenticated
using (public.has_family_access(family_id))
with check (public.has_family_access(family_id));
create policy "Family access children delete"
on public.children for delete to authenticated
using (public.has_family_access(family_id));

create policy "Family access consultations select"
on public.consultations for select to authenticated
using (public.has_family_access(family_id));
create policy "Family access consultations insert"
on public.consultations for insert to authenticated
with check (public.has_family_access(family_id));
create policy "Family access consultations update"
on public.consultations for update to authenticated
using (public.has_family_access(family_id))
with check (public.has_family_access(family_id));
create policy "Family access consultations delete"
on public.consultations for delete to authenticated
using (public.has_family_access(family_id));

create policy "Family access treatments select"
on public.treatments for select to authenticated
using (public.has_family_access(family_id));
create policy "Family access treatments insert"
on public.treatments for insert to authenticated
with check (public.has_family_access(family_id));
create policy "Family access treatments update"
on public.treatments for update to authenticated
using (public.has_family_access(family_id))
with check (public.has_family_access(family_id));
create policy "Family access treatments delete"
on public.treatments for delete to authenticated
using (public.has_family_access(family_id));

create policy "Family access reminders select"
on public.reminder_records for select to authenticated
using (public.has_family_access(family_id));
create policy "Family access reminders insert"
on public.reminder_records for insert to authenticated
with check (public.has_family_access(family_id));
create policy "Family access reminders update"
on public.reminder_records for update to authenticated
using (public.has_family_access(family_id))
with check (public.has_family_access(family_id));
create policy "Family access reminders delete"
on public.reminder_records for delete to authenticated
using (public.has_family_access(family_id));

create policy "Family access vaccines select"
on public.vaccines for select to authenticated
using (public.has_family_access(family_id));
create policy "Family access vaccines insert"
on public.vaccines for insert to authenticated
with check (public.has_family_access(family_id));
create policy "Family access vaccines update"
on public.vaccines for update to authenticated
using (public.has_family_access(family_id))
with check (public.has_family_access(family_id));
create policy "Family access vaccines delete"
on public.vaccines for delete to authenticated
using (public.has_family_access(family_id));

-- =========================================================
-- Permisos
-- =========================================================

revoke all on public.children from anon, authenticated;
revoke all on public.consultations from anon, authenticated;
revoke all on public.treatments from anon, authenticated;
revoke all on public.reminder_records from anon, authenticated;
revoke all on public.vaccines from anon, authenticated;

grant select, insert, update, delete on public.children to authenticated;
grant select, insert, update, delete on public.consultations to authenticated;
grant select, insert, update, delete on public.treatments to authenticated;
grant select, insert, update, delete on public.reminder_records to authenticated;
grant select, insert, update, delete on public.vaccines to authenticated;
