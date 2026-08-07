import {
  requireSupabase,
} from '../lib/supabaseClient.js';

import {
  getCurrentFamilyId,
} from './subscriptionService.js';

const DEFAULT_BASE_CHILDREN_LIMIT = 3;
const DEFAULT_EXTRA_CHILD_PRICE_ARS = 5000;

function normalizeCapacity(data = {}) {
  const baseChildrenLimit = Math.max(
    1,
    Number(
      data.baseChildrenLimit ??
        data.base_children_limit ??
        DEFAULT_BASE_CHILDREN_LIMIT,
    ) || DEFAULT_BASE_CHILDREN_LIMIT,
  );

  const currentCount = Math.max(
    0,
    Number(
      data.currentCount ??
        data.current_count ??
        0,
    ) || 0,
  );

  const configuredLimit = Math.max(
    baseChildrenLimit,
    Number(
      data.configuredLimit ??
        data.configured_limit ??
        data.effectiveLimit ??
        data.effective_limit ??
        baseChildrenLimit,
    ) || baseChildrenLimit,
  );

  const effectiveLimit = Math.max(
    currentCount,
    configuredLimit,
  );

  const extraChildPrice = Math.max(
    0,
    Number(
      data.extraChildPrice ??
        data.extra_child_price_ars ??
        DEFAULT_EXTRA_CHILD_PRICE_ARS,
    ) || 0,
  );

  return {
    baseChildrenLimit,
    currentCount,
    configuredLimit,
    effectiveLimit,
    availableSlots: Math.max(
      effectiveLimit - currentCount,
      0,
    ),
    canAdd: currentCount < effectiveLimit,
    extraChildrenEnabled: Math.max(
      configuredLimit - baseChildrenLimit,
      0,
    ),
    extraChildPrice,
  };
}

export function getDefaultFamilyChildCapacity(
  currentCount = 0,
) {
  return normalizeCapacity({
    currentCount,
    baseChildrenLimit:
      DEFAULT_BASE_CHILDREN_LIMIT,
    configuredLimit:
      DEFAULT_BASE_CHILDREN_LIMIT,
    extraChildPrice:
      DEFAULT_EXTRA_CHILD_PRICE_ARS,
  });
}

export async function getFamilyChildCapacity(
  familyId,
) {
  if (!familyId) {
    throw new Error(
      'No se encontró la familia activa.',
    );
  }

  const client = requireSupabase();

  const { data, error } =
    await client.rpc(
      'get_family_child_capacity',
      {
        p_family_id: familyId,
      },
    );

  if (error) {
    throw new Error(
      error.message ||
        'No se pudo consultar el límite de hijos.',
    );
  }

  return normalizeCapacity(data);
}

export async function getCurrentFamilyChildCapacity() {
  const familyId =
    getCurrentFamilyId();

  return getFamilyChildCapacity(
    familyId,
  );
}

export async function assertCanAddChild() {
  const capacity =
    await getCurrentFamilyChildCapacity();

  if (!capacity.canAdd) {
    throw new Error(
      `La familia alcanzó el límite de ${capacity.effectiveLimit} ${
        capacity.effectiveLimit === 1
          ? 'hijo'
          : 'hijos'
      }. Para agregar otro perfil, administración debe habilitar un cupo adicional.`,
    );
  }

  return capacity;
}
