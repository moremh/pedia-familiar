import {
  useMemo,
  useState,
} from 'react';

import AppointmentForm
  from '../../components/forms/AppointmentForm.jsx';

import {
  createAppointment,
  deleteAppointment,
  getAppointments,
  setAppointmentStatus,
  updateAppointment,
} from '../../services/appointmentsService.js';

import {
  getChildren,
} from '../../services/childrenService.js';

import '../../styles/appointments.css';

const dateTimeFormatter =
  new Intl.DateTimeFormat(
    'es-AR',
    {
      dateStyle: 'medium',
      timeStyle: 'short',
    },
  );

function getAppointmentDate(
  appointment,
) {
  return new Date(
    `${appointment.appointmentDate}T${appointment.appointmentTime}:00`,
  );
}

function formatAdvance(
  minutes,
) {
  const numeric =
    Number(minutes || 0);

  if (numeric === 0) {
    return 'a la hora';
  }

  if (numeric < 60) {
    return `${numeric} min antes`;
  }

  if (
    numeric % 1440 === 0
  ) {
    const days =
      numeric / 1440;

    return `${days} ${days === 1 ? 'día' : 'días'} antes`;
  }

  if (
    numeric % 60 === 0
  ) {
    const hours =
      numeric / 60;

    return `${hours} ${hours === 1 ? 'hora' : 'horas'} antes`;
  }

  return `${numeric} min antes`;
}

function AppointmentsPage() {
  const [children] =
    useState(() =>
      getChildren(),
    );

  const [
    appointments,
    setAppointments,
  ] = useState(() =>
    getAppointments(),
  );

  const [
    editingAppointment,
    setEditingAppointment,
  ] = useState(null);

  const [
    isFormOpen,
    setIsFormOpen,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState('');

  const childById =
    useMemo(
      () =>
        Object.fromEntries(
          children.map(
            (child) => [
              child.id,
              child,
            ],
          ),
        ),
      [children],
    );

  const upcoming =
    useMemo(
      () =>
        appointments.filter(
          (appointment) =>
            appointment.status ===
              'scheduled' &&
            getAppointmentDate(
              appointment,
            ).getTime() >=
              Date.now() -
                60 * 1000,
        ),
      [appointments],
    );

  const history =
    useMemo(
      () =>
        appointments.filter(
          (appointment) =>
            appointment.status !==
              'scheduled' ||
            getAppointmentDate(
              appointment,
            ).getTime() <
              Date.now() -
                60 * 1000,
        ),
      [appointments],
    );

  function refresh() {
    setAppointments(
      getAppointments(),
    );
  }

  function openNew() {
    setEditingAppointment(null);
    setIsFormOpen(true);
    setMessage('');
  }

  function openEdit(
    appointment,
  ) {
    setEditingAppointment(
      appointment,
    );
    setIsFormOpen(true);
    setMessage('');
  }

  function closeForm() {
    setEditingAppointment(null);
    setIsFormOpen(false);
  }

  function handleSave(data) {
    if (editingAppointment) {
      updateAppointment(
        editingAppointment.id,
        data,
      );

      setMessage(
        'El turno se actualizó correctamente.',
      );
    } else {
      createAppointment(data);

      setMessage(
        'El turno quedó programado.',
      );
    }

    refresh();
    closeForm();
  }

  function handleDelete(
    appointment,
  ) {
    const confirmed =
      window.confirm(
        '¿Querés eliminar este turno?',
      );

    if (!confirmed) {
      return;
    }

    deleteAppointment(
      appointment.id,
    );

    refresh();
  }

  function changeStatus(
    appointment,
    status,
  ) {
    setAppointmentStatus(
      appointment.id,
      status,
    );

    refresh();
  }

  function renderCard(
    appointment,
  ) {
    const child =
      childById[
        appointment.childId
      ];

    return (
      <article
        key={appointment.id}
        className="appointment-card"
      >
        <div className="appointment-card__date">
          <i className="bi bi-calendar-event" />
          <strong>
            {dateTimeFormatter.format(
              getAppointmentDate(
                appointment,
              ),
            )}
          </strong>
        </div>

        <div className="appointment-card__content">
          <span>
            {child?.fullName ||
              'Hijo'}
          </span>

          <h3>
            {appointment.reason}
          </h3>

          <p>
            {[
              appointment.professionalName,
              appointment.specialty,
              appointment.medicalCenter,
            ]
              .filter(Boolean)
              .join(' · ') ||
              'Sin datos adicionales'}
          </p>

          {appointment.reminderEnabled && (
            <small>
              <i className="bi bi-bell" />
              Aviso{' '}
              {formatAdvance(
                appointment
                  .reminderMinutesBefore,
              )}
            </small>
          )}
        </div>

        <div className="appointment-card__actions">
          {appointment.status ===
            'scheduled' && (
            <>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() =>
                  openEdit(
                    appointment,
                  )
                }
              >
                Editar
              </button>

              <button
                type="button"
                className="btn btn-sm btn-outline-success"
                onClick={() =>
                  changeStatus(
                    appointment,
                    'completed',
                  )
                }
              >
                Realizado
              </button>

              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() =>
                  changeStatus(
                    appointment,
                    'cancelled',
                  )
                }
              >
                Cancelar turno
              </button>
            </>
          )}

          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={() =>
              handleDelete(
                appointment,
              )
            }
          >
            Eliminar
          </button>
        </div>
      </article>
    );
  }

  return (
    <div className="appointments-page">
      <section className="appointments-page__header">
        <div>
          <span>
            Agenda médica
          </span>

          <h2>Turnos</h2>

          <p>
            Programá consultas futuras y
            elegí exactamente cuándo querés
            que MiPeque te recuerde cada una.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={openNew}
          disabled={
            children.length === 0
          }
        >
          <i className="bi bi-plus-lg" />
          Nuevo turno
        </button>
      </section>

      {children.length === 0 && (
        <div className="alert alert-warning">
          Primero registrá un hijo para
          poder crear turnos.
        </div>
      )}

      {message && (
        <div
          className="alert alert-success"
          role="status"
        >
          {message}
        </div>
      )}

      {isFormOpen && (
        <section className="appointments-form-card">
          <header>
            <h3>
              {editingAppointment
                ? 'Editar turno'
                : 'Programar turno'}
            </h3>
          </header>

          <AppointmentForm
            children={children}
            initialData={
              editingAppointment
            }
            onSubmit={handleSave}
            onCancel={closeForm}
          />
        </section>
      )}

      <section className="appointments-section">
        <header>
          <h3>Próximos turnos</h3>
          <span>
            {upcoming.length}
          </span>
        </header>

        {upcoming.length === 0 ? (
          <div className="appointments-empty">
            <i className="bi bi-calendar2-check" />
            <p>
              No hay turnos próximos.
            </p>
          </div>
        ) : (
          <div className="appointments-list">
            {upcoming.map(
              renderCard,
            )}
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="appointments-section">
          <header>
            <h3>
              Historial
            </h3>
            <span>
              {history.length}
            </span>
          </header>

          <div className="appointments-list">
            {history.map(
              renderCard,
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default AppointmentsPage;
