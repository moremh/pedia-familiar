import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useNavigate } from 'react-router-dom';

import {
  activateFamilyPlan,
  getAdminFamilies,
  getAdminPayments,
  reactivateFamily,
  refreshAdminData,
  setFamilyChildrenLimit,
  suspendFamily,
} from '../../services/adminFamiliesService.js';

import CommercialSettingsPanel from '../../components/admin/CommercialSettingsPanel.jsx';

import {
  logoutUser,
} from '../../services/authService.js';

import '../../styles/admin-dashboard.css';
import '../../styles/admin-dashboard-commercial.css';

const statusInformation = {
  trial: {
    label: 'Prueba gratuita',
    icon: 'bi-hourglass-split',
  },
  active: {
    label: 'Cuenta activa',
    icon: 'bi-check-circle',
  },
  expired: {
    label: 'Cuenta vencida',
    icon: 'bi-exclamation-circle',
  },
  pending_payment: {
    label: 'Pago pendiente',
    icon: 'bi-clock-history',
  },
  suspended: {
    label: 'Suspendida',
    icon: 'bi-slash-circle',
  },
};

const planLabels = {
  trial: 'Prueba gratuita',
  monthly: 'Mensual',
  annual: 'Anual',
};

const currencyFormatter =
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });

const dateFormatter =
  new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

function parseDate(dateValue) {
  if (!dateValue) {
    return null;
  }

  const date = new Date(dateValue);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function formatDate(dateValue) {
  const date = parseDate(dateValue);

  return date
    ? dateFormatter.format(date)
    : 'Sin fecha';
}

function getFamilyEndDate(family) {
  if (
    family.plan === 'monthly' ||
    family.plan === 'annual'
  ) {
    return family.subscriptionEndsAt;
  }

  return family.trialEndsAt;
}

function getRemainingTime(dateValue) {
  const date = parseDate(dateValue);

  if (!date) {
    return 'Sin vencimiento';
  }

  const now = new Date();

  const differenceInDays = Math.ceil(
    (date.getTime() - now.getTime()) /
      (1000 * 60 * 60 * 24),
  );

  if (differenceInDays < 0) {
    const expiredDays = Math.abs(
      differenceInDays,
    );

    return `Venció hace ${expiredDays} ${
      expiredDays === 1
        ? 'día'
        : 'días'
    }`;
  }

  if (differenceInDays === 0) {
    return 'Vence hoy';
  }

  return `${differenceInDays} ${
    differenceInDays === 1
      ? 'día restante'
      : 'días restantes'
  }`;
}

function getFamilyCode(familyId = '') {
  const normalizedId = familyId
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(-6)
    .toUpperCase();

  return `MP-${normalizedId || '000000'}`;
}

function getCurrentMonthPaymentTotal(
  payments,
) {
  const now = new Date();

  return payments
    .filter((payment) => {
      const paymentDate = parseDate(
        payment.paymentDate,
      );

      if (!paymentDate) {
        return false;
      }

      return (
        paymentDate.getMonth() ===
          now.getMonth() &&
        paymentDate.getFullYear() ===
          now.getFullYear()
      );
    })
    .reduce(
      (total, payment) =>
        total +
        Number(payment.amount || 0),
      0,
    );
}

const DEFAULT_COMMERCIAL_PLANS = {
  monthly: {
    amount: 25000,
  },
  annual: {
    amount: 150000,
  },
};

const DEFAULT_CHILD_SETTINGS = {
  baseChildrenLimit: 3,
  extraChildPrice: 5000,
};

function getEffectiveFamilyChildLimit(
  family,
  childSettings,
) {
  const baseLimit = Math.max(
    1,
    Number(
      childSettings?.baseChildrenLimit ?? 3,
    ) || 3,
  );

  const configuredLimit = Math.max(
    baseLimit,
    Number(
      family?.childrenLimitOverride ??
        baseLimit,
    ) || baseLimit,
  );

  return Math.max(
    Number(family?.childrenCount || 0),
    configuredLimit,
  );
}

function AdminDashboardPage() {
  const navigate = useNavigate();
  const [families, setFamilies] =
    useState(() => getAdminFamilies());

  const [payments, setPayments] =
    useState(() => getAdminPayments());

  const [commercialPlans, setCommercialPlans] =
    useState(DEFAULT_COMMERCIAL_PLANS);

  const [childSettings, setChildSettings] =
    useState(DEFAULT_CHILD_SETTINGS);

  const [searchTerm, setSearchTerm] =
    useState('');

  const [statusFilter, setStatusFilter] =
    useState('all');

  const [
    selectedFamilyId,
    setSelectedFamilyId,
  ] = useState(null);

  const selectedFamily =
    useMemo(
      () =>
        families.find(
          (family) =>
            family.id ===
            selectedFamilyId,
        ) ?? null,
      [families, selectedFamilyId],
    );

  const selectedFamilyPayments =
    useMemo(
      () =>
        payments.filter(
          (payment) =>
            payment.familyId ===
            selectedFamilyId,
        ),
      [payments, selectedFamilyId],
    );

  const filteredFamilies = useMemo(
    () => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase();

      return families.filter(
        (family) => {
          const matchesStatus =
            statusFilter === 'all' ||
            family.status ===
              statusFilter;

          const searchableValues = [
            family.familyName,
            family.ownerName,
            family.ownerEmail,
            family.phone,
            getFamilyCode(family.id),
          ];

          const matchesSearch =
            !normalizedSearch ||
            searchableValues.some(
              (value) =>
                String(value || '')
                  .toLowerCase()
                  .includes(
                    normalizedSearch,
                  ),
            );

          return (
            matchesStatus &&
            matchesSearch
          );
        },
      );
    },
    [
      families,
      searchTerm,
      statusFilter,
    ],
  );

  const activeFamilies =
    families.filter(
      (family) =>
        family.status === 'active',
    ).length;

  const trialFamilies =
    families.filter(
      (family) =>
        family.status === 'trial',
    ).length;

  const expiredFamilies =
    families.filter(
      (family) =>
        family.status === 'expired',
    ).length;

  const monthPaymentTotal =
    getCurrentMonthPaymentTotal(
      payments,
    );

  function refreshData() {
    setFamilies(getAdminFamilies());
    setPayments(getAdminPayments());
  }

  useEffect(() => {
    let isMounted = true;

    async function refreshRemoteData() {
      try {
        await refreshAdminData();

        if (isMounted) {
          refreshData();
        }
      } catch (error) {
        console.error(
          'No se pudo actualizar el panel administrador.',
          error,
        );
      }
    }

    refreshRemoteData();

    window.addEventListener(
      'focus',
      refreshRemoteData,
    );

    const intervalId =
      window.setInterval(
        refreshRemoteData,
        30000,
      );

    return () => {
      isMounted = false;

      window.removeEventListener(
        'focus',
        refreshRemoteData,
      );

      window.clearInterval(
        intervalId,
      );
    };
  }, []);

  async function handleLogout() {
    await logoutUser();
    navigate('/login', {
      replace: true,
    });
  }

  async function handleActivatePlan(
    family,
    plan,
  ) {
    const planName =
      plan === 'monthly'
        ? 'mensual'
        : 'anual';

    const actionText =
      family.status === 'active'
        ? 'renovar'
        : 'activar';

    const confirmed = window.confirm(
      `¿Querés ${actionText} el plan ${planName} para ${family.familyName}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await activateFamilyPlan(
        family.id,
        plan,
      );

      refreshData();
    } catch (error) {
      window.alert(
        error.message ||
          'No se pudo activar el plan.',
      );
    }
  }

  async function handleSuspend(family) {
    const confirmed = window.confirm(
      `¿Suspender el acceso de ${family.familyName}?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await suspendFamily(family.id);
      refreshData();
    } catch (error) {
      window.alert(
        error.message ||
          'No se pudo suspender la familia.',
      );
    }
  }

  async function handleReactivate(family) {
    try {
      await reactivateFamily(family.id);
      refreshData();
    } catch (error) {
      window.alert(
        error.message ||
          'No se pudo reactivar la familia.',
      );
    }
  }

  async function handleAdjustChildrenLimit(
    family,
    change,
  ) {
    const baseLimit = Math.max(
      1,
      Number(
        childSettings.baseChildrenLimit || 3,
      ),
    );

    const currentLimit =
      getEffectiveFamilyChildLimit(
        family,
        childSettings,
      );

    const nextLimit = Math.max(
      baseLimit,
      currentLimit + change,
    );

    if (
      change < 0 &&
      nextLimit < family.childrenCount
    ) {
      window.alert(
        'No podés reducir el cupo por debajo de la cantidad de hijos que la familia ya tiene registrados.',
      );
      return;
    }

    if (nextLimit === currentLimit) {
      return;
    }

    const extraPrice = Math.max(
      0,
      Number(
        childSettings.extraChildPrice || 0,
      ),
    );

    const confirmed = window.confirm(
      change > 0
        ? `¿Habilitar un cupo adicional para ${family.familyName}? El límite pasará de ${currentLimit} a ${nextLimit} hijos. Valor de referencia del cupo extra: ${currencyFormatter.format(extraPrice)}.`
        : `¿Reducir el límite de ${family.familyName} de ${currentLimit} a ${nextLimit} hijos?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await setFamilyChildrenLimit(
        family.id,
        nextLimit === baseLimit
          ? null
          : nextLimit,
      );

      refreshData();
    } catch (error) {
      window.alert(
        error.message ||
          'No se pudo modificar el límite de hijos.',
      );
    }
  }

  return (
    <main className="admin-dashboard">
      <header className="admin-dashboard__header">
        <div className="admin-dashboard__brand">
          <span>
            <i className="bi bi-heart-pulse-fill" />
          </span>

          <div>
            <small>
              MiPeque
            </small>

            <h1>
              Panel administrador
            </h1>

            <p>
              Gestioná pruebas gratuitas,
              planes y vencimientos.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={handleLogout}
        >
          <i className="bi bi-box-arrow-left" />
          Cerrar sesión
        </button>
      </header>

      <section className="admin-dashboard__notice">
        <i className="bi bi-info-circle" />

        <div>
          <strong>
            Configuración conectada a Supabase
          </strong>

          <p>
            Los precios, promociones, activaciones y pagos se guardan en la base de datos de MiPeque.
          </p>
        </div>
      </section>

      <section className="admin-statistics">
        <article>
          <span className="admin-statistics__icon admin-statistics__icon--active">
            <i className="bi bi-people" />
          </span>

          <div>
            <strong>
              {activeFamilies}
            </strong>

            <span>
              Familias activas
            </span>
          </div>
        </article>

        <article>
          <span className="admin-statistics__icon admin-statistics__icon--trial">
            <i className="bi bi-hourglass-split" />
          </span>

          <div>
            <strong>
              {trialFamilies}
            </strong>

            <span>
              Pruebas activas
            </span>
          </div>
        </article>

        <article>
          <span className="admin-statistics__icon admin-statistics__icon--expired">
            <i className="bi bi-exclamation-circle" />
          </span>

          <div>
            <strong>
              {expiredFamilies}
            </strong>

            <span>
              Cuentas vencidas
            </span>
          </div>
        </article>

        <article>
          <span className="admin-statistics__icon admin-statistics__icon--payments">
            <i className="bi bi-cash-stack" />
          </span>

          <div>
            <strong>
              {currencyFormatter.format(
                monthPaymentTotal,
              )}
            </strong>

            <span>
              Pagos del mes
            </span>
          </div>
        </article>
      </section>

      <CommercialSettingsPanel
        onPlansChange={setCommercialPlans}
        onChildSettingsChange={setChildSettings}
      />

      <section className="admin-dashboard__panel">
        <header className="admin-panel-header">
          <div>
            <span>
              Gestión de cuentas
            </span>

            <h2>
              Familias registradas
            </h2>

            <p>
              Activá, renová o suspendé el
              acceso de una familia.
            </p>
          </div>

          <strong>
            {filteredFamilies.length}{' '}
            {filteredFamilies.length === 1
              ? 'familia'
              : 'familias'}
          </strong>
        </header>

        <div className="admin-toolbar">
          <div className="admin-toolbar__search">
            <i className="bi bi-search" />

            <input
              type="search"
              value={searchTerm}
              onChange={(event) =>
                setSearchTerm(
                  event.target.value,
                )
              }
              placeholder="Buscar familia, correo o código"
              aria-label="Buscar familias"
            />

            {searchTerm && (
              <button
                type="button"
                onClick={() =>
                  setSearchTerm('')
                }
                aria-label="Limpiar búsqueda"
              >
                <i className="bi bi-x-lg" />
              </button>
            )}
          </div>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value,
              )
            }
            aria-label="Filtrar por estado"
          >
            <option value="all">
              Todos los estados
            </option>

            <option value="trial">
              Prueba gratuita
            </option>

            <option value="active">
              Activas
            </option>

            <option value="expired">
              Vencidas
            </option>

            <option value="pending_payment">
              Pago pendiente
            </option>

            <option value="suspended">
              Suspendidas
            </option>
          </select>
        </div>

        {filteredFamilies.length > 0 ? (
          <div className="admin-families-grid">
            {filteredFamilies.map(
              (family) => {
                const status =
                  statusInformation[
                    family.status
                  ] ||
                  statusInformation.expired;

                const endDate =
                  getFamilyEndDate(
                    family,
                  );

                return (
                  <article
                    key={family.id}
                    className="admin-family-card"
                  >
                    <header className="admin-family-card__header">
                      <div>
                        <span className="admin-family-card__code">
                          {getFamilyCode(
                            family.id,
                          )}
                        </span>

                        <h3>
                          {
                            family.familyName
                          }
                        </h3>
                      </div>

                      <span
                        className={`admin-status admin-status--${family.status}`}
                      >
                        <i
                          className={`bi ${status.icon}`}
                        />

                        {status.label}
                      </span>
                    </header>

                    <section className="admin-family-card__owner">
                      <span>
                        <i className="bi bi-person" />
                      </span>

                      <div>
                        <strong>
                          {family.ownerName}
                        </strong>

                        <small>
                          {
                            family.ownerEmail
                          }
                        </small>

                        <small>
                          {family.phone ||
                            'Sin teléfono'}
                        </small>
                      </div>
                    </section>

                    <dl className="admin-family-card__information">
                      <div>
                        <dt>Plan</dt>

                        <dd>
                          {planLabels[
                            family.plan
                          ] ||
                            'Sin plan'}
                        </dd>
                      </div>

                      <div>
                        <dt>Vencimiento</dt>

                        <dd>
                          {formatDate(
                            endDate,
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt>Tiempo restante</dt>

                        <dd>
                          {getRemainingTime(
                            endDate,
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt>Integrantes</dt>

                        <dd>
                          {
                            family.membersCount
                          }{' '}
                          responsables
                        </dd>
                      </div>

                      <div>
                        <dt>Hijos</dt>

                        <dd>
                          {family.childrenCount}{' '}
                          /{' '}
                          {getEffectiveFamilyChildLimit(
                            family,
                            childSettings,
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt>Plan solicitado</dt>

                        <dd>
                          {family.requestedPlan
                            ? planLabels[
                                family
                                  .requestedPlan
                              ]
                            : 'Ninguno'}
                        </dd>
                      </div>
                    </dl>

                    <div className="admin-family-card__main-actions">
                      <button
                        type="button"
                        className="admin-action admin-action--monthly"
                        onClick={() =>
                          handleActivatePlan(
                            family,
                            'monthly',
                          )
                        }
                      >
                        <i className="bi bi-calendar-month" />

                        <span>
                          <strong>
                            {family.status ===
                            'active'
                              ? 'Sumar 1 mes'
                              : 'Activar mensual'}
                          </strong>

                          <small>
                            {currencyFormatter.format(
                              commercialPlans.monthly?.amount ||
                                15000,
                            )}
                          </small>
                        </span>
                      </button>

                      <button
                        type="button"
                        className="admin-action admin-action--annual"
                        onClick={() =>
                          handleActivatePlan(
                            family,
                            'annual',
                          )
                        }
                      >
                        <i className="bi bi-calendar2-check" />

                        <span>
                          <strong>
                            {family.status ===
                            'active'
                              ? 'Sumar 1 año'
                              : 'Activar anual'}
                          </strong>

                          <small>
                            {currencyFormatter.format(
                              commercialPlans.annual?.amount ||
                                100000,
                            )}
                          </small>
                        </span>
                      </button>
                    </div>

                    <footer className="admin-family-card__footer">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedFamilyId(
                            family.id,
                          )
                        }
                      >
                        <i className="bi bi-eye" />
                        Ver detalles
                      </button>

                      {family.status ===
                      'suspended' ? (
                        <button
                          type="button"
                          className="admin-family-card__reactivate"
                          onClick={() =>
                            handleReactivate(
                              family,
                            )
                          }
                        >
                          <i className="bi bi-arrow-counterclockwise" />
                          Reactivar
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="admin-family-card__suspend"
                          onClick={() =>
                            handleSuspend(
                              family,
                            )
                          }
                        >
                          <i className="bi bi-slash-circle" />
                          Suspender
                        </button>
                      )}
                    </footer>
                  </article>
                );
              },
            )}
          </div>
        ) : (
          <div className="admin-empty">
            <i className="bi bi-search" />

            <h3>
              No encontramos familias
            </h3>

            <p>
              Probá cambiando la búsqueda o
              el estado seleccionado.
            </p>
          </div>
        )}
      </section>

      <section className="admin-dashboard__panel">
        <header className="admin-panel-header">
          <div>
            <span>
              Movimientos recientes
            </span>

            <h2>
              Historial de activaciones
            </h2>

            <p>
              Cada activación o renovación
              queda registrada.
            </p>
          </div>
        </header>

        {payments.length > 0 ? (
          <div className="admin-payments">
            {payments
              .slice(0, 8)
              .map((payment) => (
                <article
                  key={payment.id}
                  className="admin-payment"
                >
                  <span className="admin-payment__icon">
                    <i className="bi bi-receipt" />
                  </span>

                  <div className="admin-payment__family">
                    <strong>
                      {
                        payment.familyName
                      }
                    </strong>

                    <small>
                      {payment.type ===
                      'renewal'
                        ? 'Renovación'
                        : 'Activación'}{' '}
                      ·{' '}
                      {planLabels[
                        payment.plan
                      ]}
                    </small>
                  </div>

                  <div className="admin-payment__date">
                    <small>Fecha</small>

                    <strong>
                      {formatDate(
                        payment.paymentDate,
                      )}
                    </strong>
                  </div>

                  <strong className="admin-payment__amount">
                    {currencyFormatter.format(
                      payment.amount,
                    )}
                  </strong>
                </article>
              ))}
          </div>
        ) : (
          <div className="admin-empty admin-empty--small">
            <i className="bi bi-receipt" />
            <p>
              Todavía no hay activaciones.
            </p>
          </div>
        )}
      </section>

      {selectedFamily && (
        <div
          className="admin-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="adminFamilyTitle"
        >
          <button
            type="button"
            className="admin-modal__backdrop"
            onClick={() =>
              setSelectedFamilyId(null)
            }
            aria-label="Cerrar detalles"
          />

          <div className="admin-modal__container">
            <header className="admin-modal__header">
              <div>
                <span>
                  {getFamilyCode(
                    selectedFamily.id,
                  )}
                </span>

                <h2 id="adminFamilyTitle">
                  {
                    selectedFamily.familyName
                  }
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedFamilyId(null)
                }
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg" />
              </button>
            </header>

            <div className="admin-modal__body">
              <section className="admin-detail-section">
                <h3>
                  <i className="bi bi-person" />
                  Responsable principal
                </h3>

                <dl>
                  <div>
                    <dt>Nombre</dt>

                    <dd>
                      {
                        selectedFamily.ownerName
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>Correo</dt>

                    <dd>
                      {
                        selectedFamily.ownerEmail
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>Teléfono</dt>

                    <dd>
                      {selectedFamily.phone ||
                        'No registrado'}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="admin-detail-section">
                <h3>
                  <i className="bi bi-credit-card" />
                  Suscripción
                </h3>

                <dl>
                  <div>
                    <dt>Estado</dt>

                    <dd>
                      {
                        statusInformation[
                          selectedFamily
                            .status
                        ]?.label
                      }
                    </dd>
                  </div>

                  <div>
                    <dt>Plan</dt>

                    <dd>
                      {planLabels[
                        selectedFamily.plan
                      ] || 'Sin plan'}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Inicio de prueba
                    </dt>

                    <dd>
                      {formatDate(
                        selectedFamily
                          .trialStartedAt,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Fin de prueba
                    </dt>

                    <dd>
                      {formatDate(
                        selectedFamily
                          .trialEndsAt,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Inicio del plan
                    </dt>

                    <dd>
                      {formatDate(
                        selectedFamily
                          .subscriptionStartedAt,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>
                      Fin del plan
                    </dt>

                    <dd>
                      {formatDate(
                        selectedFamily
                          .subscriptionEndsAt,
                      )}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="admin-detail-section admin-detail-section--children-limit">
                <h3>
                  <i className="bi bi-people" />
                  Cupo de hijos
                </h3>

                {(() => {
                  const baseLimit = Math.max(
                    1,
                    Number(
                      childSettings.baseChildrenLimit || 3,
                    ),
                  );

                  const effectiveLimit =
                    getEffectiveFamilyChildLimit(
                      selectedFamily,
                      childSettings,
                    );

                  const extraSlots = Math.max(
                    effectiveLimit - baseLimit,
                    0,
                  );

                  const extraPrice = Math.max(
                    0,
                    Number(
                      childSettings.extraChildPrice || 0,
                    ),
                  );

                  return (
                    <>
                      <div className="admin-children-limit__summary">
                        <div>
                          <small>Perfiles usados</small>
                          <strong>
                            {selectedFamily.childrenCount} de {effectiveLimit}
                          </strong>
                        </div>

                        <div>
                          <small>Incluidos</small>
                          <strong>{baseLimit}</strong>
                        </div>

                        <div>
                          <small>Cupos extra</small>
                          <strong>{extraSlots}</strong>
                        </div>
                      </div>

                      <div className="admin-children-limit__price">
                        <i className="bi bi-cash-coin" />
                        <span>
                          Valor de referencia por cada hijo extra:{' '}
                          <strong>
                            {currencyFormatter.format(extraPrice)}
                          </strong>
                        </span>
                      </div>

                      <div className="admin-children-limit__actions">
                        <button
                          type="button"
                          className="btn btn-outline-secondary"
                          onClick={() =>
                            handleAdjustChildrenLimit(
                              selectedFamily,
                              -1,
                            )
                          }
                          disabled={effectiveLimit <= baseLimit}
                        >
                          <i className="bi bi-dash-lg" />
                          Quitar 1 cupo
                        </button>

                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() =>
                            handleAdjustChildrenLimit(
                              selectedFamily,
                              1,
                            )
                          }
                          disabled={effectiveLimit >= 20}
                        >
                          <i className="bi bi-plus-lg" />
                          Habilitar +1 hijo
                        </button>
                      </div>
                    </>
                  );
                })()}
              </section>

              <section className="admin-detail-section">
                <h3>
                  <i className="bi bi-receipt" />
                  Pagos de esta familia
                </h3>

                {selectedFamilyPayments.length >
                0 ? (
                  <div className="admin-detail-payments">
                    {selectedFamilyPayments.map(
                      (payment) => (
                        <article
                          key={payment.id}
                        >
                          <div>
                            <strong>
                              {planLabels[
                                payment.plan
                              ]}
                            </strong>

                            <small>
                              {formatDate(
                                payment.paymentDate,
                              )}
                            </small>
                          </div>

                          <strong>
                            {currencyFormatter.format(
                              payment.amount,
                            )}
                          </strong>
                        </article>
                      ),
                    )}
                  </div>
                ) : (
                  <p className="admin-detail-section__empty">
                    Esta familia todavía no
                    tiene pagos registrados.
                  </p>
                )}
              </section>
            </div>

            <footer className="admin-modal__footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() =>
                  setSelectedFamilyId(null)
                }
              >
                Cerrar
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  );
}

export default AdminDashboardPage;