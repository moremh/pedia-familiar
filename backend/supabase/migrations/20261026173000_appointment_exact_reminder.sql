-- =========================================================
-- MiPeque - recordatorio exacto para turnos
-- 2026-10-26
-- =========================================================

alter table public.appointments
  add column if not exists reminder_mode text
    not null default 'relative'
    check (reminder_mode in ('relative', 'exact'));

alter table public.appointments
  add column if not exists reminder_at timestamptz;

update public.appointments
set reminder_mode = 'relative'
where reminder_mode is null;
