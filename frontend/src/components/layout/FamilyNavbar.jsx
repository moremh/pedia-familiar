import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  useLocation,
  useNavigate,
} from 'react-router-dom';

import {
  getCurrentUser,
} from '../../services/authService.js';

import {
  getCurrentFamilySubscription,
  getFamilyExpirationDate,
} from '../../services/subscriptionService.js';

import {
  isMedicationOnlyAccess,
} from '../../services/familyAccessService.js';

const pageTitles = {
  '/dashboard': 'Inicio',
  '/dashboard/children':
    'Mis hijos',
  '/dashboard/consultations':
    'Consultas médicas',
  '/dashboard/treatments':
    'Tratamientos',
  '/dashboard/reminders':
    'Recordatorios',
  '/dashboard/documents':
    'Documentos médicos',
  '/dashboard/vaccines':
    'Vacunas',
  '/dashboard/medicine-cabinet':
    'Botiquín',
  '/dashboard/caregivers':
    'Responsables',
  '/dashboard/alerts':
    'Alertas',
  '/dashboard/history':
    'Historial de medicamentos',
  '/dashboard/settings':
    'Configuración',
};

const dateFormatter =
  new Intl.DateTimeFormat(
    'es-AR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    },
  );

function getInitials(
  fullName = '',
) {
  const names =
    String(fullName)
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (names.length === 0) {
    return 'RF';
  }

  return names
    .slice(0, 2)
    .map((name) => name[0])
    .join('')
    .toUpperCase();
}

function getRemainingDays(
  date,
) {
  if (!date) {
    return null;
  }

  const difference =
    date.getTime() -
    new Date().getTime();

  return Math.max(
    0,
    Math.ceil(
      difference /
        (1000 * 60 * 60 * 24),
    ),
  );
}

function getSubscriptionDisplay(
  family,
) {
  if (!family) {
    return {
      label: 'Cuenta familiar',
      description:
        'Sin información',
    };
  }

  const expirationDate =
    getFamilyExpirationDate(
      family,
    );

  if (
    family.status === 'trial'
  ) {
    const days =
      getRemainingDays(
        expirationDate,
      );

    return {
      label: 'Prueba gratuita',
      description:
        days === 0
          ? 'Vence hoy'
          : `${days} ${
              days === 1
                ? 'día restante'
                : 'días restantes'
            }`,
    };
  }

  if (
    family.status === 'active'
  ) {
    return {
      label:
        family.plan === 'annual'
          ? 'Plan anual'
          : 'Plan mensual',

      description:
        expirationDate
          ? `Vence el ${dateFormatter.format(
              expirationDate,
            )}`
          : 'Suscripción activa',
    };
  }

  return {
    label: 'Cuenta familiar',
    description:
      'Revisar suscripción',
  };
}

function FamilyNavbar({
  onMenuClick,
}) {
  const limitedAccess =
    isMedicationOnlyAccess();
  const location =
    useLocation();

  const navigate =
    useNavigate();

  const [user, setUser] =
    useState(() =>
      getCurrentUser(),
    );

  const [family, setFamily] =
    useState(() =>
      getCurrentFamilySubscription(),
    );

  const refreshInformation =
    useCallback(() => {
      setUser(
        getCurrentUser(),
      );

      setFamily(
        getCurrentFamilySubscription(),
      );
    }, []);

  useEffect(() => {
    refreshInformation();
  }, [
    location.pathname,
    refreshInformation,
  ]);

  useEffect(() => {
    window.addEventListener(
      'focus',
      refreshInformation,
    );

    window.addEventListener(
      'storage',
      refreshInformation,
    );

    return () => {
      window.removeEventListener(
        'focus',
        refreshInformation,
      );

      window.removeEventListener(
        'storage',
        refreshInformation,
      );
    };
  }, [refreshInformation]);

  const currentTitle =
    pageTitles[
      location.pathname
    ] ?? 'MiPeque';

  const subscriptionDisplay =
    getSubscriptionDisplay(
      family,
    );

  return (
    <header className="family-navbar">
      <div className="family-navbar__left">
        <button
          type="button"
          className="family-navbar__menu-button"
          onClick={onMenuClick}
          aria-label="Abrir menú lateral"
        >
          <i className="bi bi-list" />
        </button>

        <div>
          <span className="family-navbar__eyebrow">
            {limitedAccess
              ? 'Administración de tomas'
              : 'Panel familiar'}
          </span>

          <h1>
            {currentTitle}
          </h1>
        </div>
      </div>

      <div className="family-navbar__actions">
        <div className="family-navbar__trial">
          <i className="bi bi-clock-history" />

          <span>
            <small>
              {
                subscriptionDisplay.label
              }
            </small>

            <strong>
              {
                subscriptionDisplay.description
              }
            </strong>
          </span>
        </div>

        {!limitedAccess && (
          <button
            type="button"
            className="family-navbar__icon-button"
            aria-label="Ver alertas"
            onClick={() =>
              navigate(
                '/dashboard/alerts',
              )
            }
          >
            <i className="bi bi-bell" />
            <span className="family-navbar__notification-dot" />
          </button>
        )}

        <button
          type="button"
          className="family-navbar__profile"
          aria-label={
            limitedAccess
              ? 'Perfil del responsable'
              : 'Abrir configuración del perfil'
          }
          onClick={() => {
            if (!limitedAccess) {
              navigate(
                '/dashboard/settings',
              );
            }
          }}
        >
          <span className="family-navbar__profile-avatar">
            {getInitials(
              user?.fullName,
            )}
          </span>

          <span className="family-navbar__profile-info">
            <strong>
              {user?.fullName ||
                'Responsable'}
            </strong>

            <small>
              {user?.role === 'owner'
                ? 'Responsable principal'
                : limitedAccess
                  ? 'Responsable de tomas'
                  : 'Responsable'}
            </small>
          </span>

          {!limitedAccess && (
            <i className="bi bi-chevron-right" />
          )}
        </button>
      </div>
    </header>
  );
}

export default FamilyNavbar;