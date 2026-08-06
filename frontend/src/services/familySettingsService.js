import {
  clearFamilyDataSnapshot,
  getCurrentFamilyDataSnapshot,
  isFamilyDataStorageKey,
  saveFamilyDataSnapshot,
} from './familyStorageService.js';

import {
  getCurrentFamilyId,
} from './subscriptionService.js';

import {
  flushPendingRemoteSync,
  forceSyncAllFamilyData,
  loadCurrentAccountCache,
  notifyFamilyDataChanged,
} from './supabaseSyncService.js';

import {
  requireSupabase,
} from '../lib/supabaseClient.js';

const SETTINGS_STORAGE_KEY =
  'mipeque-settings';

const BACKUP_STORAGE_KEYS = new Set([
  'mipeque-settings',
  'mipeque-children',
  'mipeque-consultations',
  'mipeque-treatments',
  'mipeque-reminder-records',
  'mipeque-vaccines',
  'mipeque-medical-documents',
  'mipeque-medicine-cabinet',
]);

const DOCUMENTS_STORAGE_KEY =
  'mipeque-medical-documents';

const VACCINES_STORAGE_KEY =
  'mipeque-vaccines';

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

function parseStoredValue(
  value,
  fallback,
) {
  try {
    if (typeof value !== 'string') {
      return fallback;
    }

    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function getBackupSnapshot() {
  const currentSnapshot =
    getCurrentFamilyDataSnapshot();

  return Object.entries(
    currentSnapshot,
  ).reduce(
    (
      result,
      [storageKey, value],
    ) => {
      if (
        BACKUP_STORAGE_KEYS.has(
          storageKey,
        ) &&
        typeof value === 'string'
      ) {
        result[storageKey] =
          value;
      }

      return result;
    },
    {},
  );
}

function getSnapshotCount(
  snapshot,
  storageKey,
) {
  const value =
    parseStoredValue(
      snapshot[storageKey],
      [],
    );

  return Array.isArray(value)
    ? value.length
    : 0;
}

function createBackupSummary(
  snapshot,
) {
  const settings =
    parseStoredValue(
      snapshot[
        SETTINGS_STORAGE_KEY
      ],
      DEFAULT_FAMILY_SETTINGS,
    );

  return {
    familyName:
      settings.familyName ||
      'Mi familia',
    children:
      getSnapshotCount(
        snapshot,
        'mipeque-children',
      ),
    consultations:
      getSnapshotCount(
        snapshot,
        'mipeque-consultations',
      ),
    treatments:
      getSnapshotCount(
        snapshot,
        'mipeque-treatments',
      ),
    reminders:
      getSnapshotCount(
        snapshot,
        'mipeque-reminder-records',
      ),
    vaccines:
      getSnapshotCount(
        snapshot,
        VACCINES_STORAGE_KEY,
      ),
    documents:
      getSnapshotCount(
        snapshot,
        DOCUMENTS_STORAGE_KEY,
      ),
    medicineCabinet:
      getSnapshotCount(
        snapshot,
        'mipeque-medicine-cabinet',
      ),
  };
}

function blobToDataUrl(blob) {
  return new Promise(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.onload = () =>
        resolve(reader.result);

      reader.onerror = () =>
        reject(
          new Error(
            'No se pudo preparar uno de los archivos médicos para la copia de seguridad.',
          ),
        );

      reader.readAsDataURL(blob);
    },
  );
}

async function downloadStoredFile(
  client,
  file,
) {
  if (!file) {
    return null;
  }

  if (
    String(
      file.dataUrl || '',
    ).startsWith('data:')
  ) {
    return file;
  }

  let blob = null;

  if (file.storagePath) {
    const {
      data,
      error,
    } = await client.storage
      .from('medical-files')
      .download(
        file.storagePath,
      );

    if (error) {
      throw new Error(
        error.message ||
          `No se pudo incluir el archivo ${file.name || 'médico'} en la copia de seguridad.`,
      );
    }

    blob = data;
  } else if (file.dataUrl) {
    const response = await fetch(
      file.dataUrl,
    );

    if (!response.ok) {
      throw new Error(
        `No se pudo incluir el archivo ${file.name || 'médico'} en la copia de seguridad.`,
      );
    }

    blob = await response.blob();
  }

  if (!blob) {
    return {
      ...file,
      dataUrl: '',
    };
  }

  return {
    ...file,
    name:
      file.name ||
      'Archivo médico',
    type:
      file.type ||
      blob.type ||
      'application/octet-stream',
    size:
      Number(
        file.size ||
          blob.size ||
          0,
      ),
    dataUrl:
      await blobToDataUrl(blob),
  };
}

async function includeMedicalFiles(
  snapshot,
) {
  const client =
    requireSupabase();

  const documents =
    parseStoredValue(
      snapshot[
        DOCUMENTS_STORAGE_KEY
      ],
      [],
    );

  const vaccines =
    parseStoredValue(
      snapshot[
        VACCINES_STORAGE_KEY
      ],
      [],
    );

  const preparedDocuments =
    [];

  for (const document of documents) {
    preparedDocuments.push({
      ...document,
      file:
        await downloadStoredFile(
          client,
          document.file,
        ),
    });
  }

  const preparedVaccines = [];

  for (const vaccine of vaccines) {
    preparedVaccines.push({
      ...vaccine,
      proofFile:
        await downloadStoredFile(
          client,
          vaccine.proofFile,
        ),
    });
  }

  return {
    ...snapshot,
    [DOCUMENTS_STORAGE_KEY]:
      JSON.stringify(
        preparedDocuments,
      ),
    [VACCINES_STORAGE_KEY]:
      JSON.stringify(
        preparedVaccines,
      ),
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function createBackupHtml(backup) {
  const summary =
    backup.summary || {};

  const safeBackupText =
    escapeHtml(
      JSON.stringify(backup),
    );

  const exportedDate =
    new Date(
      backup.exportedAt,
    ).toLocaleString('es-AR');

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Copia de seguridad de MiPeque</title>
  <style>
    body {
      margin: 0;
      padding: 32px 18px;
      background: #eef5f7;
      color: #17324d;
      font-family: Arial, sans-serif;
    }

    main {
      width: min(760px, 100%);
      margin: 0 auto;
      padding: 32px;
      border: 1px solid #d7e3e8;
      border-radius: 24px;
      background: #ffffff;
      box-sizing: border-box;
      box-shadow: 0 18px 50px rgba(23, 50, 77, 0.08);
    }

    h1 {
      margin: 0 0 8px;
      font-size: 30px;
    }

    p {
      line-height: 1.6;
      color: #61758a;
    }

    .notice {
      margin: 24px 0;
      padding: 16px;
      border-radius: 14px;
      background: #eaf7f8;
      color: #286a78;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-top: 24px;
    }

    article {
      padding: 16px;
      border: 1px solid #dce7eb;
      border-radius: 14px;
    }

    article strong {
      display: block;
      margin-bottom: 5px;
      font-size: 24px;
    }

    article span {
      color: #6c7f91;
    }

    small {
      display: block;
      margin-top: 26px;
      color: #7d8c99;
    }
  </style>
</head>
<body>
  <main>
    <h1>Copia de seguridad de MiPeque</h1>
    <p><strong>Familia:</strong> ${escapeHtml(summary.familyName || 'Mi familia')}</p>
    <p><strong>Creada:</strong> ${escapeHtml(exportedDate)}</p>

    <div class="notice">
      Guardá este archivo sin modificarlo. Para recuperar la información, seleccioná este mismo archivo desde MiPeque → Configuración → Restaurar información.
    </div>

    <div class="grid">
      <article><strong>${Number(summary.children || 0)}</strong><span>Hijos</span></article>
      <article><strong>${Number(summary.consultations || 0)}</strong><span>Consultas</span></article>
      <article><strong>${Number(summary.treatments || 0)}</strong><span>Tratamientos</span></article>
      <article><strong>${Number(summary.reminders || 0)}</strong><span>Acciones de tomas</span></article>
      <article><strong>${Number(summary.vaccines || 0)}</strong><span>Vacunas</span></article>
      <article><strong>${Number(summary.documents || 0)}</strong><span>Documentos</span></article>
      <article><strong>${Number(summary.medicineCabinet || 0)}</strong><span>Medicamentos</span></article>
    </div>

    <small>
      La cuenta, la suscripción y los responsables con acceso al sistema no forman parte de la restauración y se conservan en MiPeque.
    </small>
  </main>

  <textarea id="mipeque-backup" hidden>${safeBackupText}</textarea>
</body>
</html>`;
}

function parseBackupContent(
  backupContent,
) {
  if (
    backupContent &&
    typeof backupContent ===
      'object'
  ) {
    return backupContent;
  }

  const text =
    String(
      backupContent || '',
    ).trim();

  if (!text) {
    throw new Error(
      'El archivo seleccionado está vacío.',
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    // Puede ser una copia visual en formato HTML.
  }

  let jsonContent = '';

  try {
    const documentResult =
      new DOMParser().parseFromString(
        text,
        'text/html',
      );

    const backupElement =
      documentResult.getElementById(
        'mipeque-backup',
      );

    if (backupElement) {
      jsonContent =
        backupElement.tagName ===
        'TEXTAREA'
          ? backupElement.value
          : backupElement.textContent || '';
    }
  } catch {
    jsonContent = '';
  }

  if (!jsonContent.trim()) {
    const oldHtmlMatch = text.match(
      /<script[^>]*id=["']mipeque-backup["'][^>]*>([\s\S]*?)<\/script>/i,
    );

    jsonContent =
      oldHtmlMatch?.[1] || '';
  }

  try {
    return JSON.parse(
      jsonContent.trim(),
    );
  } catch {
    throw new Error(
      'El archivo no corresponde a una copia de seguridad válida de MiPeque.',
    );
  }
}

function replaceBackupData(
  safeData,
) {
  BACKUP_STORAGE_KEYS.forEach(
    (storageKey) => {
      localStorage.removeItem(
        storageKey,
      );
    },
  );

  Object.entries(
    safeData,
  ).forEach(
    ([storageKey, value]) => {
      localStorage.setItem(
        storageKey,
        value,
      );
    },
  );

  persistFamilyChanges();
}

async function refreshCurrentAccountCache() {
  const client =
    requireSupabase();

  const {
    data: { user },
    error,
  } = await client.auth.getUser();

  if (error || !user) {
    throw new Error(
      'La sesión terminó. Volvé a iniciar sesión.',
    );
  }

  await loadCurrentAccountCache(
    user,
  );
}

async function getFamilyStoragePaths(
  client,
  familyId,
) {
  const [
    documentsResult,
    vaccinesResult,
  ] = await Promise.all([
    client
      .from('medical_documents')
      .select('storage_path')
      .eq('family_id', familyId),

    client
      .from('vaccines')
      .select('proof_storage_path')
      .eq('family_id', familyId),
  ]);

  if (documentsResult.error) {
    throw new Error(
      documentsResult.error.message ||
        'No se pudieron revisar los documentos médicos.',
    );
  }

  if (vaccinesResult.error) {
    throw new Error(
      vaccinesResult.error.message ||
        'No se pudieron revisar los comprobantes de vacunas.',
    );
  }

  return [
    ...(documentsResult.data || []).map(
      (item) => item.storage_path,
    ),
    ...(vaccinesResult.data || []).map(
      (item) =>
        item.proof_storage_path,
    ),
  ].filter(Boolean);
}

async function removeFamilyStorageFiles(
  client,
  paths,
) {
  for (
    let index = 0;
    index < paths.length;
    index += 100
  ) {
    const pathGroup =
      paths.slice(
        index,
        index + 100,
      );

    const { error } =
      await client.storage
        .from('medical-files')
        .remove(pathGroup);

    if (error) {
      throw new Error(
        error.message ||
          'Los datos fueron eliminados, pero no se pudieron quitar algunos archivos médicos almacenados.',
      );
    }
  }

  return paths.length;
}

async function verifyRestoredFamilyData(
  client,
  familyId,
  safeData,
) {
  const checks = [
    ['mipeque-children', 'children', 'hijos'],
    ['mipeque-consultations', 'consultations', 'consultas'],
    ['mipeque-treatments', 'treatments', 'tratamientos'],
    ['mipeque-reminder-records', 'reminder_records', 'tomas'],
    ['mipeque-vaccines', 'vaccines', 'vacunas'],
    ['mipeque-medical-documents', 'medical_documents', 'documentos'],
    ['mipeque-medicine-cabinet', 'medicine_cabinet_items', 'medicamentos'],
  ];

  const differences = [];

  for (const [storageKey, tableName, label] of checks) {
    const localItems =
      parseStoredValue(
        safeData[storageKey],
        [],
      );

    const expectedCount =
      Array.isArray(localItems)
        ? localItems.length
        : 0;

    const {
      count,
      error,
    } = await client
      .from(tableName)
      .select('id', {
        count: 'exact',
        head: true,
      })
      .eq('family_id', familyId);

    if (error) {
      throw new Error(
        error.message ||
          `No se pudo comprobar la restauración de ${label}.`,
      );
    }

    if (Number(count || 0) !== expectedCount) {
      differences.push(label);
    }
  }

  if (differences.length > 0) {
    throw new Error(
      `La copia se leyó, pero no se terminaron de restaurar: ${differences.join(', ')}. Volvé a intentar sin cerrar esta página.`,
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

  notifyFamilyDataChanged(
    SETTINGS_STORAGE_KEY,
  );

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

  notifyFamilyDataChanged(
    SETTINGS_STORAGE_KEY,
  );

  persistFamilyChanges();

  return resetSettings;
}

export async function createFamilyBackup() {
  await flushPendingRemoteSync();

  const initialSnapshot =
    getBackupSnapshot();

  const snapshot =
    await includeMedicalFiles(
      initialSnapshot,
    );

  return {
    application: 'MiPeque',
    backupVersion: 3,
    exportedAt:
      new Date().toISOString(),
    summary:
      createBackupSummary(
        snapshot,
      ),
    data: snapshot,
  };
}

export async function downloadFamilyBackup() {
  const backup =
    await createFamilyBackup();

  const backupContent =
    createBackupHtml(backup);

  const backupBlob =
    new Blob(
      [backupContent],
      {
        type:
          'text/html;charset=utf-8',
      },
    );

  const backupUrl =
    URL.createObjectURL(
      backupBlob,
    );

  const date = new Date();

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
    document.createElement('a');

  downloadLink.href =
    backupUrl;

  downloadLink.download =
    `respaldo-mipeque-${dateLabel}.html`;

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

export async function importFamilyBackup(
  backupContent,
) {
  const parsedBackup =
    parseBackupContent(
      backupContent,
    );

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
          BACKUP_STORAGE_KEYS.has(
            storageKey,
          ) &&
          typeof value ===
            'string'
        ) {
          result[storageKey] =
            value;
        }

        return result;
      },
      {},
    );

  const entries =
    Object.entries(safeData);

  if (entries.length === 0) {
    throw new Error(
      'La copia de seguridad no contiene datos familiares para restaurar.',
    );
  }

  const familyId =
    getCurrentFamilyId();

  if (!familyId) {
    throw new Error(
      'No se encontró la familia activa.',
    );
  }

  await flushPendingRemoteSync();

  const client =
    requireSupabase();

  const previousStoragePaths =
    await getFamilyStoragePaths(
      client,
      familyId,
    );

  const {
    error: clearError,
  } = await client.rpc(
    'clear_family_data',
    {
      p_family_id: familyId,
    },
  );

  if (clearError) {
    throw new Error(
      clearError.message ||
        'No se pudo preparar la familia para restaurar la copia.',
    );
  }

  try {
    await removeFamilyStorageFiles(
      client,
      previousStoragePaths,
    );
  } catch (cleanupError) {
    console.warn(
      'No se pudieron eliminar algunos archivos anteriores antes de restaurar.',
      cleanupError,
    );
  }

  replaceBackupData(
    safeData,
  );

  try {
    await forceSyncAllFamilyData();
  } catch (syncError) {
    persistFamilyChanges();

    throw new Error(
      syncError.message ||
        'La copia se leyó correctamente, pero no se pudo guardar en Supabase.',
    );
  }

  await verifyRestoredFamilyData(
    client,
    familyId,
    safeData,
  );

  await refreshCurrentAccountCache();

  return entries.length;
}

export async function clearAllFamilyData() {
  const familyId =
    getCurrentFamilyId();

  if (!familyId) {
    throw new Error(
      'No se encontró la familia activa.',
    );
  }

  await flushPendingRemoteSync();

  const client =
    requireSupabase();

  const storagePaths =
    await getFamilyStoragePaths(
      client,
      familyId,
    );

  const {
    data,
    error,
  } = await client.rpc(
    'clear_family_data',
    {
      p_family_id: familyId,
    },
  );

  if (error) {
    throw new Error(
      error.message ||
        'No se pudieron eliminar los datos familiares.',
    );
  }

  let removedFiles = 0;
  let fileCleanupWarning = '';

  try {
    removedFiles =
      await removeFamilyStorageFiles(
        client,
        storagePaths,
      );
  } catch (cleanupError) {
    fileCleanupWarning =
      cleanupError.message ||
      'Quedaron algunos archivos pendientes de limpieza.';

    console.error(
      'No se pudieron eliminar todos los archivos médicos.',
      cleanupError,
    );
  }

  clearFamilyDataSnapshot(
    familyId,
  );

  await refreshCurrentAccountCache();

  return {
    ...(data || {}),
    removedFiles,
    fileCleanupWarning,
  };
}
