import { useState } from 'react';

import {
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { loginUser } from '../../services/authService.js';

import {
  getSubscriptionAccessState,
} from '../../services/subscriptionService.js';

import {
  getFamilyHomePath,
  isMedicationOnlyAccess,
} from '../../services/familyAccessService.js';

function LoginPage() {
  const navigate =
    useNavigate();

  const location =
    useLocation();

  const [formData, setFormData] =
    useState({
      email: '',
      password: '',
    });

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  function handleChange(event) {
    const {
      name,
      value,
    } = event.target;

    setFormData(
      (previousFormData) => ({
        ...previousFormData,
        [name]: value,
      }),
    );

    setErrorMessage('');
  }

  async function handleSubmit(
    event,
  ) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const result =
        await loginUser(
          formData,
        );

      if (
        result.session.role ===
        'admin'
      ) {
        navigate(
          '/admin/dashboard',
          {
            replace: true,
          },
        );

        return;
      }

      const accessState =
        getSubscriptionAccessState(
          result.family,
        );

      const requestedPath =
        location.state?.from;

      if (!accessState.allowed) {
        navigate(
          '/subscription',
          {
            replace: true,
          },
        );

        return;
      }

      const familyHomePath =
        getFamilyHomePath();

      const destination =
        !isMedicationOnlyAccess() &&
        typeof requestedPath ===
          'string' &&
        requestedPath.startsWith(
          '/dashboard',
        )
          ? requestedPath
          : familyHomePath;

      navigate(destination, {
        replace: true,
      });
    } catch (error) {
      setErrorMessage(
        error.message ||
          'No se pudo iniciar sesión.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand-icon">
            <i className="bi bi-heart-pulse-fill" />
          </div>

          <h1>
            MiPeque
          </h1>

          <p>
            La salud de tu familia,
            siempre organizada.
          </p>
        </div>

        {location.state?.notice && (
          <div
            className="alert alert-success d-flex align-items-center gap-2"
            role="status"
          >
            <i className="bi bi-check-circle" />
            <span>
              {location.state.notice}
            </span>
          </div>
        )}

        {errorMessage && (
          <div
            className="alert alert-danger d-flex align-items-center gap-2"
            role="alert"
          >
            <i className="bi bi-exclamation-circle" />
            <span>
              {errorMessage}
            </span>
          </div>
        )}

        <form
          className="auth-form"
          onSubmit={
            handleSubmit
          }
        >
          <div className="mb-3">
            <label
              htmlFor="email"
              className="form-label"
            >
              Correo electrónico
            </label>

            <input
              type="email"
              id="email"
              name="email"
              className="form-control"
              placeholder="familia@email.com"
              autoComplete="email"
              value={
                formData.email
              }
              onChange={
                handleChange
              }
              disabled={
                isSubmitting
              }
              required
            />
          </div>

          <div className="mb-3">
            <label
              htmlFor="password"
              className="form-label"
            >
              Contraseña
            </label>

            <input
              type="password"
              id="password"
              name="password"
              className="form-control"
              placeholder="Ingresá tu contraseña"
              autoComplete="current-password"
              value={
                formData.password
              }
              onChange={
                handleChange
              }
              disabled={
                isSubmitting
              }
              required
            />
          </div>

          <div className="text-end mb-2">
            <Link
              to="/forgot-password"
              className="small text-decoration-none"
            >
              ¿Olvidaste tu contraseña?
            </Link>
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={
              isSubmitting
            }
          >
            {isSubmitting ? (
              <>
                <span
                  className="spinner-border spinner-border-sm me-2"
                  aria-hidden="true"
                />
                Ingresando...
              </>
            ) : (
              <>
                <i className="bi bi-box-arrow-in-right me-2" />
                Iniciar sesión
              </>
            )}
          </button>
        </form>

        <p className="auth-footer">
          ¿Todavía no tenés una
          cuenta?{' '}

          <Link to="/register">
            Probá gratis durante
            7 días
          </Link>
        </p>
      </section>
    </main>
  );
}

export default LoginPage;