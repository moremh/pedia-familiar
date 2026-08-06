import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Link,
  Navigate,
  useNavigate,
} from 'react-router-dom';

import {
  getCurrentFamilySubscription,
  getFamilyExpirationDate,
  getAnnualPlanSaving,
  getSubscriptionAccessState,
  getSubscriptionPlans,
  refreshSubscriptionPlans,
  requestPlanAndGetWhatsAppUrl,
} from '../../services/subscriptionService.js';

import {
  logoutUser,
} from '../../services/authService.js';

import '../../styles/subscription-expired.css';
import '../../styles/subscription-expired-commercial.css';

const currencyFormatter =
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });

const dateFormatter =
  new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

const statusIcons = {
  expired: 'bi-calendar-x',
  pending_payment:
    'bi-hourglass-split',
  suspended: 'bi-slash-circle',
  not_found:
    'bi-exclamation-triangle',
};

function formatDate(date) {
  if (
    !date ||
    Number.isNaN(date.getTime())
  ) {
    return 'Sin fecha registrada';
  }

  return dateFormatter.format(date);
}

function SubscriptionExpiredPage() {
  const navigate = useNavigate();
  const [family, setFamily] =
    useState(() =>
      getCurrentFamilySubscription(),
    );

  const [plans, setPlans] =
    useState(() =>
      getSubscriptionPlans(),
    );

  const [processingPlan, setProcessingPlan] =
    useState('');

  const [errorMessage, setErrorMessage] =
    useState('');

  const refreshFamily =
    useCallback(() => {
      setFamily(
        getCurrentFamilySubscription(),
      );
    }, []);

  useEffect(() => {
    let isMounted = true;

    async function refreshPlans() {
      try {
        const updatedPlans =
          await refreshSubscriptionPlans();

        if (isMounted) {
          setPlans(updatedPlans);
        }
      } catch (error) {
        console.error(
          'No se pudieron actualizar los planes.',
          error,
        );
      }
    }

    refreshPlans();

    window.addEventListener(
      'mipeque:commercial-settings-updated',
      refreshPlans,
    );

    window.addEventListener(
      'focus',
      refreshFamily,
    );

    window.addEventListener(
      'storage',
      refreshFamily,
    );

    const intervalId =
      window.setInterval(
        refreshFamily,
        30000,
      );

    return () => {
      isMounted = false;

      window.removeEventListener(
        'mipeque:commercial-settings-updated',
        refreshPlans,
      );

      window.removeEventListener(
        'focus',
        refreshFamily,
      );

      window.removeEventListener(
        'storage',
        refreshFamily,
      );

      window.clearInterval(
        intervalId,
      );
    };
  }, [refreshFamily]);

  const accessState = useMemo(
    () =>
      getSubscriptionAccessState(
        family,
      ),
    [family],
  );

  const expirationDate =
    useMemo(
      () =>
        getFamilyExpirationDate(
          family,
        ),
      [family],
    );

  const requestedPlan =
    family?.requestedPlan || '';

  const annualSaving =
    getAnnualPlanSaving(plans);

  async function handleLogout() {
    await logoutUser();
    navigate('/login', {
      replace: true,
    });
  }

  async function handleRequestPlan(
    planId,
  ) {
    try {
      setProcessingPlan(planId);
      setErrorMessage('');

      const {
        family: updatedFamily,
        whatsappUrl,
      } =
        await requestPlanAndGetWhatsAppUrl(
          planId,
        );

      setFamily(updatedFamily);

      window.open(
        whatsappUrl,
        '_blank',
        'noopener,noreferrer',
      );
    } catch (error) {
      setErrorMessage(
        error.message ||
          'No se pudo preparar la solicitud.',
      );
    } finally {
      setProcessingPlan('');
    }
  }

  if (accessState.allowed) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return (
    <main className="subscription-page">
      <header className="subscription-page__header">
        <Link
          to="/login"
          className="subscription-page__brand"
        >
          <span>
            <i className="bi bi-heart-pulse-fill" />
          </span>

          <div>
            <strong>
              MiPeque
            </strong>

            <small>
              Salud familiar organizada
            </small>
          </div>
        </Link>

        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={handleLogout}
        >
          <i className="bi bi-box-arrow-left" />
          Cerrar sesión
        </button>
      </header>

      <section className="subscription-hero">
        <span
          className={`subscription-hero__icon subscription-hero__icon--${accessState.status}`}
        >
          <i
            className={`bi ${
              statusIcons[
                accessState.status
              ] ||
              'bi-calendar-x'
            }`}
          />
        </span>

        <span className="subscription-hero__eyebrow">
          Estado de la cuenta
        </span>

        <h1>
          {accessState.title}
        </h1>

        <p>
          {accessState.description}
        </p>

        {family && (
          <div className="subscription-hero__family">
            <span>
              <i className="bi bi-people" />
            </span>

            <div>
              <small>
                Cuenta familiar
              </small>

              <strong>
                {family.familyName}
              </strong>
            </div>

            <div>
              <small>
                Fecha de vencimiento
              </small>

              <strong>
                {formatDate(
                  expirationDate,
                )}
              </strong>
            </div>
          </div>
        )}
      </section>

      {accessState.status ===
        'pending_payment' && (
        <section className="subscription-pending">
          <i className="bi bi-clock-history" />

          <div>
            <strong>
              Estamos esperando la confirmación del pago
            </strong>

            <p>
              Tu información continúa guardada.
              Cuando el pago sea verificado,
              activaremos toda la cuenta familiar.
            </p>
          </div>
        </section>
      )}

      {accessState.status ===
        'suspended' && (
        <section className="subscription-suspended">
          <i className="bi bi-info-circle" />

          <div>
            <strong>
              Comunicate con administración
            </strong>

            <p>
              Podés elegir un plan y abrir
              WhatsApp para consultar el estado
              de la cuenta.
            </p>
          </div>
        </section>
      )}

      {errorMessage && (
        <div className="subscription-error">
          <i className="bi bi-exclamation-circle" />
          {errorMessage}
        </div>
      )}

      <section className="subscription-plans">
        <header className="subscription-plans__header">
          <span>
            Elegí cómo continuar
          </span>

          <h2>
            Planes de MiPeque
          </h2>

          <p>
            El plan activa a todos los
            responsables de la misma familia.
          </p>
        </header>

        <div className="subscription-plans__grid">
          <article
            className={`subscription-plan ${
              requestedPlan ===
              'monthly'
                ? 'is-requested'
                : ''
            }`}
          >
            <header>
              <span className="subscription-plan__icon">
                <i className="bi bi-calendar-month" />
              </span>

              <div>
                <small>
                  Pago mensual
                </small>

                <h3>
                  {
                    plans.monthly.name
                  }
                </h3>
              </div>
            </header>

            <div className="subscription-plan__price">
              <strong>
                {currencyFormatter.format(
                  plans.monthly.amount,
                )}
              </strong>

              <span>
                por mes
              </span>
            </div>

            {plans.monthly.promotionName && (
              <div className="subscription-plan__promotion">
                <span>
                  <i className="bi bi-stars" />
                  {plans.monthly.promotionName}
                </span>

                {plans.monthly.baseAmount >
                  plans.monthly.amount && (
                  <del>
                    {currencyFormatter.format(
                      plans.monthly.baseAmount,
                    )}
                  </del>
                )}

                {plans.monthly.promotionDescription && (
                  <small>
                    {plans.monthly.promotionDescription}
                  </small>
                )}
              </div>
            )}

            <ul>
              <li>
                <i className="bi bi-check-circle-fill" />
                Hijos sin límites
              </li>

              <li>
                <i className="bi bi-check-circle-fill" />
                Responsables sin límites
              </li>

              <li>
                <i className="bi bi-check-circle-fill" />
                Todas las funciones disponibles
              </li>

              <li>
                <i className="bi bi-check-circle-fill" />
                Acceso durante un mes
              </li>
            </ul>

            <button
              type="button"
              className="subscription-plan__button"
              disabled={
                processingPlan ===
                  'monthly' ||
                plans.monthly.isActive ===
                  false
              }
              onClick={() =>
                handleRequestPlan(
                  'monthly',
                )
              }
            >
              <i className="bi bi-whatsapp" />

              {processingPlan ===
              'monthly'
                ? 'Preparando...'
                : requestedPlan ===
                    'monthly'
                  ? 'Abrir WhatsApp nuevamente'
                  : 'Solicitar plan mensual'}
            </button>

            {requestedPlan ===
              'monthly' && (
              <span className="subscription-plan__requested">
                <i className="bi bi-check-circle" />
                Plan solicitado
              </span>
            )}
          </article>

          <article
            className={`subscription-plan subscription-plan--featured ${
              requestedPlan ===
              'annual'
                ? 'is-requested'
                : ''
            }`}
          >
            <span className="subscription-plan__badge">
              Más conveniente
            </span>

            <header>
              <span className="subscription-plan__icon">
                <i className="bi bi-calendar2-check" />
              </span>

              <div>
                <small>
                  Pago anual
                </small>

                <h3>
                  {
                    plans.annual.name
                  }
                </h3>
              </div>
            </header>

            <div className="subscription-plan__price">
              <strong>
                {currencyFormatter.format(
                  plans.annual.amount,
                )}
              </strong>

              <span>
                por año
              </span>
            </div>

            {plans.annual.promotionName && (
              <div className="subscription-plan__promotion">
                <span>
                  <i className="bi bi-stars" />
                  {plans.annual.promotionName}
                </span>

                {plans.annual.baseAmount >
                  plans.annual.amount && (
                  <del>
                    {currencyFormatter.format(
                      plans.annual.baseAmount,
                    )}
                  </del>
                )}

                {plans.annual.promotionDescription && (
                  <small>
                    {plans.annual.promotionDescription}
                  </small>
                )}
              </div>
            )}

            <div className="subscription-plan__saving">
              Ahorrás {currencyFormatter.format(
                annualSaving,
              )} frente a doce pagos mensuales
            </div>

            <ul>
              <li>
                <i className="bi bi-check-circle-fill" />
                Hijos sin límites
              </li>

              <li>
                <i className="bi bi-check-circle-fill" />
                Responsables sin límites
              </li>

              <li>
                <i className="bi bi-check-circle-fill" />
                Todas las funciones disponibles
              </li>

              <li>
                <i className="bi bi-check-circle-fill" />
                Acceso durante un año
              </li>
            </ul>

            <button
              type="button"
              className="subscription-plan__button"
              disabled={
                processingPlan ===
                  'annual' ||
                plans.annual.isActive ===
                  false
              }
              onClick={() =>
                handleRequestPlan(
                  'annual',
                )
              }
            >
              <i className="bi bi-whatsapp" />

              {processingPlan ===
              'annual'
                ? 'Preparando...'
                : requestedPlan ===
                    'annual'
                  ? 'Abrir WhatsApp nuevamente'
                  : 'Solicitar plan anual'}
            </button>

            {requestedPlan ===
              'annual' && (
              <span className="subscription-plan__requested">
                <i className="bi bi-check-circle" />
                Plan solicitado
              </span>
            )}
          </article>
        </div>
      </section>

      <section className="subscription-information">
        <span>
          <i className="bi bi-shield-check" />
        </span>

        <div>
          <strong>
            Tus datos no se eliminan
          </strong>

          <p>
            Los perfiles, tratamientos,
            recordatorios, documentos y demás
            información permanecen guardados
            mientras la cuenta está bloqueada.
          </p>
        </div>
      </section>

      <footer className="subscription-page__footer">
        <p>
          Después de realizar el pago,
          enviá el comprobante por WhatsApp.
          La activación se realiza manualmente.
        </p>
      </footer>
    </main>
  );
}

export default SubscriptionExpiredPage;