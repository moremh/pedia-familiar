import {
  useEffect,
  useState,
} from 'react';

const emptyForm = {
  fullName: '',
  relationship: 'mother',
  phone: '',
  email: '',
  isPrimary: false,
  isActive: true,
  hasSystemAccess: false,
  notes: '',
};

function CaregiverForm({
  initialData = null,
  onSubmit,
  onCancel,
}) {
  const [formData, setFormData] =
    useState(emptyForm);

  const [error, setError] =
    useState('');

  const isOwnerAccount =
    initialData?.role === 'owner';

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...emptyForm,
        ...initialData,
        hasSystemAccess:
          initialData.role ===
            'owner' ||
          Boolean(
            initialData.hasSystemAccess,
          ),
      });
    } else {
      setFormData(
        emptyForm,
      );
    }

    setError('');
  }, [initialData]);

  function handleChange(event) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setFormData(
      (currentData) => ({
        ...currentData,

        [name]:
          type === 'checkbox'
            ? checked
            : value,
      }),
    );

    setError('');
  }

  function handleSubmit(event) {
    event.preventDefault();

    const fullName =
      formData.fullName.trim();

    const email =
      formData.email
        .trim()
        .toLowerCase();

    const phone =
      formData.phone.trim();

    const hasSystemAccess =
      isOwnerAccount ||
      formData.hasSystemAccess;

    if (!fullName) {
      setError(
        'Ingresá el nombre completo del responsable.',
      );

      return;
    }

    if (phone) {
      const normalizedPhone =
        phone.replace(
          /\D/g,
          '',
        );

      if (
        normalizedPhone.length <
        8
      ) {
        setError(
          'Ingresá un número de teléfono válido.',
        );

        return;
      }
    }

    if (email) {
      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailPattern.test(
          email,
        )
      ) {
        setError(
          'Ingresá un correo electrónico válido.',
        );

        return;
      }
    }

    if (
      hasSystemAccess &&
      !email
    ) {
      setError(
        'Para darle acceso al sistema necesitás ingresar su correo electrónico.',
      );

      return;
    }

    setError('');

    onSubmit({
      fullName,
      relationship:
        formData.relationship,
      phone,
      email,
      isPrimary:
        formData.isPrimary,
      isActive:
        formData.isActive,
      hasSystemAccess,
      notes:
        formData.notes.trim(),
    });
  }

  return (
    <form
      className="caregiver-form"
      onSubmit={handleSubmit}
      noValidate
    >
      {error && (
        <div
          className="caregiver-form__error"
          role="alert"
        >
          <i className="bi bi-exclamation-circle" />
          <span>{error}</span>
        </div>
      )}

      <div className="caregiver-form__notice">
        <i className="bi bi-people" />

        <p>
          Podés registrarlo solamente para el
          historial o darle una cuenta propia para
          que entre a la misma familia.
        </p>
      </div>

      <section className="caregiver-form__section">
        <header className="caregiver-form__section-header">
          <i className="bi bi-person-vcard" />

          <div>
            <h3>Datos personales</h3>

            <p>
              Información básica para identificar al
              responsable familiar.
            </p>
          </div>
        </header>

        <div className="caregiver-form__grid">
          <div className="caregiver-form__field caregiver-form__field--wide">
            <label htmlFor="caregiverFullName">
              Nombre completo
            </label>

            <input
              type="text"
              id="caregiverFullName"
              name="fullName"
              className="form-control"
              value={
                formData.fullName
              }
              onChange={
                handleChange
              }
              placeholder="Ejemplo: María García"
              required
            />
          </div>

          <div className="caregiver-form__field">
            <label htmlFor="caregiverRelationship">
              Relación con los hijos
            </label>

            <select
              id="caregiverRelationship"
              name="relationship"
              className="form-select"
              value={
                formData.relationship
              }
              onChange={
                handleChange
              }
            >
              <option value="mother">
                Madre
              </option>

              <option value="father">
                Padre
              </option>

              <option value="tutor">
                Tutor/a
              </option>

              <option value="grandparent">
                Abuelo/a
              </option>

              <option value="sibling">
                Hermano/a
              </option>

              <option value="babysitter">
                Cuidador/a
              </option>

              <option value="other">
                Otro responsable
              </option>
            </select>
          </div>

          <div className="caregiver-form__field">
            <label htmlFor="caregiverPhone">
              Teléfono
            </label>

            <input
              type="tel"
              id="caregiverPhone"
              name="phone"
              className="form-control"
              value={
                formData.phone
              }
              onChange={
                handleChange
              }
              placeholder="Ejemplo: 3815555555"
            />
          </div>

          <div className="caregiver-form__field caregiver-form__field--wide">
            <label htmlFor="caregiverEmail">
              Correo electrónico
            </label>

            <input
              type="email"
              id="caregiverEmail"
              name="email"
              className="form-control"
              value={
                formData.email
              }
              onChange={
                handleChange
              }
              placeholder="correo@ejemplo.com"
              required={
                formData.hasSystemAccess ||
                isOwnerAccount
              }
            />

            <small className="caregiver-form__help">
              Es obligatorio cuando el responsable
              tendrá una cuenta propia.
            </small>
          </div>
        </div>
      </section>

      <section className="caregiver-form__section">
        <header className="caregiver-form__section-header">
          <i className="bi bi-sliders" />

          <div>
            <h3>Configuración</h3>

            <p>
              Elegí cómo participará esta persona en
              la organización familiar.
            </p>
          </div>
        </header>

        <div className="caregiver-form__options">
          <label
            className={`caregiver-form__option ${
              formData.isPrimary
                ? 'is-selected'
                : ''
            }`}
          >
            <input
              type="checkbox"
              name="isPrimary"
              checked={
                formData.isPrimary
              }
              onChange={
                handleChange
              }
            />

            <i className="bi bi-star" />

            <span>
              <strong>
                Responsable principal
              </strong>

              <small>
                Aparecerá primero en el sistema.
              </small>
            </span>
          </label>

          <label
            className={`caregiver-form__option ${
              formData.isActive
                ? 'is-selected'
                : ''
            }`}
          >
            <input
              type="checkbox"
              name="isActive"
              checked={
                formData.isActive
              }
              onChange={
                handleChange
              }
            />

            <i className="bi bi-person-check" />

            <span>
              <strong>
                Responsable activo
              </strong>

              <small>
                Podrá seleccionarse al registrar una
                toma.
              </small>
            </span>
          </label>

          <label
            className={`caregiver-form__option ${
              formData.hasSystemAccess ||
              isOwnerAccount
                ? 'is-selected'
                : ''
            } ${
              isOwnerAccount
                ? 'is-disabled'
                : ''
            }`}
          >
            <input
              type="checkbox"
              name="hasSystemAccess"
              checked={
                formData.hasSystemAccess ||
                isOwnerAccount
              }
              onChange={
                handleChange
              }
              disabled={
                isOwnerAccount
              }
            />

            <i className="bi bi-person-lock" />

            <span>
              <strong>
                Acceso al sistema
              </strong>

              <small>
                Recibirá una invitación para entrar
                con su propia contraseña.
              </small>
            </span>
          </label>
        </div>

        {formData.hasSystemAccess &&
          !isOwnerAccount && (
            <div className="caregiver-form__access-message">
              <i className="bi bi-envelope-check" />

              <p>
                Al guardar se generará un enlace de
                invitación válido durante siete
                días.
              </p>
            </div>
          )}
      </section>

      <section className="caregiver-form__section">
        <header className="caregiver-form__section-header">
          <i className="bi bi-journal-text" />

          <div>
            <h3>Observaciones</h3>

            <p>
              Información adicional sobre el
              responsable.
            </p>
          </div>
        </header>

        <div className="caregiver-form__field">
          <label htmlFor="caregiverNotes">
            Observaciones
          </label>

          <textarea
            id="caregiverNotes"
            name="notes"
            className="form-control"
            value={
              formData.notes
            }
            onChange={
              handleChange
            }
            rows="3"
            placeholder="Ejemplo: responsable durante el turno de la mañana."
          />
        </div>
      </section>

      <footer className="caregiver-form__actions">
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
            : formData.hasSystemAccess
              ? 'Agregar e invitar'
              : 'Agregar responsable'}
        </button>
      </footer>
    </form>
  );
}

export default CaregiverForm;