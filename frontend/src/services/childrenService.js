import {
  updateFamilyStatistics,
} from './adminFamiliesService.js';

import {
  saveCurrentFamilyAfterChange,
} from './familyStorageService.js';

import {
  getCurrentFamilyId,
} from './subscriptionService.js';

import {
  notifyFamilyDataChanged,
} from './supabaseSyncService.js';

const STORAGE_KEY =
  'mipeque-children';

function generateId() {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `child-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function synchronizeChildrenCount(
  children,
) {
  const familyId =
    getCurrentFamilyId();

  if (!familyId) {
    return;
  }

  updateFamilyStatistics(
    familyId,
    {
      childrenCount:
        children.length,
    },
  );
}

function persistChildren(children) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(children),
  );

  notifyFamilyDataChanged(STORAGE_KEY);

  const familyId =
    getCurrentFamilyId();

  synchronizeChildrenCount(
    children,
  );

  if (familyId) {
    saveCurrentFamilyAfterChange(
      familyId,
    );
  }

  return children;
}

export function getChildren() {
  try {
    const savedChildren =
      localStorage.getItem(
        STORAGE_KEY,
      );

    if (!savedChildren) {
      return [];
    }

    const parsedChildren =
      JSON.parse(savedChildren);

    const children =
      Array.isArray(
        parsedChildren,
      )
        ? parsedChildren
        : [];

    synchronizeChildrenCount(
      children,
    );

    return children;
  } catch (error) {
    console.error(
      'No se pudieron cargar los perfiles infantiles.',
      error,
    );

    return [];
  }
}

export function getChildById(childId) {
  return (
    getChildren().find(
      (child) =>
        child.id === childId,
    ) ?? null
  );
}

export function createChild(childData) {
  const children =
    getChildren();

  const now =
    new Date().toISOString();

  const newChild = {
    ...childData,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };

  persistChildren([
    ...children,
    newChild,
  ]);

  return newChild;
}

export function updateChild(
  childId,
  childData,
) {
  const children =
    getChildren();

  const updatedChildren =
    children.map((child) =>
      child.id === childId
        ? {
            ...child,
            ...childData,
            id: child.id,
            updatedAt:
              new Date().toISOString(),
          }
        : child,
    );

  persistChildren(
    updatedChildren,
  );

  return (
    updatedChildren.find(
      (child) =>
        child.id === childId,
    ) ?? null
  );
}

export function deleteChild(childId) {
  const children =
    getChildren();

  const updatedChildren =
    children.filter(
      (child) =>
        child.id !== childId,
    );

  persistChildren(
    updatedChildren,
  );

  return updatedChildren;
}
