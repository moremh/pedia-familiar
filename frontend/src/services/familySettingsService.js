import {
  clearFamilyDataSnapshot,
  getCurrentFamilyDataSnapshot,
  isFamilyDataStorageKey,
  replaceCurrentFamilyData,
  saveFamilyDataSnapshot,
} from './familyStorageService.js';

import {
  getCurrentFamilyId,
} from './subscriptionService.js';

import {
  notifyFamilyDataChanged,
  syncAllFamilyData,
} from './supabaseSyncService.js';

const SETTINGS_STORAGE_KEY =
  'mipeque-settings';

export const DEFAULT_FAMILY_SETTINGS = {
  familyName: 'Mi familia',
  contactName: '',
  contactEmail: '',
  phone: '',
  defaultCaregiverId: '',
  reminderAdvanceMinutes: 15,
  expirationWarningDays: 30,
  vaccineWarningDays: 30,
  showOverdueAlerts: true,
  showStockAlerts: true,
  showExpirationAlerts: true,
  showVaccineAlerts: true,
};

function persistFamilyChanges() {
  const familyId =
    getCurrentFamilyId();

  if (familyId) {
    saveFamilyDataSnapshot(
      familyId,
    );
  }
}

export function getFamilySettings() {
  try {
    const storedSettings =
      localStorage.getItem(
        SETTINGS_STORAGE_KEY,
      );

    if (!storedSettings) {
      return {
        ...DEFAULT_FAMILY_SETTINGS,
      };
    }

    const parsedSettings =
      JSON.parse(
        storedSettings,
      );

    if (
      !parsedSettings ||
      typeof parsedSettings !==
        'object' ||
      Array.isArray(
        parsedSettings,
      )
    ) {
      return {
        ...DEFAULT_FAMILY_SETTINGS,
      };
    }

    return {
      ...DEFAULT_FAMILY_SETTINGS,
      ...parsedSettings,
    };
  } catch (error) {
    console.error(
      'No se pudo cargar la configuración familiar.',
      error,
    );

    return {
      ...DEFAULT_FAMILY_SETTINGS,
    };
  }
}

export function saveFamilySettings(
  settingsData,
) {
  const previousSettings =
    getFamilySettings();

  const now =
    new Date().toISOString();

  const updatedSettings = {
    ...DEFAULT_FAMILY_SETTINGS,
    ...previousSettings,
    ...settingsData,

    createdAt:
      previousSettings.createdAt ??
      now,

    updatedAt: now,
  };

  localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify(
      updatedSettings,
    ),
  );

  notifyFamilyDataChanged(SETTINGS_STORAGE_KEY);

  persistFamilyChanges();

  return updatedSettings;
}

export function resetFamilySettings() {
  const resetSettings = {
    ...DEFAULT_FAMILY_SETTINGS,
    updatedAt:
      new Date().toISOString(),
  };

  localStorage.setItem(
    SETTINGS_STORAGE_KEY,
    JSON.stringify(
      resetSettings,
    ),
  );

  notifyFamilyDataChanged(SETTINGS_STORAGE_KEY);

  persistFamilyChanges();

  return resetSettings;
}

export function createFamilyBackup() {
  return {
    application:
      'MiPeque',

    backupVersion: 2,

    exportedAt:
      new Date().toISOString(),

    data:
      getCurrentFamilyDataSnapshot(),
  };
}

export function downloadFamilyBackup() {
  const backup =
    createFamilyBackup();

  const backupContent =
    JSON.stringify(
      backup,
      null,
      2,
    );

  const backupBlob =
    new Blob(
      [backupContent],
      {
        type:
          'application/json',
      },
    );

  const backupUrl =
    URL.createObjectURL(
      backupBlob,
    );

  const date =
    new Date();

  const dateLabel = [
    date.getFullYear(),

    String(
      date.getMonth() + 1,
    ).padStart(2, '0'),

    String(
      date.getDate(),
    ).padStart(2, '0'),
  ].join('-');

  const downloadLink =
    document.createElement(
      'a',
    );

  downloadLink.href =
    backupUrl;

  downloadLink.download =
    `mipeque-backup-${dateLabel}.json`;

  document.body.appendChild(
    downloadLink,
  );

  downloadLink.click();
  downloadLink.remove();

  URL.revokeObjectURL(
    backupUrl,
  );

  return backup;
}

export function importFamilyBackup(
  backupContent,
) {
  let parsedBackup;

  try {
    parsedBackup =
      typeof backupContent ===
      'string'
        ? JSON.parse(
            backupContent,
          )
        : backupContent;
  } catch {
    throw new Error(
      'El archivo seleccionado no contiene un JSON válido.',
    );
  }

  if (
    !parsedBackup ||
    parsedBackup.application !==
      'MiPeque' ||
    !parsedBackup.data ||
    typeof parsedBackup.data !==
      'object' ||
    Array.isArray(
      parsedBackup.data,
    )
  ) {
    throw new Error(
      'El archivo no corresponde a una copia de seguridad válida de MiPeque.',
    );
  }

  const safeData =
    Object.entries(
      parsedBackup.data,
    ).reduce(
      (
        result,
        [storageKey, value],
      ) => {
        if (
          isFamilyDataStorageKey(
            storageKey,
          ) &&
          typeof value ===
            'string'
        ) {
          result[
            storageKey
          ] = value;
        }

        return result;
      },
      {},
    );

  const entries =
    Object.entries(safeData);

  if (
    entries.length === 0
  ) {
    throw new Error(
      'La copia de seguridad no contiene datos familiares para restaurar.',
    );
  }

  replaceCurrentFamilyData(
    safeData,
  );

  persistFamilyChanges();

  syncAllFamilyData().catch(
    (error) => {
      console.error(
        'No se pudo sincronizar la copia restaurada.',
        error,
      );
    },
  );

  return entries.length;
}

export function clearAllFamilyData() {
  const familyId =
    getCurrentFamilyId();

  const deletedCount =
    Object.keys(
      getCurrentFamilyDataSnapshot(),
    ).length;

  clearFamilyDataSnapshot(
    familyId,
  );

  syncAllFamilyData().catch(
    (error) => {
      console.error(
        'No se pudieron eliminar los datos remotos.',
        error,
      );
    },
  );

  return deletedCount;
}