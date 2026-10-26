import {
  getAdminFamilyById,
} from './adminFamiliesService.js';

import {
  requireSupabase,
} from '../lib/supabaseClient.js';

import {
  getPublicSubscriptionOffers,
} from './commercialSettingsService.js';

import {
  loadCurrentAccountCache,
} from './supabaseSyncService.js';

const CURRENT_FAMILY_STORAGE_KEY =
  'mipeque-current-family-id';

const ADMIN_WHATSAPP_NUMBER =
  String(
    import.meta.env
      .VITE_ADMIN_WHATSAPP || '',
  ).replace(/\D/g, '');

export const SUBSCRIPTION_PLANS = {
  monthly: {
    id: 'monthly',
    name: 'Plan mensual',
    shortName: 'Mensual',
    amount: 25000,
    baseAmount: 25000,
    duration: '1 mes',
    durationMonths: 1,
    isActive: true,
    promotionId: '',
    promotionName: '',
    promotionDescription: '',
    promotionEndsAt: '',
  },

  annual: {
    id: 'annual',
    name: 'Plan anual',
    shortName: 'Anual',
    amount: 150000,
    baseAmount: 150000,
    duration: '1 año',
    durationMonths: 12,
    isActive: true,
    promotionId: '',
    promotionName: '',
    promotionDescription: '',
    promotionEndsAt: '',
  },
};

const currencyFormatter =
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });

function applySubscriptionOffers(
  offers,
) {
  for (const offer of offers) {
    if (!SUBSCRIPTION_PLANS[offer.id]) {
      continue;
    }

    Object.assign(
      SUBSCRIPTION_PLANS[offer.id],
      offer,
    );
  }

  return getSubscriptionPlans();
}

export function getSubscriptionPlans() {
  return {
    monthly: {
      ...SUBSCRIPTION_PLANS.monthly,
    },
    annual: {
      ...SUBSCRIPTION_PLANS.annual,
    },
  };
}

export async function refreshSubscriptionPlans() {
  const offers =
    await getPublicSubscriptionOffers();

  return applySubscriptionOffers(
    offers,
  );
}

export function getAnnualPlanSaving(
  plans = getSubscriptionPlans(),
) {
  const monthlyAmount = Number(
    plans.monthly?.amount || 0,
  );

  const annualAmount = Number(
    plans.annual?.amount || 0,
  );

  return Math.max(
    monthlyAmount * 12 -
      annualAmount,
    0,
  );
}

function getFamilyCode(
  familyId = '',
) {
  const normalizedId =
    String(familyId)
      .replace(
        /[^a-zA-Z0-9]/g,
        '',
      )
      .slice(-6)
      .toUpperCase();

  return `MP-${
    normalizedId || '000000'
  }`;
}

function parseDate(dateValue) {
  if (!dateValue) {
    return null;
  }

  const date =
    new Date(dateValue);

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date;
}

export function getCurrentFamilyId() {
  return (
    localStorage.getItem(
      CURRENT_FAMILY_STORAGE_KEY,
    ) || ''
  );
}

export function setCurrentFamilyId(
  familyId,
) {
  if (!familyId) {
    localStorage.removeItem(
      CURRENT_FAMILY_STORAGE_KEY,
    );

    return '';
  }

  localStorage.setItem(
    CURRENT_FAMILY_STORAGE_KEY,
    familyId,
  );

  return familyId;
}

export function clearCurrentFamilyId() {
  localStorage.removeItem(
    CURRENT_FAMILY_STORAGE_KEY,
  );
}

export async function refreshCurrentFamilyAccessState() {
  const familyId =
    getCurrentFamilyId();

  if (!familyId) {
    return null;
  }

  const client = requireSupabase();

  const {
    data,
    error,
  } = await client
    .from('families')
    .select(
      'id, family_name, access_status, current_plan, requested_plan, trial_started_at, trial_ends_at, current_period_start, current_period_end, children_count, members_count, children_limit_override',
    )
    .eq('id', familyId)
    .single();

  if (error || !data) {
    if (
      typeof navigator !== 'undefined' &&
      navigator.onLine === false
    ) {
      return getCurrentFamilySubscription();
    }

    throw new Error(
      error?.message ||
        'No se pudo actualizar el estado de la suscripción.',
    );
  }

  const current =
    getCurrentFamilySubscription() || {
      id: familyId,
    };

  const updated = {
    ...current,
    id: data.id,
    familyName:
      data.family_name ||
      current.familyName ||
      '',
    status:
      data.access_status ||
      current.status ||
      'expired',
    plan:
      data.current_plan ||
      current.plan ||
      'none',
    requestedPlan:
      data.requested_plan || '',
    trialStartedAt:
      data.trial_started_at || null,
    trialEndsAt:
      data.trial_ends_at || null,
    subscriptionStartedAt:
      data.current_period_start || null,
    subscriptionEndsAt:
      data.current_period_end || null,
    childrenCount:
      Number(data.children_count || 0),
    membersCount:
      Number(data.members_count || 0),
    childrenLimitOverride:
      data.children_limit_override ?? null,
  };

  localStorage.setItem(
    'mipeque-admin-families',
    JSON.stringify([updated]),
  );

  return updated;
}

export function getCurrentFamilySubscription() {
  const familyId =
    getCurrentFamilyId();

  if (!familyId) {
    return null;
  }

  return getAdminFamilyById(
    familyId,
  );
}

export function getFamilyExpirationDate(
  family,
) {
  if (!family) {
    return null;
  }

  if (
    family.plan === 'monthly' ||
    family.plan === 'annual'
  ) {
    return parseDate(
      family.subscriptionEndsAt,
    );
  }

  return parseDate(
    family.trialEndsAt,
  );
}

export function getSubscriptionAccessState(
  family =
    getCurrentFamilySubscription(),
) {
  if (!family) {
    return {
      allowed: false,
      status: 'not_found',
      title:
        'Familia no encontrada',
      description:
        'No pudimos encontrar la información de esta familia.',
    };
  }

  if (family.status === 'trial') {
    return {
      allowed: true,
      status: 'trial',
      title:
        'Prueba gratuita activa',
      description:
        'La familia todavía se encuentra dentro del período gratuito.',
    };
  }

  if (family.status === 'active') {
    return {
      allowed: true,
      status: 'active',
      title:
        'Suscripción activa',
      description:
        'La familia tiene acceso completo a MiPeque.',
    };
  }

  if (
    family.status ===
    'pending_payment'
  ) {
    return {
      allowed: false,
      status:
        'pending_payment',
      title:
        'Pago pendiente de activación',
      description:
        'Cuando confirmemos el pago, activaremos nuevamente el acceso de toda la familia.',
    };
  }

  if (
    family.status === 'suspended'
  ) {
    return {
      allowed: false,
      status: 'suspended',
      title:
        'Cuenta suspendida',
      description:
        'El acceso fue suspendido por administración. Comunicate por WhatsApp para revisar la cuenta.',
    };
  }

  return {
    allowed: false,
    status: 'expired',
    title: 'Tu acceso terminó',
    description:
      family.plan === 'trial'
        ? 'La prueba gratuita de siete días finalizó.'
        : 'La suscripción de la familia llegó a su fecha de vencimiento.',
  };
}

export async function requestFamilyPlan(
  planId,
) {
  const plans =
    await refreshSubscriptionPlans();

  const plan = plans[planId];

  if (
    !plan ||
    plan.isActive === false
  ) {
    throw new Error(
      'El plan seleccionado no está disponible.',
    );
  }

  const family =
    getCurrentFamilySubscription();

  if (!family) {
    throw new Error(
      'No se encontró la familia.',
    );
  }

  if (
    family.status === 'suspended'
  ) {
    throw new Error(
      'La cuenta se encuentra suspendida.',
    );
  }

  const client = requireSupabase();

  const { error } = await client.rpc(
    'request_family_plan',
    {
      p_family_id: family.id,
      p_plan: planId,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
        'No se pudo registrar la solicitud.',
    );
  }

  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();

  if (userError || !user) {
    throw new Error(
      'La sesión terminó. Volvé a iniciar sesión.',
    );
  }

  await loadCurrentAccountCache(user);

  const updatedFamily =
    getCurrentFamilySubscription();

  if (!updatedFamily) {
    throw new Error(
      'No se pudo actualizar la familia.',
    );
  }

  return updatedFamily;
}

export function buildPaymentWhatsAppUrl(
  family,
  planId,
) {
  const plan =
    SUBSCRIPTION_PLANS[planId];

  if (!family || !plan) {
    throw new Error(
      'No se pudo preparar el mensaje de WhatsApp.',
    );
  }

  const message = [
    'Hola, quiero activar MiPeque.',
    '',
    `Familia: ${family.familyName}`,
    `Responsable: ${family.ownerName}`,
    `Correo: ${family.ownerEmail}`,
    `Código: ${getFamilyCode(
      family.id,
    )}`,
    `Plan elegido: ${plan.name}`,
    `Duración: ${plan.duration}`,
    plan.promotionName
      ? `Promoción: ${plan.promotionName}`
      : null,
    `Importe: ${currencyFormatter.format(
      plan.amount,
    )}`,
    '',
    'Voy a enviar el comprobante de pago por este medio.',
  ]
    .filter(Boolean)
    .join('\n');

  const baseUrl =
    ADMIN_WHATSAPP_NUMBER
      ? `https://wa.me/${ADMIN_WHATSAPP_NUMBER}`
      : 'https://wa.me/';

  return `${baseUrl}?text=${encodeURIComponent(
    message,
  )}`;
}

export async function requestPlanAndGetWhatsAppUrl(
  planId,
) {
  await refreshSubscriptionPlans();

  const updatedFamily =
    await requestFamilyPlan(planId);

  const whatsappUrl =
    buildPaymentWhatsAppUrl(
      updatedFamily,
      planId,
    );

  return {
    family: updatedFamily,
    whatsappUrl,
  };
}
