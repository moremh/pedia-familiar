const consultationTypeLabels = {
  pediatric: 'Pediatría',
  emergency: 'Guardia',
  specialist: 'Especialista',
  control: 'Control médico',
  telemedicine: 'Teleconsulta',
  other: 'Otra consulta',
};

export function formatConsultationDate(dateValue) {
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

export function formatShortConsultationDate(
  dateValue,
) {
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

export function formatConsultationTime(timeValue) {
  if (!timeValue) {
    return 'Horario no registrado';
  }

  return `${timeValue} hs`;
}

export function getConsultationTypeLabel(type) {
  return (
    consultationTypeLabels[type] ??
    'Consulta médica'
  );
}

export function isConsultationThisMonth(
  consultationDate,
) {
  if (!consultationDate) {
    return false;
  }

  const date = new Date(
    `${consultationDate}T00:00:00`,
  );

  const today = new Date();

  return (
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function hasFutureFollowUp(followUpDate) {
  if (!followUpDate) {
    return false;
  }

  const followUp = new Date(
    `${followUpDate}T23:59:59`,
  );

  return followUp >= new Date();
}