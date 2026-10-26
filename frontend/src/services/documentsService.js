import {
  isSupabaseConfigured,
  requireSupabase,
} from '../lib/supabaseClient.js';

import {
  notifyFamilyDataChanged,
} from './supabaseSyncService.js';

const STORAGE_KEY = 'mipeque-medical-documents';

function generateId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `document-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function saveDocuments(documents) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(documents),
    );

    notifyFamilyDataChanged(STORAGE_KEY);
  } catch (error) {
    console.error(
      'No se pudieron guardar los documentos.',
      error,
    );

    throw new Error(
      'No hay espacio suficiente en el navegador. Eliminá algún archivo o seleccioná uno más pequeño.',
    );
  }
}

export function getDocuments() {
  try {
    const storedDocuments =
      localStorage.getItem(STORAGE_KEY);

    if (!storedDocuments) {
      return [];
    }

    const parsedDocuments = JSON.parse(
      storedDocuments,
    );

    if (!Array.isArray(parsedDocuments)) {
      return [];
    }

    return [...parsedDocuments].sort(
      (firstDocument, secondDocument) => {
        const firstDate = new Date(
          `${firstDocument.documentDate || '1970-01-01'}T00:00:00`,
        ).getTime();

        const secondDate = new Date(
          `${secondDocument.documentDate || '1970-01-01'}T00:00:00`,
        ).getTime();

        return secondDate - firstDate;
      },
    );
  } catch (error) {
    console.error(
      'No se pudieron cargar los documentos médicos.',
      error,
    );

    return [];
  }
}

export function getDocumentById(documentId) {
  return (
    getDocuments().find(
      (document) => document.id === documentId,
    ) ?? null
  );
}

export function createDocument(documentData) {
  const documents = getDocuments();
  const now = new Date().toISOString();

  const newDocument = {
    ...documentData,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };

  saveDocuments([...documents, newDocument]);

  return newDocument;
}

export function updateDocument(
  documentId,
  documentData,
) {
  const documents = getDocuments();

  const updatedDocuments = documents.map(
    (document) =>
      document.id === documentId
        ? {
            ...document,
            ...documentData,
            id: document.id,
            updatedAt: new Date().toISOString(),
          }
        : document,
  );

  saveDocuments(updatedDocuments);

  return (
    updatedDocuments.find(
      (document) => document.id === documentId,
    ) ?? null
  );
}

export function deleteDocument(documentId) {
  const documents = getDocuments();

  const updatedDocuments = documents.filter(
    (document) => document.id !== documentId,
  );

  saveDocuments(updatedDocuments);

  return updatedDocuments;
}

export function getDocumentsByChild(childId) {
  return getDocuments().filter(
    (document) => document.childId === childId,
  );
}
export async function refreshDocumentFile(document) {
  const file = document?.file;

  if (!file) {
    return null;
  }

  if (
    !file.storagePath ||
    !isSupabaseConfigured
  ) {
    return file;
  }

  const client = requireSupabase();

  const { data, error } =
    await client.storage
      .from('medical-files')
      .createSignedUrl(
        file.storagePath,
        60 * 60,
      );

  if (error || !data?.signedUrl) {
    throw new Error(
      error?.message ||
        'No se pudo preparar el archivo médico.',
    );
  }

  return {
    ...file,
    dataUrl: data.signedUrl,
  };
}
