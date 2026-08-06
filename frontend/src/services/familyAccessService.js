import {
  getCurrentSession,
  getCurrentUser,
} from './authService.js';

export const FAMILY_ACCESS_LEVELS = {
  FULL: 'full_access',
  MEDICATION_ONLY: 'medication_only',
};

export function getCurrentFamilyAccessLevel() {
  const session = getCurrentSession();
  const user = getCurrentUser();

  if (
    session?.role === 'owner' ||
    session?.role === 'admin'
  ) {
    return FAMILY_ACCESS_LEVELS.FULL;
  }

  return (
    session?.accessLevel ||
    user?.accessLevel ||
    FAMILY_ACCESS_LEVELS.FULL
  );
}

export function hasFullFamilyAccess() {
  return (
    getCurrentFamilyAccessLevel() ===
    FAMILY_ACCESS_LEVELS.FULL
  );
}

export function isMedicationOnlyAccess() {
  return (
    getCurrentFamilyAccessLevel() ===
    FAMILY_ACCESS_LEVELS.MEDICATION_ONLY
  );
}

export function getFamilyHomePath() {
  return isMedicationOnlyAccess()
    ? '/dashboard/reminders'
    : '/dashboard';
}
