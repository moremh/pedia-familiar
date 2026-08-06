import {
  notifyFamilyDataChanged,
} from './supabaseSyncService.js';

const STORAGE_KEY =
  'mipeque-treatments';

const VALID_STATUSES = [
  'active',
  'scheduled',
  'paused',
  'completed',
];

function generateId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return crypto.randomUUID();
  }

  return `treatment-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function getTodayDateKey() {
  const today = new Date();

  const year = today.getFullYear();

  const month = String(
    today.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    today.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function resolveAutomaticStatus(
  treatmentData,
  currentStatus = '',
) {
  if (
    currentStatus === 'completed' ||
    currentStatus === 'paused'
  ) {
    return currentStatus;
  }

  if (
    treatmentData.status &&
    VALID_STATUSES.includes(
      treatmentData.status,
    ) &&
    ![
      'active',
      'scheduled',
    ].includes(treatmentData.status)
  ) {
    return treatmentData.status;
  }

  if (
    treatmentData.startDate &&
    treatmentData.startDate >
      getTodayDateKey()
  ) {
    return 'scheduled';
  }

  return 'active';
}

function normalizeTreatment(
  treatmentData,
) {
  return {
    childId:
      treatmentData.childId ?? '',

    consultationId:
      treatmentData.consultationId ?? '',

    medicationName: String(
      treatmentData.medicationName ?? '',
    ).trim(),

    presentation: String(
      treatmentData.presentation ?? '',
    ).trim(),

    dosageInstruction: String(
      treatmentData.dosageInstruction ??
        '',
    ).trim(),

    administrationRoute:
      treatmentData.administrationRoute ||
      'oral',

    startDate:
      treatmentData.startDate ?? '',

    durationDays: Number(
      treatmentData.durationDays,
    ),

    endDate:
      treatmentData.endDate ?? '',

    frequencyMode:
      treatmentData.frequencyMode ||
      'interval',

    intervalHours:
      treatmentData.frequencyMode ===
      'interval'
        ? Number(
            treatmentData.intervalHours,
          )
        : '',

    firstDoseTime:
      treatmentData.frequencyMode ===
      'interval'
        ? treatmentData.firstDoseTime ??
          ''
        : '',

    customTimes:
      treatmentData.frequencyMode ===
        'custom' &&
      Array.isArray(
        treatmentData.customTimes,
      )
        ? treatmentData.customTimes
        : [],

    notes: String(
      treatmentData.notes ?? '',
    ).trim(),
  };
}

function saveTreatments(treatments) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(treatments),
    );

    notifyFamilyDataChanged(STORAGE_KEY);
  } catch (error) {
    console.error(
      'No se pudieron guardar los tratamientos.',
      error,
    );

    throw new Error(
      'No se pudo guardar el tratamiento.',
    );
  }
}

export function getTreatments() {
  try {
    const storedTreatments =
      localStorage.getItem(STORAGE_KEY);

    if (!storedTreatments) {
      return [];
    }

    const parsedTreatments =
      JSON.parse(storedTreatments);

    if (
      !Array.isArray(parsedTreatments)
    ) {
      return [];
    }

    return [...parsedTreatments].sort(
      (first, second) => {
        const firstDate = new Date(
          `${
            first.startDate ||
            '1970-01-01'
          }T00:00:00`,
        ).getTime();

        const secondDate = new Date(
          `${
            second.startDate ||
            '1970-01-01'
          }T00:00:00`,
        ).getTime();

        return secondDate - firstDate;
      },
    );
  } catch (error) {
    console.error(
      'No se pudieron cargar los tratamientos.',
      error,
    );

    return [];
  }
}

export function getTreatmentById(
  treatmentId,
) {
  return (
    getTreatments().find(
      (treatment) =>
        treatment.id === treatmentId,
    ) ?? null
  );
}

export function createTreatment(
  treatmentData,
) {
  const treatments = getTreatments();

  const now =
    new Date().toISOString();

  const normalizedTreatment =
    normalizeTreatment(treatmentData);

  const newTreatment = {
    ...normalizedTreatment,

    id: generateId(),

    status: resolveAutomaticStatus(
      treatmentData,
    ),

    createdAt: now,
    updatedAt: now,
  };

  saveTreatments([
    ...treatments,
    newTreatment,
  ]);

  return newTreatment;
}

export function updateTreatment(
  treatmentId,
  treatmentData,
) {
  const treatments = getTreatments();

  const existingTreatment =
    treatments.find(
      (treatment) =>
        treatment.id === treatmentId,
    );

  if (!existingTreatment) {
    throw new Error(
      'No se encontró el tratamiento.',
    );
  }

  const normalizedTreatment =
    normalizeTreatment({
      ...existingTreatment,
      ...treatmentData,
    });

  const updatedTreatment = {
    ...existingTreatment,
    ...normalizedTreatment,

    status: resolveAutomaticStatus(
      treatmentData,
      existingTreatment.status,
    ),

    id: existingTreatment.id,

    updatedAt:
      new Date().toISOString(),
  };

  const updatedTreatments =
    treatments.map((treatment) =>
      treatment.id === treatmentId
        ? updatedTreatment
        : treatment,
    );

  saveTreatments(updatedTreatments);

  return updatedTreatment;
}

export function updateTreatmentStatus(
  treatmentId,
  status,
) {
  if (
    !VALID_STATUSES.includes(status)
  ) {
    throw new Error(
      'El estado del tratamiento no es válido.',
    );
  }

  const treatments = getTreatments();

  let updatedTreatment = null;

  const updatedTreatments =
    treatments.map((treatment) => {
      if (
        treatment.id !== treatmentId
      ) {
        return treatment;
      }

      updatedTreatment = {
        ...treatment,
        status,
        updatedAt:
          new Date().toISOString(),
      };

      return updatedTreatment;
    });

  saveTreatments(updatedTreatments);

  return updatedTreatment;
}

export function deleteTreatment(
  treatmentId,
) {
  const treatments = getTreatments();

  const updatedTreatments =
    treatments.filter(
      (treatment) =>
        treatment.id !== treatmentId,
    );

  saveTreatments(updatedTreatments);

  return updatedTreatments;
}

export function getTreatmentsByChild(
  childId,
) {
  return getTreatments().filter(
    (treatment) =>
      treatment.childId === childId,
  );
}