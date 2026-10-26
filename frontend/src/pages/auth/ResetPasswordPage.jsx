import {
  useState,
} from 'react';

import {
  Link,
  useNavigate,
} from 'react-router-dom';

import {
  updateRecoveredPassword,
} from '../../services/authService.js';

function ResetPasswordPage() {
  const navigate = useNavigate();

  const [formData, setFormData] =
    useState({
      password: '',
      confirmPassword: '',
    });

  const [errorMessage, setErrorMessage] =
    useState('');

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));

    setErrorMessage('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await updateRecoveredPassword(
        formData,
      );

      navigate('/login', {
        replace: true,
        state: {
          notice:
            'La contraseña se actualizó correctamente. Ya podés iniciar sesión.',
        },
      });
    } catch (error) {
      setErrorMessage(
        error.message ||
          'No se pudo actualizar la contraseña.',
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
            <i className="bi bi-shield-lock" />
          </div>

          <h1>Nueva contraseña</h1>

          <p>
            Elegí una contraseña nueva de al menos
            8 caracteres.
          </p>
        </div>

        {errorMessage && (
          <div
            className="alert alert-danger"
            role="alert"
          >
            {errorMessage}
          </div>
        )}

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <div className="mb-3">
            <label
              htmlFor="new-password"
              className="form-label"
            >
              Nueva contraseña
            </label>

            <input
              id="new-password"
              name="password"
              type="password"
              className="form-control"
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
              minLength={8}
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="mb-3">
            <label
              htmlFor="confirm-new-password"
              className="form-label"
            >
              Repetir contraseña
            </label>

            <input
              id="confirm-new-password"
              name="confirmPassword"
              type="password"
              className="form-control"
              value={formData.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              minLength={8}
              disabled={isSubmitting}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary w-100"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? 'Guardando...'
              : 'Guardar nueva contraseña'}
          </button>
        </form>

        <p className="auth-footer">
          <Link to="/login">
            Volver a iniciar sesión
          </Link>
        </p>
      </section>
    </main>
  );
}

export default ResetPasswordPage;
