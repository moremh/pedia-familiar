import {
  useEffect,
  useState,
} from 'react';

const REMINDER_OPTIONS = [
  {
    value: '0',
    label: 'A la hora del turno',
  },
  {
    value: '10',
    label: '10 minutos antes',
  },
  {
    value: '15',
    label: '15 minutos antes',
  },
  {
    value: '30',
    label: '30 minutos antes',
  },
  {
    value: '60',
    label: '1 hora antes',
  },
  {
    value: '120',
    label: '2 horas antes',
  },
  {
    value: '1440',
    label: '1 día antes',
  },
  {
    value: 'custom',
    label: 'Personalizado',
  },
];

const emptyForm = {
  childId: '',
  appointmentDate: '',
  appointmentTime: '',
  reason: '',
  professionalName: '',
  specialty: '',
  medicalCenter: '',
  reminderEnabled: true,
  reminderMinutesBefore: 30,
  notes: '',
};

function AppointmentForm({
  children,
  initialData = null,
  onSubmit,
  onCancel,
}) {
  const [formData, setFormData] =
    useState(emptyForm);

  const [
    reminderPreset,
    setReminderPreset,
  ] = useState('30');

  const [error, setError] =
    useState('');

  useEffect(() => {
    const next = initialData
      ? {
          ...emptyForm,
          ...initialData,
          reminderEnabled:
            initialData.reminderEnabled !==
            false,
          reminderMinutesBefore:
            Number(
              initialData.reminderMinutesBefore ??
                30,
            ),
        }
      : {
          ...emptyForm,
          childId:
            children.length === 1
              ? children[0].id
              : '',
        };

    setFormData(next);

    const currentMinutes =
      String(
        next.reminderMinutesBefore,
      );

    const known =
      REMINDER_OPTIONS.some(
        (option) =>
          option.value ===
          currentMinutes,
      );

    setReminderPreset(
      known
        ? currentMinutes
        : 'custom',
    );

    setError('');
  }, [
    children,
    initialData,
  ]);

  function handleChange(event) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setFormData(
      (current) => ({
        ...current,
        [name]:
          type === 'checkbox'
            ? checked
            : value,
      }),
    );
  }

  function handleReminderPreset(
    event,
  ) {
    const value =
      event.target.value;

    setReminderPreset(value);

    if (value !== 'custom') {
      setFormData(
        (current) => ({
          ...current,
          reminderMinutesBefore:
            Number(value),
        }),
      );
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!formData.childId) {
      setError(
        'Seleccioná el hijo al que corresponde el turno.',
      );
      return;
    }

    if (
      !formData.appointmentDate ||
      !formData.appointmentTime
    ) {
      setError(
        'Ingresá la fecha y la hora del turno.',
      );
      return;
    }

    const appointmentAt =
      new Date(
        `${formData.appointmentDate}T${formData.appointmentTime}:00`,
      );

    if (
      Number.isNaN(
        appointmentAt.getTime(),
      )
    ) {
      setError(
        'La fecha u hora del turno no es válida.',
      );
      return;
    }

    if (
      !initialData &&
      appointmentAt.getTime() <
        Date.now() - 60 * 1000
    ) {
      setError(
        'El turno debe programarse para una fecha y hora futuras.',
      );
      return;
    }

    if (
      !formData.reason.trim()
    ) {
      setError(
        'Ingresá el motivo del turno.',
      );
      return;
    }

    const reminderMinutes =
      Number(
        formData.reminderMinutesBefore,
      );

    if (
      formData.reminderEnabled &&
      (
        !Number.isInteger(
          reminderMinutes,
        ) ||
        reminderMinutes < 0 ||
        reminderMinutes > 10080
      )
    ) {
      setError(
        'El aviso personalizado debe estar entre 0 y 10080 minutos.',
      );
      return;
    }

    setError('');

    onSubmit({
      ...formData,
      reason:
        formData.reason.trim(),
      professionalName:
        formData.professionalName.trim(),
      specialty:
        formData.specialty.trim(),
      medicalCenter:
        formData.medicalCenter.trim(),
      notes:
        formData.notes.trim(),
      reminderEnabled:
        Boolean(
          formData.reminderEnabled,
        ),
      reminderMinutesBefore:
        reminderMinutes,
    });
  }

  return (
    <form
      className="appointment-form"
      onSubmit={handleSubmit}
      noValidate
    >
      {error && (
        <div
          className="alert alert-danger"
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="appointment-form__grid">
        <label>
          Hijo
          <select
            name="childId"
            className="form-select"
            value={formData.childId}
            onChange={handleChange}
            required
          >
            <option value="">
              Seleccionar
            </option>

            {children.map(
              (child) => (
                <option
                  key={child.id}
                  value={child.id}
                >
                  {child.fullName}
                </option>
              ),
            )}
          </select>
        </label>

        <label>
          Fecha
          <input
            type="date"
            name="appointmentDate"
            className="form-control"
            value={
              formData.appointmentDate
            }
            onChange={handleChange}
            required
          />
        </label>

        <label>
          Hora
          <input
            type="time"
            name="appointmentTime"
            className="form-control"
            value={
              formData.appointmentTime
            }
            onChange={handleChange}
            required
          />
        </label>

        <label className="appointment-form__wide">
          Motivo
          <input
            type="text"
            name="reason"
            className="form-control"
            value={formData.reason}
            onChange={handleChange}
            placeholder="Ej.: control pediátrico"
            required
          />
        </label>

        <label>
          Profesional
          <input
            type="text"
            name="professionalName"
            className="form-control"
            value={
              formData.professionalName
            }
            onChange={handleChange}
            placeholder="Nombre del profesional"
          />
        </label>

        <label>
          Especialidad
          <input
            type="text"
            name="specialty"
            className="form-control"
            value={
              formData.specialty
            }
            onChange={handleChange}
            placeholder="Pediatría, odontología..."
          />
        </label>

        <label className="appointment-form__wide">
          Lugar
          <input
            type="text"
            name="medicalCenter"
            className="form-control"
            value={
              formData.medicalCenter
            }
            onChange={handleChange}
            placeholder="Clínica, consultorio, hospital..."
          />
        </label>
      </div>

      <section className="appointment-form__reminder">
        <label className="appointment-form__toggle">
          <input
            type="checkbox"
            name="reminderEnabled"
            checked={
              formData.reminderEnabled
            }
            onChange={handleChange}
          />

          <span>
            <strong>
              Recordarme este turno
            </strong>
            <small>
              MiPeque enviará un aviso
              dentro y fuera de la app.
            </small>
          </span>
        </label>

        {formData.reminderEnabled && (
          <div className="appointment-form__reminder-grid">
            <label>
              Avisar
              <select
                className="form-select"
                value={reminderPreset}
                onChange={
                  handleReminderPreset
                }
              >
                {REMINDER_OPTIONS.map(
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
            </label>

            {reminderPreset ===
              'custom' && (
              <label>
                Minutos antes
                <input
                  type="number"
                  className="form-control"
                  name="reminderMinutesBefore"
                  value={
                    formData.reminderMinutesBefore
                  }
                  onChange={handleChange}
                  min="0"
                  max="10080"
                  step="1"
                />
              </label>
            )}
          </div>
        )}
      </section>

      <label className="appointment-form__notes">
        Notas
        <textarea
          name="notes"
          className="form-control"
          rows="3"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Indicaciones, documentación a llevar, etc."
        />
      </label>

      <div className="appointment-form__actions">
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
          Guardar turno
        </button>
      </div>
    </form>
  );
}

export default AppointmentForm;
