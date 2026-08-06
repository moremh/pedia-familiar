import {
  requireSupabase,
} from '../lib/supabaseClient.js';

import {
  loadAdminCache,
} from './supabaseSyncService.js';

const FAMILIES_STORAGE_KEY =
  'mipeque-admin-families';

const PAYMENTS_STORAGE_KEY =
  'mipeque-admin-payments';

const PLAN_PRICES = {
  monthly: 25000,
  annual: 150000,
};

function parseDate(dateValue) {
  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}


function getAutomaticStatus(family) {
  if (!family) {
    return 'expired';
  }

  if (
    family.status === 'suspended' ||
    family.status === 'pending_payment'
  ) {
    return family.status;
  }

  const now = Date.now();

  if (family.status === 'trial') {
    const trialEnd = parseDate(
      family.trialEndsAt,
    );

    return trialEnd &&
      trialEnd.getTime() > now
      ? 'trial'
      : 'expired';
  }

  if (family.status === 'active') {
    const subscriptionEnd =
      parseDate(
        family.subscriptionEndsAt,
      );

    return subscriptionEnd &&
      subscriptionEnd.getTime() > now
      ? 'active'
      : 'expired';
  }

  return family.status || 'expired';
}

function readStoredList(storageKey) {
  try {
    const storedValue =
      localStorage.getItem(storageKey);

    if (!storedValue) {
      return [];
    }

    const parsedValue =
      JSON.parse(storedValue);

    return Array.isArray(parsedValue)
      ? parsedValue
      : [];
  } catch (error) {
    console.error(
      `No se pudo leer ${storageKey}.`,
      error,
    );

    return [];
  }
}

function saveStoredList(
  storageKey,
  values,
) {
  localStorage.setItem(
    storageKey,
    JSON.stringify(values),
  );
}

function normalizeRemoteError(
  error,
  fallbackMessage,
) {
  if (!error) {
    return new Error(fallbackMessage);
  }

  return new Error(
    error.message || fallbackMessage,
  );
}

export function getAdminFamilies() {
  const families = readStoredList(
    FAMILIES_STORAGE_KEY,
  ).map((family) => ({
    ...family,
    status: getAutomaticStatus(family),
  }));

  return families.sort((first, second) => {
    const firstDate =
      parseDate(first.updatedAt)?.getTime() ||
      0;

    const secondDate =
      parseDate(second.updatedAt)?.getTime() ||
      0;

    return secondDate - firstDate;
  });
}

export function getAdminFamilyById(
  familyId,
) {
  return (
    getAdminFamilies().find(
      (family) => family.id === familyId,
    ) ?? null
  );
}

export function getAdminPayments() {
  return readStoredList(
    PAYMENTS_STORAGE_KEY,
  ).sort((first, second) => {
    const firstDate =
      parseDate(
        first.paymentDate,
      )?.getTime() || 0;

    const secondDate =
      parseDate(
        second.paymentDate,
      )?.getTime() || 0;

    return secondDate - firstDate;
  });
}

export async function refreshAdminData() {
  return loadAdminCache();
}

export async function activateFamilyPlan(
  familyId,
  plan,
  options = {},
) {
  if (
    plan !== 'monthly' &&
    plan !== 'annual'
  ) {
    throw new Error(
      'El plan seleccionado no es válido.',
    );
  }

  if (!familyId) {
    throw new Error(
      'No se encontró la familia.',
    );
  }

  const client = requireSupabase();

  const { error } = await client.rpc(
    'activate_family_subscription',
    {
      p_family_id: familyId,
      p_plan: plan,
      p_payment_reference:
        String(
          options.paymentReference || '',
        ).trim(),
      p_notes: String(
        options.notes || '',
      ).trim(),
    },
  );

  if (error) {
    throw normalizeRemoteError(
      error,
      'No se pudo activar el plan.',
    );
  }

  await loadAdminCache();

  return getAdminFamilyById(familyId);
}

export async function markFamilyPendingPayment(
  familyId,
  requestedPlan = '',
) {
  if (
    requestedPlan !== 'monthly' &&
    requestedPlan !== 'annual'
  ) {
    throw new Error(
      'El plan seleccionado no es válido.',
    );
  }

  const client = requireSupabase();

  const { error } = await client.rpc(
    'request_family_plan',
    {
      p_family_id: familyId,
      p_plan: requestedPlan,
    },
  );

  if (error) {
    throw normalizeRemoteError(
      error,
      'No se pudo registrar la solicitud.',
    );
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  if (user) {
    const { loadCurrentAccountCache } =
      await import(
        './supabaseSyncService.js'
      );

    await loadCurrentAccountCache(user);
  }

  return getAdminFamilyById(familyId);
}

async function setFamilySuspension(
  familyId,
  suspended,
) {
  if (!familyId) {
    throw new Error(
      'No se encontró la familia.',
    );
  }

  const client = requireSupabase();

  const { error } = await client.rpc(
    'set_family_suspended',
    {
      p_family_id: familyId,
      p_suspended: Boolean(suspended),
    },
  );

  if (error) {
    throw normalizeRemoteError(
      error,
      suspended
        ? 'No se pudo suspender la familia.'
        : 'No se pudo reactivar la familia.',
    );
  }

  await loadAdminCache();

  return getAdminFamilyById(familyId);
}

export async function suspendFamily(
  familyId,
) {
  return setFamilySuspension(
    familyId,
    true,
  );
}

export async function reactivateFamily(
  familyId,
) {
  return setFamilySuspension(
    familyId,
    false,
  );
}

export function updateFamilyStatistics(
  familyId,
  statistics = {},
) {
  if (!familyId) {
    return null;
  }

  const families = getAdminFamilies();
  let updatedFamily = null;

  const updatedFamilies =
    families.map((family) => {
      if (family.id !== familyId) {
        return family;
      }

      updatedFamily = {
        ...family,
        childrenCount:
          Number.isInteger(
            statistics.childrenCount,
          )
            ? Math.max(
                statistics.childrenCount,
                0,
              )
            : family.childrenCount,
        membersCount:
          Number.isInteger(
            statistics.membersCount,
          )
            ? Math.max(
                statistics.membersCount,
                1,
              )
            : family.membersCount,
        updatedAt:
          new Date().toISOString(),
      };

      return updatedFamily;
    });

  if (!updatedFamily) {
    return null;
  }

  saveStoredList(
    FAMILIES_STORAGE_KEY,
    updatedFamilies,
  );

  return updatedFamily;
}

export function getPlanPrice(plan) {
  return PLAN_PRICES[plan] || 0;
}
