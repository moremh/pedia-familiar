-- =========================================================
-- MiPeque - Documentos médicos y archivos privados
-- Ruta esperada de Storage:
--   <family_id>/<child_id>/<categoria>/<nombre-del-archivo>
-- =========================================================

create table public.medical_documents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null,
  child_id uuid not null,
  consultation_id uuid,
  treatment_id uuid,
  document_type text not null default 'prescription',
  title text not null check (char_length(trim(title)) >= 2),
  document_date date not null,
  professional_name text not null default '',
  medical_center text not null default '',
  notes text not null default '',
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
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
  foreign key (treatment_id)
    references public.treatments(id) on delete set null
);

create index medical_documents_family_id_idx
on public.medical_documents(family_id);
create index medical_documents_child_id_idx
on public.medical_documents(child_id);
create index medical_documents_date_idx
on public.medical_documents(document_date desc);
create index medical_documents_type_idx
on public.medical_documents(document_type);

create or replace function public.validate_medical_document_links()
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

create trigger medical_documents_validate_links
before insert or update on public.medical_documents
for each row execute function public.validate_medical_document_links();

create trigger medical_documents_set_audit_fields
before insert or update on public.medical_documents
for each row execute function public.set_audit_fields();

alter table public.medical_documents enable row level security;

create policy "Family access documents select"
on public.medical_documents for select to authenticated
using (public.has_family_access(family_id));
create policy "Family access documents insert"
on public.medical_documents for insert to authenticated
with check (public.has_family_access(family_id));
create policy "Family access documents update"
on public.medical_documents for update to authenticated
using (public.has_family_access(family_id))
with check (public.has_family_access(family_id));
create policy "Family access documents delete"
on public.medical_documents for delete to authenticated
using (public.has_family_access(family_id));

revoke all on public.medical_documents from anon, authenticated;
grant select, insert, update, delete on public.medical_documents to authenticated;

-- =========================================================
-- Storage privado
-- =========================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'medical-files',
  'medical-files',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_family_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  first_segment text;
begin
  first_segment := split_part(coalesce(object_name, ''), '/', 1);

  if first_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return first_segment::uuid;
  end if;

  return null;
end;
$$;

revoke all on function public.storage_family_id(text) from public;
grant execute on function public.storage_family_id(text) to authenticated;

create policy "Family reads private medical files"
on storage.objects for select to authenticated
using (
  bucket_id = 'medical-files'
  and public.has_family_access(public.storage_family_id(name))
);

create policy "Family uploads private medical files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'medical-files'
  and public.has_family_access(public.storage_family_id(name))
);

create policy "Family updates private medical files"
on storage.objects for update to authenticated
using (
  bucket_id = 'medical-files'
  and public.has_family_access(public.storage_family_id(name))
)
with check (
  bucket_id = 'medical-files'
  and public.has_family_access(public.storage_family_id(name))
);

create policy "Family deletes private medical files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'medical-files'
  and public.has_family_access(public.storage_family_id(name))
);
