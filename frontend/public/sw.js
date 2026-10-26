const CACHE_NAME = 'mipeque-shell-v4';

const APP_SHELL = [
  '/',
  '/manifest.webmanifest',
  '/favicon.ico',
  '/icons/favicon-16x16.png',
  '/icons/favicon-32x32.png',
  '/icons/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL)),
  );

  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName !== CACHE_NAME,
            )
            .map((cacheName) =>
              caches.delete(cacheName),
            ),
        ),
      ),
  );

  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/'),
      ),
    );

    return;
  }

  const requestUrl = new URL(request.url);

  if (
    requestUrl.origin !==
    self.location.origin
  ) {
    return;
  }

  event.respondWith(
    caches
      .match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then(
          (networkResponse) => {
            if (
              !networkResponse ||
              networkResponse.status !== 200
            ) {
              return networkResponse;
            }

            const responseCopy =
              networkResponse.clone();

            caches
              .open(CACHE_NAME)
              .then((cache) => {
                cache.put(
                  request,
                  responseCopy,
                );
              });

            return networkResponse;
          },
        );
      }),
  );
});

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data
      ? event.data.json()
      : {};
  } catch {
    payload = {
      title: 'MiPeque',
      body: event.data?.text() || '',
    };
  }

  const title =
    payload.title || 'MiPeque';

  const body =
    payload.body ||
    'Tenés una nueva notificación.';

  const url =
    payload.url || '/dashboard/alerts';

  const options = {
    body,
    icon:
      payload.icon ||
      '/icons/icon-192.png',
    badge:
      payload.badge ||
      '/icons/icon-192.png',
    tag:
      payload.tag ||
      `mipeque-${Date.now()}`,

    // Pedimos el comportamiento de una notificación
    // normal del sistema. El navegador y el sistema
    // operativo deciden finalmente sonido, banner y
    // superposición según la configuración del usuario.
    renotify: true,
    silent: false,
    requireInteraction: true,
    vibrate: [250, 120, 250],
    timestamp:
      Number(payload.timestamp) ||
      Date.now(),

    actions: [
      {
        action: 'open',
        title: 'Abrir MiPeque',
      },
    ],

    data: {
      url,
      category:
        payload.category || '',
      referenceId:
        payload.referenceId || '',
    },
  };

  const inAppPayload = {
    id:
      payload.dedupeKey ||
      payload.tag ||
      `push-${Date.now()}`,
    title,
    body,
    url,
    category:
      payload.category || '',
    referenceId:
      payload.referenceId || '',
  };

  const notifyOpenClients =
    self.clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type:
              'MIPEQUE_PUSH_NOTIFICATION',
            payload:
              inAppPayload,
          });
        });
      });

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(
        title,
        options,
      ),
      notifyOpenClients,
    ]),
  );
});

self.addEventListener(
  'notificationclick',
  (event) => {
    event.notification.close();

    const destination =
      event.notification.data?.url ||
      '/dashboard/alerts';

    const absoluteDestination = new URL(
      destination,
      self.location.origin,
    ).href;

    event.waitUntil(
      self.clients
        .matchAll({
          type: 'window',
          includeUncontrolled: true,
        })
        .then(async (clientList) => {
          for (const client of clientList) {
            if (
              'focus' in client &&
              new URL(client.url).origin ===
                self.location.origin
            ) {
              if ('navigate' in client) {
                try {
                  await client.navigate(
                    absoluteDestination,
                  );
                } catch {
                  // Algunos navegadores no permiten
                  // navegar un cliente en este punto.
                }
              }

              return client.focus();
            }
          }

          if (
            self.clients.openWindow
          ) {
            return self.clients.openWindow(
              absoluteDestination,
            );
          }

          return null;
        }),
    );
  },
);
