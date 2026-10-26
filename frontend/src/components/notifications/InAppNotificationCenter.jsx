import {
  useEffect,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import '../../styles/in-app-notifications.css';

const MAX_NOTIFICATIONS = 3;

function normalizeNotification(
  payload = {},
) {
  return {
    id:
      payload.id ||
      `${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`,
    title:
      payload.title ||
      'MiPeque',
    body:
      payload.body ||
      'Tenés una nueva notificación.',
    url:
      payload.url ||
      '/dashboard/alerts',
    category:
      payload.category || '',
    referenceId:
      payload.referenceId || '',
  };
}

function InAppNotificationCenter() {
  const navigate =
    useNavigate();

  const [
    notifications,
    setNotifications,
  ] = useState([]);

  useEffect(() => {
    function addNotification(
      payload,
    ) {
      const notification =
        normalizeNotification(
          payload,
        );

      setNotifications(
        (current) => [
          notification,
          ...current.filter(
            (item) =>
              item.id !==
              notification.id,
          ),
        ].slice(
          0,
          MAX_NOTIFICATIONS,
        ),
      );
    }

    function handleServiceWorkerMessage(
      event,
    ) {
      if (
        event.data?.type !==
        'MIPEQUE_PUSH_NOTIFICATION'
      ) {
        return;
      }

      addNotification(
        event.data.payload,
      );
    }

    function handleLocalNotification(
      event,
    ) {
      addNotification(
        event.detail,
      );
    }

    navigator.serviceWorker
      ?.addEventListener(
        'message',
        handleServiceWorkerMessage,
      );

    window.addEventListener(
      'mipeque-in-app-notification',
      handleLocalNotification,
    );

    return () => {
      navigator.serviceWorker
        ?.removeEventListener(
          'message',
          handleServiceWorkerMessage,
        );

      window.removeEventListener(
        'mipeque-in-app-notification',
        handleLocalNotification,
      );
    };
  }, []);

  function dismiss(id) {
    setNotifications(
      (current) =>
        current.filter(
          (item) =>
            item.id !== id,
        ),
    );
  }

  function openNotification(
    notification,
  ) {
    dismiss(notification.id);

    navigate(
      notification.url ||
        '/dashboard/alerts',
    );
  }

  if (
    notifications.length === 0
  ) {
    return null;
  }

  return (
    <aside
      className="in-app-notifications"
      aria-live="assertive"
      aria-label="Notificaciones de MiPeque"
    >
      {notifications.map(
        (notification) => (
          <article
            key={notification.id}
            className="in-app-notification"
          >
            <span className="in-app-notification__icon">
              <i className="bi bi-bell-fill" />
            </span>

            <div className="in-app-notification__content">
              <strong>
                {notification.title}
              </strong>

              <p>
                {notification.body}
              </p>

              <button
                type="button"
                onClick={() =>
                  openNotification(
                    notification,
                  )
                }
              >
                Ver en MiPeque
              </button>
            </div>

            <button
              type="button"
              className="in-app-notification__close"
              onClick={() =>
                dismiss(
                  notification.id,
                )
              }
              aria-label="Cerrar notificación"
            >
              <i className="bi bi-x-lg" />
            </button>
          </article>
        ),
      )}
    </aside>
  );
}

export default InAppNotificationCenter;
