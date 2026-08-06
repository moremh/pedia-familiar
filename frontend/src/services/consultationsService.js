import {
  notifyFamilyDataChanged,
} from './supabaseSyncService.js';

const STORAGE_KEY = 'mipeque-consultations';

function generateId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `consultation-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function saveConsultations(consultations) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(consultations),
  );

  notifyFamilyDataChanged(STORAGE_KEY);
}

function getConsultationTimestamp(consultation) {
  const date = consultation.consultationDate;
  const time = consultation.consultationTime || '00:00';

  const timestamp = new Date(
    `${date}T${time}:00`,
  ).getTime();

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export function getConsultations() {
  try {
    const storedConsultations =
      localStorage.getItem(STORAGE_KEY);

    if (!storedConsultations) {
      return [];
    }

    const parsedConsultations = JSON.parse(
      storedConsultations,
    );

    if (!Array.isArray(parsedConsultations)) {
      return [];
    }

    return [...parsedConsultations].sort(
      (firstConsultation, secondConsultation) =>
        getConsultationTimestamp(secondConsultation) -
        getConsultationTimestamp(firstConsultation),
    );
  } catch (error) {
    console.error(
      'No se pudieron cargar las consultas médicas.',
      error,
    );

    return [];
  }
}

export function getConsultationById(consultationId) {
  return (
    getConsultations().find(
      (consultation) =>
        consultation.id === consultationId,
    ) ?? null
  );
}

export function createConsultation(consultationData) {
  const consultations = getConsultations();
  const now = new Date().toISOString();

  const newConsultation = {
    ...consultationData,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };

  saveConsultations([
    ...consultations,
    newConsultation,
  ]);

  return newConsultation;
}

export function updateConsultation(
  consultationId,
  consultationData,
) {
  const consultations = getConsultations();

  const updatedConsultations = consultations.map(
    (consultation) =>
      consultation.id === consultationId
        ? {
            ...consultation,
            ...consultationData,
            id: consultation.id,
            updatedAt: new Date().toISOString(),
          }
        : consultation,
  );

  saveConsultations(updatedConsultations);

  return (
    updatedConsultations.find(
      (consultation) =>
        consultation.id === consultationId,
    ) ?? null
  );
}

export function deleteConsultation(consultationId) {
  const consultations = getConsultations();

  const updatedConsultations = consultations.filter(
    (consultation) =>
      consultation.id !== consultationId,
  );

  saveConsultations(updatedConsultations);

  return updatedConsultations;
}

export function getConsultationsByChild(childId) {
  return getConsultations().filter(
    (consultation) =>
      consultation.childId === childId,
  );
}