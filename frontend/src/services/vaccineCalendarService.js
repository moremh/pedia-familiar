import {
  notifyFamilyDataChanged,
} from './supabaseSyncService.js';

export const VACCINE_CALENDAR_STORAGE_KEY =
  'mipeque-vaccine-calendar-marks';

function generateId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `vaccine-mark-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function saveMarks(marks) {
  localStorage.setItem(
    VACCINE_CALENDAR_STORAGE_KEY,
    JSON.stringify(marks),
  );

  notifyFamilyDataChanged(
    VACCINE_CALENDAR_STORAGE_KEY,
  );
}

export function getVaccineCalendarMarks() {
  try {
    const stored = localStorage.getItem(
      VACCINE_CALENDAR_STORAGE_KEY,
    );

    if (!stored) {
      return [];
    }

    const parsed = JSON.parse(stored);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch (error) {
    console.error(
      'No se pudo cargar el calendario de vacunación.',
      error,
    );

    return [];
  }
}

export function setVaccineCalendarMark({
  childId,
  scheduleKey,
  checked,
}) {
  if (!childId || !scheduleKey) {
    return getVaccineCalendarMarks();
  }

  const marks = getVaccineCalendarMarks();
  const existing = marks.find(
    (mark) =>
      mark.childId === childId &&
      mark.scheduleKey === scheduleKey,
  );

  if (!checked) {
    const updatedMarks = marks.filter(
      (mark) =>
        !(
          mark.childId === childId &&
          mark.scheduleKey === scheduleKey
        ),
    );

    saveMarks(updatedMarks);
    return updatedMarks;
  }

  const now = new Date().toISOString();

  if (existing) {
    const updatedMarks = marks.map((mark) =>
      mark.id === existing.id
        ? {
            ...mark,
            checkedAt: mark.checkedAt || now,
            updatedAt: now,
          }
        : mark,
    );

    saveMarks(updatedMarks);
    return updatedMarks;
  }

  const newMark = {
    id: generateId(),
    childId,
    scheduleKey,
    checkedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const updatedMarks = [
    ...marks,
    newMark,
  ];

  saveMarks(updatedMarks);
  return updatedMarks;
}
