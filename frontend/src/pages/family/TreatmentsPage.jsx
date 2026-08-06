import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import TreatmentCard from '../../components/cards/TreatmentCard.jsx';
import TreatmentForm from '../../components/forms/TreatmentForm.jsx';

import { getChildren } from '../../services/childrenService.js';
import { getConsultations } from '../../services/consultationsService.js';

import {
  createTreatment,
  deleteTreatment,
  getTreatments,
  updateTreatment,
  updateTreatmentStatus,
} from '../../services/treatmentsService.js';

import {
  formatNextDose,
  formatTreatmentDate,
  getNextTreatmentDose,
  getTreatmentRouteLabel,
  getTreatmentScheduleDescription,
  getTreatmentStatus,
  getTreatmentStatusLabel,
} from '../../utils/treatmentUtils.js';

import '../../styles/treatments.css';

function TreatmentsPage() {
  const [children] = useState(() => getChildren());

  const [consultations] = useState(() =>
    getConsultations(),
  );

  const [treatments, setTreatments] = useState(() =>
    getTreatments(),
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [childFilter, setChildFilter] = useState('all');
  const [statusFilter, setStatusFilter] =
    useState('all');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] =
    useState(null);

  const [selectedTreatment, setSelectedTreatment] =
    useState(null);

  const childrenMap = useMemo(
    () =>
      Object.fromEntries(
        children.map((child) => [child.id, child]),
      ),
    [children],
  );

  const consultationsMap = useMemo(
    () =>
      Object.fromEntries(
        consultations.map((consultation) => [
          consultation.id,
          consultation,
        ]),
      ),
    [consultations],
  );

  const filteredTreatments = useMemo(() => {
    const normalizedSearch = searchTerm
      .trim()
      .toLowerCase();

    return treatments.filter((treatment) => {
      const child = childrenMap[treatment.childId];
      const status = getTreatmentStatus(treatment);

      const matchesChild =
        childFilter === 'all' ||
        treatment.childId === childFilter;

      const matchesStatus =
        statusFilter === 'all' ||
        status === statusFilter;

      const searchableValues = [
        child?.fullName,
        treatment.medicationName,
        treatment.presentation,
        treatment.dosageInstruction,
        treatment.notes,
      ];

      const matchesSearch =
        !normalizedSearch ||
        searchableValues.some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(normalizedSearch),
        );

      return (
        matchesChild &&
        matchesStatus &&
        matchesSearch
      );
    });
  }, [
    treatments,
    childrenMap,
    childFilter,
    statusFilter,
    searchTerm,
  ]);

  const activeCount = treatments.filter(
    (treatment) =>
      getTreatmentStatus(treatment) === 'active',
  ).length;

  const scheduledCount = treatments.filter(
    (treatment) =>
      getTreatmentStatus(treatment) === 'scheduled',
  ).length;

  const completedCount = treatments.filter(
    (treatment) =>
      getTreatmentStatus(treatment) === 'completed',
  ).length;

  function refreshTreatments() {
    setTreatments(getTreatments());
  }

  function openCreateForm() {
    if (children.length === 0) {
      return;
    }

    setEditingTreatment(null);
    setSelectedTreatment(null);
    setIsFormOpen(true);
  }

  function openEditForm(treatment) {
    setSelectedTreatment(null);
    setEditingTreatment(treatment);
    setIsFormOpen(true);
  }

  function closeForm() {
    setEditingTreatment(null);
    setIsFormOpen(false);
  }

  function handleSaveTreatment(data) {
    if (editingTreatment) {
      updateTreatment(editingTreatment.id, data);
    } else {
      createTreatment(data);
    }

    refreshTreatments();
    closeForm();
  }

  function handleDeleteTreatment(treatment) {
    const confirmed = window.confirm(
      `¿Querés eliminar el tratamiento con ${treatment.medicationName}?`,
    );

    if (!confirmed) {
      return;
    }

    deleteTreatment(treatment.id);

    if (selectedTreatment?.id === treatment.id) {
      setSelectedTreatment(null);
    }

    refreshTreatments();
  }

  function handleTogglePause(treatment) {
    const currentStatus = getTreatmentStatus(treatment);

    updateTreatmentStatus(
      treatment.id,
      currentStatus === 'paused'
        ? 'active'
        : 'paused',
    );

    refreshTreatments();
  }

  function handleCompleteTreatment(treatment) {
    const confirmed = window.confirm(
      `¿Marcar el tratamiento con ${treatment.medicationName} como finalizado?`,
    );

    if (!confirmed) {
      return;
    }

    updateTreatmentStatus(treatment.id, 'completed');
    refreshTreatments();
  }

  return (
    <div className="treatments-page">
      <section className="treatments-page__header">
        <div>
          <span>Seguimiento médico</span>
          <h2>Tratamientos</h2>

          <p>
            Organizá medicamentos, indicaciones, duración y
            horarios de cada hijo.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateForm}
          disabled={children.length === 0}
        >
          <i className="bi bi-capsule" />
          Nuevo tratamiento
        </button>
      </section>

      {children.length === 0 && (
        <section className="treatments-page__warning">
          <i className="bi bi-person-exclamation" />

          <div>
            <strong>
              Primero necesitás crear un perfil infantil
            </strong>

            <p>
              Cada tratamiento debe estar asociado a uno de los
              hijos.
            </p>
          </div>

          <Link
            to="/dashboard/children"
            className="btn btn-outline-primary"
          >
            Ir a Mis hijos
          </Link>
        </section>
      )}

      <section className="treatments-statistics">
        <article>
          <span className="treatments-statistics__icon">
            <i className="bi bi-capsule-pill" />
          </span>

          <div>
            <strong>{treatments.length}</strong>
            <span>Tratamientos registrados</span>
          </div>
        </article>

        <article>
          <span className="treatments-statistics__icon treatments-statistics__icon--active">
            <i className="bi bi-activity" />
          </span>

          <div>
            <strong>{activeCount}</strong>
            <span>Tratamientos activos</span>
          </div>
        </article>

        <article>
          <span className="treatments-statistics__icon treatments-statistics__icon--scheduled">
            <i className="bi bi-calendar2-check" />
          </span>

          <div>
            <strong>{scheduledCount}</strong>
            <span>Tratamientos programados</span>
          </div>
        </article>

        <article>
          <span className="treatments-statistics__icon treatments-statistics__icon--completed">
            <i className="bi bi-check-circle" />
          </span>

          <div>
            <strong>{completedCount}</strong>
            <span>Tratamientos finalizados</span>
          </div>
        </article>
      </section>

      <section className="treatments-toolbar">
        <div className="treatments-toolbar__search">
          <i className="bi bi-search" />

          <input
            type="search"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
            placeholder="Buscar por hijo, medicamento o indicación"
            aria-label="Buscar tratamientos"
          />

          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Limpiar búsqueda"
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>

        <select
          value={childFilter}
          onChange={(event) =>
            setChildFilter(event.target.value)
          }
          aria-label="Filtrar por hijo"
        >
          <option value="all">Todos los hijos</option>

          {children.map((child) => (
            <option key={child.id} value={child.id}>
              {child.fullName}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value)
          }
          aria-label="Filtrar por estado"
        >
          <option value="all">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="scheduled">Programados</option>
          <option value="paused">Pausados</option>
          <option value="completed">Finalizados</option>
        </select>
      </section>

      <div className="treatments-page__result">
        {filteredTreatments.length}{' '}
        {filteredTreatments.length === 1
          ? 'tratamiento encontrado'
          : 'tratamientos encontrados'}
      </div>

      {filteredTreatments.length > 0 ? (
        <section className="treatments-grid">
          {filteredTreatments.map((treatment) => (
            <TreatmentCard
              key={treatment.id}
              treatment={treatment}
              child={childrenMap[treatment.childId]}
              onView={setSelectedTreatment}
              onEdit={openEditForm}
              onDelete={handleDeleteTreatment}
              onTogglePause={handleTogglePause}
              onComplete={handleCompleteTreatment}
            />
          ))}
        </section>
      ) : (
        <section className="treatments-empty">
          <span>
            <i className="bi bi-capsule-pill" />
          </span>

          <h3>
            {treatments.length === 0
              ? 'Todavía no hay tratamientos'
              : 'No encontramos resultados'}
          </h3>

          <p>
            {treatments.length === 0
              ? 'Registrá el primer tratamiento para organizar los medicamentos y sus horarios.'
              : 'Probá cambiando los filtros o utilizando otros términos de búsqueda.'}
          </p>

          {treatments.length === 0 &&
            children.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={openCreateForm}
              >
                Registrar primer tratamiento
              </button>
            )}
        </section>
      )}

      {isFormOpen && (
        <div
          className="treatments-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="treatmentFormTitle"
        >
          <button
            type="button"
            className="treatments-modal__backdrop"
            onClick={closeForm}
            aria-label="Cerrar formulario"
          />

          <div className="treatments-modal__container treatments-modal__container--form">
            <header className="treatments-modal__header">
              <div>
                <span>Seguimiento médico</span>

                <h2 id="treatmentFormTitle">
                  {editingTreatment
                    ? 'Editar tratamiento'
                    : 'Registrar tratamiento'}
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

            <div className="treatments-modal__body">
              <TreatmentForm
                children={children}
                consultations={consultations}
                initialData={editingTreatment}
                onSubmit={handleSaveTreatment}
                onCancel={closeForm}
              />
            </div>
          </div>
        </div>
      )}

      {selectedTreatment && (
        <div
          className="treatments-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="treatmentDetailTitle"
        >
          <button
            type="button"
            className="treatments-modal__backdrop"
            onClick={() => setSelectedTreatment(null)}
            aria-label="Cerrar tratamiento"
          />

          <div className="treatments-modal__container">
            <header className="treatments-modal__header">
              <div>
                <span>Información completa</span>
                <h2 id="treatmentDetailTitle">
                  Tratamiento
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTreatment(null)}
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg" />
              </button>
            </header>

            <div className="treatments-modal__body">
              <section className="treatment-detail__hero">
                <div className="treatment-detail__hero-icon">
                  <i className="bi bi-capsule-pill" />
                </div>

                <div>
                  <span>
                    {getTreatmentStatusLabel(
                      selectedTreatment,
                    )}
                  </span>

                  <h3>
                    {selectedTreatment.medicationName}
                  </h3>

                  <p>
                    {
                      childrenMap[
                        selectedTreatment.childId
                      ]?.fullName
                    }
                  </p>
                </div>
              </section>

              <section className="treatment-detail__section">
                <h4>
                  <i className="bi bi-prescription2" />
                  Medicamento e indicación
                </h4>

                <dl className="treatment-detail__grid">
                  <div>
                    <dt>Presentación</dt>
                    <dd>
                      {selectedTreatment.presentation ||
                        'No registrada'}
                    </dd>
                  </div>

                  <div>
                    <dt>Vía de administración</dt>
                    <dd>
                      {getTreatmentRouteLabel(
                        selectedTreatment.administrationRoute,
                      )}
                    </dd>
                  </div>
                </dl>

                <div className="treatment-detail__text">
                  <strong>Indicación recetada</strong>
                  <p>
                    {selectedTreatment.dosageInstruction}
                  </p>
                </div>
              </section>

              <section className="treatment-detail__section">
                <h4>
                  <i className="bi bi-calendar-range" />
                  Duración
                </h4>

                <dl className="treatment-detail__grid">
                  <div>
                    <dt>Inicio</dt>
                    <dd>
                      {formatTreatmentDate(
                        selectedTreatment.startDate,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Finalización</dt>
                    <dd>
                      {formatTreatmentDate(
                        selectedTreatment.endDate,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Duración total</dt>
                    <dd>
                      {selectedTreatment.durationDays}{' '}
                      {selectedTreatment.durationDays === 1
                        ? 'día'
                        : 'días'}
                    </dd>
                  </div>

                  <div>
                    <dt>Estado</dt>
                    <dd>
                      {getTreatmentStatusLabel(
                        selectedTreatment,
                      )}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="treatment-detail__section">
                <h4>
                  <i className="bi bi-clock-history" />
                  Horarios
                </h4>

                <div className="treatment-detail__text">
                  <strong>Frecuencia</strong>
                  <p>
                    {getTreatmentScheduleDescription(
                      selectedTreatment,
                    )}
                  </p>
                </div>

                <div className="treatment-detail__next-dose">
                  <i className="bi bi-bell" />

                  <span>
                    <small>Próxima toma</small>
                    <strong>
                      {formatNextDose(
                        getNextTreatmentDose(
                          selectedTreatment,
                        ),
                      )}
                    </strong>
                  </span>
                </div>
              </section>

              {selectedTreatment.consultationId && (
                <section className="treatment-detail__section">
                  <h4>
                    <i className="bi bi-clipboard2-pulse" />
                    Consulta relacionada
                  </h4>

                  <div className="treatment-detail__text">
                    <strong>Motivo de consulta</strong>
                    <p>
                      {consultationsMap[
                        selectedTreatment.consultationId
                      ]?.reason ||
                        'Consulta no disponible'}
                    </p>
                  </div>
                </section>
              )}

              {selectedTreatment.notes && (
                <section className="treatment-detail__section">
                  <h4>
                    <i className="bi bi-journal-text" />
                    Observaciones
                  </h4>

                  <div className="treatment-detail__text">
                    <p>{selectedTreatment.notes}</p>
                  </div>
                </section>
              )}
            </div>

            <footer className="treatments-modal__footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setSelectedTreatment(null)}
              >
                Cerrar
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  openEditForm(selectedTreatment)
                }
              >
                <i className="bi bi-pencil" />
                Editar tratamiento
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default TreatmentsPage;