import {
  useMemo,
  useState,
} from 'react';

import FamilyAlertCard from '../../components/cards/FamilyAlertCard.jsx';

import { getChildren } from '../../services/childrenService.js';
import { getTreatments } from '../../services/treatmentsService.js';
import { getVaccines } from '../../services/vaccinesService.js';

import {
  getReminderRecords,
} from '../../services/remindersService.js';

import {
  getMedicineCabinetItems,
} from '../../services/medicineCabinetService.js';

import {
  buildFamilyAlerts,
} from '../../utils/alertUtils.js';

import '../../styles/alerts.css';

function AlertsPage() {
  const [children, setChildren] = useState(
    () => getChildren(),
  );

  const [treatments, setTreatments] =
    useState(() => getTreatments());

  const [
    reminderRecords,
    setReminderRecords,
  ] = useState(() =>
    getReminderRecords(),
  );

  const [vaccines, setVaccines] = useState(
    () => getVaccines(),
  );

  const [cabinetItems, setCabinetItems] =
    useState(() =>
      getMedicineCabinetItems(),
    );

  const [viewFilter, setViewFilter] =
    useState('all');

  const [typeFilter, setTypeFilter] =
    useState('all');

  const [childFilter, setChildFilter] =
    useState('all');

  const [searchTerm, setSearchTerm] =
    useState('');

  const alerts = useMemo(
    () =>
      buildFamilyAlerts({
        children,
        treatments,
        reminderRecords,
        vaccines,
        cabinetItems,
      }),
    [
      children,
      treatments,
      reminderRecords,
      vaccines,
      cabinetItems,
    ],
  );

  const filteredAlerts = useMemo(() => {
    const normalizedSearch = searchTerm
      .trim()
      .toLowerCase();

    return alerts.filter((alert) => {
      const matchesView =
        viewFilter === 'all' ||
        (viewFilter === 'urgent' &&
          alert.priority === 'urgent') ||
        (viewFilter === 'today' &&
          alert.group === 'today') ||
        (viewFilter === 'upcoming' &&
          alert.group === 'upcoming');

      const matchesType =
        typeFilter === 'all' ||
        alert.type === typeFilter;

      const matchesChild =
        childFilter === 'all' ||
        alert.childId === childFilter;

      const searchableValues = [
        alert.title,
        alert.description,
        alert.childName,
        alert.statusLabel,
        alert.dateLabel,
      ];

      const matchesSearch =
        !normalizedSearch ||
        searchableValues.some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(normalizedSearch),
        );

      return (
        matchesView &&
        matchesType &&
        matchesChild &&
        matchesSearch
      );
    });
  }, [
    alerts,
    viewFilter,
    typeFilter,
    childFilter,
    searchTerm,
  ]);

  const urgentCount = alerts.filter(
    (alert) =>
      alert.priority === 'urgent',
  ).length;

  const todayCount = alerts.filter(
    (alert) => alert.group === 'today',
  ).length;

  const stockCount = alerts.filter(
    (alert) => alert.type === 'stock',
  ).length;

  const upcomingCount = alerts.filter(
    (alert) => alert.group === 'upcoming',
  ).length;

  function refreshAlerts() {
    setChildren(getChildren());
    setTreatments(getTreatments());

    setReminderRecords(
      getReminderRecords(),
    );

    setVaccines(getVaccines());

    setCabinetItems(
      getMedicineCabinetItems(),
    );
  }

  return (
    <div className="alerts-page">
      <section className="alerts-page__header">
        <div>
          <span>Seguimiento familiar</span>

          <h2>Centro de alertas</h2>

          <p>
            Revisá las tomas pendientes, el stock,
            los vencimientos y las próximas vacunas.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={refreshAlerts}
        >
          <i className="bi bi-arrow-clockwise" />
          Actualizar alertas
        </button>
      </section>

      <section className="alerts-statistics">
        <article>
          <span className="alerts-statistics__icon alerts-statistics__icon--urgent">
            <i className="bi bi-exclamation-triangle" />
          </span>

          <div>
            <strong>{urgentCount}</strong>
            <span>Alertas urgentes</span>
          </div>
        </article>

        <article>
          <span className="alerts-statistics__icon alerts-statistics__icon--today">
            <i className="bi bi-calendar-day" />
          </span>

          <div>
            <strong>{todayCount}</strong>
            <span>Para revisar hoy</span>
          </div>
        </article>

        <article>
          <span className="alerts-statistics__icon alerts-statistics__icon--stock">
            <i className="bi bi-box-seam" />
          </span>

          <div>
            <strong>{stockCount}</strong>
            <span>Alertas del botiquín</span>
          </div>
        </article>

        <article>
          <span className="alerts-statistics__icon alerts-statistics__icon--upcoming">
            <i className="bi bi-calendar2-check" />
          </span>

          <div>
            <strong>{upcomingCount}</strong>
            <span>Próximas alertas</span>
          </div>
        </article>
      </section>

      <section className="alerts-view-tabs">
        <button
          type="button"
          className={
            viewFilter === 'all'
              ? 'is-active'
              : ''
          }
          onClick={() =>
            setViewFilter('all')
          }
        >
          <i className="bi bi-grid" />
          Todas
          <span>{alerts.length}</span>
        </button>

        <button
          type="button"
          className={
            viewFilter === 'urgent'
              ? 'is-active'
              : ''
          }
          onClick={() =>
            setViewFilter('urgent')
          }
        >
          <i className="bi bi-exclamation-triangle" />
          Urgentes
          <span>{urgentCount}</span>
        </button>

        <button
          type="button"
          className={
            viewFilter === 'today'
              ? 'is-active'
              : ''
          }
          onClick={() =>
            setViewFilter('today')
          }
        >
          <i className="bi bi-calendar-day" />
          Para hoy
          <span>{todayCount}</span>
        </button>

        <button
          type="button"
          className={
            viewFilter === 'upcoming'
              ? 'is-active'
              : ''
          }
          onClick={() =>
            setViewFilter('upcoming')
          }
        >
          <i className="bi bi-calendar2-week" />
          Próximas
          <span>{upcomingCount}</span>
        </button>
      </section>

      <section className="alerts-toolbar">
        <div className="alerts-toolbar__search">
          <i className="bi bi-search" />

          <input
            type="search"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(
                event.target.value,
              )
            }
            placeholder="Buscar medicamento, hijo o alerta"
            aria-label="Buscar alertas"
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
          value={childFilter}
          onChange={(event) =>
            setChildFilter(
              event.target.value,
            )
          }
          aria-label="Filtrar por hijo"
        >
          <option value="all">
            Todos los hijos
          </option>

          {children.map((child) => (
            <option
              key={child.id}
              value={child.id}
            >
              {child.fullName}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(event) =>
            setTypeFilter(
              event.target.value,
            )
          }
          aria-label="Filtrar por tipo"
        >
          <option value="all">
            Todos los tipos
          </option>

          <option value="dose">
            Medicamentos
          </option>

          <option value="stock">
            Botiquín
          </option>

          <option value="vaccine">
            Vacunas
          </option>

          <option value="treatment">
            Tratamientos
          </option>
        </select>
      </section>

      <div className="alerts-page__result">
        {filteredAlerts.length}{' '}

        {filteredAlerts.length === 1
          ? 'alerta encontrada'
          : 'alertas encontradas'}
      </div>

      {filteredAlerts.length > 0 ? (
        <section className="alerts-grid">
          {filteredAlerts.map((alert) => (
            <FamilyAlertCard
              key={alert.id}
              alert={alert}
            />
          ))}
        </section>
      ) : (
        <section className="alerts-empty">
          <span>
            <i className="bi bi-shield-check" />
          </span>

          <h3>
            {alerts.length === 0
              ? 'No hay alertas pendientes'
              : 'No encontramos resultados'}
          </h3>

          <p>
            {alerts.length === 0
              ? 'Las tomas, el stock, los vencimientos y las vacunas están controlados.'
              : 'Probá cambiando los filtros o utilizando otro término de búsqueda.'}
          </p>
        </section>
      )}
    </div>
  );
}

export default AlertsPage;