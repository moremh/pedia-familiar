import {
  notifyFamilyDataChanged,
} from './supabaseSyncService.js';

const STORAGE_KEY =
  'mipeque-appointments';

function generateId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `appointment-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function saveAppointments(items) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(items),
  );

  notifyFamilyDataChanged(
    STORAGE_KEY,
  );
}

function getTimestamp(item) {
  const date =
    item.appointmentDate || '';

  const time =
    item.appointmentTime ||
    '00:00';

  const timestamp =
    new Date(
      `${date}T${time}:00`,
    ).getTime();

  return Number.isNaN(timestamp)
    ? 0
    : timestamp;
}

export function getAppointments() {
  try {
    const raw =
      localStorage.getItem(
        STORAGE_KEY,
      );

    if (!raw) {
      return [];
    }

    const parsed =
      JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return [...parsed].sort(
      (
        first,
        second,
      ) =>
        getTimestamp(first) -
        getTimestamp(second),
    );
  } catch (error) {
    console.error(
      'No se pudieron cargar los turnos.',
      error,
    );

    return [];
  }
}

export function getAppointmentById(
  appointmentId,
) {
  return (
    getAppointments().find(
      (appointment) =>
        appointment.id ===
        appointmentId,
    ) || null
  );
}

export function createAppointment(
  appointmentData,
) {
  const appointments =
    getAppointments();

  const now =
    new Date().toISOString();

  const appointment = {
    ...appointmentData,
    id: generateId(),
    status:
      appointmentData.status ||
      'scheduled',
    createdAt: now,
    updatedAt: now,
  };

  saveAppointments([
    ...appointments,
    appointment,
  ]);

  return appointment;
}

export function updateAppointment(
  appointmentId,
  appointmentData,
) {
  const appointments =
    getAppointments();

  const updated =
    appointments.map(
      (appointment) =>
        appointment.id ===
        appointmentId
          ? {
              ...appointment,
              ...appointmentData,
              id: appointment.id,
              updatedAt:
                new Date()
                  .toISOString(),
            }
          : appointment,
    );

  saveAppointments(updated);

  return (
    updated.find(
      (appointment) =>
        appointment.id ===
        appointmentId,
    ) || null
  );
}

export function deleteAppointment(
  appointmentId,
) {
  const updated =
    getAppointments().filter(
      (appointment) =>
        appointment.id !==
        appointmentId,
    );

  saveAppointments(updated);

  return updated;
}

export function setAppointmentStatus(
  appointmentId,
  status,
) {
  if (
    ![
      'scheduled',
      'completed',
      'cancelled',
    ].includes(status)
  ) {
    throw new Error(
      'El estado del turno no es válido.',
    );
  }

  return updateAppointment(
    appointmentId,
    { status },
  );
}
