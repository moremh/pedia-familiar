-- =========================================================
-- MiPeque - endurecimiento de permisos y consistencia comercial
-- 2026-10-26
-- =========================================================

-- Conserva cualquier precio personalizado del panel admin.
-- Solo migra los valores iniciales históricos.
update public.subscription_plans
set price_ars = 25000,
    updated_at = now()
where id = 'monthly'
  and price_ars = 15000;

update public.subscription_plans
set price_ars = 150000,
    updated_at = now()
where id = 'annual'
  and price_ars = 100000;

-- Los responsables con acceso medication_only necesitan hijos,
-- tratamientos y recordatorios para administrar tomas, pero no
-- deben poder leer consultas, vacunas ni documentos médicos.

drop policy if exists "Family access consultations select"
on public.consultations;

create policy "Family access consultations select"
on public.consultations for select to authenticated
using (
  public.has_full_family_access(family_id)
);

drop policy if exists "Family access vaccines select"
on public.vaccines;

create policy "Family access vaccines select"
on public.vaccines for select to authenticated
using (
  public.has_full_family_access(family_id)
);

drop policy if exists "Family access documents select"
on public.medical_documents;

create policy "Family access documents select"
on public.medical_documents for select to authenticated
using (
  public.has_full_family_access(family_id)
);

drop policy if exists "Family reads private medical files"
on storage.objects;

create policy "Family reads private medical files"
on storage.objects for select to authenticated
using (
  bucket_id = 'medical-files'
  and public.has_full_family_access(
    public.storage_family_id(name)
  )
);

-- El calendario visual de vacunas también es información médica.
drop policy if exists "Full family access vaccine schedule select"
on public.vaccine_schedule_marks;

create policy "Full family access vaccine schedule select"
on public.vaccine_schedule_marks for select to authenticated
using (
  public.has_full_family_access(family_id)
);
