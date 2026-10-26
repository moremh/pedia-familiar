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

const READY_TIMEOUT_MS = 10000;

const wait = (milliseconds) =>
  new Promise((resolve) =>
    window.setTimeout(resolve, milliseconds),
  );

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
      return { ...DEFAULT_PUSH_PREFERENCES };
    }

    const parsedValue = JSON.parse(rawValue);

    if (
      !parsedValue ||
      typeof parsedValue !== 'object' ||
      Array.isArray(parsedValue)
    ) {
      return { ...DEFAULT_PUSH_PREFERENCES };
    }

    return {
      ...DEFAULT_PUSH_PREFERENCES,
      ...parsedValue,
    };
  } catch {
    return { ...DEFAULT_PUSH_PREFERENCES };
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

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat(
    (4 - (base64String.length % 4)) % 4,
  );

  const base64 = (
    base64String + padding
  )
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData =
    window.atob(base64);

  const outputArray =
    new Uint8Array(rawData.length);

  for (
    let index = 0;
    index < rawData.length;
    index += 1
  ) {
    outputArray[index] =
      rawData.charCodeAt(index);
  }

  return outputArray;
}

function uint8ArrayToBase64Url(value) {
  const bytes =
    value instanceof Uint8Array
      ? value
      : new Uint8Array(value);

  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function getSubscriptionKey(subscription) {
  try {
    const applicationServerKey =
      subscription?.options
        ?.applicationServerKey;

    if (!applicationServerKey) {
      return null;
    }

    return uint8ArrayToBase64Url(
      applicationServerKey,
    );
  } catch {
    return null;
  }
}

async function getServiceWorkerRegistration({
  registerIfMissing = false,
} = {}) {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator)
  ) {
    return {
      success: false,
      registration: null,
      message:
        'Este navegador no admite Service Workers.',
    };
  }

  let registration =
    await navigator.serviceWorker
      .getRegistration();

  if (
    !registration &&
    registerIfMissing
  ) {
    try {
      registration =
        await navigator.serviceWorker
          .register('/sw.js');
    } catch (error) {
      return {
        success: false,
        registration: null,
        message:
          error?.message ||
          'No se pudo registrar el Service Worker de MiPeque.',
        error,
      };
    }
  }

  if (registration) {
    try {
      await registration.update();
    } catch {
      // La suscripción puede continuar usando el SW actual.
    }

    return {
      success: true,
      registration,
    };
  }

  return Promise.race([
    navigator.serviceWorker.ready.then(
      (readyRegistration) => ({
        success: true,
        registration:
          readyRegistration,
      }),
    ),
    wait(READY_TIMEOUT_MS).then(
      () => ({
        success: false,
        registration: null,
        message:
          'El Service Worker todavía no está disponible. Cerrá y volvé a abrir MiPeque e intentá nuevamente.',
      }),
    ),
  ]);
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
    isIosDevice() &&
    !isStandaloneApp();

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

export async function getCurrentPushSubscription() {
  const capability =
    getPushCapability();

  if (!capability.apiSupported) {
    return {
      success: false,
      subscription: null,
      status: 'unsupported',
      message:
        'Este navegador no admite notificaciones Push.',
    };
  }

  const registrationResult =
    await getServiceWorkerRegistration();

  if (!registrationResult.success) {
    return {
      ...registrationResult,
      subscription: null,
      status:
        'service-worker-unavailable',
    };
  }

  const subscription =
    await registrationResult
      .registration
      .pushManager
      .getSubscription();

  return {
    success: true,
    subscription:
      subscription || null,
    registration:
      registrationResult.registration,
  };
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
    showDetails:
      row.show_details ?? false,
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

  const { data, error } =
    await client
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
  const familyId =
    getCurrentFamilyId();

  if (!familyId) {
    throw new Error(
      'No se encontró la familia actual.',
    );
  }

  const serialized =
    subscription.toJSON();

  const endpoint =
    serialized.endpoint ||
    subscription.endpoint ||
    '';

  const p256dhKey =
    serialized.keys?.p256dh || '';

  const authKey =
    serialized.keys?.auth || '';

  if (
    !endpoint ||
    !p256dhKey ||
    !authKey
  ) {
    throw new Error(
      'El navegador no devolvió una suscripción Push completa.',
    );
  }

  const client =
    requireSupabase();

  const normalizedPreferences =
    saveStoredPreferences(preferences);

  const { data, error } =
    await client.rpc(
      'register_push_subscription',
      {
        p_family_id: familyId,
        p_endpoint: endpoint,
        p_p256dh_key: p256dhKey,
        p_auth_key: authKey,
        p_user_agent:
          navigator.userAgent || '',
        p_timezone:
          getTimezone(),
        ...preferencesToRpc(
          normalizedPreferences,
        ),
      },
    );

  if (error) {
    console.error(
      'No se pudo guardar la suscripción Push:',
      error,
    );

    throw new Error(
      error.message ||
        'No se pudo guardar este dispositivo para recibir notificaciones.',
    );
  }

  return {
    id: data,
    preferences:
      normalizedPreferences,
  };
}

async function removeRemoteSubscription(
  endpoint,
) {
  if (
    !endpoint ||
    !isSupabaseConfigured
  ) {
    return true;
  }

  try {
    const client =
      requireSupabase();

    const { error } =
      await client.rpc(
        'detach_push_subscription',
        {
          p_endpoint: endpoint,
        },
      );

    if (error) {
      console.error(
        'No se pudo quitar la suscripción Push de Supabase:',
        error,
      );

      return false;
    }

    return true;
  } catch (error) {
    console.error(
      'No se pudo quitar la suscripción Push de Supabase:',
      error,
    );

    return false;
  }
}

export async function subscribeCurrentDeviceToPush(
  preferences =
    DEFAULT_PUSH_PREFERENCES,
) {
  const capability =
    getPushCapability();

  if (capability.iosNeedsInstall) {
    return {
      success: false,
      status: 'ios-install-required',
      message:
        'En iPhone o iPad, agregá MiPeque a la pantalla de inicio y abrila desde su ícono antes de activar las notificaciones.',
    };
  }

  if (!capability.secureContext) {
    return {
      success: false,
      status: 'insecure',
      message:
        'Las notificaciones Push requieren HTTPS.',
    };
  }

  if (!capability.apiSupported) {
    return {
      success: false,
      status: 'unsupported',
      message:
        'Este navegador no admite notificaciones Push.',
    };
  }

  if (!capability.vapidConfigured) {
    return {
      success: false,
      status: 'missing-key',
      message:
        'Falta configurar VITE_VAPID_PUBLIC_KEY.',
    };
  }

  if (
    Notification.permission !==
    'granted'
  ) {
    return {
      success: false,
      status:
        'permission-required',
      message:
        'Primero tenés que permitir las notificaciones.',
    };
  }

  const registrationResult =
    await getServiceWorkerRegistration({
      registerIfMissing: true,
    });

  if (!registrationResult.success) {
    return {
      ...registrationResult,
      success: false,
      status:
        'service-worker-unavailable',
    };
  }

  const registration =
    registrationResult.registration;

  let subscription =
    await registration
      .pushManager
      .getSubscription();

  if (subscription) {
    const currentKey =
      getSubscriptionKey(
        subscription,
      );

    if (
      currentKey &&
      currentKey !==
        VAPID_PUBLIC_KEY
    ) {
      const oldEndpoint =
        subscription.endpoint;

      await removeRemoteSubscription(
        oldEndpoint,
      );

      try {
        await subscription
          .unsubscribe();
      } catch (error) {
        console.warn(
          'No se pudo eliminar la suscripción Push anterior:',
          error,
        );
      }

      subscription = null;
    }
  }

  if (!subscription) {
    try {
      subscription =
        await registration
          .pushManager
          .subscribe({
            userVisibleOnly: true,
            applicationServerKey:
              urlBase64ToUint8Array(
                VAPID_PUBLIC_KEY,
              ),
          });
    } catch (error) {
      console.error(
        'No se pudo crear la suscripción Push:',
        error,
      );

      return {
        success: false,
        status:
          'subscription-error',
        message:
          error?.message
            ? `No se pudo registrar este navegador: ${error.message}`
            : 'No se pudo registrar este navegador para notificaciones Push.',
        error,
      };
    }
  }

  try {
    const remote =
      await registerRemoteSubscription(
        subscription,
        preferences,
      );

    return {
      success: true,
      status: 'subscribed',
      subscription,
      subscriptionId:
        remote.id,
      preferences:
        remote.preferences,
      message:
        'Este dispositivo quedó registrado para recibir notificaciones Push.',
    };
  } catch (error) {
    return {
      success: false,
      status: 'save-error',
      subscription,
      message:
        error.message ||
        'El navegador quedó suscripto, pero no se pudo guardar el dispositivo en MiPeque.',
      error,
    };
  }
}

export async function requestPushNotificationPermission(
  preferences =
    DEFAULT_PUSH_PREFERENCES,
) {
  const capability =
    getPushCapability();

  if (!capability.apiSupported) {
    return {
      success: false,
      permission:
        'unsupported',
      status:
        'unsupported',
      message:
        'Este navegador no admite notificaciones del sistema.',
    };
  }

  try {
    const permission =
      await Notification
        .requestPermission();

    if (
      permission !==
      'granted'
    ) {
      return {
        success: false,
        permission,
        status:
          permission === 'denied'
            ? 'permission-denied'
            : 'permission-required',
        message:
          permission === 'denied'
            ? 'Las notificaciones están bloqueadas en este dispositivo.'
            : 'No se concedió permiso para mostrar notificaciones.',
      };
    }

    const result =
      await subscribeCurrentDeviceToPush(
        preferences,
      );

    return {
      ...result,
      permission,
    };
  } catch (error) {
    return {
      success: false,
      permission:
        Notification.permission,
      status: 'error',
      message:
        error?.message ||
        'No se pudieron activar las notificaciones.',
      error,
    };
  }
}

export async function getPushNotificationState() {
  const capability =
    getPushCapability();

  if (!capability.supported) {
    return {
      ...capability,
      status:
        !capability.apiSupported
          ? 'unsupported'
          : !capability.vapidConfigured
            ? 'missing-key'
            : capability.iosNeedsInstall
              ? 'ios-install-required'
              : 'unavailable',
      subscribed: false,
      browserSubscribed: false,
      remoteRegistered: false,
      subscriptionId: null,
      preferences:
        readStoredPreferences(),
    };
  }

  if (
    capability.permission ===
    'denied'
  ) {
    return {
      ...capability,
      status:
        'permission-denied',
      subscribed: false,
      browserSubscribed: false,
      remoteRegistered: false,
      subscriptionId: null,
      preferences:
        readStoredPreferences(),
    };
  }

  if (
    capability.permission !==
    'granted'
  ) {
    return {
      ...capability,
      status:
        'permission-required',
      subscribed: false,
      browserSubscribed: false,
      remoteRegistered: false,
      subscriptionId: null,
      preferences:
        readStoredPreferences(),
    };
  }

  const current =
    await getCurrentPushSubscription();

  if (!current.success) {
    return {
      ...capability,
      status:
        current.status || 'error',
      subscribed: false,
      browserSubscribed: false,
      remoteRegistered: false,
      subscriptionId: null,
      preferences:
        readStoredPreferences(),
      remoteRegistrationError:
        current.message || '',
    };
  }

  if (!current.subscription) {
    return {
      ...capability,
      permission:
        Notification.permission,
      status:
        'not-subscribed',
      subscribed: false,
      browserSubscribed: false,
      remoteRegistered: false,
      subscriptionId: null,
      preferences:
        readStoredPreferences(),
    };
  }

  let remoteSubscription =
    await findRemoteSubscription(
      current.subscription.endpoint,
    );

  let remoteRegistrationError = '';

  if (!remoteSubscription) {
    try {
      await registerRemoteSubscription(
        current.subscription,
        readStoredPreferences(),
      );

      remoteSubscription =
        await findRemoteSubscription(
          current.subscription.endpoint,
        );
    } catch (error) {
      remoteRegistrationError =
        error?.message ||
        'No se pudo registrar el dispositivo en MiPeque.';
    }
  }

  const preferences =
    mapDatabasePreferences(
      remoteSubscription,
    );

  saveStoredPreferences(preferences);

  const remoteRegistered =
    Boolean(
      remoteSubscription?.is_enabled,
    );

  return {
    ...capability,
    permission:
      Notification.permission,
    status:
      remoteRegistered
        ? 'subscribed'
        : 'save-error',
    subscribed:
      remoteRegistered,
    browserSubscribed: true,
    remoteRegistered,
    remoteRegistrationError,
    subscriptionId:
      remoteSubscription?.id || null,
    preferences,
  };
}

export async function enablePushNotifications(
  preferences =
    DEFAULT_PUSH_PREFERENCES,
) {
  const result =
    Notification.permission ===
      'granted'
      ? await subscribeCurrentDeviceToPush(
          preferences,
        )
      : await requestPushNotificationPermission(
          preferences,
        );

  if (!result.success) {
    throw new Error(
      result.message ||
        'No se pudieron activar las notificaciones.',
    );
  }

  return result;
}

export async function savePushNotificationPreferences(
  preferences,
) {
  const normalizedPreferences =
    saveStoredPreferences(preferences);

  const current =
    await getCurrentPushSubscription();

  if (
    !current.success ||
    !current.subscription
  ) {
    return normalizedPreferences;
  }

  await registerRemoteSubscription(
    current.subscription,
    normalizedPreferences,
  );

  return normalizedPreferences;
}

export async function disablePushNotifications() {
  const current =
    await getCurrentPushSubscription();

  if (
    !current.success ||
    !current.subscription
  ) {
    return true;
  }

  await removeRemoteSubscription(
    current.subscription.endpoint,
  );

  try {
    await current.subscription
      .unsubscribe();
  } catch (error) {
    console.warn(
      'La suscripción se quitó de MiPeque, pero el navegador no pudo eliminarla localmente:',
      error,
    );
  }

  return true;
}

export async function detachCurrentPushSubscription() {
  const current =
    await getCurrentPushSubscription();

  if (
    !current.success ||
    !current.subscription
  ) {
    return;
  }

  await removeRemoteSubscription(
    current.subscription.endpoint,
  );
}

export async function refreshCurrentPushSubscription() {
  if (
    !isSupabaseConfigured ||
    typeof Notification === 'undefined' ||
    Notification.permission !==
      'granted'
  ) {
    return null;
  }

  const current =
    await getCurrentPushSubscription();

  if (
    !current.success ||
    !current.subscription
  ) {
    return null;
  }

  try {
    return await registerRemoteSubscription(
      current.subscription,
      readStoredPreferences(),
    );
  } catch (error) {
    console.error(
      'No se pudo actualizar la suscripción Push del dispositivo.',
      error,
    );

    return null;
  }
}

export async function showTestSystemNotification() {
  if (
    typeof Notification ===
      'undefined' ||
    Notification.permission !==
      'granted'
  ) {
    return {
      success: false,
      message:
        'Primero tenés que permitir las notificaciones.',
    };
  }

  const registrationResult =
    await getServiceWorkerRegistration({
      registerIfMissing: true,
    });

  if (!registrationResult.success) {
    return registrationResult;
  }

  try {
    await registrationResult
      .registration
      .showNotification(
        'Prueba de MiPeque',
        {
          body:
            'Las notificaciones del sistema están funcionando en este dispositivo.',
          icon:
            '/icons/icon-192.png',
          badge:
            '/icons/icon-192.png',
          tag:
            'mipeque-notification-test',
          renotify: true,
          requireInteraction: true,
          silent: false,
          vibrate: [
            220,
            100,
            220,
            100,
            320,
          ],
          data: {
            url:
              '/dashboard/settings',
          },
        },
      );

    return {
      success: true,
      message:
        'Notificación de prueba enviada al sistema.',
    };
  } catch (error) {
    return {
      success: false,
      message:
        'No se pudo mostrar la notificación del sistema.',
      error,
    };
  }
}

export async function sendTestPushNotification() {
  const state =
    await getPushNotificationState();

  if (
    !state.subscribed ||
    !state.remoteRegistered
  ) {
    throw new Error(
      state.remoteRegistrationError ||
        'Primero registrá este dispositivo para recibir notificaciones.',
    );
  }

  const client =
    requireSupabase();

  const { data, error } =
    await client.functions.invoke(
      'push-notifications',
      {
        body: {
          mode: 'test',
          subscriptionId:
            state.subscriptionId,
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
