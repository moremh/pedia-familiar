const vaccineStateLabels = {
  upToDate: 'Sin próxima dosis',
  upcoming: 'Próxima dosis',
  today: 'Dosis para hoy',
  overdue: 'Dosis atrasada',
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

export function formatVaccineDate(dateValue) {
  const date = parseLocalDate(dateValue);

  if (!date) {
    return 'Fecha no registrada';
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatShortVaccineDate(
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

export function getVaccineState(vaccine) {
  if (!vaccine.nextDoseDate) {
    return 'upToDate';
  }

  const nextDoseDate = parseLocalDate(
    vaccine.nextDoseDate,
  );

  if (!nextDoseDate) {
    return 'upToDate';
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);
  nextDoseDate.setHours(0, 0, 0, 0);

  if (
    nextDoseDate.getTime() === today.getTime()
  ) {
    return 'today';
  }

  if (nextDoseDate < today) {
    return 'overdue';
  }

  return 'upcoming';
}

export function getVaccineStateLabel(vaccine) {
  return (
    vaccineStateLabels[getVaccineState(vaccine)] ??
    'Sin próxima dosis'
  );
}

export function getDaysUntilNextDose(
  nextDoseDateValue,
) {
  const nextDoseDate = parseLocalDate(
    nextDoseDateValue,
  );

  if (!nextDoseDate) {
    return null;
  }

  const today = new Date();

  today.setHours(0, 0, 0, 0);
  nextDoseDate.setHours(0, 0, 0, 0);

  return Math.round(
    (nextDoseDate.getTime() - today.getTime()) /
      86400000,
  );
}

export function getNextDoseDescription(
  vaccine,
) {
  if (!vaccine.nextDoseDate) {
    return 'No se registró una próxima dosis.';
  }

  const days = getDaysUntilNextDose(
    vaccine.nextDoseDate,
  );

  if (days === null) {
    return 'Fecha no disponible';
  }

  if (days === 0) {
    return 'Corresponde hoy';
  }

  if (days === 1) {
    return 'Corresponde mañana';
  }

  if (days > 1) {
    return `Dentro de ${days} días`;
  }

  if (days === -1) {
    return 'Atrasada desde ayer';
  }

  return `Atrasada hace ${Math.abs(days)} días`;
}