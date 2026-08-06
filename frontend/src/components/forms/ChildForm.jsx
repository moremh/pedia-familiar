import { useEffect, useState } from 'react';

const emptyForm = {
  fullName: '',
  birthDate: '',
  bloodType: '',
  weight: '',
  height: '',
  allergies: '',
  medicalHistory: '',
  healthInsurance: '',
  memberNumber: '',
  pediatricianName: '',
  pediatricianPhone: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  notes: '',
};

function ChildForm({
  initialData = null,
  onSubmit,
  onCancel,
}) {
  const [formData, setFormData] = useState(emptyForm);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...emptyForm,
        ...initialData,
        weight: initialData.weight ?? '',
        height: initialData.height ?? '',
      });
    } else {
      setFormData(emptyForm);
    }

    setError('');
  }, [initialData]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!formData.fullName.trim()) {
      setError('Ingresá el nombre y apellido del hijo.');
      return;
    }

    if (!formData.birthDate) {
      setError('Ingresá la fecha de nacimiento.');
      return;
    }

    const birthDate = new Date(
      `${formData.birthDate}T00:00:00`,
    );

    if (birthDate > new Date()) {
      setError(
        'La fecha de nacimiento no puede ser posterior a hoy.',
      );
      return;
    }

    setError('');

    onSubmit({
      ...formData,
      fullName: formData.fullName.trim(),
      weight:
        formData.weight === ''
          ? ''
          : Number(formData.weight),
      height:
        formData.height === ''
          ? ''
          : Number(formData.height),
    });
  }

  return (
    <form
      className="child-form"
      onSubmit={handleSubmit}
      noValidate
    >
      {error && (
        <div className="child-form__error" role="alert">
          <i className="bi bi-exclamation-circle" />
          <span>{error}</span>
        </div>
      )}

      <section className="child-form__section">
        <div className="child-form__section-header">
          <i className="bi bi-person-vcard" />

          <div>
            <h3>Datos personales</h3>
            <p>Información principal del perfil infantil.</p>
          </div>
        </div>

        <div className="child-form__grid">
          <div className="child-form__field child-form__field--wide">
            <label htmlFor="childFullName">
              Nombre y apellido
            </label>

            <input
              type="text"
              id="childFullName"
              name="fullName"
              className="form-control"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Ejemplo: Sofía García"
              autoComplete="off"
            />
          </div>

          <div className="child-form__field">
            <label htmlFor="childBirthDate">
              Fecha de nacimiento
            </label>

            <input
              type="date"
              id="childBirthDate"
              name="birthDate"
              className="form-control"
              value={formData.birthDate}
              onChange={handleChange}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div className="child-form__field">
            <label htmlFor="childBloodType">
              Grupo sanguíneo
            </label>

            <select
              id="childBloodType"
              name="bloodType"
              className="form-select"
              value={formData.bloodType}
              onChange={handleChange}
            >
              <option value="">No registrado</option>
              <option value="A+">A positivo</option>
              <option value="A-">A negativo</option>
              <option value="B+">B positivo</option>
              <option value="B-">B negativo</option>
              <option value="AB+">AB positivo</option>
              <option value="AB-">AB negativo</option>
              <option value="O+">O positivo</option>
              <option value="O-">O negativo</option>
            </select>
          </div>

          <div className="child-form__field">
            <label htmlFor="childWeight">
              Peso actual
            </label>

            <div className="child-form__input-group">
              <input
                type="number"
                id="childWeight"
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

          <div className="child-form__field">
            <label htmlFor="childHeight">
              Altura actual
            </label>

            <div className="child-form__input-group">
              <input
                type="number"
                id="childHeight"
                name="height"
                className="form-control"
                value={formData.height}
                onChange={handleChange}
                min="0"
                max="250"
                step="0.1"
                placeholder="121"
              />

              <span>cm</span>
            </div>
          </div>
        </div>
      </section>

      <section className="child-form__section">
        <div className="child-form__section-header">
          <i className="bi bi-heart-pulse" />

          <div>
            <h3>Información médica</h3>
            <p>
              Alergias y antecedentes importantes para consultas.
            </p>
          </div>
        </div>

        <div className="child-form__grid">
          <div className="child-form__field child-form__field--wide">
            <label htmlFor="childAllergies">
              Alergias conocidas
            </label>

            <textarea
              id="childAllergies"
              name="allergies"
              className="form-control"
              value={formData.allergies}
              onChange={handleChange}
              rows="3"
              placeholder="Ejemplo: penicilina. Escribí Ninguna cuando corresponda."
            />
          </div>

          <div className="child-form__field child-form__field--wide">
            <label htmlFor="childMedicalHistory">
              Antecedentes médicos
            </label>

            <textarea
              id="childMedicalHistory"
              name="medicalHistory"
              className="form-control"
              value={formData.medicalHistory}
              onChange={handleChange}
              rows="4"
              placeholder="Enfermedades anteriores, cirugías u observaciones importantes."
            />
          </div>
        </div>
      </section>

      <section className="child-form__section">
        <div className="child-form__section-header">
          <i className="bi bi-shield-check" />

          <div>
            <h3>Cobertura médica</h3>
            <p>Obra social y pediatra habitual.</p>
          </div>
        </div>

        <div className="child-form__grid">
          <div className="child-form__field">
            <label htmlFor="childHealthInsurance">
              Obra social
            </label>

            <input
              type="text"
              id="childHealthInsurance"
              name="healthInsurance"
              className="form-control"
              value={formData.healthInsurance}
              onChange={handleChange}
              placeholder="Ejemplo: OSDE"
            />
          </div>

          <div className="child-form__field">
            <label htmlFor="childMemberNumber">
              Número de afiliado
            </label>

            <input
              type="text"
              id="childMemberNumber"
              name="memberNumber"
              className="form-control"
              value={formData.memberNumber}
              onChange={handleChange}
              placeholder="Número de afiliación"
            />
          </div>

          <div className="child-form__field">
            <label htmlFor="childPediatricianName">
              Pediatra habitual
            </label>

            <input
              type="text"
              id="childPediatricianName"
              name="pediatricianName"
              className="form-control"
              value={formData.pediatricianName}
              onChange={handleChange}
              placeholder="Nombre del profesional"
            />
          </div>

          <div className="child-form__field">
            <label htmlFor="childPediatricianPhone">
              Teléfono del pediatra
            </label>

            <input
              type="tel"
              id="childPediatricianPhone"
              name="pediatricianPhone"
              className="form-control"
              value={formData.pediatricianPhone}
              onChange={handleChange}
              placeholder="381..."
            />
          </div>
        </div>
      </section>

      <section className="child-form__section">
        <div className="child-form__section-header">
          <i className="bi bi-telephone" />

          <div>
            <h3>Contacto de emergencia</h3>
            <p>Persona a quien contactar en una urgencia.</p>
          </div>
        </div>

        <div className="child-form__grid">
          <div className="child-form__field">
            <label htmlFor="emergencyContactName">
              Nombre del contacto
            </label>

            <input
              type="text"
              id="emergencyContactName"
              name="emergencyContactName"
              className="form-control"
              value={formData.emergencyContactName}
              onChange={handleChange}
              placeholder="Nombre y apellido"
            />
          </div>

          <div className="child-form__field">
            <label htmlFor="emergencyContactPhone">
              Teléfono
            </label>

            <input
              type="tel"
              id="emergencyContactPhone"
              name="emergencyContactPhone"
              className="form-control"
              value={formData.emergencyContactPhone}
              onChange={handleChange}
              placeholder="381..."
            />
          </div>

          <div className="child-form__field child-form__field--wide">
            <label htmlFor="childNotes">
              Observaciones adicionales
            </label>

            <textarea
              id="childNotes"
              name="notes"
              className="form-control"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              placeholder="Información adicional que la familia necesite recordar."
            />
          </div>
        </div>
      </section>

      <footer className="child-form__actions">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onCancel}
        >
          Cancelar
        </button>

        <button type="submit" className="btn btn-primary">
          <i className="bi bi-check-lg" />
          {initialData ? 'Guardar cambios' : 'Crear perfil'}
        </button>
      </footer>
    </form>
  );
}

export default ChildForm;