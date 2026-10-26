import {
  NavLink,
  useNavigate,
} from 'react-router-dom';

import {
  getCurrentUser,
  logoutUser,
} from '../../services/authService.js';

import {
  getCurrentFamilySubscription,
} from '../../services/subscriptionService.js';

import {
  getFamilySettings,
} from '../../services/familySettingsService.js';

import {
  getFamilyHomePath,
  isMedicationOnlyAccess,
} from '../../services/familyAccessService.js';

const fullNavigationSections = [
  {
    title: 'Principal',
    items: [
      {
        label: 'Inicio',
        path: '/dashboard',
        icon: 'bi-grid-1x2-fill',
        end: true,
      },
      {
        label: 'Mis hijos',
        path: '/dashboard/children',
        icon: 'bi-person-hearts',
      },
      {
        label: 'Recordatorios',
        path: '/dashboard/reminders',
        icon: 'bi-bell',
      },
      {
        label: 'Tratamientos',
        path: '/dashboard/treatments',
        icon: 'bi-capsule-pill',
      },
    ],
  },
  {
    title: 'Salud',
    items: [
      {
        label: 'Consultas',
        path: '/dashboard/consultations',
        icon: 'bi-clipboard2-pulse',
      },
      {
        label: 'Turnos',
        path: '/dashboard/appointments',
        icon: 'bi-calendar-event',
      },
      {
        label: 'Vacunas',
        path: '/dashboard/vaccines',
        icon: 'bi-shield-plus',
      },
      {
        label: 'Botiquín',
        path: '/dashboard/medicine-cabinet',
        icon: 'bi-box-seam',
      },
      {
        label: 'Documentos',
        path: '/dashboard/documents',
        icon: 'bi-folder2-open',
      },
      {
        label: 'Historial',
        path: '/dashboard/history',
        icon: 'bi-clock-history',
      },
    ],
  },
  {
    title: 'Familia',
    items: [
      {
        label: 'Responsables',
        path: '/dashboard/caregivers',
        icon: 'bi-people',
      },
      {
        label: 'Alertas',
        path: '/dashboard/alerts',
        icon: 'bi-exclamation-triangle',
      },
    ],
  },
];

const medicationNavigationSections = [
  {
    title: 'Administración de tomas',
    items: [
      {
        label: 'Tomas de hoy',
        path: '/dashboard/reminders',
        icon: 'bi-capsule-pill',
      },
      {
        label: 'Historial de tomas',
        path: '/dashboard/history',
        icon: 'bi-clock-history',
      },
    ],
  },
];

function FamilySidebar({
  isOpen,
  onClose,
}) {
  const navigate = useNavigate();
  const limitedAccess =
    isMedicationOnlyAccess();

  const familySettings =
    getFamilySettings();

  const family =
    getCurrentFamilySubscription();

  const user = getCurrentUser();

  const familyName =
    family?.familyName?.trim() ||
    familySettings.familyName?.trim() ||
    'Mi familia';

  const navigationSections =
    limitedAccess
      ? medicationNavigationSections
      : fullNavigationSections;

  function handleLogout() {
    logoutUser();
    onClose();

    navigate('/login', {
      replace: true,
    });
  }

  return (
    <aside
      className={`family-sidebar ${
        isOpen ? 'is-open' : ''
      }`}
      aria-label="Navegación familiar"
    >
      <div className="family-sidebar__header">
        <NavLink
          to={getFamilyHomePath()}
          className="family-sidebar__brand"
          onClick={onClose}
        >
          <span className="family-sidebar__logo">
            <i className="bi bi-heart-pulse-fill" />
          </span>

          <span>
            <strong>MiPeque</strong>
            <small>
              {limitedAccess
                ? 'Administración de tomas'
                : 'Salud organizada'}
            </small>
          </span>
        </NavLink>

        <button
          type="button"
          className="family-sidebar__close"
          onClick={onClose}
          aria-label="Cerrar menú"
        >
          <i className="bi bi-x-lg" />
        </button>
      </div>

      <div className="family-sidebar__family">
        <div className="family-sidebar__avatar">
          <i className="bi bi-house-heart-fill" />
        </div>

        <div>
          <span>Cuenta familiar</span>
          <strong>{familyName}</strong>

          {user?.fullName && (
            <small>{user.fullName}</small>
          )}
        </div>
      </div>

      <nav className="family-sidebar__navigation">
        {navigationSections.map(
          (section) => (
            <div
              key={section.title}
              className="family-sidebar__group"
            >
              <span className="family-sidebar__section-title">
                {section.title}
              </span>

              {section.items.map(
                (item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    className={({
                      isActive,
                    }) =>
                      `family-sidebar__link ${
                        isActive
                          ? 'is-active'
                          : ''
                      }`
                    }
                    onClick={onClose}
                  >
                    <i
                      className={`bi ${item.icon}`}
                    />
                    <span>{item.label}</span>
                  </NavLink>
                ),
              )}
            </div>
          ),
        )}
      </nav>

      <div className="family-sidebar__footer">
        <NavLink
          to="/dashboard/help"
          className={({ isActive }) =>
            `family-sidebar__link ${
              isActive
                ? 'is-active'
                : ''
            }`
          }
          onClick={onClose}
        >
          <i className="bi bi-question-circle" />
          <span>Ayuda</span>
        </NavLink>

        {!limitedAccess && (
          <NavLink
            to="/dashboard/settings"
            className={({ isActive }) =>
              `family-sidebar__link ${
                isActive
                  ? 'is-active'
                  : ''
              }`
            }
            onClick={onClose}
          >
            <i className="bi bi-gear" />
            <span>Configuración</span>
          </NavLink>
        )}

        <button
          type="button"
          className="family-sidebar__link family-sidebar__logout"
          onClick={handleLogout}
          style={{
            width: '100%',
            border: 0,
            background: 'transparent',
            textAlign: 'left',
          }}
        >
          <i className="bi bi-box-arrow-left" />
          <span>Cerrar sesión</span>
        </button>
      </div>
    </aside>
  );
}

export default FamilySidebar;
