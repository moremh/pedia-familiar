import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateTreatmentEndDate,
  generateIntervalTimes,
  parseCustomTimes,
} from '../src/utils/treatmentUtils.js';

test('calcula la fecha final incluyendo el primer dia', () => {
  assert.equal(
    calculateTreatmentEndDate(
      '2026-10-26',
      3,
    ),
    '2026-10-28',
  );
});

test('genera horarios por intervalo sin duplicados', () => {
  assert.deepEqual(
    generateIntervalTimes(
      '08:00',
      8,
    ),
    ['08:00', '16:00', '00:00'],
  );
});

test('normaliza horarios personalizados validos', () => {
  assert.deepEqual(
    parseCustomTimes(
      '20:00, 08:00, 20:00, 99:00',
    ),
    ['08:00', '20:00'],
  );
});
