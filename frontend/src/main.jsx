import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './styles/global.css';

import App from './App.jsx';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error(
    'No se encontró el elemento raíz de la aplicación.',
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

if (
  'serviceWorker' in navigator &&
  import.meta.env.PROD
) {
  const UPDATE_INTERVAL_MS =
    60 * 60 * 1000;

  window.addEventListener('load', async () => {
    try {
      const registration =
        await navigator.serviceWorker
          .register('/sw.js');

      const checkForUpdates =
        async () => {
          if (!navigator.onLine) {
            return;
          }

          try {
            await registration.update();
          } catch (error) {
            console.warn(
              'MiPeque no pudo comprobar si existe una actualización del Service Worker.',
              error,
            );
          }
        };

      await checkForUpdates();

      window.setInterval(
        checkForUpdates,
        UPDATE_INTERVAL_MS,
      );

      window.addEventListener(
        'online',
        checkForUpdates,
      );

      document.addEventListener(
        'visibilitychange',
        () => {
          if (
            document.visibilityState ===
            'visible'
          ) {
            void checkForUpdates();
          }
        },
      );
    } catch (error) {
      console.error(
        'No se pudo registrar el Service Worker de MiPeque.',
        error,
      );
    }
  });
}
