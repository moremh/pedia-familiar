import {
  notifyFamilyDataChanged,
} from './supabaseSyncService.js';

const STORAGE_KEY =
  'mipeque-vaccines';

function generateId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID ===
      'function'
  ) {
    return crypto.randomUUID();
  }

  return `vaccine-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function resolveRecordStatus(vaccine) {
  if (
    vaccine.recordStatus ===
      'applied' ||
    vaccine.recordStatus === 'pending'
  ) {
    return vaccine.recordStatus;
  }

  return vaccine.applicationDate
    ? 'applied'
    : 'pending';
}

function normalizeVaccine(vaccineData) {
  const recordStatus =
    resolveRecordStatus(vaccineData);

  return {
    childId:
      vaccineData.childId ?? '',

    vaccineName: String(
      vaccineData.vaccineName ?? '',
    ).trim(),

    recordStatus,

    applicationDate:
      recordStatus === 'applied'
        ? vaccineData.applicationDate ??
          ''
        : '',

    nextDoseDate:
      vaccineData.nextDoseDate ?? '',

    doseLabel: String(
      vaccineData.doseLabel ??
        (recordStatus === 'applied'
          ? 'Aplicada'
          : 'Pendiente'),
    ).trim(),

    observations: String(
      vaccineData.observations ?? '',
    ).trim(),

    lotNumber: String(
      vaccineData.lotNumber ?? '',
    ).trim(),

    vaccinationCenter: String(
      vaccineData.vaccinationCenter ?? '',
    ).trim(),

    professionalName: String(
      vaccineData.professionalName ?? '',
    ).trim(),

    proofFile:
      vaccineData.proofFile ?? null,
  };
}

function saveVaccines(vaccines) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(vaccines),
    );

    notifyFamilyDataChanged(STORAGE_KEY);
  } catch (error) {
    console.error(
      'No se pudieron guardar las vacunas.',
      error,
    );

    throw new Error(
      'No se pudo guardar la vacuna.',
    );
  }
}

export function getVaccines() {
  try {
    const storedVaccines =
      localStorage.getItem(STORAGE_KEY);

    if (!storedVaccines) {
      return [];
    }

    const parsedVaccines =
      JSON.parse(storedVaccines);

    if (
      !Array.isArray(parsedVaccines)
    ) {
      return [];
    }

    return [...parsedVaccines].sort(
      (
        firstVaccine,
        secondVaccine,
      ) => {
        const firstStatus =
          resolveRecordStatus(
            firstVaccine,
          );

        const secondStatus =
          resolveRecordStatus(
            secondVaccine,
          );

        if (
          firstStatus !== secondStatus
        ) {
          return firstStatus ===
            'pending'
            ? -1
            : 1;
        }

        const firstDateValue =
          firstStatus === 'pending'
            ? firstVaccine.nextDoseDate
            : firstVaccine.applicationDate;

        const secondDateValue =
          secondStatus === 'pending'
            ? secondVaccine.nextDoseDate
            : secondVaccine.applicationDate;

        const firstDate = new Date(
          `${
            firstDateValue ||
            '1970-01-01'
          }T00:00:00`,
        ).getTime();

        const secondDate = new Date(
          `${
            secondDateValue ||
            '1970-01-01'
          }T00:00:00`,
        ).getTime();

        if (firstStatus === 'pending') {
          return firstDate - secondDate;
        }

        return secondDate - firstDate;
      },
    );
  } catch (error) {
    console.error(
      'No se pudieron cargar las vacunas.',
      error,
    );

    return [];
  }
}

export function getVaccineById(
  vaccineId,
) {
  return (
    getVaccines().find(
      (vaccine) =>
        vaccine.id === vaccineId,
    ) ?? null
  );
}

export function createVaccine(
  vaccineData,
) {
  const vaccines = getVaccines();

  const now =
    new Date().toISOString();

  const newVaccine = {
    ...normalizeVaccine(vaccineData),

    id: generateId(),

    createdAt: now,
    updatedAt: now,
  };

  saveVaccines([
    ...vaccines,
    newVaccine,
  ]);

  return newVaccine;
}

export function updateVaccine(
  vaccineId,
  vaccineData,
) {
  const vaccines = getVaccines();

  const existingVaccine =
    vaccines.find(
      (vaccine) =>
        vaccine.id === vaccineId,
    );

  if (!existingVaccine) {
    throw new Error(
      'No se encontró la vacuna.',
    );
  }

  const updatedVaccine = {
    ...existingVaccine,

    ...normalizeVaccine({
      ...existingVaccine,
      ...vaccineData,
    }),

    id: existingVaccine.id,

    updatedAt:
      new Date().toISOString(),
  };

  const updatedVaccines =
    vaccines.map((vaccine) =>
      vaccine.id === vaccineId
        ? updatedVaccine
        : vaccine,
    );

  saveVaccines(updatedVaccines);

  return updatedVaccine;
}

export function deleteVaccine(
  vaccineId,
) {
  const vaccines = getVaccines();

  const updatedVaccines =
    vaccines.filter(
      (vaccine) =>
        vaccine.id !== vaccineId,
    );

  saveVaccines(updatedVaccines);

  return updatedVaccines;
}

export function getVaccinesByChild(
  childId,
) {
  return getVaccines().filter(
    (vaccine) =>
      vaccine.childId === childId,
  );
}