-- =========================================================
-- MiPeque
-- Evita responsables duplicados dentro de una misma familia.
--
-- Se considera duplicado cuando coincide:
--   1. el correo electrónico, o
--   2. el nombre junto con el teléfono, o
--   3. todos los datos de identidad.
--
-- Los duplicados ya existentes no se eliminan automáticamente.
-- =========================================================

create or replace function public.prevent_duplicate_family_caregiver()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_duplicate_id uuid;
  v_new_email text;
  v_new_phone text;
  v_new_name text;
begin
  v_new_email := lower(trim(coalesce(new.email, '')));
  v_new_phone := regexp_replace(
    coalesce(new.phone, ''),
    '[^0-9]',
    '',
    'g'
  );
  v_new_name := lower(
    regexp_replace(
      trim(coalesce(new.full_name, '')),
      '[[:space:]]+',
      ' ',
      'g'
    )
  );

  select caregiver.id
  into v_duplicate_id
  from public.caregivers caregiver
  where caregiver.family_id = new.family_id
    and (
      tg_op = 'INSERT'
      or caregiver.id <> new.id
    )
    and (
      (
        v_new_email <> ''
        and lower(
          trim(
            coalesce(caregiver.email, '')
          )
        ) = v_new_email
      )
      or (
        v_new_phone <> ''
        and lower(
          regexp_replace(
            trim(
              coalesce(
                caregiver.full_name,
                ''
              )
            ),
            '[[:space:]]+',
            ' ',
            'g'
          )
        ) = v_new_name
        and regexp_replace(
          coalesce(caregiver.phone, ''),
          '[^0-9]',
          '',
          'g'
        ) = v_new_phone
      )
      or (
        lower(
          regexp_replace(
            trim(
              coalesce(
                caregiver.full_name,
                ''
              )
            ),
            '[[:space:]]+',
            ' ',
            'g'
          )
        ) = v_new_name
        and coalesce(
          caregiver.relationship,
          'other'
        ) = coalesce(
          new.relationship,
          'other'
        )
        and lower(
          trim(
            coalesce(caregiver.email, '')
          )
        ) = v_new_email
        and regexp_replace(
          coalesce(caregiver.phone, ''),
          '[^0-9]',
          '',
          'g'
        ) = v_new_phone
      )
    )
  limit 1;

  if v_duplicate_id is not null then
    raise exception using
      errcode = 'P0001',
      message = 'Ese responsable ya está unido a la familia.',
      constraint = 'caregivers_no_duplicates_per_family';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_duplicate_family_caregiver()
from public, anon, authenticated;

drop trigger if exists prevent_duplicate_family_caregiver_trigger
on public.caregivers;

create trigger prevent_duplicate_family_caregiver_trigger
before insert or update of
  family_id,
  full_name,
  relationship,
  phone,
  email
on public.caregivers
for each row
execute function public.prevent_duplicate_family_caregiver();

-- Índices auxiliares para acelerar la validación.
create index if not exists caregivers_family_email_normalized_idx
on public.caregivers (
  family_id,
  lower(trim(email))
)
where nullif(trim(email), '') is not null;

create index if not exists caregivers_family_phone_normalized_idx
on public.caregivers (
  family_id,
  regexp_replace(
    coalesce(phone, ''),
    '[^0-9]',
    '',
    'g'
  )
)
where regexp_replace(
  coalesce(phone, ''),
  '[^0-9]',
  '',
  'g'
) <> '';
