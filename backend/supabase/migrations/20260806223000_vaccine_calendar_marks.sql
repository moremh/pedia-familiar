-- MiPeque
-- Seguimiento simple del Calendario Nacional de Vacunación por hijo.
-- Cada fila representa una casilla marcada en el calendario visual.

create table if not exists public.vaccine_schedule_marks (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  child_id uuid not null,
  schedule_key text not null
    check (char_length(trim(schedule_key)) >= 3),
  checked_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  updated_by uuid references public.profiles(id) on delete set null
    default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (child_id, family_id)
    references public.children(id, family_id) on delete cascade,
  constraint vaccine_schedule_marks_child_schedule_unique
    unique (child_id, schedule_key)
);

create index if not exists vaccine_schedule_marks_family_id_idx
  on public.vaccine_schedule_marks(family_id);

create index if not exists vaccine_schedule_marks_child_id_idx
  on public.vaccine_schedule_marks(child_id);

create index if not exists vaccine_schedule_marks_schedule_key_idx
  on public.vaccine_schedule_marks(schedule_key);

drop trigger if exists vaccine_schedule_marks_set_audit_fields
  on public.vaccine_schedule_marks;

create trigger vaccine_schedule_marks_set_audit_fields
before insert or update on public.vaccine_schedule_marks
for each row execute function public.set_audit_fields();

alter table public.vaccine_schedule_marks enable row level security;

drop policy if exists "Full family access vaccine schedule select"
  on public.vaccine_schedule_marks;
drop policy if exists "Full family access vaccine schedule insert"
  on public.vaccine_schedule_marks;
drop policy if exists "Full family access vaccine schedule update"
  on public.vaccine_schedule_marks;
drop policy if exists "Full family access vaccine schedule delete"
  on public.vaccine_schedule_marks;

create policy "Full family access vaccine schedule select"
on public.vaccine_schedule_marks
for select to authenticated
using (public.has_full_family_access(family_id));

create policy "Full family access vaccine schedule insert"
on public.vaccine_schedule_marks
for insert to authenticated
with check (public.has_full_family_access(family_id));

create policy "Full family access vaccine schedule update"
on public.vaccine_schedule_marks
for update to authenticated
using (public.has_full_family_access(family_id))
with check (public.has_full_family_access(family_id));

create policy "Full family access vaccine schedule delete"
on public.vaccine_schedule_marks
for delete to authenticated
using (public.has_full_family_access(family_id));

revoke all on public.vaccine_schedule_marks from anon, authenticated;
grant select, insert, update, delete on public.vaccine_schedule_marks to authenticated;
