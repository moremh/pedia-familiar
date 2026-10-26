import {
  isSupabaseConfigured,
  requireSupabase,
} from '../lib/supabaseClient.js';

const CURRENT_FAMILY_STORAGE_KEY =
  'mipeque-current-family-id';

const PUSH_PREFERENCES_STORAGE_KEY =
  'mipeque-push-preferences';

const VAPID_PUBLIC_KEY = String(
  import.meta.env.VITE_VAPID_PUBLIC_KEY || '',
).trim();

export const DEFAULT_PUSH_PREFERENCES = {
  notifyMedicationDue: true,
  notifyMedicationOverdue: true,
  notifyVaccines: true,
  notifyExpirations: true,
  notifyStock: true,
  notifyFollowups: true,
  showDetails: false,
};

function readStoredPreferences() {
  try {
    const rawValue = localStorage.getItem(
      PUSH_PREFERENCES_STORAGE_KEY,
    );

    if (!rawValue) {
      return {
        ...DEFAULT_PUSH_PREFERENCES,
      };
    }

    const parsedValue = JSON.parse(rawValue);

    if (
      !parsedValue ||
      typeof parsedValue !== 'object' ||
      Array.isArray(parsedValue)
    ) {
      return {
        ...DEFAULT_PUSH_PREFERENCES,
      };
    }

    return {
      ...DEFAULT_PUSH_PREFERENCES,
      ...parsedValue,
    };
  } catch {
    return {
      ...DEFAULT_PUSH_PREFERENCES,
    };
  }
}

function saveStoredPreferences(preferences) {
  const normalizedPreferences = {
    ...DEFAULT_PUSH_PREFERENCES,
    ...preferences,
  };

  localStorage.setItem(
    PUSH_PREFERENCES_STORAGE_KEY,
    JSON.stringify(normalizedPreferences),
  );

  return normalizedPreferences;
}

function getCurrentFamilyId() {
  return (
    localStorage.getItem(
      CURRENT_FAMILY_STORAGE_KEY,
    ) || ''
  );
}

function getTimezone() {
  try {
    return (
      Intl.DateTimeFormat()
        .resolvedOptions()
        .timeZone ||
      'America/Argentina/Buenos_Aires'
    );
  } catch {
    return 'America/Argentina/Buenos_Aires';
  }
}

function isIosDevice() {
  if (typeof navigator === 'undefined') {
    return false;
  }

  return /iphone|ipad|ipod/i.test(
    navigator.userAgent || '',
  );
}

function isStandaloneApp() {
  if (typeof window === 'undefined') {
    return false;
  }

  return Boolean(
    window.matchMedia?.(
      '(display-mode: standalone)',
    )?.matches ||
      window.navigator.standalone === true,
  );
}

function applicationServerKeysMatch(
  subscription,
  expectedKey,
) {
  const currentKey =
    subscription?.options
      ?.applicationServerKey;

  if (!currentKey) {
    return false;
  }

  const expected =
    urlBase64ToUint8Array(
      expectedKey,
    );

  const current =
    new Uint8Array(currentKey);

  if (
    current.length !==
    expected.length
  ) {
    return false;
  }

  return current.every(
    (value, index) =>
      value === expected[index],
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat(
    (4 - (base64String.length % 4)) % 4,
  );

  const base64 = (
    base64String + padding
  )
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);

  return Uint8Array.from(
    [...rawData].map((character) =>
      character.charCodeAt(0),
    ),
  );
}

function mapDatabasePreferences(row) {
  if (!row) {
    return readStoredPreferences();
  }

  return {
    notifyMedicationDue:
      row.notify_medication_due ?? true,
    notifyMedicationOverdue:
      row.notify_medication_overdue ?? true,
    notifyVaccines:
      row.notify_vaccines ?? true,
    notifyExpirations:
      row.notify_expirations ?? true,
    notifyStock:
      row.notify_stock ?? true,
    notifyFollowups:
      row.notify_followups ?? true,
    showDetails: row.show_details ?? false,
  };
}

function preferencesToRpc(preferences) {
  const normalizedPreferences = {
    ...DEFAULT_PUSH_PREFERENCES,
    ...preferences,
  };

  return {
    p_notify_medication_due:
      normalizedPreferences.notifyMedicationDue,
    p_notify_medication_overdue:
      normalizedPreferences.notifyMedicationOverdue,
    p_notify_vaccines:
      normalizedPreferences.notifyVaccines,
    p_notify_expirations:
      normalizedPreferences.notifyExpirations,
    p_notify_stock:
      normalizedPreferences.notifyStock,
    p_notify_followups:
      normalizedPreferences.notifyFollowups,
    p_show_details:
      normalizedPreferences.showDetails,
  };
}

async function getServiceWorkerRegistration({
  registerIfMissing = false,
} = {}) {
  if (!('serviceWorker' in navigator)) {
    return null;
  }

  let registration =
    await navigator.serviceWorker.getRegistration(
      '/',
    );

  if (
    !registration &&
    registerIfMissing
  ) {
    registration =
      await navigator.serviceWorker.register(
        '/sw.js',
      );
  }

  if (!registration) {
    return null;
  }

  return navigator.serviceWorker.ready;
}

async function getBrowserSubscription() {
  const registration =
    await getServiceWorkerRegistration();

  if (!registration) {
    return null;
  }

  return registration.pushManager.getSubscription();
}

async function findRemoteSubscription(
  endpoint,
) {
  if (
    !endpoint ||
    !isSupabaseConfigured
  ) {
    return null;
  }

  const client = requireSupabase();

  const { data, error } = await client
    .from('push_subscriptions')
    .select(
      [
        'id',
        'family_id',
        'user_id',
        'endpoint',
        'notify_medication_due',
        'notify_medication_overdue',
        'notify_vaccines',
        'notify_expirations',
        'notify_stock',
        'notify_followups',
        'show_details',
        'is_enabled',
      ].join(', '),
    )
    .eq('endpoint', endpoint)
    .maybeSingle();

  if (error) {
    console.error(
      'No se pudo consultar la suscripción push.',
      error,
    );

    return null;
  }

  return data || null;
}

async function registerRemoteSubscription(
  subscription,
  preferences,
) {
  const familyId = getCurrentFamilyId();

  if (!familyId) {
    throw new Error(
      'No se encontró la familia actual.',
    );
  }

  const subscriptionJson =
    subscription.toJSON();

  const p256dhKey =
    subscriptionJson.keys?.p256dh || '';

  const authKey =
    subscriptionJson.keys?.auth || '';

  if (!p256dhKey || !authKey) {
    throw new Error(
      'El navegador no devolvió las claves necesarias para las notificaciones.',
    );
  }

  const client = requireSupabase();

  const normalizedPreferences =
    saveStoredPreferences(preferences);

  const { data, error } = await client.rpc(
    'register_push_subscription',
    {
      p_family_id: familyId,
      p_endpoint: subscription.endpoint,
      p_p256dh_key: p256dhKey,
      p_auth_key: authKey,
      p_user_agent:
        navigator.userAgent || '',
      p_timezone: getTimezone(),
      ...preferencesToRpc(
        normalizedPreferences,
      ),
    },
  );

  if (error) {
    throw new Error(
      error.message ||
        'No se pudo guardar el dispositivo para recibir notificaciones.',
    );
  }

  return {
    id: data,
    preferences: normalizedPreferences,
  };
}

export function getPushCapability() {
  const secureContext =
    typeof window !== 'undefined' &&
    window.isSecureContext;

  const apiSupported = Boolean(
    typeof window !== 'undefined' &&
      'Notification' in window &&
      'serviceWorker' in navigator &&
      'PushManager' in window,
  );

  const iosNeedsInstall =
    isIosDevice() && !isStandaloneApp();

  return {
    supported:
      secureContext &&
      apiSupported &&
      Boolean(VAPID_PUBLIC_KEY) &&
      !iosNeedsInstall,
    secureContext,
    apiSupported,
    vapidConfigured:
      Boolean(VAPID_PUBLIC_KEY),
    iosNeedsInstall,
    permission:
      typeof Notification !== 'undefined'
        ? Notification.permission
        : 'unsupported',
  };
}

export async function getPushNotificationState() {
  const capability = getPushCapability();

  if (!capability.supported) {
    return {
      ...capability,
      subscribed: false,
      subscriptionId: null,
      preferences:
        readStoredPreferences(),
    };
  }

  const browserSubscription =
    await getBrowserSubscription();

  if (!browserSubscription) {
    return {
      ...capability,
      permission: Notification.permission,
      subscribed: false,
      subscriptionId: null,
      preferences:
        readStoredPreferences(),
    };
  }

  let remoteSubscription =
    await findRemoteSubscription(
      browserSubscription.endpoint,
    );

  let remoteRegistrationError = '';

  if (
    !remoteSubscription &&
    Notification.permission === 'granted'
  ) {
    try {
      await registerRemoteSubscription(
        browserSubscription,
        readStoredPreferences(),
      );

      remoteSubscription =
        await findRemoteSubscription(
          browserSubscription.endpoint,
        );
    } catch (error) {
      remoteRegistrationError =
        error?.message ||
        'No se pudo registrar el dispositivo en MiPeque.';

      console.error(
        'El navegador está suscripto, pero no se pudo reparar el registro remoto.',
        error,
      );
    }
  }

  const preferences =
    mapDatabasePreferences(
      remoteSubscription,
    );

  saveStoredPreferences(preferences);

  return {
    ...capability,
    permission: Notification.permission,
    subscribed: Boolean(
      remoteSubscription?.is_enabled,
    ),
    browserSubscribed: true,
    remoteRegistrationError,
    subscriptionId:
      remoteSubscription?.id || null,
    preferences,
  };
}

export async function enablePushNotifications(
  preferences = DEFAULT_PUSH_PREFERENCES,
) {
  const capability = getPushCapability();

  if (capability.iosNeedsInstall) {
    throw new Error(
      'En iPhone o iPad, agregá MiPeque a la pantalla de inicio y abrila desde su ícono antes de activar las notificaciones.',
    );
  }

  if (!capability.secureContext) {
    throw new Error(
      'Las notificaciones push requieren HTTPS.',
    );
  }

  if (!capability.apiSupported) {
    throw new Error(
      'Este navegador no admite notificaciones push.',
    );
  }

  if (!capability.vapidConfigured) {
    throw new Error(
      'Falta configurar VITE_VAPID_PUBLIC_KEY.',
    );
  }

  const permission =
    Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();

  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'Las notificaciones están bloqueadas en este dispositivo. Habilitalas desde la configuración del navegador o del sistema.'
        : 'No se concedió permiso para mostrar notificaciones.',
    );
  }

  const registration =
    await getServiceWorkerRegistration({
      registerIfMissing: true,
    });

  if (!registration) {
    throw new Error(
      'No se pudo preparar el service worker de MiPeque.',
    );
  }

  let subscription =
    await registration.pushManager.getSubscription();

  if (
    subscription &&
    !applicationServerKeysMatch(
      subscription,
      VAPID_PUBLIC_KEY,
    )
  ) {
    try {
      await subscription.unsubscribe();
    } catch (error) {
      console.error(
        'No se pudo reemplazar una suscripción push anterior.',
        error,
      );
    }

    subscription = null;
  }

  if (!subscription) {
    try {
      subscription =
        await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey:
            urlBase64ToUint8Array(
              VAPID_PUBLIC_KEY,
            ),
        });
    } catch (error) {
      throw new Error(
        error?.message
          ? `No se pudo crear la suscripción push: ${error.message}`
          : 'No se pudo crear la suscripción push en este navegador.',
      );
    }
  }

  const remote =
    await registerRemoteSubscription(
      subscription,
      preferences,
    );

  return {
    subscribed: true,
    subscriptionId: remote.id,
    permission: Notification.permission,
    preferences: remote.preferences,
  };
}

export async function savePushNotificationPreferences(
  preferences,
) {
  const normalizedPreferences =
    saveStoredPreferences(preferences);

  const subscription =
    await getBrowserSubscription();

  if (!subscription) {
    return normalizedPreferences;
  }

  await registerRemoteSubscription(
    subscription,
    normalizedPreferences,
  );

  return normalizedPreferences;
}

export async function disablePushNotifications() {
  const subscription =
    await getBrowserSubscription();

  if (!subscription) {
    return true;
  }

  if (isSupabaseConfigured) {
    try {
      const client = requireSupabase();

      await client.rpc(
        'detach_push_subscription',
        {
          p_endpoint:
            subscription.endpoint,
        },
      );
    } catch (error) {
      console.error(
        'No se pudo quitar la suscripción remota.',
        error,
      );
    }
  }

  try {
    await subscription.unsubscribe();
  } catch (error) {
    console.error(
      'No se pudo cancelar la suscripción del navegador.',
      error,
    );
  }

  return true;
}

export async function detachCurrentPushSubscription() {
  if (!isSupabaseConfigured) {
    return;
  }

  try {
    const subscription =
      await getBrowserSubscription();

    if (!subscription) {
      return;
    }

    const client = requireSupabase();

    await client.rpc(
      'detach_push_subscription',
      {
        p_endpoint:
          subscription.endpoint,
      },
    );
  } catch (error) {
    console.error(
      'No se pudo desvincular el dispositivo de las notificaciones push.',
      error,
    );
  }
}

export async function refreshCurrentPushSubscription() {
  if (
    !isSupabaseConfigured ||
    typeof Notification === 'undefined' ||
    Notification.permission !== 'granted'
  ) {
    return null;
  }

  const subscription =
    await getBrowserSubscription();

  if (!subscription) {
    return null;
  }

  try {
    return await registerRemoteSubscription(
      subscription,
      readStoredPreferences(),
    );
  } catch (error) {
    console.error(
      'No se pudo actualizar la suscripción push del dispositivo.',
      error,
    );

    return null;
  }
}

export async function sendTestPushNotification() {
  const state =
    await getPushNotificationState();

  if (!state.subscribed) {
    throw new Error(
      'Primero activá las notificaciones en este dispositivo.',
    );
  }

  let subscriptionId =
    state.subscriptionId;

  if (!subscriptionId) {
    const refreshed =
      await refreshCurrentPushSubscription();

    subscriptionId =
      refreshed?.id || null;
  }

  if (!subscriptionId) {
    throw new Error(
      'No se encontró el dispositivo registrado.',
    );
  }

  const client = requireSupabase();

  const { data, error } =
    await client.functions.invoke(
      'push-notifications',
      {
        body: {
          mode: 'test',
          subscriptionId,
        },
      },
    );

  if (error) {
    throw new Error(
      error.message ||
        'No se pudo enviar la notificación de prueba.',
    );
  }

  if (!data?.ok) {
    throw new Error(
      data?.message ||
        'No se pudo enviar la notificación de prueba.',
    );
  }

  return data;
}
