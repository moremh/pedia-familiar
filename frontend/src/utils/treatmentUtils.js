const statusLabels = {
  active: 'Activo',
  scheduled: 'Programado',
  paused: 'Pausado',
  completed: 'Finalizado',
};

const routeLabels = {
  oral: 'Vía oral',
  topical: 'Uso tópico',
  inhaled: 'Inhalación',
  ophthalmic: 'Vía oftálmica',
  otic: 'Vía ótica',
  nasal: 'Vía nasal',
  other: 'Otra vía',
};

export function calculateTreatmentEndDate(
  startDate,
  durationDays,
) {
  if (!startDate || !durationDays) {
    return '';
  }

  const start = new Date(`${startDate}T00:00:00`);

  if (Number.isNaN(start.getTime())) {
    return '';
  }

  const duration = Math.max(Number(durationDays), 1);

  start.setDate(start.getDate() + duration - 1);

  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, '0');
  const day = String(start.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function formatTreatmentDate(dateValue) {
  if (!dateValue) {
    return 'No registrada';
  }

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return 'No registrada';
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatShortTreatmentDate(dateValue) {
  if (!dateValue) {
    return 'Sin fecha';
  }

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function parseCustomTimes(timesText) {
  if (!timesText) {
    return [];
  }

  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

  return [
    ...new Set(
      timesText
        .split(',')
        .map((time) => time.trim())
        .filter((time) => timePattern.test(time)),
    ),
  ].sort();
}

export function generateIntervalTimes(
  firstDoseTime,
  intervalHours,
) {
  if (!firstDoseTime || !intervalHours) {
    return [];
  }

  const [hours, minutes] = firstDoseTime
    .split(':')
    .map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    Number(intervalHours) <= 0
  ) {
    return [];
  }

  const interval = Number(intervalHours);
  const dosesPerDay = Math.floor(24 / interval);
  const times = [];

  for (let index = 0; index < dosesPerDay; index += 1) {
    const totalMinutes =
      hours * 60 + minutes + index * interval * 60;

    const normalizedMinutes = totalMinutes % (24 * 60);
    const doseHour = Math.floor(normalizedMinutes / 60);
    const doseMinute = normalizedMinutes % 60;

    times.push(
      `${String(doseHour).padStart(2, '0')}:${String(
        doseMinute,
      ).padStart(2, '0')}`,
    );
  }

  return [...new Set(times)].sort();
}

export function getTreatmentTimes(treatment) {
  if (treatment.frequencyMode === 'custom') {
    return Array.isArray(treatment.customTimes)
      ? [...treatment.customTimes].sort()
      : [];
  }

  return generateIntervalTimes(
    treatment.firstDoseTime,
    treatment.intervalHours,
  );
}

export function getTreatmentStatus(treatment) {
  if (treatment.status === 'paused') {
    return 'paused';
  }

  if (treatment.status === 'completed') {
    return 'completed';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = treatment.startDate
    ? new Date(`${treatment.startDate}T00:00:00`)
    : null;

  const endDate = treatment.endDate
    ? new Date(`${treatment.endDate}T23:59:59`)
    : null;

  if (startDate && startDate > today) {
    return 'scheduled';
  }

  if (endDate && endDate < today) {
    return 'completed';
  }

  return 'active';
}

export function getTreatmentStatusLabel(treatment) {
  return statusLabels[getTreatmentStatus(treatment)] ?? 'Activo';
}

export function getTreatmentRouteLabel(route) {
  return routeLabels[route] ?? 'No registrada';
}

export function getTreatmentScheduleDescription(treatment) {
  const times = getTreatmentTimes(treatment);

  if (treatment.frequencyMode === 'custom') {
    return times.length > 0
      ? `Horarios: ${times.join(', ')}`
      : 'Sin horarios registrados';
  }

  if (!treatment.intervalHours) {
    return 'Frecuencia no registrada';
  }

  const intervalText =
    Number(treatment.intervalHours) === 24
      ? 'Una vez al día'
      : `Cada ${treatment.intervalHours} horas`;

  return times.length > 0
    ? `${intervalText} · ${times.join(', ')}`
    : intervalText;
}

export function getNextTreatmentDose(treatment) {
  const status = getTreatmentStatus(treatment);

  if (
    status === 'completed' ||
    status === 'paused'
  ) {
    return null;
  }

  const times = getTreatmentTimes(treatment);

  if (times.length === 0 || !treatment.startDate) {
    return null;
  }

  const now = new Date();

  const startDate = new Date(
    `${treatment.startDate}T00:00:00`,
  );

  const endDate = treatment.endDate
    ? new Date(`${treatment.endDate}T23:59:59`)
    : null;

  let currentDate =
    startDate > now
      ? new Date(startDate)
      : new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
        );

  for (let dayOffset = 0; dayOffset < 370; dayOffset += 1) {
    const dateToCheck = new Date(currentDate);

    dateToCheck.setDate(currentDate.getDate() + dayOffset);

    if (endDate && dateToCheck > endDate) {
      return null;
    }

    for (const time of times) {
      const [hours, minutes] = time.split(':').map(Number);

      const doseDate = new Date(
        dateToCheck.getFullYear(),
        dateToCheck.getMonth(),
        dateToCheck.getDate(),
        hours,
        minutes,
      );

      if (doseDate >= now && doseDate >= startDate) {
        return doseDate;
      }
    }
  }

  return null;
}

export function formatNextDose(date) {
  if (!date) {
    return 'Sin próxima toma';
  }

  const today = new Date();

  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const isTomorrow =
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear();

  const time = new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  if (isToday) {
    return `Hoy a las ${time}`;
  }

  if (isTomorrow) {
    return `Mañana a las ${time}`;
  }

  const day = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
  }).format(date);

  return `${day} a las ${time}`;
}