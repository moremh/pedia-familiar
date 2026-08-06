import {
  useEffect,
  useState,
} from 'react';

const emptyForm = {
  childId: '',
  vaccineName: '',
  recordStatus: 'applied',
  date: '',
  doseLabel: '',
  nextDoseDate: '',
  observations: '',
};

function getTodayDateKey() {
  const today = new Date();

  const year = today.getFullYear();

  const month = String(
    today.getMonth() + 1,
  ).padStart(2, '0');

  const day = String(
    today.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getInitialStatus(vaccine) {
  if (vaccine?.recordStatus) {
    return vaccine.recordStatus;
  }

  if (
    vaccine?.applicationDate
  ) {
    return 'applied';
  }

  return 'pending';
}

function VaccineForm({
  children = [],
  initialData = null,
  onSubmit,
  onCancel,
}) {
  const [formData, setFormData] =
    useState(emptyForm);

  const [error, setError] =
    useState('');

  const [
    showMoreOptions,
    setShowMoreOptions,
  ] = useState(false);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  useEffect(() => {
    if (initialData) {
      const recordStatus =
        getInitialStatus(initialData);

      setFormData({
        ...emptyForm,

        childId:
          initialData.childId ?? '',

        vaccineName:
          initialData.vaccineName ?? '',

        recordStatus,

        date:
          recordStatus === 'applied'
            ? initialData.applicationDate ??
              ''
            : initialData.nextDoseDate ??
              '',

        doseLabel:
          initialData.doseLabel ?? '',

        nextDoseDate:
          recordStatus === 'applied'
            ? initialData.nextDoseDate ??
              ''
            : '',

        observations:
          initialData.observations ?? '',
      });

      setShowMoreOptions(
        Boolean(initialData.doseLabel) ||
          Boolean(
            initialData.observations,
          ) ||
          (recordStatus === 'applied' &&
            Boolean(
              initialData.nextDoseDate,
            )),
      );
    } else {
      setFormData({
        ...emptyForm,

        childId:
          children.length === 1
            ? children[0].id
            : '',
      });

      setShowMoreOptions(false);
    }

    setError('');
  }, [initialData, children]);

  function handleChange(event) {
    const { name, value } =
      event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!formData.childId) {
      setError(
        'Seleccioná a qué hijo corresponde.',
      );

      return;
    }

    if (
      !formData.vaccineName.trim()
    ) {
      setError(
        'Ingresá el nombre de la vacuna.',
      );

      return;
    }

    if (!formData.date) {
      setError(
        formData.recordStatus ===
        'applied'
          ? 'Seleccioná la fecha en que fue aplicada.'
          : 'Seleccioná la fecha prevista.',
      );

      return;
    }

    const selectedDate = new Date(
      `${formData.date}T00:00:00`,
    );

    if (
      Number.isNaN(
        selectedDate.getTime(),
      )
    ) {
      setError(
        'La fecha seleccionada no es válida.',
      );

      return;
    }

    if (
      formData.recordStatus ===
      'applied'
    ) {
      const today = new Date();

      today.setHours(
        23,
        59,
        59,
        999,
      );

      if (selectedDate > today) {
        setError(
          'Una vacuna aplicada no puede tener una fecha futura.',
        );

        return;
      }

      if (formData.nextDoseDate) {
        const nextDoseDate = new Date(
          `${formData.nextDoseDate}T00:00:00`,
        );

        if (
          nextDoseDate <= selectedDate
        ) {
          setError(
            'La próxima dosis debe ser posterior a la fecha de aplicación.',
          );

          return;
        }
      }
    }

    setError('');
    setIsSubmitting(true);

    try {
      await onSubmit({
        childId: formData.childId,

        vaccineName:
          formData.vaccineName.trim(),

        recordStatus:
          formData.recordStatus,

        applicationDate:
          formData.recordStatus ===
          'applied'
            ? formData.date
            : '',

        nextDoseDate:
          formData.recordStatus ===
          'pending'
            ? formData.date
            : formData.nextDoseDate,

        doseLabel:
          formData.doseLabel.trim() ||
          (formData.recordStatus ===
          'applied'
            ? 'Aplicada'
            : 'Pendiente'),

        observations:
          formData.observations.trim(),
      });
    } catch (submitError) {
      setError(
        submitError.message ||
          'No se pudo guardar la vacuna.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="vaccine-form"
      onSubmit={handleSubmit}
      noValidate
    >
      {error && (
        <div
          className="vaccine-form__error"
          role="alert"
        >
          <i className="bi bi-exclamation-circle" />
          <span>{error}</span>
        </div>
      )}

      <div className="vaccine-form__notice">
        <i className="bi bi-info-circle" />

        <p>
          Guardá únicamente la
          información que figure en el
          carnet o haya indicado el
          profesional.
        </p>
      </div>

      <section className="vaccine-form__section">
        <header className="vaccine-form__section-header">
          <i className="bi bi-shield-plus" />

          <div>
            <h3>Datos principales</h3>

            <p>
              Solo necesitás completar
              cuatro datos.
            </p>
          </div>
        </header>

        <div className="vaccine-form__grid">
          <div className="vaccine-form__field">
            <label htmlFor="vaccineChild">
              Hijo
            </label>

            <select
              id="vaccineChild"
              name="childId"
              className="form-select"
              value={formData.childId}
              onChange={handleChange}
            >
              <option value="">
                Seleccionar hijo
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
          </div>

          <div className="vaccine-form__field">
            <label htmlFor="vaccineName">
              Vacuna
            </label>

            <input
              type="text"
              id="vaccineName"
              name="vaccineName"
              className="form-control"
              value={
                formData.vaccineName
              }
              onChange={handleChange}
              placeholder="Ejemplo: Antigripal"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="vaccine-form__status-options">
          <label
            className={
              formData.recordStatus ===
              'applied'
                ? 'is-selected'
                : ''
            }
          >
            <input
              type="radio"
              name="recordStatus"
              value="applied"
              checked={
                formData.recordStatus ===
                'applied'
              }
              onChange={handleChange}
            />

            <i className="bi bi-check-circle" />

            <span>
              <strong>Aplicada</strong>

              <small>
                Ya recibió esta vacuna.
              </small>
            </span>
          </label>

          <label
            className={
              formData.recordStatus ===
              'pending'
                ? 'is-selected'
                : ''
            }
          >
            <input
              type="radio"
              name="recordStatus"
              value="pending"
              checked={
                formData.recordStatus ===
                'pending'
              }
              onChange={handleChange}
            />

            <i className="bi bi-calendar-event" />

            <span>
              <strong>Pendiente</strong>

              <small>
                Todavía debe aplicarse.
              </small>
            </span>
          </label>
        </div>

        <div className="vaccine-form__field">
          <label htmlFor="vaccineDate">
            {formData.recordStatus ===
            'applied'
              ? 'Fecha de aplicación'
              : 'Fecha prevista'}
          </label>

          <input
            type="date"
            id="vaccineDate"
            name="date"
            className="form-control"
            value={formData.date}
            onChange={handleChange}
            max={
              formData.recordStatus ===
              'applied'
                ? getTodayDateKey()
                : undefined
            }
          />
        </div>
      </section>

      <button
        type="button"
        className="vaccine-form__more-button"
        onClick={() =>
          setShowMoreOptions(
            (currentValue) =>
              !currentValue,
          )
        }
        aria-expanded={showMoreOptions}
      >
        <span>
          <i className="bi bi-sliders" />

          {showMoreOptions
            ? 'Ocultar detalles opcionales'
            : 'Agregar más detalles'}
        </span>

        <i
          className={`bi ${
            showMoreOptions
              ? 'bi-chevron-up'
              : 'bi-chevron-down'
          }`}
        />
      </button>

      {showMoreOptions && (
        <section className="vaccine-form__section vaccine-form__section--optional">
          <header className="vaccine-form__section-header">
            <i className="bi bi-journal-text" />

            <div>
              <h3>Detalles opcionales</h3>

              <p>
                Podés dejarlos vacíos.
              </p>
            </div>
          </header>

          <div className="vaccine-form__grid">
            <div className="vaccine-form__field">
              <label htmlFor="vaccineDoseLabel">
                Dosis
              </label>

              <input
                type="text"
                id="vaccineDoseLabel"
                name="doseLabel"
                className="form-control"
                value={
                  formData.doseLabel
                }
                onChange={handleChange}
                placeholder="Primera, segunda o refuerzo"
              />
            </div>

            {formData.recordStatus ===
              'applied' && (
              <div className="vaccine-form__field">
                <label htmlFor="nextDoseDate">
                  Próxima dosis
                </label>

                <input
                  type="date"
                  id="nextDoseDate"
                  name="nextDoseDate"
                  className="form-control"
                  value={
                    formData.nextDoseDate
                  }
                  onChange={handleChange}
                  min={
                    formData.date ||
                    undefined
                  }
                />

                <small>
                  Dejala vacía cuando no
                  corresponda.
                </small>
              </div>
            )}

            <div className="vaccine-form__field vaccine-form__field--wide">
              <label htmlFor="vaccineObservations">
                Nota familiar
              </label>

              <textarea
                id="vaccineObservations"
                name="observations"
                className="form-control"
                value={
                  formData.observations
                }
                onChange={handleChange}
                rows="3"
                placeholder="Ejemplo: llevar el carnet."
              />
            </div>
          </div>
        </section>
      )}

      <footer className="vaccine-form__actions">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancelar
        </button>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSubmitting}
        >
          <i
            className={`bi ${
              isSubmitting
                ? 'bi-hourglass-split'
                : 'bi-check-lg'
            }`}
          />

          {isSubmitting
            ? 'Guardando...'
            : initialData
              ? 'Guardar cambios'
              : 'Guardar vacuna'}
        </button>
      </footer>
    </form>
  );
}

export default VaccineForm;