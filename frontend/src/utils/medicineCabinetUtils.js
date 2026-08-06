const stockUnitLabels = {
  dose: 'dosis',
  tablet: 'comprimidos',
  capsule: 'cápsulas',
  milliliter: 'ml',
  sachet: 'sobres',
  ampoule: 'ampollas',
  inhalation: 'inhalaciones',
  application: 'aplicaciones',
  other: 'unidades',
};

const cabinetStateLabels = {
  available: 'Disponible',
  lowStock: 'Poco stock',
  outOfStock: 'Sin stock',
  expiring: 'Próximo a vencer',
  expired: 'Vencido',
};

function parseLocalDate(dateValue) {
  if (!dateValue) {
    return null;
  }

  const date = new Date(`${dateValue}T00:00:00`);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

export function formatCabinetDate(dateValue) {
  const date = parseLocalDate(dateValue);

  if (!date) {
    return 'Sin fecha registrada';
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatShortCabinetDate(
  dateValue,
) {
  const date = parseLocalDate(dateValue);

  if (!date) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function getStockUnitLabel(unit) {
  return stockUnitLabels[unit] ?? 'unidades';
}

export function getExpirationDays(
  expirationDateValue,
) {
  const expirationDate = parseLocalDate(
    expirationDateValue,
  );

  if (!expirationDate) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  expirationDate.setHours(0, 0, 0, 0);

  return Math.round(
    (expirationDate.getTime() -
      today.getTime()) /
      86400000,
  );
}

export function isMedicineExpired(item) {
  const days = getExpirationDays(
    item.expirationDate,
  );

  return days !== null && days < 0;
}

export function isMedicineExpiringSoon(
  item,
  warningDays = 30,
) {
  const days = getExpirationDays(
    item.expirationDate,
  );

  return (
    days !== null &&
    days >= 0 &&
    days <= warningDays
  );
}

export function isMedicineOutOfStock(item) {
  return Number(item.currentStock) <= 0;
}

export function isMedicineLowStock(item) {
  const currentStock =
    Number(item.currentStock) || 0;

  const minimumStock =
    Number(item.minimumStock) || 0;

  return (
    currentStock > 0 &&
    currentStock <= minimumStock
  );
}

export function getMedicineCabinetState(item) {
  if (isMedicineExpired(item)) {
    return 'expired';
  }

  if (isMedicineOutOfStock(item)) {
    return 'outOfStock';
  }

  if (isMedicineExpiringSoon(item)) {
    return 'expiring';
  }

  if (isMedicineLowStock(item)) {
    return 'lowStock';
  }

  return 'available';
}

export function getMedicineCabinetStateLabel(
  item,
) {
  return (
    cabinetStateLabels[
      getMedicineCabinetState(item)
    ] ?? 'Disponible'
  );
}

export function getExpirationDescription(item) {
  if (!item.expirationDate) {
    return 'Sin fecha de vencimiento registrada';
  }

  const days = getExpirationDays(
    item.expirationDate,
  );

  if (days === null) {
    return 'Fecha no disponible';
  }

  if (days === 0) {
    return 'Vence hoy';
  }

  if (days === 1) {
    return 'Vence mañana';
  }

  if (days > 1) {
    return `Vence dentro de ${days} días`;
  }

  if (days === -1) {
    return 'Venció ayer';
  }

  return `Venció hace ${Math.abs(days)} días`;
}

export function getStockPercentage(item) {
  const currentStock =
    Number(item.currentStock) || 0;

  const initialStock =
    Number(item.initialStock) ||
    currentStock ||
    1;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (currentStock / initialStock) * 100,
      ),
    ),
  );
}