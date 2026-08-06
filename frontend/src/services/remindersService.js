import {
  notifyFamilyDataChanged,
} from './supabaseSyncService.js';

const STORAGE_KEY =
  'mipeque-reminder-records';

function saveReminderRecords(records) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(records),
    );

    notifyFamilyDataChanged(STORAGE_KEY);
  } catch (error) {
    console.error(
      'No se pudieron guardar los recordatorios.',
      error,
    );

    throw new Error(
      'No se pudieron guardar los cambios del recordatorio.',
    );
  }
}

export function getReminderRecords() {
  try {
    const storedRecords =
      localStorage.getItem(STORAGE_KEY);

    if (!storedRecords) {
      return [];
    }

    const parsedRecords =
      JSON.parse(storedRecords);

    return Array.isArray(parsedRecords)
      ? parsedRecords
      : [];
  } catch (error) {
    console.error(
      'No se pudieron cargar los recordatorios.',
      error,
    );

    return [];
  }
}

export function getReminderRecordById(
  reminderId,
) {
  if (!reminderId) {
    return null;
  }

  return (
    getReminderRecords().find(
      (record) => record.id === reminderId,
    ) ?? null
  );
}

export function updateReminderRecord(
  reminderId,
  recordData = {},
) {
  if (!reminderId) {
    throw new Error(
      'No se recibió el identificador del recordatorio.',
    );
  }

  const records = getReminderRecords();

  const existingRecord = records.find(
    (record) => record.id === reminderId,
  );

  const now = new Date().toISOString();

  let updatedRecords;

  if (existingRecord) {
    updatedRecords = records.map((record) =>
      record.id === reminderId
        ? {
            ...record,
            ...recordData,
            id: reminderId,
            createdAt:
              record.createdAt ?? now,
            updatedAt: now,
          }
        : record,
    );
  } else {
    const newRecord = {
      ...recordData,
      id: reminderId,
      status:
        recordData.status ?? 'pending',
      createdAt: now,
      updatedAt: now,
    };

    updatedRecords = [
      ...records,
      newRecord,
    ];
  }

  saveReminderRecords(updatedRecords);

  return (
    updatedRecords.find(
      (record) => record.id === reminderId,
    ) ?? null
  );
}

export function markReminderAsAdministered(
  reminderId,
  {
    responsibleId = '',
    responsibleName =
      'Responsable familiar',
    notes = '',
    treatmentId = '',
    childId = '',
    childName = '',
    medicationName = '',
    presentation = '',
    dosageInstruction = '',
    scheduledAt = null,
    originalTime = '',
  } = {},
) {
  return updateReminderRecord(reminderId, {
    status: 'administered',
    completedAt: new Date().toISOString(),
    responsibleId,
    responsibleName,
    notes,
    treatmentId,
    childId,
    childName,
    medicationName,
    presentation,
    dosageInstruction,
    scheduledAt,
    originalTime,
    postponedUntil: null,
  });
}

export function markReminderAsOmitted(
  reminderId,
  {
    responsibleId = '',
    responsibleName =
      'Responsable familiar',
    notes = '',
    treatmentId = '',
    childId = '',
    childName = '',
    medicationName = '',
    presentation = '',
    dosageInstruction = '',
    scheduledAt = null,
    originalTime = '',
  } = {},
) {
  return updateReminderRecord(reminderId, {
    status: 'omitted',
    completedAt: new Date().toISOString(),
    responsibleId,
    responsibleName,
    notes,
    treatmentId,
    childId,
    childName,
    medicationName,
    presentation,
    dosageInstruction,
    scheduledAt,
    originalTime,
    postponedUntil: null,
  });
}

export function postponeReminder(
  reminderId,
  minutes = 30,
) {
  const numericMinutes = Number(minutes);

  if (
    !Number.isInteger(numericMinutes) ||
    numericMinutes < 1
  ) {
    throw new Error(
      'La cantidad de minutos no es válida.',
    );
  }

  const postponedUntil = new Date();

  postponedUntil.setMinutes(
    postponedUntil.getMinutes() +
      numericMinutes,
  );

  return updateReminderRecord(reminderId, {
    status: 'postponed',
    postponedUntil:
      postponedUntil.toISOString(),
    completedAt: null,
    responsibleId: '',
    responsibleName: '',
  });
}

export function resetReminder(reminderId) {
  if (!reminderId) {
    return getReminderRecords();
  }

  const records = getReminderRecords();

  const updatedRecords = records.filter(
    (record) => record.id !== reminderId,
  );

  saveReminderRecords(updatedRecords);

  return updatedRecords;
}

export function deleteReminderRecord(
  reminderId,
) {
  return resetReminder(reminderId);
}

export function deleteRecordsByTreatment(
  treatmentId,
) {
  if (!treatmentId) {
    return getReminderRecords();
  }

  const records = getReminderRecords();

  const updatedRecords = records.filter(
    (record) =>
      record.treatmentId !== treatmentId,
  );

  saveReminderRecords(updatedRecords);

  return updatedRecords;
}

export function clearReminderRecords() {
  localStorage.removeItem(STORAGE_KEY);

  return [];
}