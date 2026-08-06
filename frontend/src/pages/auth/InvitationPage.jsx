import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom';

import {
  acceptFamilyInvitation,
  getInvitationDetails,
} from '../../services/familyInvitationsService.js';

import {
  getSubscriptionAccessState,
} from '../../services/subscriptionService.js';

import {
  getFamilyHomePath,
} from '../../services/familyAccessService.js';

import '../../styles/invitation.css';

const statusInformation = {
  expired: {
    title:
      'La invitación venció',
    description:
      'Pedile al responsable principal que genere un nuevo enlace.',
    icon:
      'bi-calendar-x',
  },

  accepted: {
    title:
      'La invitación ya fue utilizada',
    description:
      'Iniciá sesión con la cuenta que creaste al aceptarla.',
    icon:
      'bi-check-circle',
  },

  cancelled: {
    title:
      'La invitación fue cancelada',
    description:
      'Solicitá una nueva invitación a la familia.',
    icon:
      'bi-x-circle',
  },

  revoked: {
    title:
      'El acceso fue revocado',
    description:
      'Comunicate con el responsable principal de la familia.',
    icon:
      'bi-person-x',
  },
};

function InvitationPage() {
  const { token } =
    useParams();

  const navigate =
    useNavigate();

  const [
    details,
    setDetails,
  ] = useState({
    invitation: null,
    family: null,
    hasExistingAccount: false,
  });

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState('');

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setLoadError('');

    getInvitationDetails(token)
      .then((result) => {
        if (isMounted) {
          setDetails(result);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setLoadError(
            error.message ||
              'No se pudo cargar la invitación.',
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const [
    formData,
    setFormData,
  ] = useState({
    password: '',
    confirmPassword: '',
  });

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const invitation =
    details.invitation;

  const family =
    details.family;

  const invalidStatus =
    useMemo(
      () =>
        invitation &&
        invitation.status !==
          'pending'
          ? statusInformation[
              invitation.status
            ] ?? {
              title:
                'La invitación no está disponible',
              description:
                'Solicitá un nuevo enlace.',
              icon:
                'bi-exclamation-circle',
            }
          : null,
      [invitation],
    );

  function handleChange(event) {
    const {
      name,
      value,
    } = event.target;

    setFormData(
      (previousData) => ({
        ...previousData,
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
        await acceptFamilyInvitation(
          {
            token,
            password:
              formData.password,
            confirmPassword:
              formData.confirmPassword,
          },
        );

      const accessState =
        getSubscriptionAccessState(
          result.family,
        );

      navigate(
        accessState.allowed
          ? getFamilyHomePath()
          : '/subscription',
        {
          replace: true,
        },
      );
    } catch (error) {
      setErrorMessage(
        error.message ||
          'No se pudo aceptar la invitación.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <main className="invitation-page">
        <section className="invitation-card invitation-card--state">
          <span className="spinner-border text-primary mb-3" />
          <h1>Cargando invitación</h1>
          <p>Estamos verificando el enlace.</p>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="invitation-page">
        <section className="invitation-card invitation-card--state">
          <span className="invitation-state-icon invitation-state-icon--error">
            <i className="bi bi-cloud-slash" />
          </span>

          <h1>No pudimos verificar la invitación</h1>
          <p>{loadError}</p>

          <Link
            to="/login"
            className="btn btn-primary"
          >
            Ir al inicio de sesión
          </Link>
        </section>
      </main>
    );
  }

  if (!invitation) {
    return (
      <main className="invitation-page">
        <section className="invitation-card invitation-card--state">
          <span className="invitation-state-icon invitation-state-icon--error">
            <i className="bi bi-link-45deg" />
          </span>

          <h1>
            Invitación no encontrada
          </h1>

          <p>
            El enlace no existe o fue eliminado.
          </p>

          <Link
            to="/login"
            className="btn btn-primary"
          >
            Ir al inicio de sesión
          </Link>
        </section>
      </main>
    );
  }

  if (invalidStatus) {
    return (
      <main className="invitation-page">
        <section className="invitation-card invitation-card--state">
          <span className="invitation-state-icon invitation-state-icon--error">
            <i
              className={`bi ${invalidStatus.icon}`}
            />
          </span>

          <h1>
            {invalidStatus.title}
          </h1>

          <p>
            {invalidStatus.description}
          </p>

          <Link
            to="/login"
            className="btn btn-primary"
          >
            Ir al inicio de sesión
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="invitation-page">
      <section className="invitation-card">
        <header className="invitation-card__header">
          <span className="invitation-card__logo">
            <i className="bi bi-heart-pulse-fill" />
          </span>

          <div>
            <small>
              MiPeque
            </small>

            <h1>
              Te invitaron a una familia
            </h1>

            <p>
              Tendrás acceso compartido a la
              información familiar.
            </p>
          </div>
        </header>

        <section className="invitation-family">
          <span>
            <i className="bi bi-house-heart-fill" />
          </span>

          <div>
            <small>
              Familia
            </small>

            <strong>
              {family?.familyName ||
                invitation.familyName}
            </strong>
          </div>
        </section>

        <section className="invitation-person">
          <div>
            <span>
              Nombre
            </span>

            <strong>
              {
                invitation.caregiverName
              }
            </strong>
          </div>

          <div>
            <span>
              Correo invitado
            </span>

            <strong>
              {invitation.email}
            </strong>
          </div>
        </section>

        <div className="invitation-permissions">
          <i className="bi bi-shield-check" />

          <div>
            <strong>
              Acceso familiar completo
            </strong>

            <p>
              Podrás ver y modificar hijos,
              tratamientos, recordatorios,
              documentos y demás información de la
              familia.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div
            className="invitation-error"
            role="alert"
          >
            <i className="bi bi-exclamation-circle" />

            <span>
              {errorMessage}
            </span>
          </div>
        )}

        <form
          className="invitation-form"
          onSubmit={
            handleSubmit
          }
        >
          <div>
            <label htmlFor="invitationPassword">
              {details.hasExistingAccount
                ? 'Contraseña actual'
                : 'Crear contraseña'}
            </label>

            <input
              type="password"
              id="invitationPassword"
              name="password"
              className="form-control"
              value={
                formData.password
              }
              onChange={
                handleChange
              }
              placeholder={
                details.hasExistingAccount
                  ? 'Ingresá tu contraseña'
                  : 'Mínimo 8 caracteres'
              }
              autoComplete={
                details.hasExistingAccount
                  ? 'current-password'
                  : 'new-password'
              }
              minLength={8}
              disabled={
                isSubmitting
              }
              required
            />
          </div>

          {!details.hasExistingAccount && (
            <div>
              <label htmlFor="invitationConfirmPassword">
                Repetir contraseña
              </label>

              <input
                type="password"
                id="invitationConfirmPassword"
                name="confirmPassword"
                className="form-control"
                value={
                  formData.confirmPassword
                }
                onChange={
                  handleChange
                }
                placeholder="Volvé a ingresar la contraseña"
                autoComplete="new-password"
                minLength={8}
                disabled={
                  isSubmitting
                }
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              isSubmitting
            }
          >
            {isSubmitting ? (
              <>
                <span
                  className="spinner-border spinner-border-sm"
                  aria-hidden="true"
                />

                Aceptando...
              </>
            ) : (
              <>
                <i className="bi bi-person-check" />

                {details.hasExistingAccount
                  ? 'Aceptar e ingresar'
                  : 'Crear cuenta y aceptar'}
              </>
            )}
          </button>
        </form>

        <footer className="invitation-card__footer">
          <i className="bi bi-info-circle" />

          <p>
            Esta invitación no crea otra prueba
            gratuita. Utiliza el mismo plan y la
            misma información de la familia.
          </p>
        </footer>
      </section>
    </main>
  );
}

export default InvitationPage;