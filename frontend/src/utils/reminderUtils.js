import {
  getTreatmentStatus,
  getTreatmentTimes,
} from './treatmentUtils.js';

const statusLabels = {
  pending: 'Pendiente',
  administered: 'Administrada',
  omitted: 'Omitida',
  postponed: 'Pospuesta',
};

function padNumber(value) {
  return String(value).padStart(2, '0');
}

export function getLocalDateKey(date) {
  return [
    date.getFullYear(),
    padNumber(date.getMonth() + 1),
    padNumber(date.getDate()),
  ].join('-');
}

export function createLocalDateTime(
  dateKey,
  time,
) {
  if (!dateKey || !time) {
    return null;
  }

  const [year, month, day] = dateKey
    .split('-')
    .map(Number);

  const [hours, minutes] = time
    .split(':')
    .map(Number);

  const result = new Date(
    year,
    month - 1,
    day,
    hours,
    minutes,
    0,
    0,
  );

  return Number.isNaN(result.getTime())
    ? null
    : result;
}

export function getReminderStatusLabel(status) {
  return statusLabels[status] ?? 'Pendiente';
}

export function formatReminderTime(dateValue) {
  const date =
    dateValue instanceof Date
      ? dateValue
      : new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }

  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatReminderDate(dateValue) {
  const date =
    dateValue instanceof Date
      ? dateValue
      : new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible';
  }

  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatShortReminderDate(dateValue) {
  const date =
    dateValue instanceof Date
      ? dateValue
      : new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

export function getRelativeReminderDay(dateValue) {
  const date =
    dateValue instanceof Date
      ? new Date(dateValue)
      : new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const reminderDay = new Date(date);
  reminderDay.setHours(0, 0, 0, 0);

  const difference =
    Math.round(
      (reminderDay.getTime() - today.getTime()) /
        86400000,
    );

  if (difference === 0) {
    return 'Hoy';
  }

  if (difference === 1) {
    return 'Mañana';
  }

  if (difference === -1) {
    return 'Ayer';
  }

  return formatShortReminderDate(date);
}

export function getReminderEffectiveDate(reminder) {
  if (
    reminder.status === 'postponed' &&
    reminder.postponedUntil
  ) {
    const postponedDate = new Date(
      reminder.postponedUntil,
    );

    if (!Number.isNaN(postponedDate.getTime())) {
      return postponedDate;
    }
  }

  return new Date(reminder.scheduledAt);
}

function getTreatmentFirstDoseDate(
  treatment,
) {
  if (
    treatment.frequencyMode === 'custom' ||
    !treatment.startDate ||
    !treatment.firstDoseTime
  ) {
    return null;
  }

  return createLocalDateTime(
    treatment.startDate,
    treatment.firstDoseTime,
  );
}

function getTreatmentEndDate(
  treatment,
) {
  if (!treatment.endDate) {
    return null;
  }

  const endDate = new Date(
    `${treatment.endDate}T23:59:59.999`,
  );

  return Number.isNaN(
    endDate.getTime(),
  )
    ? null
    : endDate;
}

function isDateInsideTreatment(
  date,
  treatment,
) {
  if (!treatment.startDate) {
    return false;
  }

  const startDate = new Date(
    `${treatment.startDate}T00:00:00`,
  );

  const endDate =
    getTreatmentEndDate(
      treatment,
    );

  if (date < startDate) {
    return false;
  }

  if (
    endDate &&
    date > endDate
  ) {
    return false;
  }

  return true;
}

function createReminder({
  treatment,
  scheduledDate,
  recordsMap,
  childrenMap,
  treatmentStatus,
}) {
  const dateKey =
    getLocalDateKey(
      scheduledDate,
    );

  const time = [
    padNumber(
      scheduledDate.getHours(),
    ),
    padNumber(
      scheduledDate.getMinutes(),
    ),
  ].join(':');

  const reminderId = [
    treatment.id,
    dateKey,
    time.replace(':', ''),
  ].join('-');

  const savedRecord =
    recordsMap[reminderId] ?? {};

  return {
    id: reminderId,
    treatmentId: treatment.id,
    childId: treatment.childId,
    medicationName:
      treatment.medicationName,
    presentation:
      treatment.presentation,
    dosageInstruction:
      treatment.dosageInstruction,
    administrationRoute:
      treatment.administrationRoute,
    childName:
      childrenMap[treatment.childId]
        ?.fullName ??
      'Perfil no disponible',
    scheduledAt:
      scheduledDate.toISOString(),
    originalTime: time,
    treatmentStatus,
    status:
      savedRecord.status ?? 'pending',
    postponedUntil:
      savedRecord.postponedUntil ??
      null,
    completedAt:
      savedRecord.completedAt ?? null,
    responsibleName:
      savedRecord.responsibleName ??
      '',
    notes:
      savedRecord.notes ?? '',
  };
}

function generateIntervalOccurrences({
  treatment,
  recordsMap,
  childrenMap,
  treatmentStatus,
  rangeStart,
  rangeEnd,
  now,
}) {
  const firstDoseDate =
    getTreatmentFirstDoseDate(
      treatment,
    );

  const intervalHours = Number(
    treatment.intervalHours,
  );

  if (
    !firstDoseDate ||
    !Number.isFinite(intervalHours) ||
    intervalHours <= 0
  ) {
    return [];
  }

  const treatmentEndDate =
    getTreatmentEndDate(
      treatment,
    );

  const scheduledDate =
    new Date(firstDoseDate);

  /*
   * La secuencia comienza exactamente en
   * la primera toma elegida. Nunca se crean
   * horarios anteriores dentro de ese día.
   */
  while (
    scheduledDate < rangeStart
  ) {
    scheduledDate.setMinutes(
      scheduledDate.getMinutes() +
        intervalHours * 60,
    );
  }

  const reminders = [];

  while (
    scheduledDate <= rangeEnd &&
    (
      !treatmentEndDate ||
      scheduledDate <=
        treatmentEndDate
    )
  ) {
    if (
      (
        treatmentStatus ===
          'completed' ||
        treatmentStatus ===
          'paused'
      ) &&
      scheduledDate > now
    ) {
      break;
    }

    reminders.push(
      createReminder({
        treatment,
        scheduledDate:
          new Date(scheduledDate),
        recordsMap,
        childrenMap,
        treatmentStatus,
      }),
    );

    scheduledDate.setMinutes(
      scheduledDate.getMinutes() +
        intervalHours * 60,
    );
  }

  return reminders;
}

function generateCustomOccurrences({
  treatment,
  recordsMap,
  childrenMap,
  treatmentStatus,
  rangeStart,
  rangeEnd,
  now,
}) {
  const treatmentTimes =
    getTreatmentTimes(
      treatment,
    );

  if (
    treatmentTimes.length === 0 ||
    !treatment.startDate
  ) {
    return [];
  }

  const reminders = [];
  const currentDate =
    new Date(rangeStart);

  while (
    currentDate <= rangeEnd
  ) {
    if (
      isDateInsideTreatment(
        currentDate,
        treatment,
      )
    ) {
      const dateKey =
        getLocalDateKey(
          currentDate,
        );

      treatmentTimes.forEach(
        (time) => {
          const scheduledDate =
            createLocalDateTime(
              dateKey,
              time,
            );

          if (!scheduledDate) {
            return;
          }

          if (
            (
              treatmentStatus ===
                'completed' ||
              treatmentStatus ===
                'paused'
            ) &&
            scheduledDate > now
          ) {
            return;
          }

          reminders.push(
            createReminder({
              treatment,
              scheduledDate,
              recordsMap,
              childrenMap,
              treatmentStatus,
            }),
          );
        },
      );
    }

    currentDate.setDate(
      currentDate.getDate() + 1,
    );
  }

  return reminders;
}

export function generateReminderOccurrences({
  treatments,
  records,
  childrenMap,
  daysBack = 14,
  daysForward = 14,
}) {
  const recordsMap =
    Object.fromEntries(
      records.map((record) => [
        record.id,
        record,
      ]),
    );

  const today = new Date();
  today.setHours(
    0,
    0,
    0,
    0,
  );

  const rangeStart =
    new Date(today);

  rangeStart.setDate(
    rangeStart.getDate() -
      daysBack,
  );

  const rangeEnd =
    new Date(today);

  rangeEnd.setDate(
    rangeEnd.getDate() +
      daysForward,
  );

  rangeEnd.setHours(
    23,
    59,
    59,
    999,
  );

  const now = new Date();

  const reminders =
    treatments.flatMap(
      (treatment) => {
        if (
          !treatment.startDate
        ) {
          return [];
        }

        const treatmentStatus =
          getTreatmentStatus(
            treatment,
          );

        if (
          treatment.frequencyMode ===
          'custom'
        ) {
          return generateCustomOccurrences({
            treatment,
            recordsMap,
            childrenMap,
            treatmentStatus,
            rangeStart,
            rangeEnd,
            now,
          });
        }

        return generateIntervalOccurrences({
          treatment,
          recordsMap,
          childrenMap,
          treatmentStatus,
          rangeStart,
          rangeEnd,
          now,
        });
      },
    );

  return reminders.sort(
    (
      firstReminder,
      secondReminder,
    ) =>
      getReminderEffectiveDate(
        firstReminder,
      ).getTime() -
      getReminderEffectiveDate(
        secondReminder,
      ).getTime(),
  );
}

export function isReminderToday(reminder) {
  const reminderDate =
    getReminderEffectiveDate(reminder);

  const today = new Date();

  return (
    reminderDate.getDate() === today.getDate() &&
    reminderDate.getMonth() ===
      today.getMonth() &&
    reminderDate.getFullYear() ===
      today.getFullYear()
  );
}

export function isReminderUpcoming(reminder) {
  const effectiveDate =
    getReminderEffectiveDate(reminder);

  return (
    effectiveDate >= new Date() &&
    !['administered', 'omitted'].includes(
      reminder.status,
    )
  );
}

export function isReminderHistory(reminder) {
  return (
    ['administered', 'omitted'].includes(
      reminder.status,
    ) ||
    getReminderEffectiveDate(reminder) <
      new Date()
  );
}

export function getReminderTemporalState(
  reminder,
) {
  if (reminder.status !== 'pending') {
    return reminder.status;
  }

  const reminderDate =
    getReminderEffectiveDate(reminder);

  return reminderDate < new Date()
    ? 'overdue'
    : 'pending';
}

export function groupRemindersByDate(
  reminders,
) {
  return reminders.reduce(
    (groups, reminder) => {
      const effectiveDate =
        getReminderEffectiveDate(reminder);

      const dateKey =
        getLocalDateKey(effectiveDate);

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }

      groups[dateKey].push(reminder);

      return groups;
    },
    {},
  );
}