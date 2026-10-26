import {
  formatReminderDate,
  formatReminderTime,
  generateReminderOccurrences,
  getReminderEffectiveDate,
} from './reminderUtils.js';

import {
  getTreatmentStatus,
} from './treatmentUtils.js';

import {
  formatShortVaccineDate,
  getDaysUntilNextDose,
  getVaccineState,
} from './vaccineUtils.js';

import {
  getExpirationDescription,
  getMedicineCabinetState,
  getStockUnitLabel,
} from './medicineCabinetUtils.js';

const priorityOrder = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const priorityLabels = {
  urgent: 'Urgente',
  high: 'Importante',
  medium: 'Próxima',
  low: 'Informativa',
};

const alertTypeLabels = {
  dose: 'Medicamento',
  stock: 'Botiquín',
  vaccine: 'Vacuna',
  treatment: 'Tratamiento',
  appointment: 'Turno',
  followup: 'Seguimiento',
};

export function getLocalDateKey(
  date = new Date(),
) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    date.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function isSameLocalDay(firstDate, secondDate) {
  return (
    getLocalDateKey(firstDate) ===
    getLocalDateKey(secondDate)
  );
}

function getDifferenceInDays(
  firstDate,
  secondDate,
) {
  const normalizedFirst = new Date(firstDate);
  const normalizedSecond = new Date(secondDate);

  normalizedFirst.setHours(0, 0, 0, 0);
  normalizedSecond.setHours(0, 0, 0, 0);

  return Math.round(
    (normalizedFirst.getTime() -
      normalizedSecond.getTime()) /
      86400000,
  );
}

export function getAlertPriorityLabel(
  priority,
) {
  return (
    priorityLabels[priority] ??
    'Informativa'
  );
}

export function getAlertTypeLabel(type) {
  return (
    alertTypeLabels[type] ??
    'Alerta familiar'
  );
}

export function formatAlertDateTime(
  dateValue,
) {
  if (!dateValue) {
    return 'Sin fecha específica';
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha específica';
  }

  const today = new Date();

  if (isSameLocalDay(date, today)) {
    return `Hoy · ${new Intl.DateTimeFormat(
      'es-AR',
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      },
    ).format(date)}`;
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

function createReminderAlerts({
  treatments,
  records,
  childrenMap,
}) {
  const now = new Date();

  const reminders =
    generateReminderOccurrences({
      treatments,
      records,
      childrenMap,
      daysBack: 30,
      daysForward: 30,
    });

  return reminders
    .filter((reminder) =>
      ['pending', 'postponed'].includes(
        reminder.status,
      ),
    )
    .map((reminder) => {
      const effectiveDate =
        getReminderEffectiveDate(reminder);

      const isOverdue =
        effectiveDate.getTime() <
        now.getTime();

      const isToday = isSameLocalDay(
        effectiveDate,
        now,
      );

      const daysUntil =
        getDifferenceInDays(
          effectiveDate,
          now,
        );

      if (
        !isOverdue &&
        !isToday &&
        (daysUntil < 0 || daysUntil > 7)
      ) {
        return null;
      }

      let priority = 'medium';
      let group = 'upcoming';
      let statusLabel = 'Próxima toma';

      if (isOverdue) {
        priority = 'urgent';
        group = 'urgent';
        statusLabel = 'Toma atrasada';
      } else if (isToday) {
        priority = 'high';
        group = 'today';
        statusLabel =
          reminder.status === 'postponed'
            ? 'Toma pospuesta'
            : 'Pendiente para hoy';
      }

      return {
        id: `dose-${reminder.id}`,
        sourceId: reminder.id,
        type: 'dose',
        priority,
        group,
        title: reminder.medicationName,
        description: [
          reminder.childName,
          reminder.dosageInstruction ||
            reminder.presentation,
        ]
          .filter(Boolean)
          .join(' · '),
        childId: reminder.childId,
        childName: reminder.childName,
        date: effectiveDate.toISOString(),
        dateLabel: `${formatReminderDate(
          effectiveDate,
        )} · ${formatReminderTime(
          effectiveDate,
        )}`,
        statusLabel,
        icon: 'bi-bell',
        path: '/dashboard/reminders',
        actionLabel: 'Ver recordatorio',
      };
    })
    .filter(Boolean);
}

function createCabinetAlerts({
  cabinetItems,
  childrenMap,
}) {
  return cabinetItems
    .map((item) => {
      const state =
        getMedicineCabinetState(item);

      if (state === 'available') {
        return null;
      }

      let priority = 'high';
      let group = 'today';
      let statusLabel = 'Revisar botiquín';
      let description = '';

      if (state === 'expired') {
        priority = 'urgent';
        group = 'urgent';
        statusLabel = 'Medicamento vencido';
        description =
          getExpirationDescription(item);
      }

      if (state === 'outOfStock') {
        priority = 'urgent';
        group = 'urgent';
        statusLabel = 'Sin stock';
        description =
          'No quedan unidades disponibles.';
      }

      if (state === 'lowStock') {
        priority = 'high';
        group = 'today';
        statusLabel = 'Poco stock';
        description = `${item.currentStock} ${getStockUnitLabel(
          item.stockUnit,
        )} disponibles.`;
      }

      if (state === 'expiring') {
        priority = 'high';
        group = 'upcoming';
        statusLabel = 'Próximo a vencer';
        description =
          getExpirationDescription(item);
      }

      const expirationDate =
        item.expirationDate
          ? new Date(
              `${item.expirationDate}T09:00:00`,
            ).toISOString()
          : null;

      return {
        id: `stock-${item.id}`,
        sourceId: item.id,
        type: 'stock',
        priority,
        group,
        title: item.medicineName,
        description,
        childId: item.childId,
        childName:
          childrenMap[item.childId]?.fullName ??
          'Perfil no disponible',
        date: expirationDate,
        dateLabel: item.expirationDate
          ? getExpirationDescription(item)
          : 'Sin fecha de vencimiento',
        statusLabel,
        icon:
          state === 'expired'
            ? 'bi-calendar-x'
            : state === 'outOfStock'
              ? 'bi-box-seam'
              : 'bi-capsule-pill',
        path: '/dashboard/medicine-cabinet',
        actionLabel: 'Abrir botiquín',
      };
    })
    .filter(Boolean);
}

function createVaccineAlerts({
  vaccines,
  childrenMap,
}) {
  return vaccines
    .map((vaccine) => {
      const state =
        getVaccineState(vaccine);

      if (
        ![
          'upcoming',
          'today',
          'overdue',
        ].includes(state)
      ) {
        return null;
      }

      const daysUntil =
        getDaysUntilNextDose(
          vaccine.nextDoseDate,
        );

      if (
        state === 'upcoming' &&
        daysUntil !== null &&
        daysUntil > 30
      ) {
        return null;
      }

      let priority = 'medium';
      let group = 'upcoming';
      let statusLabel = 'Próxima dosis';

      if (state === 'overdue') {
        priority = 'urgent';
        group = 'urgent';
        statusLabel = 'Dosis atrasada';
      }

      if (state === 'today') {
        priority = 'high';
        group = 'today';
        statusLabel = 'Dosis para hoy';
      }

      const nextDoseDate =
        vaccine.nextDoseDate
          ? new Date(
              `${vaccine.nextDoseDate}T09:00:00`,
            ).toISOString()
          : null;

      return {
        id: `vaccine-${vaccine.id}`,
        sourceId: vaccine.id,
        type: 'vaccine',
        priority,
        group,
        title: vaccine.vaccineName,
        description: [
          childrenMap[vaccine.childId]
            ?.fullName,
          vaccine.doseLabel,
        ]
          .filter(Boolean)
          .join(' · '),
        childId: vaccine.childId,
        childName:
          childrenMap[vaccine.childId]
            ?.fullName ??
          'Perfil no disponible',
        date: nextDoseDate,
        dateLabel: vaccine.nextDoseDate
          ? formatShortVaccineDate(
              vaccine.nextDoseDate,
            )
          : 'Sin próxima fecha',
        statusLabel,
        icon: 'bi-shield-plus',
        path: '/dashboard/vaccines',
        actionLabel: 'Ver vacunas',
      };
    })
    .filter(Boolean);
}

function createFollowUpAlerts({
  consultations,
  childrenMap,
}) {
  const now = new Date();

  return consultations
    .filter(
      (consultation) =>
        Boolean(
          consultation.followUpDate,
        ),
    )
    .map((consultation) => {
      const followUpDate =
        new Date(
          `${consultation.followUpDate}T00:00:00`,
        );

      if (
        Number.isNaN(
          followUpDate.getTime(),
        )
      ) {
        return null;
      }

      const daysUntil =
        getDifferenceInDays(
          followUpDate,
          now,
        );

      if (
        daysUntil < -30 ||
        daysUntil > 30
      ) {
        return null;
      }

      const isToday =
        daysUntil === 0;
      const isOverdue =
        daysUntil < 0;

      const childName =
        childrenMap[
          consultation.childId
        ]?.fullName ||
        'Perfil no disponible';

      return {
        id:
          `followup-${consultation.id}`,
        sourceId:
          consultation.id,
        type: 'followup',
        priority:
          isOverdue
            ? 'urgent'
            : isToday
              ? 'high'
              : 'medium',
        group:
          isOverdue
            ? 'urgent'
            : isToday
              ? 'today'
              : 'upcoming',
        title:
          consultation.reason ||
          'Seguimiento médico',
        description:
          childName,
        childId:
          consultation.childId,
        childName,
        date:
          followUpDate.toISOString(),
        dateLabel:
          new Intl.DateTimeFormat(
            'es-AR',
            {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            },
          ).format(followUpDate),
        statusLabel:
          isOverdue
            ? 'Seguimiento pendiente'
            : isToday
              ? 'Seguimiento para hoy'
              : 'Próximo seguimiento',
        icon:
          'bi-clipboard2-pulse',
        path:
          '/dashboard/consultations',
        actionLabel:
          'Ver consulta',
      };
    })
    .filter(Boolean);
}

function createAppointmentAlerts({
  appointments,
  childrenMap,
}) {
  const now =
    new Date();

  return appointments
    .filter(
      (appointment) =>
        appointment.status ===
        'scheduled',
    )
    .map((appointment) => {
      const appointmentAt =
        new Date(
          `${appointment.appointmentDate}T${appointment.appointmentTime}:00`,
        );

      if (
        Number.isNaN(
          appointmentAt.getTime(),
        )
      ) {
        return null;
      }

      const differenceMs =
        appointmentAt.getTime() -
        now.getTime();

      const daysUntil =
        Math.ceil(
          differenceMs /
            86400000,
        );

      if (
        differenceMs <
          -2 * 60 * 60 * 1000 ||
        daysUntil > 30
      ) {
        return null;
      }

      const isToday =
        getLocalDateKey(
          appointmentAt,
        ) ===
        getLocalDateKey(now);

      const isPast =
        differenceMs < 0;

      const childName =
        childrenMap[
          appointment.childId
        ]?.fullName ||
        'Perfil no disponible';

      return {
        id:
          `appointment-${appointment.id}`,
        sourceId:
          appointment.id,
        type: 'appointment',
        priority:
          isPast
            ? 'urgent'
            : isToday
              ? 'high'
              : 'medium',
        group:
          isPast
            ? 'urgent'
            : isToday
              ? 'today'
              : 'upcoming',
        title:
          appointment.reason ||
          appointment.specialty ||
          'Turno médico',
        description: [
          childName,
          appointment.professionalName,
          appointment.medicalCenter,
        ]
          .filter(Boolean)
          .join(' · '),
        childId:
          appointment.childId,
        childName,
        date:
          appointmentAt.toISOString(),
        dateLabel:
          formatAlertDateTime(
            appointmentAt,
          ),
        statusLabel:
          isPast
            ? 'Turno pendiente de cerrar'
            : isToday
              ? 'Turno para hoy'
              : 'Próximo turno',
        icon:
          'bi-calendar-event',
        path:
          '/dashboard/appointments',
        actionLabel:
          'Ver turno',
      };
    })
    .filter(Boolean);
}

function createTreatmentAlerts({
  treatments,
  cabinetItems,
  childrenMap,
}) {
  const linkedTreatmentIds = new Set(
    cabinetItems
      .map((item) => item.treatmentId)
      .filter(Boolean),
  );

  return treatments
    .filter((treatment) =>
      ['active', 'scheduled'].includes(
        getTreatmentStatus(treatment),
      ),
    )
    .filter(
      (treatment) =>
        !linkedTreatmentIds.has(
          treatment.id,
        ),
    )
    .map((treatment) => ({
      id: `treatment-${treatment.id}`,
      sourceId: treatment.id,
      type: 'treatment',
      priority: 'medium',
      group: 'upcoming',
      title:
        treatment.medicationName ||
        'Tratamiento sin nombre',
      description: `${
        childrenMap[treatment.childId]
          ?.fullName ??
        'Perfil no disponible'
      } · No tiene stock vinculado`,
      childId: treatment.childId,
      childName:
        childrenMap[treatment.childId]
          ?.fullName ??
        'Perfil no disponible',
      date: treatment.startDate
        ? new Date(
            `${treatment.startDate}T09:00:00`,
          ).toISOString()
        : null,
      dateLabel:
        'Vinculalo con un medicamento del botiquín',
      statusLabel: 'Sin stock vinculado',
      icon: 'bi-link-45deg',
      path: '/dashboard/medicine-cabinet',
      actionLabel: 'Vincular stock',
    }));
}

export function buildFamilyAlerts({
  children = [],
  treatments = [],
  reminderRecords = [],
  vaccines = [],
  cabinetItems = [],
  appointments = [],
  consultations = [],
}) {
  const childrenMap = Object.fromEntries(
    children.map((child) => [
      child.id,
      child,
    ]),
  );

  const alerts = [
    ...createReminderAlerts({
      treatments,
      records: reminderRecords,
      childrenMap,
    }),

    ...createCabinetAlerts({
      cabinetItems,
      childrenMap,
    }),

    ...createVaccineAlerts({
      vaccines,
      childrenMap,
    }),

    ...createTreatmentAlerts({
      treatments,
      cabinetItems,
      childrenMap,
    }),

    ...createAppointmentAlerts({
      appointments,
      childrenMap,
    }),

    ...createFollowUpAlerts({
      consultations,
      childrenMap,
    }),
  ];

  return alerts.sort(
    (firstAlert, secondAlert) => {
      const priorityDifference =
        priorityOrder[firstAlert.priority] -
        priorityOrder[secondAlert.priority];

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      const firstDate = firstAlert.date
        ? new Date(
            firstAlert.date,
          ).getTime()
        : Number.POSITIVE_INFINITY;

      const secondDate = secondAlert.date
        ? new Date(
            secondAlert.date,
          ).getTime()
        : Number.POSITIVE_INFINITY;

      return firstDate - secondDate;
    },
  );
}