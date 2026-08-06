export const MAX_DOCUMENT_FILE_SIZE =
  2 * 1024 * 1024;

export const ACCEPTED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
];

const documentTypeLabels = {
  prescription: 'Receta médica',
  study: 'Estudio médico',
  certificate: 'Certificado',
  indication: 'Indicación médica',
  vaccination: 'Certificado de vacunación',
  laboratory: 'Análisis de laboratorio',
  other: 'Otro documento',
};

const documentTypeIcons = {
  prescription: 'bi-prescription2',
  study: 'bi-file-medical',
  certificate: 'bi-file-earmark-check',
  indication: 'bi-clipboard2-pulse',
  vaccination: 'bi-shield-check',
  laboratory: 'bi-droplet',
  other: 'bi-file-earmark-text',
};

export function getDocumentTypeLabel(type) {
  return (
    documentTypeLabels[type] ??
    'Documento médico'
  );
}

export function getDocumentTypeIcon(type) {
  return (
    documentTypeIcons[type] ??
    'bi-file-earmark-medical'
  );
}

export function formatDocumentDate(dateValue) {
  if (!dateValue) {
    return 'Fecha no registrada';
  }

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return 'Fecha no registrada';
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function formatShortDocumentDate(dateValue) {
  if (!dateValue) {
    return 'Sin fecha';
  }

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatFileSize(size) {
  const numericSize = Number(size);

  if (
    !numericSize ||
    Number.isNaN(numericSize)
  ) {
    return 'Tamaño desconocido';
  }

  if (numericSize < 1024) {
    return `${numericSize} B`;
  }

  if (numericSize < 1024 * 1024) {
    return `${(numericSize / 1024).toFixed(
      1,
    )} KB`;
  }

  return `${(
    numericSize /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

export function validateMedicalFile(file) {
  if (!file) {
    return '';
  }

  if (
    !ACCEPTED_DOCUMENT_TYPES.includes(file.type)
  ) {
    return 'El archivo debe ser PDF, JPG, PNG o WEBP.';
  }

  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    return 'El archivo no puede superar los 2 MB.';
  }

  return '';
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(
        new Error(
          'No se pudo leer el archivo seleccionado.',
        ),
      );
    };

    reader.readAsDataURL(file);
  });
}

export async function createStoredFile(file) {
  const dataUrl = await readFileAsDataUrl(file);

  return {
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
    dataUrl,
  };
}

export function isImageFile(file) {
  return Boolean(
    file?.type?.startsWith('image/'),
  );
}

export function isPdfFile(file) {
  return file?.type === 'application/pdf';
}