export function calculateAge(birthDate) {
  if (!birthDate) {
    return null;
  }

  const birth = new Date(`${birthDate}T00:00:00`);
  const today = new Date();

  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  let age = today.getFullYear() - birth.getFullYear();

  const hasNotHadBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() &&
      today.getDate() < birth.getDate());

  if (hasNotHadBirthday) {
    age -= 1;
  }

  return Math.max(age, 0);
}

export function formatChildAge(birthDate) {
  const age = calculateAge(birthDate);

  if (age === null) {
    return 'Edad no registrada';
  }

  if (age === 0) {
    return 'Menor de 1 año';
  }

  return `${age} ${age === 1 ? 'año' : 'años'}`;
}

export function getInitials(fullName) {
  if (!fullName) {
    return 'PF';
  }

  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}

export function formatDate(dateValue) {
  if (!dateValue) {
    return 'No registrada';
  }

  const date = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return 'No registrada';
  }

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function hasRegisteredAllergies(allergies) {
  if (!allergies) {
    return false;
  }

  const normalizedValue = allergies.trim().toLowerCase();

  return ![
    '',
    'ninguna',
    'ninguno',
    'no',
    'sin alergias',
  ].includes(normalizedValue);
}