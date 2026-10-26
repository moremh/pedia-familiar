import {
  useMemo,
  useState,
} from 'react';

import { Link } from 'react-router-dom';

import {
  getChildren,
} from '../../services/childrenService.js';

import {
  getConsultations,
} from '../../services/consultationsService.js';

import {
  getDocuments,
} from '../../services/documentsService.js';

import {
  getTreatments,
} from '../../services/treatmentsService.js';

import {
  getVaccines,
} from '../../services/vaccinesService.js';

import {
  getReminderRecords,
} from '../../services/remindersService.js';

import {
  getMedicineCabinetItems,
} from '../../services/medicineCabinetService.js';

import {
  getActiveCaregiver,
} from '../../services/caregiversService.js';

import {
  getCurrentFamilySubscription,
  getFamilyExpirationDate,
} from '../../services/subscriptionService.js';

import {
  formatReminderTime,
  generateReminderOccurrences,
  getReminderEffectiveDate,
  isReminderToday,
  isReminderUpcoming,
} from '../../utils/reminderUtils.js';

import {
  getTreatmentStatus,
} from '../../utils/treatmentUtils.js';

import {
  getExpirationDescription,
  getMedicineCabinetState,
  getMedicineCabinetStateLabel,
  getStockUnitLabel,
} from '../../utils/medicineCabinetUtils.js';

import {
  formatShortVaccineDate,
  getVaccineState,
  getVaccineStateLabel,
} from '../../utils/vaccineUtils.js';

import '../../styles/family-dashboard.css';

const TRIAL_DURATION_DAYS = 7;

const trialDateFormatter =
  new Intl.DateTimeFormat(
    'es-AR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    },
  );

const quickActions = [
  {
    title: 'Nuevo tratamiento',
    description:
      'Registrar un medicamento y sus horarios.',
    icon: 'bi-capsule-pill',
    path: '/dashboard/treatments',
  },
  {
    title: 'Ver recordatorios',
    description:
      'Revisar las próximas tomas.',
    icon: 'bi-bell',
    path: '/dashboard/reminders',
  },
  {
    title: 'Agregar al botiquín',
    description:
      'Controlar stock y vencimientos.',
    icon: 'bi-box-seam',
    path: '/dashboard/medicine-cabinet',
  },
  {
    title: 'Subir documento',
    description:
      'Guardar una receta o estudio.',
    icon: 'bi-file-earmark-plus',
    path: '/dashboard/documents',
  },
  {
    title: 'Registrar consulta',
    description:
      'Guardar una atención médica.',
    icon: 'bi-clipboard2-plus',
    path: '/dashboard/consultations',
  },
  {
    title: 'Programar turno',
    description:
      'Agendar una consulta futura con recordatorio.',
    icon: 'bi-calendar-event',
    path: '/dashboard/appointments',
  },
  {
    title: 'Responsables',
    description:
      'Gestionar cuidadores familiares.',
    icon: 'bi-people',
    path: '/dashboard/caregivers',
  },
];

function getLocalDateKey(
  date = new Date(),
) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    date.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getChildInitials(
  fullName = '',
) {
  const names = fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (names.length === 0) {
    return 'HI';
  }

  return names
    .slice(0, 2)
    .map((name) => name[0])
    .join('')
    .toUpperCase();
}

function getChildAge(birthDate) {
  if (!birthDate) {
    return 'Edad no registrada';
  }

  const birth = new Date(
    `${birthDate}T00:00:00`,
  );

  if (Number.isNaN(birth.getTime())) {
    return 'Edad no registrada';
  }

  const today = new Date();

  let years =
    today.getFullYear() -
    birth.getFullYear();

  const monthDifference =
    today.getMonth() -
    birth.getMonth();

  if (
    monthDifference < 0 ||
    (monthDifference === 0 &&
      today.getDate() <
        birth.getDate())
  ) {
    years -= 1;
  }

  if (years <= 0) {
    let months =
      (today.getFullYear() -
        birth.getFullYear()) *
        12 +
      today.getMonth() -
      birth.getMonth();

    if (
      today.getDate() <
      birth.getDate()
    ) {
      months -= 1;
    }

    const normalizedMonths =
      Math.max(months, 0);

    return `${normalizedMonths} ${
      normalizedMonths === 1
        ? 'mes'
        : 'meses'
    }`;
  }

  return `${years} ${
    years === 1
      ? 'año'
      : 'años'
  }`;
}

function formatAllergies(allergies) {
  if (!allergies) {
    return 'No registradas';
  }

  if (Array.isArray(allergies)) {
    return allergies.length > 0
      ? allergies.join(', ')
      : 'No registradas';
  }

  return (
    String(allergies).trim() ||
    'No registradas'
  );
}

function formatDashboardDate() {
  const formattedDate =
    new Intl.DateTimeFormat(
      'es-AR',
      {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      },
    ).format(new Date());

  return (
    formattedDate
      .charAt(0)
      .toUpperCase() +
    formattedDate.slice(1)
  );
}

function formatConsultationDate(
  dateValue,
) {
  if (!dateValue) {
    return 'Sin fecha';
  }

  const date = new Date(
    `${dateValue}T00:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
    return 'Sin fecha';
  }

  return new Intl.DateTimeFormat(
    'es-AR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    },
  ).format(date);
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Buenos días';
  }

  if (hour < 20) {
    return 'Buenas tardes';
  }

  return 'Buenas noches';
}

function getRemainingTrialDays(
  expirationDate,
) {
  if (!expirationDate) {
    return null;
  }

  const difference =
    expirationDate.getTime() -
    new Date().getTime();

  return Math.max(
    0,
    Math.ceil(
      difference /
        (1000 * 60 * 60 * 24),
    ),
  );
}

function FamilyDashboardPage() {
  const [familySubscription] =
    useState(() =>
      getCurrentFamilySubscription(),
    );

  const [children] = useState(() =>
    getChildren(),
  );

  const [treatments] = useState(() =>
    getTreatments(),
  );

  const [consultations] = useState(() =>
    getConsultations(),
  );

  const [documents] = useState(() =>
    getDocuments(),
  );

  const [vaccines] = useState(() =>
    getVaccines(),
  );

  const [cabinetItems] = useState(() =>
    getMedicineCabinetItems(),
  );

  const [reminderRecords] =
    useState(() =>
      getReminderRecords(),
    );

  const [activeCaregiver] =
    useState(() =>
      getActiveCaregiver(),
    );

  const isTrialActive =
    familySubscription?.status ===
    'trial';

  const trialExpirationDate =
    isTrialActive
      ? getFamilyExpirationDate(
          familySubscription,
        )
      : null;

  const remainingTrialDays =
    getRemainingTrialDays(
      trialExpirationDate,
    );

  const trialProgress =
    remainingTrialDays === null
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            (remainingTrialDays /
              TRIAL_DURATION_DAYS) *
              100,
          ),
        );

  const childrenMap = useMemo(
    () =>
      Object.fromEntries(
        children.map((child) => [
          child.id,
          child,
        ]),
      ),
    [children],
  );

  const reminders = useMemo(
    () =>
      generateReminderOccurrences({
        treatments,
        records: reminderRecords,
        childrenMap,
        daysBack: 7,
        daysForward: 30,
      }),
    [
      treatments,
      reminderRecords,
      childrenMap,
    ],
  );

  const activeTreatments = useMemo(
    () =>
      treatments.filter(
        (treatment) =>
          [
            'active',
            'scheduled',
          ].includes(
            getTreatmentStatus(
              treatment,
            ),
          ),
      ),
    [treatments],
  );

  const todayReminders = useMemo(
    () =>
      reminders.filter(
        isReminderToday,
      ),
    [reminders],
  );

  const pendingToday = useMemo(
    () =>
      todayReminders.filter(
        (reminder) =>
          [
            'pending',
            'postponed',
          ].includes(
            reminder.status,
          ),
      ),
    [todayReminders],
  );

  const nextReminders = useMemo(
    () =>
      reminders
        .filter(
          (reminder) =>
            [
              'pending',
              'postponed',
            ].includes(
              reminder.status,
            ) &&
            (
              isReminderToday(
                reminder,
              ) ||
              isReminderUpcoming(
                reminder,
              )
            ),
        )
        .sort(
          (
            firstReminder,
            secondReminder,
          ) =>
            getReminderEffectiveDate(
              firstReminder,
            ).getTime() -
            getReminderEffectiveDate(
              secondReminder,
            ).getTime(),
        )
        .slice(0, 4),
    [reminders],
  );

  const cabinetAlerts = useMemo(
    () =>
      cabinetItems
        .map((item) => {
          const state =
            getMedicineCabinetState(
              item,
            );

          const isStockAlert = [
            'lowStock',
            'outOfStock',
          ].includes(state);

          return {
            id: `cabinet-${item.id}`,
            type: 'cabinet',
            state,
            title: item.medicineName,
            description: isStockAlert
              ? `${item.currentStock} ${getStockUnitLabel(
                  item.stockUnit,
                )} disponibles`
              : getExpirationDescription(
                  item,
                ),
            label:
              getMedicineCabinetStateLabel(
                item,
              ),
            path:
              '/dashboard/medicine-cabinet',
          };
        })
        .filter(
          (alert) =>
            alert.state !==
            'available',
        ),
    [cabinetItems],
  );

  const vaccineAlerts = useMemo(
    () =>
      vaccines
        .map((vaccine) => {
          const state =
            getVaccineState(vaccine);

          return {
            id: `vaccine-${vaccine.id}`,
            type: 'vaccine',
            state,
            title:
              vaccine.vaccineName,
            description:
              vaccine.nextDoseDate
                ? `${
                    childrenMap[
                      vaccine.childId
                    ]?.fullName ??
                    'Hijo'
                  } · ${formatShortVaccineDate(
                    vaccine.nextDoseDate,
                  )}`
                : 'Sin próxima fecha registrada',
            label:
              getVaccineStateLabel(
                vaccine,
              ),
            path:
              '/dashboard/vaccines',
          };
        })
        .filter((alert) =>
          [
            'upcoming',
            'today',
            'overdue',
          ].includes(
            alert.state,
          ),
        ),
    [vaccines, childrenMap],
  );

  const allAlerts = useMemo(
    () => [
      ...cabinetAlerts,
      ...vaccineAlerts,
    ],
    [
      cabinetAlerts,
      vaccineAlerts,
    ],
  );

  const visibleAlerts = useMemo(
    () => allAlerts.slice(0, 5),
    [allAlerts],
  );

  const recentConsultations =
    useMemo(
      () =>
        [...consultations]
          .sort(
            (
              first,
              second,
            ) => {
              const firstDate =
                new Date(
                  `${
                    first.consultationDate ||
                    '1970-01-01'
                  }T${
                    first.consultationTime ||
                    '00:00'
                  }`,
                ).getTime();

              const secondDate =
                new Date(
                  `${
                    second.consultationDate ||
                    '1970-01-01'
                  }T${
                    second.consultationTime ||
                    '00:00'
                  }`,
                ).getTime();

              return (
                secondDate -
                firstDate
              );
            },
          )
          .slice(0, 3),
      [consultations],
    );

  const summaryCards = [
    {
      label:
        'Perfiles infantiles',
      value: children.length,
      description:
        'Hijos registrados',
      icon:
        'bi-person-hearts',
      className: 'children',
      path:
        '/dashboard/children',
    },
    {
      label:
        'Tratamientos activos',
      value:
        activeTreatments.length,
      description:
        'En seguimiento',
      icon:
        'bi-capsule-pill',
      className: 'treatments',
      path:
        '/dashboard/treatments',
    },
    {
      label:
        'Pendientes hoy',
      value:
        pendingToday.length,
      description: `${
        todayReminders.length
      } ${
        todayReminders.length ===
        1
          ? 'toma programada'
          : 'tomas programadas'
      }`,
      icon: 'bi-bell',
      className: 'reminders',
      path:
        '/dashboard/reminders',
    },
    {
      label: 'Alertas',
      value: allAlerts.length,
      description:
        'Stock, vencimientos y vacunas',
      icon:
        'bi-exclamation-triangle',
      className: 'alerts',
      path:
        '/dashboard/alerts',
    },
  ];

  const currentDateKey =
    getLocalDateKey();

  return (
    <div className="family-dashboard">
      <section className="family-dashboard__welcome">
        <div>
          <span className="family-dashboard__eyebrow">
            {formatDashboardDate()}
          </span>

          <h2>
            {getGreeting()}
            {activeCaregiver
              ? `, ${activeCaregiver.fullName}`
              : ''}
          </h2>

          <p>
            Revisá medicamentos, turnos,
            tratamientos y recordatorios
            de tus hijos desde un solo
            lugar.
          </p>
        </div>

        <Link
          to="/dashboard/reminders"
          className="btn btn-light family-dashboard__welcome-button"
        >
          <i className="bi bi-bell" />
          Ver recordatorios
        </Link>
      </section>

      {isTrialActive && (
        <section
          className="family-trial-card"
          aria-label="Estado de la prueba gratuita"
        >
          <span className="family-trial-card__icon">
            <i className="bi bi-clock-history" />
          </span>

          <div className="family-trial-card__content">
            <div className="family-trial-card__header">
              <div>
                <strong>
                  Prueba gratuita activa
                </strong>

                <p>
                  {trialExpirationDate
                    ? `Finaliza el ${trialDateFormatter.format(
                        trialExpirationDate,
                      )}.`
                    : 'Tenés acceso completo durante el período gratuito.'}
                </p>
              </div>

              <span>
                {remainingTrialDays ===
                null
                  ? '7 días de prueba'
                  : remainingTrialDays ===
                      0
                    ? 'Vence hoy'
                    : `${remainingTrialDays} ${
                        remainingTrialDays ===
                        1
                          ? 'día restante'
                          : 'días restantes'
                      }`}
              </span>
            </div>

            <div
              className="progress family-trial-card__progress"
              role="progressbar"
              aria-label="Días restantes de la prueba gratuita"
              aria-valuemin="0"
              aria-valuemax="7"
              aria-valuenow={
                remainingTrialDays ?? 7
              }
            >
              <div
                className="progress-bar"
                style={{
                  width: `${trialProgress}%`,
                }}
              />
            </div>
          </div>
        </section>
      )}

      <section className="family-dashboard__summary">
        {summaryCards.map(
          (card) => (
            <Link
              key={card.label}
              to={card.path}
              className={`family-dashboard-summary family-dashboard-summary--${card.className}`}
            >
              <span className="family-dashboard-summary__icon">
                <i
                  className={`bi ${card.icon}`}
                />
              </span>

              <div>
                <span>
                  {card.label}
                </span>

                <strong>
                  {card.value}
                </strong>

                <small>
                  {card.description}
                </small>
              </div>

              <i className="bi bi-arrow-up-right" />
            </Link>
          ),
        )}
      </section>

      <div className="family-dashboard__main-grid">
        <section className="family-dashboard-panel">
          <header className="family-dashboard-panel__header">
            <div>
              <span>
                Seguimiento diario
              </span>

              <h3>
                Próximas tomas
              </h3>
            </div>

            <Link to="/dashboard/reminders">
              Ver todas
              <i className="bi bi-arrow-right" />
            </Link>
          </header>

          {nextReminders.length >
          0 ? (
            <div className="family-dashboard-doses">
              {nextReminders.map(
                (reminder) => {
                  const reminderDate =
                    getReminderEffectiveDate(
                      reminder,
                    );

                  const reminderDateKey =
                    getLocalDateKey(
                      reminderDate,
                    );

                  return (
                    <article
                      key={reminder.id}
                      className="family-dashboard-dose"
                    >
                      <div className="family-dashboard-dose__time">
                        <strong>
                          {formatReminderTime(
                            reminderDate,
                          )}
                        </strong>

                        <span>
                          {reminderDateKey ===
                          currentDateKey
                            ? 'Hoy'
                            : new Intl.DateTimeFormat(
                                'es-AR',
                                {
                                  day: '2-digit',
                                  month:
                                    'short',
                                },
                              ).format(
                                reminderDate,
                              )}
                        </span>
                      </div>

                      <span className="family-dashboard-dose__icon">
                        <i className="bi bi-capsule-pill" />
                      </span>

                      <div className="family-dashboard-dose__information">
                        <strong>
                          {
                            reminder.medicationName
                          }
                        </strong>

                        <span>
                          {
                            reminder.childName
                          }

                          {reminder.dosageInstruction
                            ? ` · ${reminder.dosageInstruction}`
                            : ''}
                        </span>
                      </div>

                      <span
                        className={`family-dashboard-dose__status family-dashboard-dose__status--${reminder.status}`}
                      >
                        {reminder.status ===
                        'postponed'
                          ? 'Pospuesta'
                          : 'Pendiente'}
                      </span>
                    </article>
                  );
                },
              )}
            </div>
          ) : (
            <div className="family-dashboard-panel__empty">
              <i className="bi bi-check-circle" />

              <strong>
                No hay tomas pendientes
              </strong>

              <p>
                Las próximas tomas
                aparecerán aquí
                automáticamente.
              </p>
            </div>
          )}
        </section>

        <section className="family-dashboard-panel">
          <header className="family-dashboard-panel__header">
            <div>
              <span>
                Atención necesaria
              </span>

              <h3>
                Alertas importantes
              </h3>
            </div>

            <Link to="/dashboard/alerts">
              Ver todas
              <i className="bi bi-arrow-right" />
            </Link>
          </header>

          {visibleAlerts.length >
          0 ? (
            <div className="family-dashboard-alerts">
              {visibleAlerts.map(
                (alert) => (
                  <Link
                    key={alert.id}
                    to={alert.path}
                    className={`family-dashboard-alert family-dashboard-alert--${alert.state}`}
                  >
                    <span className="family-dashboard-alert__icon">
                      <i
                        className={`bi ${
                          alert.type ===
                          'vaccine'
                            ? 'bi-shield-plus'
                            : 'bi-capsule'
                        }`}
                      />
                    </span>

                    <div>
                      <strong>
                        {alert.title}
                      </strong>

                      <p>
                        {
                          alert.description
                        }
                      </p>
                    </div>

                    <span className="family-dashboard-alert__label">
                      {alert.label}
                    </span>
                  </Link>
                ),
              )}
            </div>
          ) : (
            <div className="family-dashboard-panel__empty">
              <i className="bi bi-shield-check" />

              <strong>
                No hay alertas
                importantes
              </strong>

              <p>
                El stock, los
                vencimientos y las
                próximas vacunas están
                controlados.
              </p>
            </div>
          )}
        </section>
      </div>

      <section className="family-dashboard-panel family-dashboard-panel--actions">
        <header className="family-dashboard-panel__header">
          <div>
            <span>
              Accesos directos
            </span>

            <h3>
              ¿Qué necesitás hacer?
            </h3>
          </div>
        </header>

        <div className="family-dashboard-actions">
          {quickActions.map(
            (action) => (
              <Link
                key={action.title}
                to={action.path}
                className="family-dashboard-action"
              >
                <span className="family-dashboard-action__icon">
                  <i
                    className={`bi ${action.icon}`}
                  />
                </span>

                <span>
                  <strong>
                    {action.title}
                  </strong>

                  <small>
                    {
                      action.description
                    }
                  </small>
                </span>

                <i className="bi bi-chevron-right" />
              </Link>
            ),
          )}
        </div>
      </section>

      <div className="family-dashboard__secondary-grid">
        <section className="family-dashboard-panel">
          <header className="family-dashboard-panel__header">
            <div>
              <span>
                Perfiles familiares
              </span>

              <h3>Mis hijos</h3>
            </div>

            <Link to="/dashboard/children">
              Ver perfiles
              <i className="bi bi-arrow-right" />
            </Link>
          </header>

          {children.length > 0 ? (
            <div className="family-dashboard-children">
              {children
                .slice(0, 4)
                .map((child) => (
                  <article
                    key={child.id}
                    className="family-dashboard-child"
                  >
                    <span className="family-dashboard-child__avatar">
                      {getChildInitials(
                        child.fullName,
                      )}
                    </span>

                    <div className="family-dashboard-child__information">
                      <h4>
                        {child.fullName}
                      </h4>

                      <p>
                        {getChildAge(
                          child.birthDate,
                        )}
                      </p>

                      <dl>
                        <div>
                          <dt>
                            Grupo sanguíneo
                          </dt>

                          <dd>
                            {child.bloodType ||
                              'No registrado'}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Alergias
                          </dt>

                          <dd>
                            {formatAllergies(
                              child.allergies,
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <Link
                      to="/dashboard/children"
                      aria-label={`Abrir perfil de ${child.fullName}`}
                    >
                      <i className="bi bi-arrow-up-right" />
                    </Link>
                  </article>
                ))}
            </div>
          ) : (
            <div className="family-dashboard-panel__empty">
              <i className="bi bi-person-plus" />

              <strong>
                No hay hijos registrados
              </strong>

              <p>
                Creá el primer perfil
                infantil para comenzar.
              </p>

              <Link
                to="/dashboard/children"
                className="btn btn-primary"
              >
                Agregar hijo
              </Link>
            </div>
          )}
        </section>

        <section className="family-dashboard-panel">
          <header className="family-dashboard-panel__header">
            <div>
              <span>
                Historial médico
              </span>

              <h3>
                Consultas recientes
              </h3>
            </div>

            <Link to="/dashboard/consultations">
              Ver consultas
              <i className="bi bi-arrow-right" />
            </Link>
          </header>

          {recentConsultations.length >
          0 ? (
            <div className="family-dashboard-consultations">
              {recentConsultations.map(
                (consultation) => (
                  <article
                    key={
                      consultation.id
                    }
                    className="family-dashboard-consultation"
                  >
                    <span className="family-dashboard-consultation__icon">
                      <i className="bi bi-clipboard2-pulse" />
                    </span>

                    <div>
                      <strong>
                        {consultation.reason ||
                          'Consulta médica'}
                      </strong>

                      <p>
                        {childrenMap[
                          consultation
                            .childId
                        ]?.fullName ??
                          'Perfil no disponible'}
                      </p>

                      <small>
                        {formatConsultationDate(
                          consultation.consultationDate,
                        )}

                        {consultation.professionalName
                          ? ` · ${consultation.professionalName}`
                          : ''}
                      </small>
                    </div>
                  </article>
                ),
              )}
            </div>
          ) : (
            <div className="family-dashboard-panel__empty">
              <i className="bi bi-clipboard2" />

              <strong>
                No hay consultas
                registradas
              </strong>

              <p>
                Las consultas médicas
                recientes aparecerán aquí.
              </p>
            </div>
          )}

          <footer className="family-dashboard-panel__footer">
            <span>
              <i className="bi bi-folder2-open" />

              {documents.length}{' '}

              {documents.length === 1
                ? 'documento guardado'
                : 'documentos guardados'}
            </span>

            <Link to="/dashboard/documents">
              Ver documentos
            </Link>
          </footer>
        </section>
      </div>
    </div>
  );
}

export default FamilyDashboardPage;