const relationshipLabels = {
  mother: 'Madre',
  father: 'Padre',
  tutor: 'Tutor/a',
  grandparent: 'Abuelo/a',
  sibling: 'Hermano/a',
  babysitter: 'Cuidador/a',
  other: 'Otro responsable',
};

const relationshipIcons = {
  mother: 'bi-person-heart',
  father: 'bi-person-heart',
  tutor: 'bi-person-badge',
  grandparent: 'bi-people',
  sibling: 'bi-person-arms-up',
  babysitter: 'bi-person-check',
  other: 'bi-person',
};

export function getRelationshipLabel(
  relationship,
) {
  return (
    relationshipLabels[relationship] ??
    'Responsable familiar'
  );
}

export function getRelationshipIcon(
  relationship,
) {
  return (
    relationshipIcons[relationship] ??
    'bi-person'
  );
}

export function formatCaregiverDateTime(
  dateValue,
) {
  if (!dateValue) {
    return 'Sin actividad registrada';
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return 'Sin actividad registrada';
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

export function getCaregiverHistoryStats(
  caregiverId,
  reminderRecords,
) {
  const caregiverRecords = reminderRecords
    .filter(
      (record) =>
        record.responsibleId === caregiverId,
    )
    .sort((firstRecord, secondRecord) => {
      const firstDate = new Date(
        firstRecord.completedAt ??
          firstRecord.updatedAt ??
          0,
      ).getTime();

      const secondDate = new Date(
        secondRecord.completedAt ??
          secondRecord.updatedAt ??
          0,
      ).getTime();

      return secondDate - firstDate;
    });

  const administered = caregiverRecords.filter(
    (record) =>
      record.status === 'administered',
  ).length;

  const omitted = caregiverRecords.filter(
    (record) => record.status === 'omitted',
  ).length;

  return {
    total: caregiverRecords.length,
    administered,
    omitted,
    lastAction:
      caregiverRecords[0]?.completedAt ??
      caregiverRecords[0]?.updatedAt ??
      null,
    records: caregiverRecords,
  };
}