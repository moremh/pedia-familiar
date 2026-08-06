import {
  flushPendingRemoteSync,
  loadCurrentAccountCache,
  notifyFamilyDataChanged,
} from './supabaseSyncService.js';

import {
  requireSupabase,
} from '../lib/supabaseClient.js';

const CABINET_STORAGE_KEY =
  'mipeque-medicine-cabinet';

const STOCK_USAGE_STORAGE_KEY =
  'mipeque-medicine-stock-usage';

function generateId(prefix = 'medicine') {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function parseStoredArray(storageKey) {
  try {
    const storedValue = localStorage.getItem(storageKey);

    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue);

    return Array.isArray(parsedValue)
      ? parsedValue
      : [];
  } catch (error) {
    console.error(
      `No se pudo leer ${storageKey}.`,
      error,
    );

    return [];
  }
}

function saveStoredArray(storageKey, values) {
  localStorage.setItem(
    storageKey,
    JSON.stringify(values),
  );

  notifyFamilyDataChanged(storageKey);
}

function normalizeNumber(value, fallback = 0) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : fallback;
}

export function getMedicineCabinetItems() {
  const items = parseStoredArray(
    CABINET_STORAGE_KEY,
  );

  return [...items].sort((first, second) => {
    if (
      first.expirationDate &&
      second.expirationDate
    ) {
      return first.expirationDate.localeCompare(
        second.expirationDate,
      );
    }

    if (first.expirationDate) {
      return -1;
    }

    if (second.expirationDate) {
      return 1;
    }

    return first.medicineName.localeCompare(
      second.medicineName,
      'es',
    );
  });
}

export function getMedicineCabinetItemById(
  itemId,
) {
  return (
    getMedicineCabinetItems().find(
      (item) => item.id === itemId,
    ) ?? null
  );
}

export function createMedicineCabinetItem(
  itemData,
) {
  const items = getMedicineCabinetItems();
  const now = new Date().toISOString();

  const newItem = {
    ...itemData,
    id: generateId(),
    currentStock: normalizeNumber(
      itemData.currentStock,
    ),
    minimumStock: normalizeNumber(
      itemData.minimumStock,
    ),
    consumptionPerDose: normalizeNumber(
      itemData.consumptionPerDose,
      1,
    ),
    createdAt: now,
    updatedAt: now,
  };

  saveStoredArray(CABINET_STORAGE_KEY, [
    ...items,
    newItem,
  ]);

  return newItem;
}

export function updateMedicineCabinetItem(
  itemId,
  itemData,
) {
  const items = getMedicineCabinetItems();

  const updatedItems = items.map((item) =>
    item.id === itemId
      ? {
          ...item,
          ...itemData,
          id: item.id,
          currentStock: normalizeNumber(
            itemData.currentStock,
          ),
          minimumStock: normalizeNumber(
            itemData.minimumStock,
          ),
          consumptionPerDose: normalizeNumber(
            itemData.consumptionPerDose,
            1,
          ),
          updatedAt: new Date().toISOString(),
        }
      : item,
  );

  saveStoredArray(
    CABINET_STORAGE_KEY,
    updatedItems,
  );

  return (
    updatedItems.find(
      (item) => item.id === itemId,
    ) ?? null
  );
}

export function deleteMedicineCabinetItem(
  itemId,
) {
  const items = getMedicineCabinetItems();

  const updatedItems = items.filter(
    (item) => item.id !== itemId,
  );

  saveStoredArray(
    CABINET_STORAGE_KEY,
    updatedItems,
  );

  const usageRecords = getStockUsageRecords();

  const updatedUsageRecords =
    usageRecords.filter(
      (record) => record.itemId !== itemId,
    );

  saveStoredArray(
    STOCK_USAGE_STORAGE_KEY,
    updatedUsageRecords,
  );

  return updatedItems;
}

export function getMedicineCabinetItemsByChild(
  childId,
) {
  return getMedicineCabinetItems().filter(
    (item) => item.childId === childId,
  );
}

export function getStockUsageRecords() {
  return parseStoredArray(
    STOCK_USAGE_STORAGE_KEY,
  );
}

export function getStockUsageByReminderId(
  reminderId,
) {
  return (
    getStockUsageRecords().find(
      (record) =>
        record.reminderId === reminderId,
    ) ?? null
  );
}

export async function consumeMedicineStockForReminder({
  reminderId,
  treatmentId,
}) {
  if (!reminderId || !treatmentId) {
    return {
      updated: false,
      reason: 'missing-data',
    };
  }

  await flushPendingRemoteSync();

  const client = requireSupabase();
  const { data, error } = await client.rpc(
    'consume_medicine_stock_for_reminder',
    {
      p_reminder_id: reminderId,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
        'No se pudo descontar el medicamento del botiquín.',
    );
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  if (user) {
    await loadCurrentAccountCache(user);
  }

  return {
    ...(data || {}),
    reason: data?.reason
      ? String(data.reason).replaceAll('_', '-')
      : '',
  };
}

export async function restoreMedicineStockForReminder(
  reminderId,
) {
  if (!reminderId) {
    return {
      updated: false,
      reason: 'missing-reminder',
    };
  }

  await flushPendingRemoteSync();

  const client = requireSupabase();
  const { data, error } = await client.rpc(
    'restore_medicine_stock_for_reminder',
    {
      p_reminder_id: reminderId,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
        'No se pudo devolver el medicamento al botiquín.',
    );
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  if (user) {
    await loadCurrentAccountCache(user);
  }

  return {
    ...(data || {}),
    reason: data?.reason
      ? String(data.reason).replaceAll('_', '-')
      : '',
  };
}
