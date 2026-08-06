const FAMILY_DATA_PREFIX =
  'mipeque-';

const FAMILY_BUCKET_PREFIX =
  'mipeque-family-bucket::';

const GLOBAL_STORAGE_KEYS = new Set([
  'mipeque-admin-families',
  'mipeque-admin-payments',
  'mipeque-auth-users',
  'mipeque-auth-session',
  'mipeque-trial-usage',
  'mipeque-current-family-id',
]);

const GLOBAL_STORAGE_PREFIXES = [
  'mipeque-admin-',
  'mipeque-auth-',
  FAMILY_BUCKET_PREFIX,
];

function getFamilyBucketKey(familyId) {
  return `${FAMILY_BUCKET_PREFIX}${familyId}`;
}

export function isFamilyDataStorageKey(
  storageKey,
) {
  if (
    !storageKey ||
    !storageKey.startsWith(
      FAMILY_DATA_PREFIX,
    )
  ) {
    return false;
  }

  if (
    GLOBAL_STORAGE_KEYS.has(storageKey)
  ) {
    return false;
  }

  return !GLOBAL_STORAGE_PREFIXES.some(
    (prefix) =>
      storageKey.startsWith(prefix),
  );
}

function normalizeSnapshot(
  snapshot = {},
) {
  if (
    !snapshot ||
    typeof snapshot !== 'object' ||
    Array.isArray(snapshot)
  ) {
    return {};
  }

  return Object.entries(snapshot).reduce(
    (
      normalizedSnapshot,
      [storageKey, value],
    ) => {
      if (
        !isFamilyDataStorageKey(
          storageKey,
        )
      ) {
        return normalizedSnapshot;
      }

      normalizedSnapshot[storageKey] =
        typeof value === 'string'
          ? value
          : JSON.stringify(value);

      return normalizedSnapshot;
    },
    {},
  );
}

export function getCurrentFamilyDataSnapshot() {
  const snapshot = {};

  for (
    let index = 0;
    index < localStorage.length;
    index += 1
  ) {
    const storageKey =
      localStorage.key(index);

    if (
      !isFamilyDataStorageKey(
        storageKey,
      )
    ) {
      continue;
    }

    const value =
      localStorage.getItem(storageKey);

    if (typeof value === 'string') {
      snapshot[storageKey] = value;
    }
  }

  return snapshot;
}

export function clearActiveFamilyStorage() {
  const keysToDelete = [];

  for (
    let index = 0;
    index < localStorage.length;
    index += 1
  ) {
    const storageKey =
      localStorage.key(index);

    if (
      isFamilyDataStorageKey(
        storageKey,
      )
    ) {
      keysToDelete.push(storageKey);
    }
  }

  keysToDelete.forEach((storageKey) => {
    localStorage.removeItem(storageKey);
  });

  return keysToDelete.length;
}

export function replaceCurrentFamilyData(
  snapshot,
) {
  const normalizedSnapshot =
    normalizeSnapshot(snapshot);

  clearActiveFamilyStorage();

  Object.entries(
    normalizedSnapshot,
  ).forEach(([storageKey, value]) => {
    localStorage.setItem(
      storageKey,
      value,
    );
  });

  return Object.keys(
    normalizedSnapshot,
  ).length;
}

export function saveFamilyDataSnapshot(
  familyId,
) {
  if (!familyId) {
    return {};
  }

  const snapshot =
    getCurrentFamilyDataSnapshot();

  localStorage.setItem(
    getFamilyBucketKey(familyId),
    JSON.stringify(snapshot),
  );

  return snapshot;
}

export function loadFamilyDataSnapshot(
  familyId,
  initialData = {},
) {
  if (!familyId) {
    clearActiveFamilyStorage();

    return {};
  }

  let snapshot = null;

  try {
    const storedSnapshot =
      localStorage.getItem(
        getFamilyBucketKey(familyId),
      );

    if (storedSnapshot) {
      const parsedSnapshot =
        JSON.parse(storedSnapshot);

      snapshot =
        normalizeSnapshot(
          parsedSnapshot,
        );
    }
  } catch (error) {
    console.error(
      'No se pudieron cargar los datos de la familia.',
      error,
    );
  }

  if (snapshot === null) {
    snapshot =
      normalizeSnapshot(initialData);
  }

  localStorage.setItem(
    getFamilyBucketKey(familyId),
    JSON.stringify(snapshot),
  );

  replaceCurrentFamilyData(snapshot);

  return snapshot;
}

export function clearFamilyDataSnapshot(
  familyId,
) {
  clearActiveFamilyStorage();

  if (familyId) {
    localStorage.setItem(
      getFamilyBucketKey(familyId),
      JSON.stringify({}),
    );
  }

  return {};
}

export function saveCurrentFamilyAfterChange(
  familyId,
) {
  if (!familyId) {
    return {};
  }

  return saveFamilyDataSnapshot(
    familyId,
  );
}
