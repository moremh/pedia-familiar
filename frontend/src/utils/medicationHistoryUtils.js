import {
  generateReminderOccurrences,
  getReminderEffectiveDate,
} from './reminderUtils.js';

const statusLabels = {
  administered: 'Administrada',
  omitted: 'Omitida',
};

export function getHistoryStatusLabel(status) {
  return statusLabels[status] ?? 'Sin estado';
}

export function getHistoryStatusIcon(status) {
  if (status === 'administered') {
    return 'bi-check-lg';
  }

  if (status === 'omitted') {
    return 'bi-x-lg';
  }

  return 'bi-clock-history';
}

export function formatHistoryDateTime(
  dateValue,
) {
  if (!dateValue) {
    return 'Fecha no disponible';
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no disponible';
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatHistoryDate(dateValue) {
  if (!dateValue) {
    return 'Sin fecha';
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function getLocalHistoryDateKey(
  dateValue,
) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    date.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function createTreatmentDateTime(
  dateValue,
  timeValue = '00:00',
) {
  if (!dateValue) {
    return null;
  }

  const normalizedTime =
    /^\d{2}:\d{2}$/.test(
      String(timeValue || ''),
    )
      ? timeValue
      : '00:00';

  const date = new Date(
    `${dateValue}T${normalizedTime}:00`,
  );

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date;
}

function getPlannedTreatmentEndDate(
  treatment,
) {
  if (treatment.endDate) {
    const explicitEnd = new Date(
      `${treatment.endDate}T23:59:59.999`,
    );

    if (
      !Number.isNaN(
        explicitEnd.getTime(),
      )
    ) {
      return explicitEnd;
    }
  }

  const startDate =
    createTreatmentDateTime(
      treatment.startDate,
    );

  const durationDays = Number(
    treatment.durationDays,
  );

  if (
    !startDate ||
    !Number.isFinite(durationDays) ||
    durationDays < 1
  ) {
    return null;
  }

  const calculatedEnd = new Date(
    startDate,
  );

  calculatedEnd.setDate(
    calculatedEnd.getDate() +
      Math.floor(durationDays) -
      1,
  );

  calculatedEnd.setHours(
    23,
    59,
    59,
    999,
  );

  return calculatedEnd;
}

function countIntervalTreatmentDoses(
  treatment,
) {
  const firstDose =
    createTreatmentDateTime(
      treatment.startDate,
      treatment.firstDoseTime,
    );

  const endDate =
    getPlannedTreatmentEndDate(
      treatment,
    );

  const intervalHours = Number(
    treatment.intervalHours,
  );

  if (
    !firstDose ||
    !endDate ||
    firstDose > endDate ||
    !Number.isFinite(intervalHours) ||
    intervalHours <= 0
  ) {
    return 0;
  }

  const intervalMilliseconds =
    intervalHours * 60 * 60 * 1000;

  return (
    Math.floor(
      (endDate.getTime() -
        firstDose.getTime()) /
        intervalMilliseconds,
    ) + 1
  );
}

function countCustomTreatmentDoses(
  treatment,
) {
  const startDate =
    createTreatmentDateTime(
      treatment.startDate,
    );

  const endDate =
    getPlannedTreatmentEndDate(
      treatment,
    );

  const treatmentTimes = [
    ...new Set(
      (
        Array.isArray(
          treatment.customTimes,
        )
          ? treatment.customTimes
          : []
      ).filter((time) =>
        /^([01]\d|2[0-3]):[0-5]\d$/.test(
          String(time || ''),
        ),
      ),
    ),
  ];

  if (
    !startDate ||
    !endDate ||
    startDate > endDate ||
    treatmentTimes.length === 0
  ) {
    return 0;
  }

  const currentDate = new Date(
    startDate,
  );

  currentDate.setHours(
    0,
    0,
    0,
    0,
  );

  const lastDate = new Date(
    endDate,
  );

  lastDate.setHours(
    0,
    0,
    0,
    0,
  );

  let dayCount = 0;

  while (
    currentDate <= lastDate
  ) {
    dayCount += 1;

    currentDate.setDate(
      currentDate.getDate() + 1,
    );
  }

  return (
    dayCount *
    treatmentTimes.length
  );
}

export function countPlannedTreatmentDoses(
  treatment,
) {
  if (
    !treatment ||
    !treatment.startDate
  ) {
    return 0;
  }

  if (
    treatment.frequencyMode ===
    'custom'
  ) {
    return countCustomTreatmentDoses(
      treatment,
    );
  }

  return countIntervalTreatmentDoses(
    treatment,
  );
}

export function calculateHistoryStats(
  history,
  treatments = [],
) {
  const administered = history.filter(
    (item) =>
      item.status === 'administered',
  ).length;

  const omitted = history.filter(
    (item) => item.status === 'omitted',
  ).length;

  const total = administered + omitted;

  const historyTreatmentIds =
    new Set(
      history
        .map((item) =>
          item.treatmentId,
        )
        .filter(Boolean),
    );

  const plannedDoses = treatments
    .filter((treatment) =>
      historyTreatmentIds.has(
        treatment.id,
      ),
    )
    .reduce(
      (totalDoses, treatment) =>
        totalDoses +
        countPlannedTreatmentDoses(
          treatment,
        ),
      0,
    );

  /*
   * El total nunca puede quedar por debajo de
   * las acciones ya registradas, incluso si un
   * tratamiento antiguo fue eliminado.
   */
  const totalPlanned = Math.max(
    plannedDoses,
    total,
  );

  const progressPercentage =
    totalPlanned > 0
      ? Math.min(
          100,
          Math.round(
            (administered /
              totalPlanned) *
              100,
          ),
        )
      : 0;

  const adherencePercentage =
    total > 0
      ? Math.round(
          (administered / total) *
            100,
        )
      : 0;

  return {
    total,
    administered,
    omitted,
    totalPlanned,
    progressPercentage,
    adherencePercentage,
  };
}

export function buildMedicationHistory({
  children = [],
  treatments = [],
  records = [],
  daysBack = 730,
}) {
  const childrenMap = Object.fromEntries(
    children.map((child) => [
      child.id,
      child,
    ]),
  );

  const treatmentsMap = Object.fromEntries(
    treatments.map((treatment) => [
      treatment.id,
      treatment,
    ]),
  );

  const generatedReminders =
    generateReminderOccurrences({
      treatments,
      records,
      childrenMap,
      daysBack,
      daysForward: 0,
    });

  const remindersMap = Object.fromEntries(
    generatedReminders.map((reminder) => [
      reminder.id,
      reminder,
    ]),
  );

  return records
    .filter((record) =>
      ['administered', 'omitted'].includes(
        record.status,
      ),
    )
    .map((record) => {
      const matchedReminder =
        remindersMap[record.id];

      const treatment =
        treatmentsMap[
          record.treatmentId ??
            matchedReminder?.treatmentId
        ];

      const treatmentId =
        record.treatmentId ??
        matchedReminder?.treatmentId ??
        treatment?.id ??
        '';

      const childId =
        record.childId ??
        matchedReminder?.childId ??
        treatment?.childId ??
        '';

      const childName =
        record.childName ??
        matchedReminder?.childName ??
        childrenMap[childId]?.fullName ??
        'Perfil no disponible';

      const medicationName =
        record.medicationName ??
        matchedReminder?.medicationName ??
        treatment?.medicationName ??
        'Medicamento no disponible';

      let scheduledAt =
        record.scheduledAt ?? null;

      if (
        !scheduledAt &&
        matchedReminder
      ) {
        const effectiveDate =
          getReminderEffectiveDate(
            matchedReminder,
          );

        if (
          effectiveDate &&
          !Number.isNaN(
            effectiveDate.getTime(),
          )
        ) {
          scheduledAt =
            effectiveDate.toISOString();
        }
      }

      const actionAt =
        record.completedAt ??
        record.updatedAt ??
        scheduledAt ??
        record.createdAt ??
        null;

      const treatmentKey =
        treatmentId ||
        medicationName.toLowerCase();

      return {
        id: record.id,
        status: record.status,

        childId,
        childName,

        treatmentId,
        treatmentKey,

        medicationName,

        presentation:
          record.presentation ??
          matchedReminder?.presentation ??
          treatment?.presentation ??
          '',

        dosageInstruction:
          record.dosageInstruction ??
          matchedReminder
            ?.dosageInstruction ??
          treatment?.dosageInstruction ??
          treatment?.instructions ??
          '',

        originalTime:
          record.originalTime ??
          matchedReminder?.originalTime ??
          '',

        scheduledAt,
        actionAt,

        responsibleId:
          record.responsibleId ?? '',

        responsibleName:
          record.responsibleName ||
          'Responsable no registrado',

        notes: record.notes ?? '',
      };
    })
    .sort((firstItem, secondItem) => {
      const firstDate = new Date(
        firstItem.actionAt ?? 0,
      ).getTime();

      const secondDate = new Date(
        secondItem.actionAt ?? 0,
      ).getTime();

      return secondDate - firstDate;
    });
}

function escapeCsvValue(value) {
  const normalizedValue = String(
    value ?? '',
  ).replace(/"/g, '""');

  return `"${normalizedValue}"`;
}

export function downloadMedicationHistoryCsv(
  history,
) {
  const headers = [
    'Fecha de registro',
    'Estado',
    'Hijo',
    'Medicamento',
    'Presentación',
    'Indicación',
    'Horario programado',
    'Responsable',
    'Observaciones',
  ];

  const rows = history.map((item) => [
    formatHistoryDateTime(item.actionAt),
    getHistoryStatusLabel(item.status),
    item.childName,
    item.medicationName,
    item.presentation,
    item.dosageInstruction,
    formatHistoryDateTime(item.scheduledAt),
    item.responsibleName,
    item.notes,
  ]);

  const csvContent = [
    headers,
    ...rows,
  ]
    .map((row) =>
      row.map(escapeCsvValue).join(';'),
    )
    .join('\n');

  const blob = new Blob(
    [`\uFEFF${csvContent}`],
    {
      type: 'text/csv;charset=utf-8;',
    },
  );

  const downloadUrl =
    URL.createObjectURL(blob);

  const downloadLink =
    document.createElement('a');

  const today = new Date();

  const dateLabel = [
    today.getFullYear(),
    String(
      today.getMonth() + 1,
    ).padStart(2, '0'),
    String(today.getDate()).padStart(
      2,
      '0',
    ),
  ].join('-');

  downloadLink.href = downloadUrl;

  downloadLink.download =
    `historial-medicacion-${dateLabel}.csv`;

  document.body.appendChild(downloadLink);

  downloadLink.click();
  downloadLink.remove();

  URL.revokeObjectURL(downloadUrl);
}