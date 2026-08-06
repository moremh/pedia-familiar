import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { Link } from 'react-router-dom';

import {
  getCurrentUser,
} from '../../services/authService.js';

import {
  isMedicationOnlyAccess,
} from '../../services/familyAccessService.js';

import ReminderCard from '../../components/cards/ReminderCard.jsx';

import { getChildren } from '../../services/childrenService.js';
import { getTreatments } from '../../services/treatmentsService.js';

import {
  getReminderRecords,
  markReminderAsAdministered,
  markReminderAsOmitted,
  postponeReminder,
  resetReminder,
} from '../../services/remindersService.js';

import {
  consumeMedicineStockForReminder,
  restoreMedicineStockForReminder,
} from '../../services/medicineCabinetService.js';

import {
  getActiveCaregiverId,
  getCaregivers,
  setActiveCaregiverId,
} from '../../services/caregiversService.js';

import {
  formatReminderDate,
  formatReminderTime,
  generateReminderOccurrences,
  getReminderEffectiveDate,
  groupRemindersByDate,
  isReminderHistory,
  isReminderToday,
  isReminderUpcoming,
} from '../../utils/reminderUtils.js';

import '../../styles/reminders.css';

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    date.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function RemindersPage() {
  const limitedAccess =
    isMedicationOnlyAccess();

  const currentUser =
    getCurrentUser();
  const [children] = useState(() =>
    getChildren(),
  );

  const [treatments] = useState(() =>
    getTreatments(),
  );

  const [records, setRecords] = useState(() =>
    getReminderRecords(),
  );

  const [caregivers] = useState(() => {
    const activeCaregivers =
      getCaregivers().filter(
        (caregiver) => caregiver.isActive,
      );

    if (!limitedAccess) {
      return activeCaregivers;
    }

    return activeCaregivers.filter(
      (caregiver) =>
        caregiver.id ===
        currentUser?.caregiverId,
    );
  });

  const [
    selectedCaregiverId,
    setSelectedCaregiverId,
  ] = useState(() => {
    if (
      limitedAccess &&
      currentUser?.caregiverId
    ) {
      return currentUser.caregiverId;
    }

    const storedCaregiverId =
      getActiveCaregiverId();

    const availableCaregivers =
      getCaregivers().filter(
        (caregiver) => caregiver.isActive,
      );

    const storedCaregiver =
      availableCaregivers.find(
        (caregiver) =>
          caregiver.id === storedCaregiverId,
      );

    if (storedCaregiver) {
      return storedCaregiver.id;
    }

    const fallbackCaregiver =
      availableCaregivers.find(
        (caregiver) => caregiver.isPrimary,
      ) ?? availableCaregivers[0];

    return fallbackCaregiver?.id ?? '';
  });

  const [viewFilter, setViewFilter] =
    useState('today');

  const [statusFilter, setStatusFilter] =
    useState('all');

  const [childFilter, setChildFilter] =
    useState('all');

  const [searchTerm, setSearchTerm] =
    useState('');

  useEffect(() => {
    if (selectedCaregiverId) {
      setActiveCaregiverId(
        selectedCaregiverId,
      );
    }
  }, [selectedCaregiverId]);

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

  const selectedCaregiver = useMemo(
    () =>
      caregivers.find(
        (caregiver) =>
          caregiver.id ===
          selectedCaregiverId,
      ) ?? null,
    [caregivers, selectedCaregiverId],
  );

  const reminders = useMemo(
    () =>
      generateReminderOccurrences({
        treatments,
        records,
        childrenMap,
        daysBack: 30,
        daysForward: 30,
      }),
    [treatments, records, childrenMap],
  );

  const filteredReminders = useMemo(() => {
    const normalizedSearch = searchTerm
      .trim()
      .toLowerCase();

    return reminders.filter((reminder) => {
      let matchesView = true;

      if (viewFilter === 'today') {
        matchesView =
          isReminderToday(reminder);
      }

      if (viewFilter === 'upcoming') {
        matchesView =
          isReminderUpcoming(reminder);
      }

      if (viewFilter === 'history') {
        matchesView =
          isReminderHistory(reminder);
      }

      const matchesStatus =
        statusFilter === 'all' ||
        reminder.status === statusFilter;

      const matchesChild =
        childFilter === 'all' ||
        reminder.childId === childFilter;

      const searchableValues = [
        reminder.childName,
        reminder.medicationName,
        reminder.presentation,
        reminder.dosageInstruction,
        reminder.responsibleName,
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
        matchesStatus &&
        matchesChild &&
        matchesSearch
      );
    });
  }, [
    reminders,
    viewFilter,
    statusFilter,
    childFilter,
    searchTerm,
  ]);

  const groupedReminders = useMemo(
    () =>
      groupRemindersByDate(
        filteredReminders,
      ),
    [filteredReminders],
  );

  const todayReminders = useMemo(
    () =>
      reminders.filter(
        isReminderToday,
      ),
    [reminders],
  );

  const administeredToday = useMemo(
    () =>
      todayReminders.filter(
        (reminder) =>
          reminder.status ===
          'administered',
      ).length,
    [todayReminders],
  );

  const pendingToday = useMemo(
    () =>
      todayReminders.filter(
        (reminder) =>
          [
            'pending',
            'postponed',
          ].includes(reminder.status),
      ).length,
    [todayReminders],
  );

  const nextReminder = useMemo(
    () =>
      reminders.find(
        (reminder) =>
          isReminderUpcoming(reminder) &&
          [
            'pending',
            'postponed',
          ].includes(reminder.status),
      ) ?? null,
    [reminders],
  );

  const todayDateKey = getLocalDateKey();

  function refreshRecords() {
    setRecords(getReminderRecords());
  }

  function handleCaregiverChange(event) {
    if (limitedAccess) {
      return;
    }

    const caregiverId = event.target.value;
    setSelectedCaregiverId(caregiverId);
  }

  async function handleAdminister(reminder) {
    if (!selectedCaregiver) {
      window.alert(
        'Primero seleccioná o registrá un responsable familiar.',
      );

      return;
    }

    markReminderAsAdministered(
  reminder.id,
  {
    responsibleId:
      selectedCaregiver.id,

    responsibleName:
      selectedCaregiver.fullName,

    treatmentId:
      reminder.treatmentId,

    childId: reminder.childId,

    childName: reminder.childName,

    medicationName:
      reminder.medicationName,

    presentation:
      reminder.presentation,

    dosageInstruction:
      reminder.dosageInstruction,

    scheduledAt:
      getReminderEffectiveDate(
        reminder,
      ).toISOString(),

    originalTime:
      reminder.originalTime,
  },
);

    let stockResult;

    try {
      stockResult =
        await consumeMedicineStockForReminder({
        reminderId: reminder.id,
          treatmentId:
            reminder.treatmentId,
        });
    } catch (error) {
      window.alert(
        error.message ||
          'La toma se registró, pero no se pudo actualizar el botiquín.',
      );

      refreshRecords();
      return;
    }

    if (
      stockResult.reason ===
      'no-linked-stock'
    ) {
      console.info(
        'La toma se registró, pero no existe un medicamento del botiquín vinculado a este tratamiento.',
      );
    }

    if (
      stockResult.reason ===
      'already-consumed'
    ) {
      console.info(
        'El stock de esta toma ya había sido descontado.',
      );
    }

    refreshRecords();
  }

  function handleOmit(reminder) {
    if (!selectedCaregiver) {
      window.alert(
        'Primero seleccioná o registrá un responsable familiar.',
      );

      return;
    }

    const reminderTime =
      reminder.originalTime ||
      formatReminderTime(
        getReminderEffectiveDate(
          reminder,
        ),
      );

    const confirmed = window.confirm(
      `¿Querés marcar como omitida la toma de ${reminder.medicationName} de las ${reminderTime}?`,
    );

    if (!confirmed) {
      return;
    }

    markReminderAsOmitted(
      reminder.id,
      {
        responsibleId:
          selectedCaregiver.id,

        responsibleName:
          selectedCaregiver.fullName,
      },
    );

    refreshRecords();
  }

  function handlePostpone(reminder) {
    const answer = window.prompt(
      '¿Cuántos minutos querés posponer la toma?',
      '30',
    );

    if (answer === null) {
      return;
    }

    const minutes = Number(answer);

    if (
      !Number.isInteger(minutes) ||
      minutes < 5 ||
      minutes > 240
    ) {
      window.alert(
        'Ingresá una cantidad entera entre 5 y 240 minutos.',
      );

      return;
    }

    postponeReminder(
      reminder.id,
      minutes,
    );

    refreshRecords();
  }

  async function handleReset(reminder) {
    const confirmed = window.confirm(
      '¿Querés volver esta toma al estado pendiente?',
    );

    if (!confirmed) {
      return;
    }

    try {
      await restoreMedicineStockForReminder(
        reminder.id,
      );

      resetReminder(reminder.id);
      refreshRecords();
    } catch (error) {
      window.alert(
        error.message ||
          'No se pudo volver la toma al estado pendiente.',
      );
    }
  }

  return (
    <div className="reminders-page">
      <section className="reminders-page__header">
        <div>
          <span>Organización diaria</span>

          <h2>Recordatorios</h2>

          <p>
            Consultá las tomas generadas por los
            tratamientos y registrá qué ocurrió
            con cada una.
          </p>
        </div>

        {!limitedAccess && (
          <Link
            to="/dashboard/treatments"
            className="btn btn-primary"
          >
            <i className="bi bi-capsule" />
            Ver tratamientos
          </Link>
        )}
      </section>

      {treatments.length === 0 && (
        <section className="reminders-page__warning">
          <i className="bi bi-bell-slash" />

          <div>
            <strong>
              Todavía no hay tratamientos
            </strong>

            <p>
              Los recordatorios se generan
              automáticamente desde los horarios
              de cada tratamiento.
            </p>
          </div>

          {!limitedAccess && (
            <Link
              to="/dashboard/treatments"
              className="btn btn-outline-primary"
            >
              Crear tratamiento
            </Link>
          )}
        </section>
      )}

      <section className="reminders-responsible-selector">
        <div className="reminders-responsible-selector__icon">
          <i className="bi bi-person-check" />
        </div>

        <div className="reminders-responsible-selector__content">
          <span>
            Responsable que realiza la acción
          </span>

          <strong>
            {selectedCaregiver
              ? selectedCaregiver.fullName
              : 'No hay un responsable seleccionado'}
          </strong>

          <p>
            Esta persona quedará registrada al
            marcar una toma como administrada u
            omitida.
          </p>
        </div>

        <select
          value={selectedCaregiverId}
          onChange={handleCaregiverChange}
          disabled={
            limitedAccess ||
            caregivers.length === 0
          }
          aria-label="Seleccionar responsable familiar"
        >
          <option value="">
            Seleccionar responsable
          </option>

          {caregivers.map(
            (caregiver) => (
              <option
                key={caregiver.id}
                value={caregiver.id}
              >
                {caregiver.fullName}

                {caregiver.isPrimary
                  ? ' — Principal'
                  : ''}
              </option>
            ),
          )}
        </select>

        {!limitedAccess && (
          <Link
            to="/dashboard/caregivers"
            className="btn btn-outline-primary"
          >
            <i className="bi bi-people" />

            {caregivers.length === 0
              ? 'Agregar responsable'
              : 'Gestionar responsables'}
          </Link>
        )}
      </section>

      <section className="reminders-statistics">
        <article>
          <span className="reminders-statistics__icon">
            <i className="bi bi-calendar-day" />
          </span>

          <div>
            <strong>
              {todayReminders.length}
            </strong>

            <span>
              Tomas programadas hoy
            </span>
          </div>
        </article>

        <article>
          <span className="reminders-statistics__icon reminders-statistics__icon--administered">
            <i className="bi bi-check-circle" />
          </span>

          <div>
            <strong>
              {administeredToday}
            </strong>

            <span>Administradas hoy</span>
          </div>
        </article>

        <article>
          <span className="reminders-statistics__icon reminders-statistics__icon--pending">
            <i className="bi bi-clock-history" />
          </span>

          <div>
            <strong>{pendingToday}</strong>

            <span>Pendientes hoy</span>
          </div>
        </article>

        <article>
          <span className="reminders-statistics__icon reminders-statistics__icon--next">
            <i className="bi bi-bell" />
          </span>

          <div>
            <strong>
              {nextReminder
                ? formatReminderTime(
                    getReminderEffectiveDate(
                      nextReminder,
                    ),
                  )
                : '--:--'}
            </strong>

            <span>
              {nextReminder
                ? `Próxima: ${nextReminder.medicationName}`
                : 'Sin próximas tomas'}
            </span>
          </div>
        </article>
      </section>

      <section className="reminders-view-tabs">
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
          Hoy
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
        </button>

        <button
          type="button"
          className={
            viewFilter === 'history'
              ? 'is-active'
              : ''
          }
          onClick={() =>
            setViewFilter('history')
          }
        >
          <i className="bi bi-clock-history" />
          Historial
        </button>

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
          <i className="bi bi-list-ul" />
          Todas
        </button>
      </section>

      <section className="reminders-toolbar">
        <div className="reminders-toolbar__search">
          <i className="bi bi-search" />

          <input
            type="search"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(
                event.target.value,
              )
            }
            placeholder="Buscar por hijo, medicamento o responsable"
            aria-label="Buscar recordatorios"
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

          <option value="pending">
            Pendientes
          </option>

          <option value="administered">
            Administradas
          </option>

          <option value="postponed">
            Pospuestas
          </option>

          <option value="omitted">
            Omitidas
          </option>
        </select>
      </section>

      <div className="reminders-page__result">
        {filteredReminders.length}{' '}

        {filteredReminders.length === 1
          ? 'recordatorio encontrado'
          : 'recordatorios encontrados'}
      </div>

      {filteredReminders.length > 0 ? (
        <div className="reminders-groups">
          {Object.entries(
            groupedReminders,
          ).map(
            ([
              dateKey,
              dateReminders,
            ]) => (
              <section
                key={dateKey}
                className="reminders-group"
              >
                <header className="reminders-group__header">
                  <div>
                    <span>
                      {dateKey ===
                      todayDateKey
                        ? 'Hoy'
                        : 'Agenda'}
                    </span>

                    <h3>
                      {formatReminderDate(
                        getReminderEffectiveDate(
                          dateReminders[0],
                        ),
                      )}
                    </h3>
                  </div>

                  <strong>
                    {dateReminders.length}{' '}

                    {dateReminders.length === 1
                      ? 'toma'
                      : 'tomas'}
                  </strong>
                </header>

                <div className="reminders-list">
                  {dateReminders.map(
                    (reminder) => (
                      <ReminderCard
                        key={reminder.id}
                        reminder={reminder}
                        onAdminister={
                          handleAdminister
                        }
                        onOmit={
                          handleOmit
                        }
                        onPostpone={
                          handlePostpone
                        }
                        onReset={
                          limitedAccess
                            ? undefined
                            : handleReset
                        }
                      />
                    ),
                  )}
                </div>
              </section>
            ),
          )}
        </div>
      ) : (
        <section className="reminders-empty">
          <span>
            <i className="bi bi-bell" />
          </span>

          <h3>
            {reminders.length === 0
              ? 'Todavía no hay recordatorios'
              : 'No encontramos resultados'}
          </h3>

          <p>
            {reminders.length === 0
              ? limitedAccess
                ? 'Todavía no hay tomas programadas. El responsable principal debe crear un tratamiento.'
                : 'Creá un tratamiento con horarios para generar automáticamente las próximas tomas.'
              : 'Probá cambiando la fecha, el estado, el hijo o el término de búsqueda.'}
          </p>

          {reminders.length === 0 &&
            !limitedAccess && (
            <Link
              to="/dashboard/treatments"
              className="btn btn-primary"
            >
              Crear tratamiento
            </Link>
          )}
        </section>
      )}
    </div>
  );
}

export default RemindersPage;