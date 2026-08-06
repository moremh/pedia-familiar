import {
  requireSupabase,
} from '../lib/supabaseClient.js';

import {
  getCurrentFamilyId,
} from './subscriptionService.js';

const CAREGIVERS_STORAGE_KEY =
  'mipeque-caregivers';

const ACTIVE_CAREGIVER_STORAGE_KEY =
  'mipeque-active-caregiver';

function saveCaregivers(caregivers) {
  localStorage.setItem(
    CAREGIVERS_STORAGE_KEY,
    JSON.stringify(caregivers),
  );
}

function normalizeCaregiver(
  row,
  previous = {},
) {
  return {
    ...previous,
    id: row.id,
    userId: row.user_id || '',
    fullName: row.full_name,
    relationship:
      row.relationship || 'other',
    phone: row.phone || '',
    email: row.email || '',
    isPrimary: Boolean(
      row.is_primary,
    ),
    isActive: Boolean(
      row.is_active,
    ),
    hasSystemAccess: Boolean(
      row.has_system_access,
    ),
    invitationStatus:
      row.invitation_status ||
      'none',
    invitedAt:
      row.invited_at || '',
    invitationAcceptedAt:
      row.invitation_accepted_at ||
      '',
    notes: row.notes || '',
    createdAt:
      row.created_at,
    updatedAt:
      row.updated_at,
  };
}

function normalizeError(
  error,
  fallback,
) {
  if (!error) {
    return new Error(
      fallback,
    );
  }

  if (
    String(
      error.message || '',
    ).includes(
      'caregivers_one_primary_per_family',
    )
  ) {
    return new Error(
      'No se pudo cambiar el responsable principal. Volvé a intentarlo.',
    );
  }

  return new Error(
    error.message || fallback,
  );
}

async function fetchAndCacheCaregivers() {
  const familyId =
    getCurrentFamilyId();

  if (!familyId) {
    return [];
  }

  const client =
    requireSupabase();

  const [
    caregiversResult,
    membersResult,
  ] = await Promise.all([
    client
      .from('caregivers')
      .select('*')
      .eq(
        'family_id',
        familyId,
      ),

    client
      .from('family_members')
      .select(
        'caregiver_id, member_role, status',
      )
      .eq(
        'family_id',
        familyId,
      ),
  ]);

  if (
    caregiversResult.error
  ) {
    throw normalizeError(
      caregiversResult.error,
      'No se pudieron cargar los responsables.',
    );
  }

  if (
    membersResult.error
  ) {
    throw normalizeError(
      membersResult.error,
      'No se pudieron cargar los accesos familiares.',
    );
  }

  const previousById =
    new Map(
      getCaregivers().map(
        (caregiver) => [
          caregiver.id,
          caregiver,
        ],
      ),
    );

  const memberByCaregiverId =
    new Map(
      (
        membersResult.data ||
        []
      )
        .filter(
          (member) =>
            member.caregiver_id,
        )
        .map(
          (member) => [
            member.caregiver_id,
            member,
          ],
        ),
    );

  const caregivers =
    (
      caregiversResult.data ||
      []
    ).map(
      (row) => {
        const caregiver =
          normalizeCaregiver(
            row,
            previousById.get(
              row.id,
            ),
          );

        const member =
          memberByCaregiverId.get(
            row.id,
          );

        caregiver.role =
          member?.member_role ||
          caregiver.role ||
          'member';

        return caregiver;
      },
    );

  saveCaregivers(
    caregivers,
  );

  return getCaregivers();
}

export function getCaregivers() {
  try {
    const storedCaregivers =
      localStorage.getItem(
        CAREGIVERS_STORAGE_KEY,
      );

    if (!storedCaregivers) {
      return [];
    }

    const parsedCaregivers =
      JSON.parse(
        storedCaregivers,
      );

    if (
      !Array.isArray(
        parsedCaregivers,
      )
    ) {
      return [];
    }

    return [
      ...parsedCaregivers,
    ].sort(
      (
        firstCaregiver,
        secondCaregiver,
      ) => {
        if (
          firstCaregiver
            .isPrimary &&
          !secondCaregiver
            .isPrimary
        ) {
          return -1;
        }

        if (
          !firstCaregiver
            .isPrimary &&
          secondCaregiver
            .isPrimary
        ) {
          return 1;
        }

        return firstCaregiver
          .fullName
          .localeCompare(
            secondCaregiver
              .fullName,
            'es',
          );
      },
    );
  } catch (error) {
    console.error(
      'No se pudieron cargar los responsables.',
      error,
    );

    return [];
  }
}

export function getCaregiverById(
  caregiverId,
) {
  return (
    getCaregivers().find(
      (caregiver) =>
        caregiver.id ===
        caregiverId,
    ) ?? null
  );
}

export async function createCaregiver(
  caregiverData,
) {
  const familyId =
    getCurrentFamilyId();

  if (!familyId) {
    throw new Error(
      'No se encontró la familia activa.',
    );
  }

  const client =
    requireSupabase();

  const caregivers =
    getCaregivers();

  const shouldBePrimary =
    caregivers.length === 0 ||
    caregiverData
      .isPrimary === true;

  if (shouldBePrimary) {
    const {
      error,
    } = await client
      .from('caregivers')
      .update({
        is_primary: false,
      })
      .eq(
        'family_id',
        familyId,
      )
      .eq(
        'is_primary',
        true,
      );

    if (error) {
      throw normalizeError(
        error,
        'No se pudo actualizar el responsable principal.',
      );
    }
  }

  const {
    data,
    error,
  } = await client
    .from('caregivers')
    .insert({
      family_id:
        familyId,

      full_name:
        String(
          caregiverData
            .fullName || '',
        ).trim(),

      relationship:
        caregiverData
          .relationship ||
        'other',

      phone:
        String(
          caregiverData
            .phone || '',
        ).trim() || null,

      email:
        String(
          caregiverData
            .email || '',
        )
          .trim()
          .toLowerCase() ||
        null,

      is_primary:
        shouldBePrimary,

      is_active:
        caregiverData
          .isActive ??
        true,

      notes:
        String(
          caregiverData
            .notes || '',
        ).trim(),
    })
    .select('*')
    .single();

  if (
    error ||
    !data
  ) {
    throw normalizeError(
      error,
      'No se pudo guardar el responsable.',
    );
  }

  await fetchAndCacheCaregivers();

  const savedCaregiver =
    getCaregiverById(
      data.id,
    );

  if (savedCaregiver) {
    savedCaregiver
      .hasSystemAccess =
      Boolean(
        caregiverData
          .hasSystemAccess,
      );
  }

  if (
    caregivers.length === 0 ||
    !getActiveCaregiverId()
  ) {
    setActiveCaregiverId(
      data.id,
    );
  }

  return savedCaregiver;
}

export async function updateCaregiver(
  caregiverId,
  caregiverData,
) {
  const familyId =
    getCurrentFamilyId();

  if (!familyId) {
    throw new Error(
      'No se encontró la familia activa.',
    );
  }

  const client =
    requireSupabase();

  const shouldBePrimary =
    caregiverData
      .isPrimary === true;

  if (shouldBePrimary) {
    const {
      error,
    } = await client
      .from('caregivers')
      .update({
        is_primary: false,
      })
      .eq(
        'family_id',
        familyId,
      )
      .neq(
        'id',
        caregiverId,
      )
      .eq(
        'is_primary',
        true,
      );

    if (error) {
      throw normalizeError(
        error,
        'No se pudo actualizar el responsable principal.',
      );
    }
  }

  const {
    error,
  } = await client
    .from('caregivers')
    .update({
      full_name:
        String(
          caregiverData
            .fullName || '',
        ).trim(),

      relationship:
        caregiverData
          .relationship ||
        'other',

      phone:
        String(
          caregiverData
            .phone || '',
        ).trim() || null,

      email:
        String(
          caregiverData
            .email || '',
        )
          .trim()
          .toLowerCase() ||
        null,

      is_primary:
        shouldBePrimary,

      is_active:
        caregiverData
          .isActive ??
        true,

      notes:
        String(
          caregiverData
            .notes || '',
        ).trim(),
    })
    .eq(
      'id',
      caregiverId,
    )
    .eq(
      'family_id',
      familyId,
    );

  if (error) {
    throw normalizeError(
      error,
      'No se pudo actualizar el responsable.',
    );
  }

  await fetchAndCacheCaregivers();

  const savedCaregiver =
    getCaregiverById(
      caregiverId,
    );

  if (savedCaregiver) {
    savedCaregiver
      .hasSystemAccess =
      Boolean(
        caregiverData
          .hasSystemAccess,
      );
  }

  return savedCaregiver;
}

export async function setPrimaryCaregiver(
  caregiverId,
) {
  const familyId =
    getCurrentFamilyId();

  if (!familyId) {
    throw new Error(
      'No se encontró la familia activa.',
    );
  }

  const client =
    requireSupabase();

  const {
    error: clearError,
  } = await client
    .from('caregivers')
    .update({
      is_primary: false,
    })
    .eq(
      'family_id',
      familyId,
    )
    .eq(
      'is_primary',
      true,
    );

  if (clearError) {
    throw normalizeError(
      clearError,
      'No se pudo actualizar el responsable principal.',
    );
  }

  const {
    error,
  } = await client
    .from('caregivers')
    .update({
      is_primary: true,
    })
    .eq(
      'id',
      caregiverId,
    )
    .eq(
      'family_id',
      familyId,
    );

  if (error) {
    throw normalizeError(
      error,
      'No se pudo actualizar el responsable principal.',
    );
  }

  return fetchAndCacheCaregivers();
}

export async function toggleCaregiverStatus(
  caregiverId,
) {
  const caregiver =
    getCaregiverById(
      caregiverId,
    );

  if (!caregiver) {
    throw new Error(
      'No se encontró el responsable.',
    );
  }

  const client =
    requireSupabase();

  const {
    error,
  } = await client
    .from('caregivers')
    .update({
      is_active:
        !caregiver.isActive,
    })
    .eq(
      'id',
      caregiverId,
    );

  if (error) {
    throw normalizeError(
      error,
      'No se pudo modificar el estado del responsable.',
    );
  }

  const updatedCaregivers =
    await fetchAndCacheCaregivers();

  const activeCaregiverId =
    getActiveCaregiverId();

  const updatedCaregiver =
    updatedCaregivers.find(
      (item) =>
        item.id ===
        caregiverId,
    );

  if (
    activeCaregiverId ===
      caregiverId &&
    updatedCaregiver
      ?.isActive === false
  ) {
    const nextCaregiver =
      updatedCaregivers.find(
        (item) =>
          item.isActive,
      );

    setActiveCaregiverId(
      nextCaregiver?.id ??
        '',
    );
  }

  return updatedCaregivers;
}

export async function deleteCaregiver(
  caregiverId,
) {
  const caregiver =
    getCaregiverById(
      caregiverId,
    );

  const client =
    requireSupabase();

  const {
    error,
  } = await client
    .from('caregivers')
    .delete()
    .eq(
      'id',
      caregiverId,
    );

  if (error) {
    throw normalizeError(
      error,
      'No se pudo eliminar el responsable.',
    );
  }

  let updatedCaregivers =
    await fetchAndCacheCaregivers();

  if (
    caregiver?.isPrimary &&
    updatedCaregivers
      .length > 0 &&
    !updatedCaregivers.some(
      (item) =>
        item.isPrimary,
    )
  ) {
    updatedCaregivers =
      await setPrimaryCaregiver(
        updatedCaregivers[0]
          .id,
      );
  }

  if (
    getActiveCaregiverId() ===
    caregiverId
  ) {
    const nextCaregiver =
      updatedCaregivers.find(
        (item) =>
          item.isPrimary &&
          item.isActive,
      ) ??
      updatedCaregivers.find(
        (item) =>
          item.isActive,
      );

    setActiveCaregiverId(
      nextCaregiver?.id ??
        '',
    );
  }

  return updatedCaregivers;
}

export function getActiveCaregiverId() {
  return (
    localStorage.getItem(
      ACTIVE_CAREGIVER_STORAGE_KEY,
    ) ?? ''
  );
}

export function setActiveCaregiverId(
  caregiverId,
) {
  if (!caregiverId) {
    localStorage.removeItem(
      ACTIVE_CAREGIVER_STORAGE_KEY,
    );

    return '';
  }

  localStorage.setItem(
    ACTIVE_CAREGIVER_STORAGE_KEY,
    caregiverId,
  );

  return caregiverId;
}

export function getActiveCaregiver() {
  const caregivers =
    getCaregivers().filter(
      (caregiver) =>
        caregiver.isActive,
    );

  if (
    caregivers.length === 0
  ) {
    return null;
  }

  const selectedCaregiver =
    caregivers.find(
      (caregiver) =>
        caregiver.id ===
        getActiveCaregiverId(),
    );

  if (selectedCaregiver) {
    return selectedCaregiver;
  }

  const fallbackCaregiver =
    caregivers.find(
      (caregiver) =>
        caregiver.isPrimary,
    ) ??
    caregivers[0];

  setActiveCaregiverId(
    fallbackCaregiver.id,
  );

  return fallbackCaregiver;
}

export async function refreshCaregiversFromSupabase() {
  return fetchAndCacheCaregivers();
}