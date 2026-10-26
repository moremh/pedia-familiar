-- =========================================================
-- MiPeque - contacto comercial administrable
-- 2026-10-26
-- =========================================================

create table if not exists public.commercial_contact_settings (
  id boolean primary key default true
    check (id = true),
  support_whatsapp text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.commercial_contact_settings (
  id,
  support_whatsapp
)
values (true, '')
on conflict (id) do nothing;

drop trigger if exists commercial_contact_settings_set_updated_at
on public.commercial_contact_settings;

create trigger commercial_contact_settings_set_updated_at
before update on public.commercial_contact_settings
for each row
execute function public.set_updated_at();

alter table public.commercial_contact_settings
enable row level security;

drop policy if exists
  "Authenticated read commercial contact"
on public.commercial_contact_settings;

create policy
  "Authenticated read commercial contact"
on public.commercial_contact_settings
for select
to authenticated
using (true);

drop policy if exists
  "Admins manage commercial contact"
on public.commercial_contact_settings;

create policy
  "Admins manage commercial contact"
on public.commercial_contact_settings
for all
to authenticated
using (public.is_app_admin())
with check (public.is_app_admin());

revoke all
on public.commercial_contact_settings
from anon, authenticated;

grant select, insert, update
on public.commercial_contact_settings
to authenticated;
