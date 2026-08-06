import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  calculateTreatmentEndDate,
  generateIntervalTimes,
  parseCustomTimes,
} from '../../utils/treatmentUtils.js';

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

const emptyForm = {
  childId: '',
  consultationId: '',
  medicationName: '',
  presentation: '',
  dosageInstruction: '',
  administrationRoute: 'oral',
  startDate: '',
  durationDays: '7',
  frequencyMode: 'interval',
  intervalHours: '8',
  firstDoseTime: '',
  customTimesText: '',
  notes: '',
};

function TreatmentForm({
  children = [],
  consultations = [],
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

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...emptyForm,
        ...initialData,

        customTimesText: Array.isArray(
          initialData.customTimes,
        )
          ? initialData.customTimes.join(', ')
          : '',

        durationDays: String(
          initialData.durationDays ?? '7',
        ),

        intervalHours: String(
          initialData.intervalHours ?? '8',
        ),
      });

      const hasOptionalInformation =
        Boolean(initialData.consultationId) ||
        Boolean(initialData.presentation) ||
        Boolean(initialData.notes) ||
        initialData.administrationRoute !==
          'oral';

      setShowMoreOptions(
        hasOptionalInformation,
      );
    } else {
      setFormData({
        ...emptyForm,

        childId:
          children.length === 1
            ? children[0].id
            : '',

        startDate: getTodayDateKey(),
      });

      setShowMoreOptions(false);
    }

    setError('');
  }, [initialData, children]);

  const availableConsultations =
    useMemo(
      () =>
        consultations.filter(
          (consultation) =>
            consultation.childId ===
            formData.childId,
        ),
      [
        consultations,
        formData.childId,
      ],
    );

  const previewTimes = useMemo(() => {
    if (
      formData.frequencyMode === 'custom'
    ) {
      return parseCustomTimes(
        formData.customTimesText,
      );
    }

    return generateIntervalTimes(
      formData.firstDoseTime,
      formData.intervalHours,
    );
  }, [
    formData.frequencyMode,
    formData.customTimesText,
    formData.firstDoseTime,
    formData.intervalHours,
  ]);

  const calculatedEndDate = useMemo(
    () =>
      calculateTreatmentEndDate(
        formData.startDate,
        formData.durationDays,
      ),
    [
      formData.startDate,
      formData.durationDays,
    ],
  );

  function handleChange(event) {
    const { name, value } =
      event.target;

    setFormData((currentData) => {
      const updatedData = {
        ...currentData,
        [name]: value,
      };

      if (name === 'childId') {
        updatedData.consultationId = '';
      }

      return updatedData;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!formData.childId) {
      setError(
        'Seleccioná a qué hijo corresponde el tratamiento.',
      );

      return;
    }

    if (
      !formData.medicationName.trim()
    ) {
      setError(
        'Ingresá el nombre del remedio.',
      );

      return;
    }

    if (
      !formData.dosageInstruction.trim()
    ) {
      setError(
        'Ingresá cuánto debe recibir en cada toma.',
      );

      return;
    }

    if (!formData.startDate) {
      setError(
        'Seleccioná la fecha de inicio.',
      );

      return;
    }

    const durationDays = Number(
      formData.durationDays,
    );

    if (
      !Number.isInteger(durationDays) ||
      durationDays < 1 ||
      durationDays > 365
    ) {
      setError(
        'Ingresá una duración válida entre 1 y 365 días.',
      );

      return;
    }

    if (
      formData.frequencyMode ===
      'interval'
    ) {
      if (!formData.firstDoseTime) {
        setError(
          'Seleccioná el horario de la primera toma.',
        );

        return;
      }

      if (
        !Number(formData.intervalHours)
      ) {
        setError(
          'Seleccioná cada cuántas horas corresponde.',
        );

        return;
      }
    }

    if (
      formData.frequencyMode ===
        'custom' &&
      previewTimes.length === 0
    ) {
      setError(
        'Ingresá al menos un horario válido, por ejemplo: 08:00, 20:00.',
      );

      return;
    }

    setError('');

    onSubmit({
      childId: formData.childId,

      consultationId:
        formData.consultationId,

      medicationName:
        formData.medicationName.trim(),

      presentation:
        formData.presentation.trim(),

      dosageInstruction:
        formData.dosageInstruction.trim(),

      administrationRoute:
        formData.administrationRoute,

      startDate: formData.startDate,

      durationDays,

      endDate: calculatedEndDate,

      frequencyMode:
        formData.frequencyMode,

      intervalHours:
        formData.frequencyMode ===
        'interval'
          ? Number(
              formData.intervalHours,
            )
          : '',

      firstDoseTime:
        formData.frequencyMode ===
        'interval'
          ? formData.firstDoseTime
          : '',

      customTimes:
        formData.frequencyMode ===
        'custom'
          ? previewTimes
          : [],

      notes: formData.notes.trim(),

      ...(initialData?.status
        ? {
            status:
              initialData.status,
          }
        : {}),
    });
  }

  return (
    <form
      className="treatment-form"
      onSubmit={handleSubmit}
      noValidate
    >
      {error && (
        <div
          className="treatment-form__error"
          role="alert"
        >
          <i className="bi bi-exclamation-circle" />
          <span>{error}</span>
        </div>
      )}

      <div className="treatment-form__notice">
        <i className="bi bi-info-circle" />

        <p>
          Copiá la cantidad y los horarios
          indicados por el profesional. El
          sistema solamente organiza los
          recordatorios.
        </p>
      </div>

      <section className="treatment-form__section">
        <header className="treatment-form__section-header">
          <i className="bi bi-capsule-pill" />

          <div>
            <h3>Datos del tratamiento</h3>

            <p>
              Completá solamente la
              información necesaria.
            </p>
          </div>
        </header>

        <div className="treatment-form__grid">
          <div className="treatment-form__field">
            <label htmlFor="treatmentChild">
              Hijo
            </label>

            <select
              id="treatmentChild"
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

          <div className="treatment-form__field">
            <label htmlFor="medicationName">
              Nombre del remedio
            </label>

            <input
              type="text"
              id="medicationName"
              name="medicationName"
              className="form-control"
              value={
                formData.medicationName
              }
              onChange={handleChange}
              placeholder="Ejemplo: Amoxicilina"
              autoComplete="off"
            />
          </div>

          <div className="treatment-form__field treatment-form__field--wide">
            <label htmlFor="dosageInstruction">
              Cantidad por toma
            </label>

            <input
              type="text"
              id="dosageInstruction"
              name="dosageInstruction"
              className="form-control"
              value={
                formData.dosageInstruction
              }
              onChange={handleChange}
              placeholder="Ejemplo: 5 ml"
              autoComplete="off"
            />

            <small>
              Escribila tal como figura en
              la indicación médica.
            </small>
          </div>

          <div className="treatment-form__field">
            <label htmlFor="treatmentStartDate">
              Comienza
            </label>

            <input
              type="date"
              id="treatmentStartDate"
              name="startDate"
              className="form-control"
              value={formData.startDate}
              onChange={handleChange}
            />
          </div>

          <div className="treatment-form__field">
            <label htmlFor="treatmentDuration">
              Durante cuántos días
            </label>

            <div className="treatment-form__input-group">
              <input
                type="number"
                id="treatmentDuration"
                name="durationDays"
                className="form-control"
                value={
                  formData.durationDays
                }
                onChange={handleChange}
                min="1"
                max="365"
                inputMode="numeric"
              />

              <span>días</span>
            </div>
          </div>
        </div>

        <div className="treatment-form__calculated-date">
          <i className="bi bi-calendar2-check" />

          <span>
            {calculatedEndDate
              ? `El tratamiento finalizará el ${calculatedEndDate}.`
              : 'Completá la fecha y la duración.'}
          </span>
        </div>
      </section>

      <section className="treatment-form__section">
        <header className="treatment-form__section-header">
          <i className="bi bi-alarm" />

          <div>
            <h3>Horarios</h3>

            <p>
              Elegí la opción que aparezca
              en la receta.
            </p>
          </div>
        </header>

        <div className="treatment-form__frequency-options">
          <label
            className={`treatment-form__frequency-option ${
              formData.frequencyMode ===
              'interval'
                ? 'is-selected'
                : ''
            }`}
          >
            <input
              type="radio"
              name="frequencyMode"
              value="interval"
              checked={
                formData.frequencyMode ===
                'interval'
              }
              onChange={handleChange}
            />

            <i className="bi bi-arrow-repeat" />

            <span>
              <strong>
                Cada cierta cantidad de
                horas
              </strong>

              <small>
                Ejemplo: cada 8 horas.
              </small>
            </span>
          </label>

          <label
            className={`treatment-form__frequency-option ${
              formData.frequencyMode ===
              'custom'
                ? 'is-selected'
                : ''
            }`}
          >
            <input
              type="radio"
              name="frequencyMode"
              value="custom"
              checked={
                formData.frequencyMode ===
                'custom'
              }
              onChange={handleChange}
            />

            <i className="bi bi-clock" />

            <span>
              <strong>
                Horarios específicos
              </strong>

              <small>
                Ejemplo: 08:00 y 20:00.
              </small>
            </span>
          </label>
        </div>

        {formData.frequencyMode ===
        'interval' ? (
          <div className="treatment-form__grid">
            <div className="treatment-form__field">
              <label htmlFor="intervalHours">
                Frecuencia
              </label>

              <select
                id="intervalHours"
                name="intervalHours"
                className="form-select"
                value={
                  formData.intervalHours
                }
                onChange={handleChange}
              >
                <option value="4">
                  Cada 4 horas
                </option>

                <option value="6">
                  Cada 6 horas
                </option>

                <option value="8">
                  Cada 8 horas
                </option>

                <option value="12">
                  Cada 12 horas
                </option>

                <option value="24">
                  Una vez al día
                </option>
              </select>
            </div>

            <div className="treatment-form__field">
              <label htmlFor="firstDoseTime">
                Primera toma
              </label>

              <input
                type="time"
                id="firstDoseTime"
                name="firstDoseTime"
                className="form-control"
                value={
                  formData.firstDoseTime
                }
                onChange={handleChange}
              />
            </div>
          </div>
        ) : (
          <div className="treatment-form__field">
            <label htmlFor="customTimesText">
              Horarios
            </label>

            <input
              type="text"
              id="customTimesText"
              name="customTimesText"
              className="form-control"
              value={
                formData.customTimesText
              }
              onChange={handleChange}
              placeholder="08:00, 14:00, 20:00"
              autoComplete="off"
            />

            <small>
              Separá los horarios con una
              coma.
            </small>
          </div>
        )}

        <div className="treatment-form__schedule-preview">
          <span>
            Recordatorios que se crearán
          </span>

          <div>
            {previewTimes.length > 0 ? (
              previewTimes.map((time) => (
                <strong key={time}>
                  {time}
                </strong>
              ))
            ) : (
              <small>
                Seleccioná los horarios para
                verlos aquí.
              </small>
            )}
          </div>
        </div>
      </section>

      <button
        type="button"
        className="treatment-form__more-button"
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
        <section className="treatment-form__section treatment-form__section--optional">
          <header className="treatment-form__section-header">
            <i className="bi bi-journal-text" />

            <div>
              <h3>Detalles opcionales</h3>

              <p>
                Podés dejarlos vacíos y
                completar el tratamiento
                igualmente.
              </p>
            </div>
          </header>

          <div className="treatment-form__grid">
            <div className="treatment-form__field">
              <label htmlFor="medicationPresentation">
                Presentación
              </label>

              <input
                type="text"
                id="medicationPresentation"
                name="presentation"
                className="form-control"
                value={
                  formData.presentation
                }
                onChange={handleChange}
                placeholder="Ejemplo: jarabe"
              />
            </div>

            <div className="treatment-form__field">
              <label htmlFor="administrationRoute">
                Cómo se administra
              </label>

              <select
                id="administrationRoute"
                name="administrationRoute"
                className="form-select"
                value={
                  formData.administrationRoute
                }
                onChange={handleChange}
              >
                <option value="oral">
                  Por boca
                </option>

                <option value="topical">
                  Sobre la piel
                </option>

                <option value="inhaled">
                  Inhalación
                </option>

                <option value="ophthalmic">
                  En los ojos
                </option>

                <option value="otic">
                  En los oídos
                </option>

                <option value="nasal">
                  En la nariz
                </option>

                <option value="other">
                  Otra
                </option>
              </select>
            </div>

            <div className="treatment-form__field treatment-form__field--wide">
              <label htmlFor="treatmentConsultation">
                Consulta relacionada
              </label>

              <select
                id="treatmentConsultation"
                name="consultationId"
                className="form-select"
                value={
                  formData.consultationId
                }
                onChange={handleChange}
                disabled={!formData.childId}
              >
                <option value="">
                  Ninguna
                </option>

                {availableConsultations.map(
                  (consultation) => (
                    <option
                      key={consultation.id}
                      value={consultation.id}
                    >
                      {consultation.consultationDate}{' '}
                      — {consultation.reason}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="treatment-form__field treatment-form__field--wide">
              <label htmlFor="treatmentNotes">
                Nota para la familia
              </label>

              <textarea
                id="treatmentNotes"
                name="notes"
                className="form-control"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
                placeholder="Ejemplo: dar después de comer."
              />
            </div>
          </div>
        </section>
      )}

      <footer className="treatment-form__actions">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onCancel}
        >
          Cancelar
        </button>

        <button
          type="submit"
          className="btn btn-primary"
        >
          <i className="bi bi-check-lg" />

          {initialData
            ? 'Guardar cambios'
            : 'Crear tratamiento'}
        </button>
      </footer>
    </form>
  );
}

export default TreatmentForm;