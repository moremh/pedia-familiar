import {
  useEffect,
  useState,
} from 'react';

import AppRoutes from './routes/AppRoutes.jsx';

import {
  initializeAuthentication,
} from './services/authService.js';

import './styles/app-fixes.css';

function AppLoadingScreen({ message = 'Cargando MiPeque...' }) {
  return (
    <main className="min-vh-100 d-flex align-items-center justify-content-center bg-light px-3">
      <section className="text-center">
        <div
          className="spinner-border text-primary mb-3"
          role="status"
          aria-label="Cargando"
        />

        <p className="mb-0 text-secondary">
          {message}
        </p>
      </section>
    </main>
  );
}

function App() {
  const [isReady, setIsReady] = useState(false);
  const [startupError, setStartupError] = useState('');

  useEffect(() => {
    let isMounted = true;

    initializeAuthentication()
      .catch((error) => {
        console.error(
          'No se pudo iniciar la conexión con Supabase.',
          error,
        );

        if (isMounted) {
          setStartupError(
            error.message ||
              'No se pudo conectar con MiPeque.',
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsReady(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (!isReady) {
    return <AppLoadingScreen />;
  }

  if (startupError) {
    return (
      <main className="min-vh-100 d-flex align-items-center justify-content-center bg-light px-3">
        <section className="card border-0 shadow-sm p-4 text-center" style={{ maxWidth: 520 }}>
          <i className="bi bi-cloud-slash fs-1 text-danger mb-3" />
          <h1 className="h4">No pudimos iniciar MiPeque</h1>
          <p className="text-secondary">{startupError}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Volver a intentar
          </button>
        </section>
      </main>
    );
  }

  return <AppRoutes />;
}

export default App;
