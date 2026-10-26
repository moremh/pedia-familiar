import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFamilyAlerts,
} from '../src/utils/alertUtils.js';

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0');
  const day = String(
    date.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

test(
  'incluye seguimientos medicos de hoy en el centro de alertas',
  () => {
    const today =
      localDateKey(
        new Date(),
      );

    const alerts =
      buildFamilyAlerts({
        children: [
          {
            id: 'child-1',
            fullName: 'Paciente',
          },
        ],
        consultations: [
          {
            id: 'consultation-1',
            childId: 'child-1',
            reason: 'Control',
            followUpDate: today,
          },
        ],
      });

    const followUp =
      alerts.find(
        (alert) =>
          alert.type ===
          'followup',
      );

    assert.ok(followUp);
    assert.equal(
      followUp.group,
      'today',
    );
    assert.equal(
      followUp.path,
      '/dashboard/consultations',
    );
  },
);

test(
  'mantiene los turnos programados dentro del centro de alertas',
  () => {
    const appointmentAt =
      new Date(
        Date.now() +
          60 * 60 * 1000,
      );

    const date =
      localDateKey(
        appointmentAt,
      );

    const time =
      `${String(
        appointmentAt.getHours(),
      ).padStart(2, '0')}:${String(
        appointmentAt.getMinutes(),
      ).padStart(2, '0')}`;

    const alerts =
      buildFamilyAlerts({
        children: [
          {
            id: 'child-1',
            fullName: 'Paciente',
          },
        ],
        appointments: [
          {
            id: 'appointment-1',
            childId: 'child-1',
            appointmentDate: date,
            appointmentTime: time,
            reason: 'Pediatría',
            status: 'scheduled',
          },
        ],
      });

    const appointment =
      alerts.find(
        (alert) =>
          alert.type ===
          'appointment',
      );

    assert.ok(appointment);
    assert.equal(
      appointment.path,
      '/dashboard/appointments',
    );
  },
);
