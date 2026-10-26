import {
  isSupabaseConfigured,
  requireSupabase,
} from '../lib/supabaseClient.js';

import {
  clearCachedAccount,
  flushPendingRemoteSync,
  initializeSupabaseCache,
  loadCurrentAccountCache,
  STORAGE_KEYS,
} from './supabaseSyncService.js';

function normalizeEmail(email = '') {
  return String(email)
    .trim()
    .toLowerCase();
}

function normalizePhone(phone = '') {
  return String(phone).replace(/\D/g, '');
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email,
  );
}

function readJson(
  storageKey,
  fallback = null,
) {
  try {
    const storedValue =
      localStorage.getItem(storageKey);

    return storedValue
      ? JSON.parse(storedValue)
      : fallback;
  } catch {
    return fallback;
  }
}

function getCachedUsers() {
  const users = readJson(
    STORAGE_KEYS.users,
    [],
  );

  return Array.isArray(users)
    ? users
    : [];
}

function getCachedFamilies() {
  const families = readJson(
    STORAGE_KEYS.adminFamilies,
    [],
  );

  return Array.isArray(families)
    ? families
    : [];
}

function translateAuthError(error) {
  const message = String(
    error?.message || '',
  ).toLowerCase();

  if (
    message.includes(
      'invalid login credentials',
    ) ||
    message.includes(
      'invalid credentials',
    )
  ) {
    return 'El correo o la contraseña son incorrectos.';
  }

  if (
    message.includes(
      'email not confirmed',
    )
  ) {
    return 'Primero confirmá tu correo electrónico y después iniciá sesión.';
  }

  if (
    message.includes(
      'user already registered',
    )
  ) {
    return 'Ya existe una cuenta con ese correo.';
  }

  if (
    message.includes(
      'password should be',
    )
  ) {
    return 'La contraseña no cumple con los requisitos de seguridad.';
  }

  if (
    message.includes('rate limit')
  ) {
    return 'Se hicieron demasiados intentos. Esperá unos minutos y volvé a probar.';
  }

  return (
    error?.message ||
    'Ocurrió un error al procesar la cuenta.'
  );
}

async function createPendingFamilyForUser(
  user,
) {
  const metadata =
    user?.user_metadata || {};

  const familyName = String(
    metadata.family_name || '',
  ).trim();

  const responsibleName = String(
    metadata.full_name ||
      metadata.name ||
      '',
  ).trim();

  const phone = normalizePhone(
    metadata.phone || '',
  );

  if (
    !familyName ||
    !responsibleName ||
    !phone
  ) {
    return null;
  }

  const client = requireSupabase();

  const {
    data,
    error,
  } = await client.rpc(
    'create_family_with_trial',
    {
      p_family_name: familyName,
      p_responsible_name:
        responsibleName,
      p_phone: phone,
    },
  );

  if (error) {
    const normalizedMessage =
      String(
        error.message || '',
      ).toLowerCase();

    if (
      !normalizedMessage.includes(
        'ya pertenece a una familia',
      )
    ) {
      throw new Error(
        error.message ||
          'No se pudo crear la familia.',
      );
    }
  }

  return data;
}

export function getCurrentSession() {
  return readJson(
    STORAGE_KEYS.session,
    null,
  );
}

export function validateCurrentSession() {
  const session =
    getCurrentSession();

  if (!session) {
    return {
      valid: false,
      reason: 'missing-session',
      session: null,
      user: null,
      family: null,
    };
  }

  const user = getCachedUsers().find(
    (storedUser) =>
      storedUser.id === session.userId,
  );

  if (
    !user ||
    user.status !== 'active'
  ) {
    return {
      valid: false,
      reason:
        'invalid-user-session',
      session,
      user: null,
      family: null,
    };
  }

  if (session.role === 'admin') {
    const isValidAdmin =
      user.role === 'admin';

    return {
      valid: isValidAdmin,
      reason: isValidAdmin
        ? ''
        : 'invalid-admin-session',
      session,
      user,
      family: null,
    };
  }

  if (
    !session.familyId ||
    user.familyId !== session.familyId
  ) {
    return {
      valid: false,
      reason: 'missing-family',
      session,
      user: null,
      family: null,
    };
  }

  const family =
    getCachedFamilies().find(
      (storedFamily) =>
        storedFamily.id ===
        session.familyId,
    );

  return {
    valid: Boolean(family),
    reason: family
      ? ''
      : 'invalid-family-session',
    session,
    user: family
      ? user
      : null,
    family: family || null,
  };
}

export function clearInvalidSession() {
  clearCachedAccount();
}

export function getCurrentUser() {
  const session =
    getCurrentSession();

  if (!session) {
    return null;
  }

  return (
    getCachedUsers().find(
      (user) =>
        user.id === session.userId,
    ) || null
  );
}

export function isFamilyAuthenticated() {
  const session =
    getCurrentSession();

  return Boolean(
    session &&
      session.role !== 'admin' &&
      session.familyId,
  );
}

export function isAdminAuthenticated() {
  return (
    getCurrentSession()?.role ===
    'admin'
  );
}

export async function initializeAuthentication() {
  return initializeSupabaseCache();
}

export async function refreshAuthenticatedAccount() {
  const client =
    requireSupabase();

  const {
    data,
    error,
  } = await client.auth.getUser();

  if (
    error ||
    !data?.user
  ) {
    clearCachedAccount();
    return null;
  }

  return loadCurrentAccountCache(
    data.user,
  );
}

export async function loginUser({
  email,
  password,
}) {
  const normalizedEmail =
    normalizeEmail(email);

  const normalizedPassword =
    String(password || '');

  if (
    !normalizedEmail ||
    !normalizedPassword
  ) {
    throw new Error(
      'Ingresá tu correo y contraseña.',
    );
  }

  const client =
    requireSupabase();

  const {
    data,
    error,
  } =
    await client.auth
      .signInWithPassword({
        email: normalizedEmail,
        password:
          normalizedPassword,
      });

  if (
    error ||
    !data?.user
  ) {
    throw new Error(
      translateAuthError(error),
    );
  }

  let context =
    await loadCurrentAccountCache(
      data.user,
    );

  if (context?.missingFamily) {
    await createPendingFamilyForUser(
      data.user,
    );

    context =
      await loadCurrentAccountCache(
        data.user,
      );
  }

  if (!context?.session) {
    await client.auth.signOut({
      scope: 'local',
    });

    clearCachedAccount();

    throw new Error(
      'La cuenta todavía no está vinculada a una familia. Comunicate con administración.',
    );
  }

  return context;
}

export async function registerFamilyAccount({
  familyName,
  responsibleName,
  phone,
  email,
  password,
  confirmPassword,
}) {
  const normalizedFamilyName =
    String(
      familyName || '',
    ).trim();

  const normalizedResponsibleName =
    String(
      responsibleName || '',
    ).trim();

  const normalizedEmail =
    normalizeEmail(email);

  const normalizedPhone =
    normalizePhone(phone);

  const normalizedPassword =
    String(password || '');

  if (
    normalizedFamilyName.length < 2
  ) {
    throw new Error(
      'Ingresá el nombre de la familia.',
    );
  }

  if (
    normalizedResponsibleName.length <
    3
  ) {
    throw new Error(
      'Ingresá el nombre y apellido del responsable.',
    );
  }

  if (
    !validateEmail(
      normalizedEmail,
    )
  ) {
    throw new Error(
      'Ingresá un correo electrónico válido.',
    );
  }

  if (
    normalizedPhone.length < 8
  ) {
    throw new Error(
      'Ingresá un número de teléfono válido.',
    );
  }

  if (
    normalizedPassword.length < 8
  ) {
    throw new Error(
      'La contraseña debe tener al menos 8 caracteres.',
    );
  }

  if (
    normalizedPassword !==
    String(confirmPassword || '')
  ) {
    throw new Error(
      'Las contraseñas no coinciden.',
    );
  }

  const client =
    requireSupabase();

  const {
    data,
    error,
  } = await client.auth.signUp({
    email: normalizedEmail,
    password:
      normalizedPassword,
    options: {
      data: {
        full_name:
          normalizedResponsibleName,
        phone:
          normalizedPhone,
        family_name:
          normalizedFamilyName,
      },
    },
  });

  if (
    error ||
    !data?.user
  ) {
    throw new Error(
      translateAuthError(error),
    );
  }

  if (!data.session) {
    return {
      confirmationRequired: true,
      email: normalizedEmail,
      trialGranted: false,
      session: null,
      user: null,
      family: null,
    };
  }

  const {
    data: familyResult,
    error: familyError,
  } = await client.rpc(
    'create_family_with_trial',
    {
      p_family_name:
        normalizedFamilyName,
      p_responsible_name:
        normalizedResponsibleName,
      p_phone:
        normalizedPhone,
    },
  );

  if (familyError) {
    await client.auth.signOut({
      scope: 'local',
    });

    clearCachedAccount();

    throw new Error(
      familyError.message ||
        'No se pudo crear la familia.',
    );
  }

  const context =
    await loadCurrentAccountCache(
      data.user,
    );

  if (!context?.session) {
    throw new Error(
      'La cuenta se creó, pero no se pudo cargar la familia.',
    );
  }

  return {
    ...context,
    trialGranted: Boolean(
      familyResult?.trialGranted,
    ),
  };
}

export async function requestPasswordReset(
  email,
) {
  const normalizedEmail =
    normalizeEmail(email);

  if (!validateEmail(normalizedEmail)) {
    throw new Error(
      'Ingresá un correo electrónico válido.',
    );
  }

  const client = requireSupabase();

  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/reset-password`
      : undefined;

  const { error } =
    await client.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo,
      },
    );

  if (error) {
    throw new Error(
      translateAuthError(error),
    );
  }

  return true;
}

export async function updateRecoveredPassword({
  password,
  confirmPassword,
}) {
  const normalizedPassword =
    String(password || '');

  if (normalizedPassword.length < 8) {
    throw new Error(
      'La contraseña debe tener al menos 8 caracteres.',
    );
  }

  if (
    normalizedPassword !==
    String(confirmPassword || '')
  ) {
    throw new Error(
      'Las contraseñas no coinciden.',
    );
  }

  const client = requireSupabase();

  const {
    data: sessionData,
    error: sessionError,
  } = await client.auth.getSession();

  if (
    sessionError ||
    !sessionData?.session
  ) {
    throw new Error(
      'El enlace de recuperación venció o no es válido. Solicitá uno nuevo.',
    );
  }

  const { error } =
    await client.auth.updateUser({
      password: normalizedPassword,
    });

  if (error) {
    throw new Error(
      translateAuthError(error),
    );
  }

  clearCachedAccount();

  await client.auth.signOut({
    scope: 'local',
  });

  return true;
}

export async function logoutUser() {
  if (isSupabaseConfigured) {
    try {
      const {
        detachCurrentPushSubscription,
      } = await import(
        './pushNotificationsService.js'
      );

      await detachCurrentPushSubscription();
    } catch (error) {
      console.error(
        'No se pudo desvincular el dispositivo de las notificaciones antes de cerrar sesión.',
        error,
      );
    }

    try {
      await flushPendingRemoteSync();
    } catch (error) {
      console.error(
        'No se pudieron sincronizar los últimos cambios antes de cerrar sesión.',
        error,
      );
    }
  }

  if (!isSupabaseConfigured) {
    clearCachedAccount();
    return;
  }

  const client =
    requireSupabase();

  try {
    const {
      data,
      error: sessionError,
    } =
      await client.auth.getSession();

    clearCachedAccount();

    if (
      sessionError ||
      !data?.session
    ) {
      return;
    }

    const {
      error: signOutError,
    } =
      await client.auth.signOut({
        scope: 'local',
      });

    if (
      signOutError &&
      signOutError.status !== 401 &&
      signOutError.status !== 403
    ) {
      console.error(
        'No se pudo cerrar la sesión remota.',
        signOutError,
      );
    }
  } catch (error) {
    clearCachedAccount();

    console.error(
      'No se pudo cerrar la sesión remota.',
      error,
    );
  }
}

export function getDevelopmentAccounts() {
  return {
    admin: null,
    demoFamily: null,
  };
}