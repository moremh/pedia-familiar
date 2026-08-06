import {
  useMemo,
  useState,
} from 'react';

import { Link } from 'react-router-dom';

import VaccineForm from '../../components/forms/VaccineForm.jsx';

import {
  getChildren,
} from '../../services/childrenService.js';

import {
  createVaccine,
  deleteVaccine,
  getVaccines,
  updateVaccine,
} from '../../services/vaccinesService.js';

import {
  formatVaccineDate,
  getNextDoseDescription,
  getVaccineState,
} from '../../utils/vaccineUtils.js';

import '../../styles/vaccines.css';

function getRecordStatus(vaccine) {
  if (
    vaccine.recordStatus ===
      'applied' ||
    vaccine.recordStatus === 'pending'
  ) {
    return vaccine.recordStatus;
  }

  return vaccine.applicationDate
    ? 'applied'
    : 'pending';
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

function VaccinesPage() {
  const [children] = useState(() =>
    getChildren(),
  );

  const [vaccines, setVaccines] =
    useState(() => getVaccines());

  const [searchTerm, setSearchTerm] =
    useState('');

  const [childFilter, setChildFilter] =
    useState('all');

  const [statusFilter, setStatusFilter] =
    useState('all');

  const [showFilters, setShowFilters] =
    useState(false);

  const [isFormOpen, setIsFormOpen] =
    useState(false);

  const [
    editingVaccine,
    setEditingVaccine,
  ] = useState(null);

  const [
    selectedVaccine,
    setSelectedVaccine,
  ] = useState(null);

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

  const filteredVaccines = useMemo(
    () => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase();

      return vaccines.filter(
        (vaccine) => {
          const child =
            childrenMap[
              vaccine.childId
            ];

          const recordStatus =
            getRecordStatus(vaccine);

          const matchesChild =
            childFilter === 'all' ||
            vaccine.childId ===
              childFilter;

          const matchesStatus =
            statusFilter === 'all' ||
            recordStatus ===
              statusFilter;

          const searchableValues = [
            child?.fullName,
            vaccine.vaccineName,
            vaccine.doseLabel,
            vaccine.observations,
          ];

          const matchesSearch =
            !normalizedSearch ||
            searchableValues.some(
              (value) =>
                String(value ?? '')
                  .toLowerCase()
                  .includes(
                    normalizedSearch,
                  ),
            );

          return (
            matchesChild &&
            matchesStatus &&
            matchesSearch
          );
        },
      );
    },
    [
      vaccines,
      childrenMap,
      childFilter,
      statusFilter,
      searchTerm,
    ],
  );

  const appliedCount =
    vaccines.filter(
      (vaccine) =>
        getRecordStatus(vaccine) ===
        'applied',
    ).length;

  const pendingCount =
    vaccines.filter(
      (vaccine) =>
        getRecordStatus(vaccine) ===
        'pending',
    ).length;

  const overdueCount =
    vaccines.filter(
      (vaccine) =>
        getRecordStatus(vaccine) ===
          'pending' &&
        getVaccineState(vaccine) ===
          'overdue',
    ).length;

  const hasActiveFilters =
    childFilter !== 'all' ||
    statusFilter !== 'all';

  function refreshVaccines() {
    setVaccines(getVaccines());
  }

  function openCreateForm() {
    if (children.length === 0) {
      return;
    }

    setEditingVaccine(null);
    setSelectedVaccine(null);
    setIsFormOpen(true);
  }

  function openEditForm(vaccine) {
    setSelectedVaccine(null);
    setEditingVaccine(vaccine);
    setIsFormOpen(true);
  }

  function closeForm() {
    setEditingVaccine(null);
    setIsFormOpen(false);
  }

  async function handleSaveVaccine(
    data,
  ) {
    if (editingVaccine) {
      updateVaccine(
        editingVaccine.id,
        data,
      );
    } else {
      createVaccine(data);
    }

    refreshVaccines();
    closeForm();
  }

  function handleDeleteVaccine(
    vaccine,
  ) {
    const confirmed = window.confirm(
      `¿Eliminar el registro de ${vaccine.vaccineName}?`,
    );

    if (!confirmed) {
      return;
    }

    deleteVaccine(vaccine.id);

    if (
      selectedVaccine?.id ===
      vaccine.id
    ) {
      setSelectedVaccine(null);
    }

    refreshVaccines();
  }

  function clearFilters() {
    setChildFilter('all');
    setStatusFilter('all');
  }

  return (
    <div className="vaccines-page">
      <section className="vaccines-page__header">
        <div>
          <span>Control familiar</span>

          <h2>Vacunas</h2>

          <p>
            Guardá las vacunas aplicadas y
            las que todavía están pendientes.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateForm}
          disabled={
            children.length === 0
          }
        >
          <i className="bi bi-plus-lg" />
          Agregar vacuna
        </button>
      </section>

      {children.length === 0 && (
        <section className="vaccines-page__warning">
          <i className="bi bi-person-plus" />

          <div>
            <strong>
              Primero agregá un hijo
            </strong>

            <p>
              Después podrás guardar sus
              vacunas.
            </p>
          </div>

          <Link
            to="/dashboard/children"
            className="btn btn-outline-primary"
          >
            Agregar hijo
          </Link>
        </section>
      )}

      <section className="vaccines-statistics">
        <article>
          <span className="vaccines-statistics__icon">
            <i className="bi bi-shield-check" />
          </span>

          <div>
            <strong>{appliedCount}</strong>
            <span>Aplicadas</span>
          </div>
        </article>

        <article>
          <span className="vaccines-statistics__icon vaccines-statistics__icon--upcoming">
            <i className="bi bi-calendar-event" />
          </span>

          <div>
            <strong>{pendingCount}</strong>
            <span>Pendientes</span>
          </div>
        </article>

        <article>
          <span className="vaccines-statistics__icon vaccines-statistics__icon--overdue">
            <i className="bi bi-exclamation-triangle" />
          </span>

          <div>
            <strong>{overdueCount}</strong>
            <span>Atrasadas</span>
          </div>
        </article>
      </section>

      <section className="vaccines-toolbar">
        <div className="vaccines-toolbar__search">
          <i className="bi bi-search" />

          <input
            type="search"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(
                event.target.value,
              )
            }
            placeholder="Buscar vacuna o hijo"
            aria-label="Buscar vacunas"
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

        <button
          type="button"
          className={`vaccines-toolbar__filter-button ${
            showFilters ||
            hasActiveFilters
              ? 'is-active'
              : ''
          }`}
          onClick={() =>
            setShowFilters(
              (currentValue) =>
                !currentValue,
            )
          }
        >
          <i className="bi bi-funnel" />
          Filtros

          {hasActiveFilters && (
            <span />
          )}
        </button>
      </section>

      {showFilters && (
        <section className="vaccines-toolbar__filters">
          <select
            value={childFilter}
            onChange={(event) =>
              setChildFilter(
                event.target.value,
              )
            }
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
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value,
              )
            }
          >
            <option value="all">
              Todos los estados
            </option>

            <option value="applied">
              Aplicadas
            </option>

            <option value="pending">
              Pendientes
            </option>
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
            >
              <i className="bi bi-x-lg" />
              Limpiar
            </button>
          )}
        </section>
      )}

      <div className="vaccines-page__result">
        {filteredVaccines.length}{' '}

        {filteredVaccines.length === 1
          ? 'vacuna'
          : 'vacunas'}
      </div>

      {filteredVaccines.length > 0 ? (
        <section className="vaccines-grid">
          {filteredVaccines.map(
            (vaccine) => {
              const child =
                childrenMap[
                  vaccine.childId
                ];

              const recordStatus =
                getRecordStatus(vaccine);

              const displayDate =
                recordStatus === 'applied'
                  ? vaccine.applicationDate
                  : vaccine.nextDoseDate;

              return (
                <article
                  key={vaccine.id}
                  className={`vaccine-simple-card vaccine-simple-card--${recordStatus}`}
                >
                  <header className="vaccine-simple-card__header">
                    <div className="vaccine-simple-card__child">
                      <span>
                        {getChildInitials(
                          child?.fullName,
                        )}
                      </span>

                      <div>
                        <strong>
                          {child?.fullName ||
                            'Hijo no disponible'}
                        </strong>

                        <small>
                          {recordStatus ===
                          'applied'
                            ? 'Vacuna aplicada'
                            : 'Vacuna pendiente'}
                        </small>
                      </div>
                    </div>

                    <div className="vaccine-simple-card__actions">
                      <button
                        type="button"
                        onClick={() =>
                          openEditForm(
                            vaccine,
                          )
                        }
                        aria-label="Editar vacuna"
                      >
                        <i className="bi bi-pencil" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteVaccine(
                            vaccine,
                          )
                        }
                        aria-label="Eliminar vacuna"
                      >
                        <i className="bi bi-trash3" />
                      </button>
                    </div>
                  </header>

                  <div className="vaccine-simple-card__main">
                    <span>
                      <i className="bi bi-shield-plus" />
                    </span>

                    <div>
                      <small>
                        {recordStatus ===
                        'applied'
                          ? 'Aplicada'
                          : 'Pendiente'}
                      </small>

                      <h3>
                        {
                          vaccine.vaccineName
                        }
                      </h3>

                      {vaccine.doseLabel && (
                        <p>
                          {vaccine.doseLabel}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="vaccine-simple-card__date">
                    <i
                      className={`bi ${
                        recordStatus ===
                        'applied'
                          ? 'bi-calendar-check'
                          : 'bi-calendar-event'
                      }`}
                    />

                    <div>
                      <small>
                        {recordStatus ===
                        'applied'
                          ? 'Aplicada el'
                          : 'Fecha prevista'}
                      </small>

                      <strong>
                        {formatVaccineDate(
                          displayDate,
                        )}
                      </strong>
                    </div>
                  </div>

                  {recordStatus ===
                    'applied' &&
                    vaccine.nextDoseDate && (
                      <div className="vaccine-simple-card__next">
                        <i className="bi bi-bell" />

                        <span>
                          Próxima dosis:{' '}

                          <strong>
                            {formatVaccineDate(
                              vaccine.nextDoseDate,
                            )}
                          </strong>
                        </span>
                      </div>
                    )}

                  <button
                    type="button"
                    className="vaccine-simple-card__view"
                    onClick={() =>
                      setSelectedVaccine(
                        vaccine,
                      )
                    }
                  >
                    Ver información
                    <i className="bi bi-arrow-right" />
                  </button>
                </article>
              );
            },
          )}
        </section>
      ) : (
        <section className="vaccines-empty">
          <span>
            <i className="bi bi-shield-plus" />
          </span>

          <h3>
            {vaccines.length === 0
              ? 'Todavía no hay vacunas'
              : 'No encontramos resultados'}
          </h3>

          <p>
            {vaccines.length === 0
              ? 'Agregá una vacuna aplicada o una fecha pendiente.'
              : 'Probá cambiando la búsqueda o limpiando los filtros.'}
          </p>

          {vaccines.length === 0 &&
            children.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={openCreateForm}
              >
                Agregar vacuna
              </button>
            )}
        </section>
      )}

      {isFormOpen && (
        <div
          className="vaccines-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vaccineFormTitle"
        >
          <button
            type="button"
            className="vaccines-modal__backdrop"
            onClick={closeForm}
            aria-label="Cerrar formulario"
          />

          <div className="vaccines-modal__container vaccines-modal__container--form">
            <header className="vaccines-modal__header">
              <div>
                <span>Vacunas</span>

                <h2 id="vaccineFormTitle">
                  {editingVaccine
                    ? 'Editar vacuna'
                    : 'Agregar vacuna'}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg" />
              </button>
            </header>

            <div className="vaccines-modal__body">
              <VaccineForm
                children={children}
                initialData={
                  editingVaccine
                }
                onSubmit={
                  handleSaveVaccine
                }
                onCancel={closeForm}
              />
            </div>
          </div>
        </div>
      )}

      {selectedVaccine && (
        <div
          className="vaccines-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vaccineDetailTitle"
        >
          <button
            type="button"
            className="vaccines-modal__backdrop"
            onClick={() =>
              setSelectedVaccine(null)
            }
            aria-label="Cerrar vacuna"
          />

          <div className="vaccines-modal__container">
            <header className="vaccines-modal__header">
              <div>
                <span>
                  Información guardada
                </span>

                <h2 id="vaccineDetailTitle">
                  Vacuna
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedVaccine(
                    null,
                  )
                }
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg" />
              </button>
            </header>

            <div className="vaccines-modal__body">
              <section className="vaccine-detail__hero">
                <div className="vaccine-detail__hero-icon">
                  <i className="bi bi-shield-plus" />
                </div>

                <div>
                  <span>
                    {getRecordStatus(
                      selectedVaccine,
                    ) === 'applied'
                      ? 'Aplicada'
                      : 'Pendiente'}
                  </span>

                  <h3>
                    {
                      selectedVaccine.vaccineName
                    }
                  </h3>

                  <p>
                    {childrenMap[
                      selectedVaccine.childId
                    ]?.fullName ||
                      'Hijo no disponible'}
                  </p>
                </div>
              </section>

              <section className="vaccine-detail__section">
                <h4>
                  <i className="bi bi-calendar-event" />
                  Fecha
                </h4>

                <div className="vaccine-detail__highlight">
                  <span>
                    {getRecordStatus(
                      selectedVaccine,
                    ) === 'applied'
                      ? 'Fecha de aplicación'
                      : 'Fecha prevista'}
                  </span>

                  <strong>
                    {formatVaccineDate(
                      getRecordStatus(
                        selectedVaccine,
                      ) === 'applied'
                        ? selectedVaccine.applicationDate
                        : selectedVaccine.nextDoseDate,
                    )}
                  </strong>
                </div>
              </section>

              {selectedVaccine.doseLabel && (
                <section className="vaccine-detail__section">
                  <h4>
                    <i className="bi bi-list-check" />
                    Dosis
                  </h4>

                  <div className="vaccine-detail__text">
                    <p>
                      {
                        selectedVaccine.doseLabel
                      }
                    </p>
                  </div>
                </section>
              )}

              {getRecordStatus(
                selectedVaccine,
              ) === 'applied' &&
                selectedVaccine.nextDoseDate && (
                  <section className="vaccine-detail__section">
                    <h4>
                      <i className="bi bi-bell" />
                      Próxima dosis
                    </h4>

                    <div
                      className={`vaccine-detail__next vaccine-detail__next--${getVaccineState(
                        selectedVaccine,
                      )}`}
                    >
                      <i className="bi bi-calendar2-check" />

                      <div>
                        <strong>
                          {formatVaccineDate(
                            selectedVaccine.nextDoseDate,
                          )}
                        </strong>

                        <span>
                          {getNextDoseDescription(
                            selectedVaccine,
                          )}
                        </span>
                      </div>
                    </div>
                  </section>
                )}

              {selectedVaccine.observations && (
                <section className="vaccine-detail__section">
                  <h4>
                    <i className="bi bi-journal-text" />
                    Nota familiar
                  </h4>

                  <div className="vaccine-detail__text">
                    <p>
                      {
                        selectedVaccine.observations
                      }
                    </p>
                  </div>
                </section>
              )}
            </div>

            <footer className="vaccines-modal__footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() =>
                  setSelectedVaccine(
                    null,
                  )
                }
              >
                Cerrar
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  openEditForm(
                    selectedVaccine,
                  )
                }
              >
                <i className="bi bi-pencil" />
                Editar
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default VaccinesPage;