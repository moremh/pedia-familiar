import {
  useState,
} from 'react';

import {
  Link,
  useNavigate,
} from 'react-router-dom';

import {
  registerFamilyAccount,
} from '../../services/authService.js';

function RegisterPage() {
  const navigate =
    useNavigate();

  const [formData, setFormData] =
    useState({
      familyName: '',
      responsibleName: '',
      phone: '',
      email: '',
      password: '',
      confirmPassword: '',
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
        await registerFamilyAccount(
          formData,
        );

      if (result.confirmationRequired) {
        navigate(
          '/login',
          {
            replace: true,
            state: {
              notice:
                'La cuenta fue creada. Revisá tu correo, confirmala y después iniciá sesión.',
            },
          },
        );

        return;
      }

      navigate(
        result.trialGranted
          ? '/dashboard'
          : '/subscription',
        {
          replace: true,
        },
      );
    } catch (error) {
      setErrorMessage(
        error.message ||
          'No se pudo crear la cuenta.',
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
            <i className="bi bi-people-fill" />
          </div>

          <h1>
            Crear cuenta familiar
          </h1>

          <p>
            Accedé a todas las
            funciones durante 7 días
            gratis.
          </p>
        </div>

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
              htmlFor="familyName"
              className="form-label"
            >
              Nombre de la familia
            </label>

            <input
              type="text"
              id="familyName"
              name="familyName"
              className="form-control"
              placeholder="Familia García"
              autoComplete="organization"
              value={
                formData.familyName
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
              htmlFor="responsibleName"
              className="form-label"
            >
              Nombre del responsable
            </label>

            <input
              type="text"
              id="responsibleName"
              name="responsibleName"
              className="form-control"
              placeholder="Nombre y apellido"
              autoComplete="name"
              value={
                formData.responsibleName
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
              htmlFor="phone"
              className="form-label"
            >
              Teléfono o WhatsApp
            </label>

            <input
              type="tel"
              id="phone"
              name="phone"
              className="form-control"
              placeholder="3815551234"
              autoComplete="tel"
              value={
                formData.phone
              }
              onChange={
                handleChange
              }
              disabled={
                isSubmitting
              }
              required
            />

            <small className="text-secondary">
              Se utiliza para controlar
              que cada persona reciba
              una sola prueba gratuita.
            </small>
          </div>

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
              placeholder="Mínimo 8 caracteres"
              autoComplete="new-password"
              value={
                formData.password
              }
              onChange={
                handleChange
              }
              disabled={
                isSubmitting
              }
              minLength={8}
              required
            />
          </div>

          <div className="mb-3">
            <label
              htmlFor="confirmPassword"
              className="form-label"
            >
              Repetir contraseña
            </label>

            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              className="form-control"
              placeholder="Volvé a ingresar la contraseña"
              autoComplete="new-password"
              value={
                formData.confirmPassword
              }
              onChange={
                handleChange
              }
              disabled={
                isSubmitting
              }
              minLength={8}
              required
            />
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
                Creando cuenta...
              </>
            ) : (
              <>
                <i className="bi bi-stars me-2" />
                Comenzar prueba gratuita
              </>
            )}
          </button>
        </form>

        <p className="auth-footer">
          ¿Ya tenés una cuenta?{' '}

          <Link to="/login">
            Iniciar sesión
          </Link>
        </p>
      </section>
    </main>
  );
}

export default RegisterPage;