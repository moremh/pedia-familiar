import {
  useState,
} from 'react';

import {
  Link,
} from 'react-router-dom';

import {
  requestPasswordReset,
} from '../../services/authService.js';

function ForgotPasswordPage() {
  const [email, setEmail] =
    useState('');

  const [message, setMessage] =
    useState(null);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);

      setMessage({
        type: 'success',
        text:
          'Si existe una cuenta con ese correo, vas a recibir un enlace para crear una nueva contraseña.',
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text:
          error.message ||
          'No se pudo enviar el correo de recuperación.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="brand-icon">
            <i className="bi bi-key" />
          </div>

          <h1>Recuperar contraseña</h1>

          <p>
            Te enviaremos un enlace seguro al
            correo de tu cuenta.
          </p>
        </div>

        {message && (
          <div
            className={`alert ${
              message.type === 'success'
                ? 'alert-success'
                : 'alert-danger'
            }`}
            role={
              message.type === 'success'
                ? 'status'
                : 'alert'
            }
          >
            {message.text}
          </div>
        )}

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <div className="mb-3">
            <label
              htmlFor="recovery-email"
              className="form-label"
            >
              Correo electrónico
            </label>

            <input
              id="recovery-email"
              type="email"
              className="form-control"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              autoComplete="email"
              placeholder="familia@email.com"
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
              ? 'Enviando...'
              : 'Enviar enlace de recuperación'}
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

export default ForgotPasswordPage;
