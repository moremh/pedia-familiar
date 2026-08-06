import {
  useMemo,
  useState,
} from 'react';

import MedicationHistoryCard from '../../components/cards/MedicationHistoryCard.jsx';

import { getChildren } from '../../services/childrenService.js';
import { getTreatments } from '../../services/treatmentsService.js';

import {
  getReminderRecords,
} from '../../services/remindersService.js';

import {
  buildMedicationHistory,
  calculateHistoryStats,
  downloadMedicationHistoryCsv,
  getLocalHistoryDateKey,
} from '../../utils/medicationHistoryUtils.js';

import '../../styles/medication-history.css';

function MedicationHistoryPage() {
  const [children] = useState(() =>
    getChildren(),
  );

  const [treatments] = useState(() =>
    getTreatments(),
  );

  const [records] = useState(() =>
    getReminderRecords(),
  );

  const [searchTerm, setSearchTerm] =
    useState('');

  const [statusFilter, setStatusFilter] =
    useState('all');

  const [childFilter, setChildFilter] =
    useState('all');

  const [
    treatmentFilter,
    setTreatmentFilter,
  ] = useState('all');

  const [
    responsibleFilter,
    setResponsibleFilter,
  ] = useState('all');

  const [dateFrom, setDateFrom] =
    useState('');

  const [dateTo, setDateTo] =
    useState('');

  const history = useMemo(
    () =>
      buildMedicationHistory({
        children,
        treatments,
        records,
      }),
    [children, treatments, records],
  );

  const statistics = useMemo(
    () => calculateHistoryStats(history),
    [history],
  );

  const treatmentOptions = useMemo(() => {
    const optionsMap = new Map();

    history.forEach((item) => {
      if (!optionsMap.has(item.treatmentKey)) {
        optionsMap.set(
          item.treatmentKey,
          item.medicationName,
        );
      }
    });

    return Array.from(
      optionsMap.entries(),
    )
      .map(([value, label]) => ({
        value,
        label,
      }))
      .sort((first, second) =>
        first.label.localeCompare(
          second.label,
          'es',
        ),
      );
  }, [history]);

  const responsibleOptions = useMemo(
    () =>
      Array.from(
        new Set(
          history
            .map(
              (item) =>
                item.responsibleName,
            )
            .filter(Boolean),
        ),
      ).sort((first, second) =>
        first.localeCompare(second, 'es'),
      ),
    [history],
  );

  const filteredHistory = useMemo(() => {
    const normalizedSearch = searchTerm
      .trim()
      .toLowerCase();

    return history.filter((item) => {
      const matchesStatus =
        statusFilter === 'all' ||
        item.status === statusFilter;

      const matchesChild =
        childFilter === 'all' ||
        item.childId === childFilter;

      const matchesTreatment =
        treatmentFilter === 'all' ||
        item.treatmentKey ===
          treatmentFilter;

      const matchesResponsible =
        responsibleFilter === 'all' ||
        item.responsibleName ===
          responsibleFilter;

      const actionDateKey =
        getLocalHistoryDateKey(
          item.actionAt,
        );

      const matchesDateFrom =
        !dateFrom ||
        (actionDateKey &&
          actionDateKey >= dateFrom);

      const matchesDateTo =
        !dateTo ||
        (actionDateKey &&
          actionDateKey <= dateTo);

      const searchableValues = [
        item.childName,
        item.medicationName,
        item.presentation,
        item.dosageInstruction,
        item.responsibleName,
        item.notes,
      ];

      const matchesSearch =
        !normalizedSearch ||
        searchableValues.some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(normalizedSearch),
        );

      return (
        matchesStatus &&
        matchesChild &&
        matchesTreatment &&
        matchesResponsible &&
        matchesDateFrom &&
        matchesDateTo &&
        matchesSearch
      );
    });
  }, [
    history,
    statusFilter,
    childFilter,
    treatmentFilter,
    responsibleFilter,
    dateFrom,
    dateTo,
    searchTerm,
  ]);

  function clearFilters() {
    setSearchTerm('');
    setStatusFilter('all');
    setChildFilter('all');
    setTreatmentFilter('all');
    setResponsibleFilter('all');
    setDateFrom('');
    setDateTo('');
  }

  function handleExport() {
    if (filteredHistory.length === 0) {
      window.alert(
        'No hay registros para exportar.',
      );

      return;
    }

    downloadMedicationHistoryCsv(
      filteredHistory,
    );
  }

  const hasActiveFilters =
    searchTerm ||
    statusFilter !== 'all' ||
    childFilter !== 'all' ||
    treatmentFilter !== 'all' ||
    responsibleFilter !== 'all' ||
    dateFrom ||
    dateTo;

  return (
    <div className="medication-history-page">
      <section className="medication-history-page__header">
        <div>
          <span>Seguimiento de tratamientos</span>

          <h2>Historial de medicación</h2>

          <p>
            Consultá quién administró u omitió cada
            toma y exportá el registro familiar.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleExport}
          disabled={
            filteredHistory.length === 0
          }
        >
          <i className="bi bi-file-earmark-spreadsheet" />
          Exportar historial
        </button>
      </section>

      <section className="medication-history-statistics">
        <article>
          <span className="medication-history-statistics__icon">
            <i className="bi bi-clock-history" />
          </span>

          <div>
            <strong>
              {statistics.total}
            </strong>

            <span>Acciones registradas</span>
          </div>
        </article>

        <article>
          <span className="medication-history-statistics__icon medication-history-statistics__icon--administered">
            <i className="bi bi-check-circle" />
          </span>

          <div>
            <strong>
              {statistics.administered}
            </strong>

            <span>Tomas administradas</span>
          </div>
        </article>

        <article>
          <span className="medication-history-statistics__icon medication-history-statistics__icon--omitted">
            <i className="bi bi-x-circle" />
          </span>

          <div>
            <strong>
              {statistics.omitted}
            </strong>

            <span>Tomas omitidas</span>
          </div>
        </article>

        <article>
          <span className="medication-history-statistics__icon medication-history-statistics__icon--percentage">
            <i className="bi bi-graph-up-arrow" />
          </span>

          <div>
            <strong>
              {statistics.adherencePercentage}%
            </strong>

            <span>Administradas del total</span>
          </div>
        </article>
      </section>

      <section className="medication-history-filters">
        <div className="medication-history-filters__search">
          <i className="bi bi-search" />

          <input
            type="search"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(
                event.target.value,
              )
            }
            placeholder="Buscar hijo, medicamento o responsable"
            aria-label="Buscar historial"
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

          <option value="administered">
            Administradas
          </option>

          <option value="omitted">
            Omitidas
          </option>
        </select>

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
          value={treatmentFilter}
          onChange={(event) =>
            setTreatmentFilter(
              event.target.value,
            )
          }
          aria-label="Filtrar por medicamento"
        >
          <option value="all">
            Todos los medicamentos
          </option>

          {treatmentOptions.map(
            (option) => (
              <option
                key={option.value}
                value={option.value}
              >
                {option.label}
              </option>
            ),
          )}
        </select>

        <select
          value={responsibleFilter}
          onChange={(event) =>
            setResponsibleFilter(
              event.target.value,
            )
          }
          aria-label="Filtrar por responsable"
        >
          <option value="all">
            Todos los responsables
          </option>

          {responsibleOptions.map(
            (responsibleName) => (
              <option
                key={responsibleName}
                value={responsibleName}
              >
                {responsibleName}
              </option>
            ),
          )}
        </select>

        <div className="medication-history-filters__date">
          <label htmlFor="historyDateFrom">
            Desde
          </label>

          <input
            type="date"
            id="historyDateFrom"
            value={dateFrom}
            onChange={(event) =>
              setDateFrom(event.target.value)
            }
          />
        </div>

        <div className="medication-history-filters__date">
          <label htmlFor="historyDateTo">
            Hasta
          </label>

          <input
            type="date"
            id="historyDateTo"
            value={dateTo}
            onChange={(event) =>
              setDateTo(event.target.value)
            }
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            className="medication-history-filters__clear"
            onClick={clearFilters}
          >
            <i className="bi bi-funnel" />
            Limpiar filtros
          </button>
        )}
      </section>

      <div className="medication-history-page__result">
        {filteredHistory.length}{' '}

        {filteredHistory.length === 1
          ? 'registro encontrado'
          : 'registros encontrados'}
      </div>

      {filteredHistory.length > 0 ? (
        <section className="medication-history-grid">
          {filteredHistory.map(
            (historyItem) => (
              <MedicationHistoryCard
                key={historyItem.id}
                historyItem={historyItem}
              />
            ),
          )}
        </section>
      ) : (
        <section className="medication-history-empty">
          <span>
            <i className="bi bi-clock-history" />
          </span>

          <h3>
            {history.length === 0
              ? 'Todavía no hay acciones registradas'
              : 'No encontramos resultados'}
          </h3>

          <p>
            {history.length === 0
              ? 'Las tomas administradas u omitidas aparecerán automáticamente en este historial.'
              : 'Probá cambiando los filtros, las fechas o el término de búsqueda.'}
          </p>
        </section>
      )}
    </div>
  );
}

export default MedicationHistoryPage;