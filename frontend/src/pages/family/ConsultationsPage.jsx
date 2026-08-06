import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import ConsultationCard from '../../components/cards/ConsultationCard.jsx';
import ConsultationForm from '../../components/forms/ConsultationForm.jsx';

import { getChildren } from '../../services/childrenService.js';

import {
  createConsultation,
  deleteConsultation,
  getConsultations,
  updateConsultation,
} from '../../services/consultationsService.js';

import {
  formatConsultationDate,
  formatConsultationTime,
  getConsultationTypeLabel,
  hasFutureFollowUp,
  isConsultationThisMonth,
} from '../../utils/consultationUtils.js';

import '../../styles/consultations.css';

function ConsultationsPage() {
  const [children] = useState(() => getChildren());

  const [consultations, setConsultations] =
    useState(() => getConsultations());

  const [searchTerm, setSearchTerm] =
    useState('');

  const [childFilter, setChildFilter] =
    useState('all');

  const [typeFilter, setTypeFilter] =
    useState('all');

  const [isFormOpen, setIsFormOpen] =
    useState(false);

  const [
    editingConsultation,
    setEditingConsultation,
  ] = useState(null);

  const [
    selectedConsultation,
    setSelectedConsultation,
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

  const filteredConsultations = useMemo(() => {
    const normalizedSearch = searchTerm
      .trim()
      .toLowerCase();

    return consultations.filter(
      (consultation) => {
        const child =
          childrenMap[consultation.childId];

        const matchesChild =
          childFilter === 'all' ||
          consultation.childId === childFilter;

        const matchesType =
          typeFilter === 'all' ||
          consultation.consultationType ===
            typeFilter;

        const searchableValues = [
          child?.fullName,
          consultation.reason,
          consultation.symptoms,
          consultation.diagnosis,
          consultation.professionalName,
          consultation.specialty,
          consultation.medicalCenter,
          consultation.indications,
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
          matchesType &&
          matchesSearch
        );
      },
    );
  }, [
    consultations,
    childrenMap,
    childFilter,
    typeFilter,
    searchTerm,
  ]);

  const consultationsThisMonth =
    consultations.filter((consultation) =>
      isConsultationThisMonth(
        consultation.consultationDate,
      ),
    ).length;

  const pendingFollowUps =
    consultations.filter((consultation) =>
      hasFutureFollowUp(
        consultation.followUpDate,
      ),
    ).length;

  const registeredProfessionals = new Set(
    consultations
      .map((consultation) =>
        consultation.professionalName.trim(),
      )
      .filter(Boolean),
  ).size;

  function refreshConsultations() {
    setConsultations(getConsultations());
  }

  function openCreateForm() {
    if (children.length === 0) {
      return;
    }

    setEditingConsultation(null);
    setSelectedConsultation(null);
    setIsFormOpen(true);
  }

  function openEditForm(consultation) {
    setSelectedConsultation(null);
    setEditingConsultation(consultation);
    setIsFormOpen(true);
  }

  function closeForm() {
    setEditingConsultation(null);
    setIsFormOpen(false);
  }

  function handleSaveConsultation(data) {
    if (editingConsultation) {
      updateConsultation(
        editingConsultation.id,
        data,
      );
    } else {
      createConsultation(data);
    }

    refreshConsultations();
    closeForm();
  }

  function handleDeleteConsultation(
    consultation,
  ) {
    const child =
      childrenMap[consultation.childId];

    const confirmed = window.confirm(
      `¿Querés eliminar la consulta de ${
        child?.fullName ?? 'este perfil'
      } del ${formatConsultationDate(
        consultation.consultationDate,
      )}?`,
    );

    if (!confirmed) {
      return;
    }

    deleteConsultation(consultation.id);

    if (
      selectedConsultation?.id ===
      consultation.id
    ) {
      setSelectedConsultation(null);
    }

    refreshConsultations();
  }

  return (
    <div className="consultations-page">
      <section className="consultations-page__header">
        <div>
          <span>Historial médico</span>
          <h2>Consultas médicas</h2>

          <p>
            Registrá síntomas, diagnósticos e
            indicaciones recibidas por cada hijo.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateForm}
          disabled={children.length === 0}
        >
          <i className="bi bi-clipboard2-plus" />
          Registrar consulta
        </button>
      </section>

      {children.length === 0 && (
        <section className="consultations-page__warning">
          <i className="bi bi-person-exclamation" />

          <div>
            <strong>
              Primero necesitás crear un perfil
              infantil
            </strong>

            <p>
              Cada consulta debe estar asociada a
              uno de los hijos de la familia.
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

      <section className="consultations-statistics">
        <article>
          <span className="consultations-statistics__icon">
            <i className="bi bi-clipboard2-pulse" />
          </span>

          <div>
            <strong>
              {consultations.length}
            </strong>
            <span>Consultas registradas</span>
          </div>
        </article>

        <article>
          <span className="consultations-statistics__icon consultations-statistics__icon--month">
            <i className="bi bi-calendar3" />
          </span>

          <div>
            <strong>
              {consultationsThisMonth}
            </strong>
            <span>Durante este mes</span>
          </div>
        </article>

        <article>
          <span className="consultations-statistics__icon consultations-statistics__icon--follow-up">
            <i className="bi bi-calendar2-check" />
          </span>

          <div>
            <strong>
              {pendingFollowUps}
            </strong>
            <span>Próximos controles</span>
          </div>
        </article>

        <article>
          <span className="consultations-statistics__icon consultations-statistics__icon--doctor">
            <i className="bi bi-person-badge" />
          </span>

          <div>
            <strong>
              {registeredProfessionals}
            </strong>
            <span>Profesionales registrados</span>
          </div>
        </article>
      </section>

      <section className="consultations-toolbar">
        <div className="consultations-toolbar__search">
          <i className="bi bi-search" />

          <input
            type="search"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
            placeholder="Buscar por síntoma, diagnóstico, médico o centro"
            aria-label="Buscar consultas"
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
            setTypeFilter(event.target.value)
          }
          aria-label="Filtrar por tipo"
        >
          <option value="all">
            Todos los tipos
          </option>

          <option value="pediatric">
            Pediatría
          </option>

          <option value="control">
            Control médico
          </option>

          <option value="emergency">
            Guardia
          </option>

          <option value="specialist">
            Especialista
          </option>

          <option value="telemedicine">
            Teleconsulta
          </option>

          <option value="other">
            Otra consulta
          </option>
        </select>
      </section>

      <div className="consultations-page__result">
        {filteredConsultations.length}{' '}
        {filteredConsultations.length === 1
          ? 'consulta encontrada'
          : 'consultas encontradas'}
      </div>

      {filteredConsultations.length > 0 ? (
        <section className="consultations-grid">
          {filteredConsultations.map(
            (consultation) => (
              <ConsultationCard
                key={consultation.id}
                consultation={consultation}
                child={
                  childrenMap[
                    consultation.childId
                  ]
                }
                onView={
                  setSelectedConsultation
                }
                onEdit={openEditForm}
                onDelete={
                  handleDeleteConsultation
                }
              />
            ),
          )}
        </section>
      ) : (
        <section className="consultations-empty">
          <span>
            <i className="bi bi-clipboard2-pulse" />
          </span>

          <h3>
            {consultations.length === 0
              ? 'Todavía no hay consultas'
              : 'No encontramos resultados'}
          </h3>

          <p>
            {consultations.length === 0
              ? 'Registrá la primera consulta para comenzar a crear el historial médico.'
              : 'Probá cambiando los filtros o utilizando otros términos de búsqueda.'}
          </p>

          {consultations.length === 0 &&
            children.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={openCreateForm}
              >
                Registrar primera consulta
              </button>
            )}
        </section>
      )}

      {isFormOpen && (
        <div
          className="consultations-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="consultationFormTitle"
        >
          <button
            type="button"
            className="consultations-modal__backdrop"
            onClick={closeForm}
            aria-label="Cerrar formulario"
          />

          <div className="consultations-modal__container consultations-modal__container--form">
            <header className="consultations-modal__header">
              <div>
                <span>Historial médico</span>

                <h2 id="consultationFormTitle">
                  {editingConsultation
                    ? 'Editar consulta'
                    : 'Registrar consulta'}
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

            <div className="consultations-modal__body">
              <ConsultationForm
                children={children}
                initialData={
                  editingConsultation
                }
                onSubmit={
                  handleSaveConsultation
                }
                onCancel={closeForm}
              />
            </div>
          </div>
        </div>
      )}

      {selectedConsultation && (
        <div
          className="consultations-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="consultationDetailTitle"
        >
          <button
            type="button"
            className="consultations-modal__backdrop"
            onClick={() =>
              setSelectedConsultation(null)
            }
            aria-label="Cerrar consulta"
          />

          <div className="consultations-modal__container">
            <header className="consultations-modal__header">
              <div>
                <span>Información completa</span>

                <h2 id="consultationDetailTitle">
                  Consulta médica
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedConsultation(null)
                }
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg" />
              </button>
            </header>

            <div className="consultations-modal__body">
              <section className="consultation-detail__hero">
                <div className="consultation-detail__hero-icon">
                  <i className="bi bi-clipboard2-pulse" />
                </div>

                <div>
                  <span>
                    {getConsultationTypeLabel(
                      selectedConsultation.consultationType,
                    )}
                  </span>

                  <h3>
                    {selectedConsultation.reason}
                  </h3>

                  <p>
                    {
                      childrenMap[
                        selectedConsultation.childId
                      ]?.fullName
                    }
                  </p>
                </div>
              </section>

              <section className="consultation-detail__section">
                <h4>
                  <i className="bi bi-calendar3" />
                  Datos de la consulta
                </h4>

                <dl className="consultation-detail__grid">
                  <div>
                    <dt>Fecha</dt>
                    <dd>
                      {formatConsultationDate(
                        selectedConsultation.consultationDate,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Horario</dt>
                    <dd>
                      {formatConsultationTime(
                        selectedConsultation.consultationTime,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Profesional</dt>
                    <dd>
                      {selectedConsultation.professionalName ||
                        'No registrado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Especialidad</dt>
                    <dd>
                      {selectedConsultation.specialty ||
                        'No registrada'}
                    </dd>
                  </div>

                  <div>
                    <dt>Centro médico</dt>
                    <dd>
                      {selectedConsultation.medicalCenter ||
                        'No registrado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Próximo control</dt>
                    <dd>
                      {selectedConsultation.followUpDate
                        ? formatConsultationDate(
                            selectedConsultation.followUpDate,
                          )
                        : 'No programado'}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="consultation-detail__section">
                <h4>
                  <i className="bi bi-thermometer-half" />
                  Síntomas y mediciones
                </h4>

                <div className="consultation-detail__text">
                  <strong>Síntomas</strong>

                  <p>
                    {selectedConsultation.symptoms ||
                      'No se registraron síntomas.'}
                  </p>
                </div>

                <dl className="consultation-detail__grid consultation-detail__grid--measurements">
                  <div>
                    <dt>Peso</dt>
                    <dd>
                      {selectedConsultation.weight !==
                      ''
                        ? `${selectedConsultation.weight} kg`
                        : 'No registrado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Temperatura</dt>
                    <dd>
                      {selectedConsultation.temperature !==
                      ''
                        ? `${selectedConsultation.temperature} °C`
                        : 'No registrada'}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="consultation-detail__section">
                <h4>
                  <i className="bi bi-heart-pulse" />
                  Resultado e indicaciones
                </h4>

                <div className="consultation-detail__text">
                  <strong>
                    Diagnóstico informado
                  </strong>

                  <p>
                    {selectedConsultation.diagnosis ||
                      'No se registró un diagnóstico.'}
                  </p>
                </div>

                <div className="consultation-detail__text">
                  <strong>Indicaciones</strong>

                  <p>
                    {selectedConsultation.indications ||
                      'No se registraron indicaciones.'}
                  </p>
                </div>
              </section>

              {selectedConsultation.notes && (
                <section className="consultation-detail__section">
                  <h4>
                    <i className="bi bi-journal-text" />
                    Observaciones familiares
                  </h4>

                  <div className="consultation-detail__text">
                    <p>
                      {selectedConsultation.notes}
                    </p>
                  </div>
                </section>
              )}
            </div>

            <footer className="consultations-modal__footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() =>
                  setSelectedConsultation(null)
                }
              >
                Cerrar
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  openEditForm(
                    selectedConsultation,
                  )
                }
              >
                <i className="bi bi-pencil" />
                Editar consulta
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default ConsultationsPage;