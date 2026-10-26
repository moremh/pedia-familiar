-- =========================================================
-- MiPeque - endurecimiento de permisos
-- 2026-10-26
-- =========================================================
--
-- Importante:
-- esta migración NO modifica precios ni promociones.
-- Los valores comerciales siguen siendo administrables
-- desde el panel y se guardan en public.subscription_plans.
--
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
