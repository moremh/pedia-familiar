import {
  requireSupabase,
} from '../lib/supabaseClient.js';

const COMMERCIAL_SETTINGS_EVENT =
  'mipeque:commercial-settings-updated';

function normalizePlan(row) {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name,
    duration: row.duration_label,
    durationMonths: Number(
      row.duration_months || 0,
    ),
    baseAmount: Number(
      row.base_amount_ars ??
        row.price_ars ??
        0,
    ),
    amount: Number(
      row.amount_ars ??
        row.price_ars ??
        0,
    ),
    isActive:
      row.is_active !== false,
    displayOrder: Number(
      row.display_order || 0,
    ),
    promotionId:
      row.promotion_id || '',
    promotionName:
      row.promotion_name || '',
    promotionDescription:
      row.promotion_description || '',
    promotionType:
      row.promotion_type || '',
    promotionValue:
      row.promotion_value == null
        ? null
        : Number(row.promotion_value),
    promotionEndsAt:
      row.promotion_ends_at || '',
  };
}

function normalizePromotion(row) {
  return {
    id: row.id,
    name: row.name,
    description:
      row.description || '',
    planId: row.plan_id || 'all',
    type: row.promotion_type,
    value: Number(row.value || 0),
    startsAt: row.starts_at,
    endsAt: row.ends_at || '',
    isActive: Boolean(row.is_active),
    priority: Number(row.priority || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}


function normalizeChildSettings(row = {}) {
  return {
    baseChildrenLimit: Math.max(
      1,
      Number(
        row.base_children_limit ?? 3,
      ) || 3,
    ),
    extraChildPrice: Math.max(
      0,
      Number(
        row.extra_child_price_ars ?? 5000,
      ) || 0,
    ),
    updatedAt: row.updated_at || '',
  };
}

function normalizeError(
  error,
  fallback,
) {
  return new Error(
    error?.message || fallback,
  );
}

function notifyCommercialSettingsChanged() {
  window.dispatchEvent(
    new CustomEvent(
      COMMERCIAL_SETTINGS_EVENT,
    ),
  );
}

export function getCommercialSettingsEventName() {
  return COMMERCIAL_SETTINGS_EVENT;
}

export async function getPublicSubscriptionOffers() {
  const client = requireSupabase();

  const {
    data,
    error,
  } = await client.rpc(
    'get_subscription_offers',
  );

  if (error) {
    throw normalizeError(
      error,
      'No se pudieron cargar los planes.',
    );
  }

  return (data || [])
    .map(normalizePlan)
    .sort(
      (first, second) =>
        first.displayOrder -
        second.displayOrder,
    );
}

export async function getAdminCommercialSettings() {
  const client = requireSupabase();

  const [
    plansResult,
    promotionsResult,
    childSettingsResult,
  ] = await Promise.all([
    client
      .from('subscription_plans')
      .select('*')
      .order('display_order'),

    client
      .from('promotions')
      .select('*')
      .order('priority', {
        ascending: false,
      })
      .order('created_at', {
        ascending: false,
      }),

    client
      .from('child_limit_settings')
      .select('*')
      .eq('id', true)
      .maybeSingle(),
  ]);

  if (plansResult.error) {
    throw normalizeError(
      plansResult.error,
      'No se pudieron cargar los precios.',
    );
  }

  if (promotionsResult.error) {
    throw normalizeError(
      promotionsResult.error,
      'No se pudieron cargar las promociones.',
    );
  }

  if (childSettingsResult.error) {
    throw normalizeError(
      childSettingsResult.error,
      'No se pudo cargar la configuración de hijos.',
    );
  }

  const offers =
    await getPublicSubscriptionOffers();

  const offerById = new Map(
    offers.map((offer) => [
      offer.id,
      offer,
    ]),
  );

  const plans = (
    plansResult.data || []
  ).map((row) => ({
    ...normalizePlan(row),
    amount:
      offerById.get(row.id)
        ?.amount ??
      Number(row.price_ars || 0),
    baseAmount:
      Number(row.price_ars || 0),
  }));

  return {
    plans,
    offers,
    promotions: (
      promotionsResult.data || []
    ).map(normalizePromotion),
    childSettings:
      normalizeChildSettings(
        childSettingsResult.data || {},
      ),
  };
}

export async function updateSubscriptionPlan(
  planId,
  updates,
) {
  if (
    planId !== 'monthly' &&
    planId !== 'annual'
  ) {
    throw new Error(
      'El plan seleccionado no es válido.',
    );
  }

  const price = Number(
    updates.price,
  );

  if (
    !Number.isInteger(price) ||
    price <= 0
  ) {
    throw new Error(
      'Ingresá un precio válido.',
    );
  }

  const client = requireSupabase();

  const {
    data,
    error,
  } = await client
    .from('subscription_plans')
    .update({
      price_ars: price,
      is_active:
        updates.isActive !== false,
    })
    .eq('id', planId)
    .select('*')
    .single();

  if (error || !data) {
    throw normalizeError(
      error,
      'No se pudo actualizar el plan.',
    );
  }

  notifyCommercialSettingsChanged();

  return normalizePlan(data);
}

export async function updateChildLimitSettings(
  {
    baseChildrenLimit,
    extraChildPrice,
  },
) {
  const normalizedLimit =
    Number.parseInt(
      baseChildrenLimit,
      10,
    );

  const normalizedPrice =
    Number.parseInt(
      extraChildPrice,
      10,
    );

  if (
    !Number.isInteger(normalizedLimit) ||
    normalizedLimit < 1 ||
    normalizedLimit > 20
  ) {
    throw new Error(
      'El límite base debe estar entre 1 y 20 hijos.',
    );
  }

  if (
    !Number.isInteger(normalizedPrice) ||
    normalizedPrice < 0
  ) {
    throw new Error(
      'Ingresá un precio válido para el hijo extra.',
    );
  }

  const client = requireSupabase();

  const { data, error } =
    await client.rpc(
      'update_child_limit_settings',
      {
        p_base_children_limit:
          normalizedLimit,
        p_extra_child_price_ars:
          normalizedPrice,
      },
    );

  if (error) {
    throw normalizeError(
      error,
      'No se pudo actualizar la configuración de hijos.',
    );
  }

  notifyCommercialSettingsChanged();

  return normalizeChildSettings(
    data || {},
  );
}

function buildPromotionPayload(
  promotionData,
) {
  const name = String(
    promotionData.name || '',
  ).trim();

  const type = String(
    promotionData.type || '',
  );

  const value = Number(
    promotionData.value,
  );

  if (name.length < 3) {
    throw new Error(
      'Ingresá un nombre para la promoción.',
    );
  }

  if (
    ![
      'fixed_price',
      'percentage',
      'fixed_discount',
    ].includes(type)
  ) {
    throw new Error(
      'Seleccioná un tipo de promoción válido.',
    );
  }

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new Error(
      'Ingresá un valor válido para la promoción.',
    );
  }

  if (
    type === 'percentage' &&
    value > 100
  ) {
    throw new Error(
      'El porcentaje no puede superar el 100%.',
    );
  }

  const startsAt = new Date(
    promotionData.startsAt,
  );

  if (
    Number.isNaN(startsAt.getTime())
  ) {
    throw new Error(
      'Seleccioná una fecha de inicio válida.',
    );
  }

  let endsAt = null;

  if (promotionData.endsAt) {
    const parsedEnd = new Date(
      promotionData.endsAt,
    );

    if (
      Number.isNaN(
        parsedEnd.getTime(),
      )
    ) {
      throw new Error(
        'Seleccioná una fecha de finalización válida.',
      );
    }

    if (
      parsedEnd.getTime() <=
      startsAt.getTime()
    ) {
      throw new Error(
        'La fecha de finalización debe ser posterior al inicio.',
      );
    }

    endsAt = parsedEnd.toISOString();
  }

  const planId =
    promotionData.planId ===
    'all'
      ? null
      : promotionData.planId;

  if (
    planId !== null &&
    planId !== 'monthly' &&
    planId !== 'annual'
  ) {
    throw new Error(
      'Seleccioná el plan al que se aplicará la promoción.',
    );
  }

  return {
    name,
    description: String(
      promotionData.description || '',
    ).trim(),
    plan_id: planId,
    promotion_type: type,
    value,
    starts_at:
      startsAt.toISOString(),
    ends_at: endsAt,
    is_active:
      promotionData.isActive !== false,
    priority: Math.max(
      0,
      Number.parseInt(
        promotionData.priority,
        10,
      ) || 0,
    ),
  };
}

export async function createPromotion(
  promotionData,
) {
  const client = requireSupabase();
  const payload =
    buildPromotionPayload(
      promotionData,
    );

  const {
    data,
    error,
  } = await client
    .from('promotions')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    throw normalizeError(
      error,
      'No se pudo crear la promoción.',
    );
  }

  notifyCommercialSettingsChanged();

  return normalizePromotion(data);
}

export async function updatePromotion(
  promotionId,
  promotionData,
) {
  if (!promotionId) {
    throw new Error(
      'No se encontró la promoción.',
    );
  }

  const client = requireSupabase();
  const payload =
    buildPromotionPayload(
      promotionData,
    );

  const {
    data,
    error,
  } = await client
    .from('promotions')
    .update(payload)
    .eq('id', promotionId)
    .select('*')
    .single();

  if (error || !data) {
    throw normalizeError(
      error,
      'No se pudo actualizar la promoción.',
    );
  }

  notifyCommercialSettingsChanged();

  return normalizePromotion(data);
}

export async function setPromotionActive(
  promotionId,
  isActive,
) {
  const client = requireSupabase();

  const {
    data,
    error,
  } = await client
    .from('promotions')
    .update({
      is_active: Boolean(isActive),
    })
    .eq('id', promotionId)
    .select('*')
    .single();

  if (error || !data) {
    throw normalizeError(
      error,
      'No se pudo modificar la promoción.',
    );
  }

  notifyCommercialSettingsChanged();

  return normalizePromotion(data);
}

export async function deletePromotion(
  promotionId,
) {
  const client = requireSupabase();

  const {
    error,
  } = await client
    .from('promotions')
    .delete()
    .eq('id', promotionId);

  if (error) {
    throw normalizeError(
      error,
      'No se pudo eliminar la promoción.',
    );
  }

  notifyCommercialSettingsChanged();

  return true;
}
