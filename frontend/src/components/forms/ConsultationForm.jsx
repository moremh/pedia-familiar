import { useEffect, useState } from 'react';

const emptyForm = {
  childId: '',
  consultationDate: '',
  consultationTime: '',
  consultationType: 'pediatric',
  reason: '',
  symptoms: '',
  diagnosis: '',
  professionalName: '',
  specialty: '',
  medicalCenter: '',
  weight: '',
  temperature: '',
  indications: '',
  followUpDate: '',
  notes: '',
};

function ConsultationForm({
  children,
  initialData = null,
  onSubmit,
  onCancel,
}) {
  const [formData, setFormData] =
    useState(emptyForm);

  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...emptyForm,
        ...initialData,
        weight: initialData.weight ?? '',
        temperature:
          initialData.temperature ?? '',
      });
    } else {
      setFormData({
        ...emptyForm,
        childId:
          children.length === 1
            ? children[0].id
            : '',
      });
    }

    setError('');
  }, [initialData, children]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!formData.childId) {
      setError(
        'Seleccioná el hijo al que corresponde la consulta.',
      );
      return;
    }

    if (!formData.consultationDate) {
      setError(
        'Ingresá la fecha de la consulta.',
      );
      return;
    }

    const consultationDate = new Date(
      `${formData.consultationDate}T00:00:00`,
    );

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (consultationDate > today) {
      setError(
        'La fecha de la consulta no puede ser posterior a hoy.',
      );
      return;
    }

    if (!formData.reason.trim()) {
      setError(
        'Ingresá el motivo principal de la consulta.',
      );
      return;
    }

    if (
      formData.temperature !== '' &&
      (Number(formData.temperature) < 30 ||
        Number(formData.temperature) > 45)
    ) {
      setError(
        'Ingresá una temperatura válida entre 30 °C y 45 °C.',
      );
      return;
    }

    setError('');

    onSubmit({
      ...formData,
      reason: formData.reason.trim(),
      symptoms: formData.symptoms.trim(),
      diagnosis: formData.diagnosis.trim(),
      professionalName:
        formData.professionalName.trim(),
      specialty: formData.specialty.trim(),
      medicalCenter:
        formData.medicalCenter.trim(),
      indications: formData.indications.trim(),
      notes: formData.notes.trim(),
      weight:
        formData.weight === ''
          ? ''
          : Number(formData.weight),
      temperature:
        formData.temperature === ''
          ? ''
          : Number(formData.temperature),
    });
  }

  return (
    <form
      className="consultation-form"
      onSubmit={handleSubmit}
      noValidate
    >
      {error && (
        <div
          className="consultation-form__error"
          role="alert"
        >
          <i className="bi bi-exclamation-circle" />
          <span>{error}</span>
        </div>
      )}

      <div className="consultation-form__notice">
        <i className="bi bi-info-circle" />

        <p>
          Registrá diagnósticos e indicaciones tal
          como fueron informados por el profesional.
          Este historial no reemplaza una nueva
          consulta médica.
        </p>
      </div>

      <section className="consultation-form__section">
        <header className="consultation-form__section-header">
          <i className="bi bi-person-hearts" />

          <div>
            <h3>Paciente y consulta</h3>
            <p>
              Indicá a quién corresponde y cuándo
              fue atendido.
            </p>
          </div>
        </header>

        <div className="consultation-form__grid">
          <div className="consultation-form__field consultation-form__field--wide">
            <label htmlFor="consultationChild">
              Hijo
            </label>

            <select
              id="consultationChild"
              name="childId"
              className="form-select"
              value={formData.childId}
              onChange={handleChange}
            >
              <option value="">
                Seleccionar perfil infantil
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

          <div className="consultation-form__field">
            <label htmlFor="consultationDate">
              Fecha de consulta
            </label>

            <input
              type="date"
              id="consultationDate"
              name="consultationDate"
              className="form-control"
              value={formData.consultationDate}
              onChange={handleChange}
              max={
                new Date()
                  .toISOString()
                  .split('T')[0]
              }
            />
          </div>

          <div className="consultation-form__field">
            <label htmlFor="consultationTime">
              Horario
            </label>

            <input
              type="time"
              id="consultationTime"
              name="consultationTime"
              className="form-control"
              value={formData.consultationTime}
              onChange={handleChange}
            />
          </div>

          <div className="consultation-form__field">
            <label htmlFor="consultationType">
              Tipo de consulta
            </label>

            <select
              id="consultationType"
              name="consultationType"
              className="form-select"
              value={formData.consultationType}
              onChange={handleChange}
            >
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
          </div>

          <div className="consultation-form__field">
            <label htmlFor="consultationSpecialty">
              Especialidad
            </label>

            <input
              type="text"
              id="consultationSpecialty"
              name="specialty"
              className="form-control"
              value={formData.specialty}
              onChange={handleChange}
              placeholder="Ejemplo: pediatría"
            />
          </div>

          <div className="consultation-form__field consultation-form__field--wide">
            <label htmlFor="consultationReason">
              Motivo principal
            </label>

            <input
              type="text"
              id="consultationReason"
              name="reason"
              className="form-control"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Ejemplo: tos y congestión"
            />
          </div>
        </div>
      </section>

      <section className="consultation-form__section">
        <header className="consultation-form__section-header">
          <i className="bi bi-thermometer-half" />

          <div>
            <h3>Síntomas y mediciones</h3>
            <p>
              Información observada durante el
              episodio.
            </p>
          </div>
        </header>

        <div className="consultation-form__grid">
          <div className="consultation-form__field consultation-form__field--wide">
            <label htmlFor="consultationSymptoms">
              Síntomas
            </label>

            <textarea
              id="consultationSymptoms"
              name="symptoms"
              className="form-control"
              value={formData.symptoms}
              onChange={handleChange}
              rows="4"
              placeholder="Tos, fiebre, dolor de garganta, congestión..."
            />
          </div>

          <div className="consultation-form__field">
            <label htmlFor="consultationWeight">
              Peso en la consulta
            </label>

            <div className="consultation-form__input-group">
              <input
                type="number"
                id="consultationWeight"
                name="weight"
                className="form-control"
                value={formData.weight}
                onChange={handleChange}
                min="0"
                max="250"
                step="0.1"
                placeholder="24"
              />

              <span>kg</span>
            </div>
          </div>

          <div className="consultation-form__field">
            <label htmlFor="consultationTemperature">
              Temperatura
            </label>

            <div className="consultation-form__input-group">
              <input
                type="number"
                id="consultationTemperature"
                name="temperature"
                className="form-control"
                value={formData.temperature}
                onChange={handleChange}
                min="30"
                max="45"
                step="0.1"
                placeholder="37.5"
              />

              <span>°C</span>
            </div>
          </div>
        </div>
      </section>

      <section className="consultation-form__section">
        <header className="consultation-form__section-header">
          <i className="bi bi-person-badge" />

          <div>
            <h3>Profesional y atención</h3>
            <p>
              Datos del médico y lugar de consulta.
            </p>
          </div>
        </header>

        <div className="consultation-form__grid">
          <div className="consultation-form__field">
            <label htmlFor="consultationProfessional">
              Profesional
            </label>

            <input
              type="text"
              id="consultationProfessional"
              name="professionalName"
              className="form-control"
              value={formData.professionalName}
              onChange={handleChange}
              placeholder="Nombre del profesional"
            />
          </div>

          <div className="consultation-form__field">
            <label htmlFor="consultationCenter">
              Centro médico
            </label>

            <input
              type="text"
              id="consultationCenter"
              name="medicalCenter"
              className="form-control"
              value={formData.medicalCenter}
              onChange={handleChange}
              placeholder="Hospital, clínica o consultorio"
            />
          </div>
        </div>
      </section>

      <section className="consultation-form__section">
        <header className="consultation-form__section-header">
          <i className="bi bi-clipboard2-pulse" />

          <div>
            <h3>Resultado de la consulta</h3>
            <p>
              Diagnóstico informado e indicaciones
              recibidas.
            </p>
          </div>
        </header>

        <div className="consultation-form__grid">
          <div className="consultation-form__field consultation-form__field--wide">
            <label htmlFor="consultationDiagnosis">
              Diagnóstico informado
            </label>

            <textarea
              id="consultationDiagnosis"
              name="diagnosis"
              className="form-control"
              value={formData.diagnosis}
              onChange={handleChange}
              rows="3"
              placeholder="Copiá el diagnóstico informado por el profesional."
            />
          </div>

          <div className="consultation-form__field consultation-form__field--wide">
            <label htmlFor="consultationIndications">
              Indicaciones
            </label>

            <textarea
              id="consultationIndications"
              name="indications"
              className="form-control"
              value={formData.indications}
              onChange={handleChange}
              rows="4"
              placeholder="Medicamentos indicados, cuidados y recomendaciones."
            />
          </div>

          <div className="consultation-form__field">
            <label htmlFor="consultationFollowUp">
              Próximo control
            </label>

            <input
              type="date"
              id="consultationFollowUp"
              name="followUpDate"
              className="form-control"
              value={formData.followUpDate}
              onChange={handleChange}
              min={formData.consultationDate || undefined}
            />
          </div>

          <div className="consultation-form__field consultation-form__field--wide">
            <label htmlFor="consultationNotes">
              Observaciones familiares
            </label>

            <textarea
              id="consultationNotes"
              name="notes"
              className="form-control"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              placeholder="Información adicional que quieran recordar."
            />
          </div>
        </div>
      </section>

      <footer className="consultation-form__actions">
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
            : 'Registrar consulta'}
        </button>
      </footer>
    </form>
  );
}

export default ConsultationForm;