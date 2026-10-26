import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  createStoredFile,
  formatFileSize,
  validateMedicalFile,
} from '../../utils/documentUtils.js';

const emptyForm = {
  childId: '',
  consultationId: '',
  treatmentId: '',
  documentType: 'prescription',
  title: '',
  documentDate: '',
  professionalName: '',
  medicalCenter: '',
  notes: '',
};

function MedicalDocumentForm({
  children,
  consultations,
  treatments,
  initialData = null,
  onSubmit,
  onCancel,
}) {
  const fileInputRef = useRef(null);

  const [formData, setFormData] =
    useState(emptyForm);

  const [selectedFile, setSelectedFile] =
    useState(null);

  const [existingFile, setExistingFile] =
    useState(null);

  const [error, setError] = useState('');
  const [fileError, setFileError] =
    useState('');

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...emptyForm,
        ...initialData,
      });

      setExistingFile(initialData.file ?? null);
    } else {
      setFormData({
        ...emptyForm,
        childId:
          children.length === 1
            ? children[0].id
            : '',
      });

      setExistingFile(null);
    }

    setSelectedFile(null);
    setError('');
    setFileError('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [initialData, children]);

  const availableConsultations = useMemo(
    () =>
      consultations.filter(
        (consultation) =>
          consultation.childId ===
          formData.childId,
      ),
    [consultations, formData.childId],
  );

  const availableTreatments = useMemo(
    () =>
      treatments.filter(
        (treatment) =>
          treatment.childId ===
          formData.childId,
      ),
    [treatments, formData.childId],
  );

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => {
      const updatedData = {
        ...currentData,
        [name]: value,
      };

      if (name === 'childId') {
        updatedData.consultationId = '';
        updatedData.treatmentId = '';
      }

      return updatedData;
    });
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];

    setFileError('');

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validationMessage =
      validateMedicalFile(file);

    if (validationMessage) {
      setSelectedFile(null);
      setFileError(validationMessage);

      event.target.value = '';
      return;
    }

    setSelectedFile(file);
  }

  function removeFile() {
    setSelectedFile(null);
    setExistingFile(null);
    setFileError('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!formData.childId) {
      setError(
        'Seleccioná el hijo al que pertenece el documento.',
      );
      return;
    }

    if (!formData.title.trim()) {
      setError(
        'Ingresá un título para identificar el documento.',
      );
      return;
    }

    if (!formData.documentDate) {
      setError(
        'Ingresá la fecha del documento.',
      );
      return;
    }

    const documentDate = new Date(
      `${formData.documentDate}T00:00:00`,
    );

    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (documentDate > today) {
      setError(
        'La fecha del documento no puede ser posterior a hoy.',
      );
      return;
    }

    if (fileError) {
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      let storedFile = existingFile;

      if (selectedFile) {
        storedFile =
          await createStoredFile(selectedFile);
      }

      await onSubmit({
        childId: formData.childId,
        consultationId:
          formData.consultationId,
        treatmentId: formData.treatmentId,
        documentType:
          formData.documentType,
        title: formData.title.trim(),
        documentDate:
          formData.documentDate,
        professionalName:
          formData.professionalName.trim(),
        medicalCenter:
          formData.medicalCenter.trim(),
        notes: formData.notes.trim(),
        file: storedFile,
      });
    } catch (submitError) {
      setError(
        submitError.message ||
          'No se pudo guardar el documento.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const displayedFile =
    selectedFile ?? existingFile;

  return (
    <form
      className="medical-document-form"
      onSubmit={handleSubmit}
      noValidate
    >
      {error && (
        <div
          className="medical-document-form__error"
          role="alert"
        >
          <i className="bi bi-exclamation-circle" />
          <span>{error}</span>
        </div>
      )}

      <div className="medical-document-form__notice">
        <i className="bi bi-info-circle" />

        <p>
          Los archivos se guardan de forma privada
          en MiPeque y solo pueden acceder los
          responsables autorizados. Utilizá PDF o
          imágenes de hasta 2 MB.
        </p>
      </div>

      <section className="medical-document-form__section">
        <header className="medical-document-form__section-header">
          <i className="bi bi-person-hearts" />

          <div>
            <h3>Paciente y relaciones</h3>
            <p>
              Asociá el documento con un hijo y,
              opcionalmente, con su atención médica.
            </p>
          </div>
        </header>

        <div className="medical-document-form__grid">
          <div className="medical-document-form__field medical-document-form__field--wide">
            <label htmlFor="documentChild">
              Hijo
            </label>

            <select
              id="documentChild"
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

          <div className="medical-document-form__field">
            <label htmlFor="documentConsultation">
              Consulta relacionada
            </label>

            <select
              id="documentConsultation"
              name="consultationId"
              className="form-select"
              value={formData.consultationId}
              onChange={handleChange}
              disabled={!formData.childId}
            >
              <option value="">
                Sin consulta relacionada
              </option>

              {availableConsultations.map(
                (consultation) => (
                  <option
                    key={consultation.id}
                    value={consultation.id}
                  >
                    {consultation.consultationDate} —{' '}
                    {consultation.reason}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="medical-document-form__field">
            <label htmlFor="documentTreatment">
              Tratamiento relacionado
            </label>

            <select
              id="documentTreatment"
              name="treatmentId"
              className="form-select"
              value={formData.treatmentId}
              onChange={handleChange}
              disabled={!formData.childId}
            >
              <option value="">
                Sin tratamiento relacionado
              </option>

              {availableTreatments.map(
                (treatment) => (
                  <option
                    key={treatment.id}
                    value={treatment.id}
                  >
                    {treatment.medicationName} —{' '}
                    {treatment.startDate}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>
      </section>

      <section className="medical-document-form__section">
        <header className="medical-document-form__section-header">
          <i className="bi bi-file-earmark-medical" />

          <div>
            <h3>Información del documento</h3>
            <p>
              Indicá qué tipo de archivo es y cuándo
              fue emitido.
            </p>
          </div>
        </header>

        <div className="medical-document-form__grid">
          <div className="medical-document-form__field">
            <label htmlFor="documentType">
              Tipo de documento
            </label>

            <select
              id="documentType"
              name="documentType"
              className="form-select"
              value={formData.documentType}
              onChange={handleChange}
            >
              <option value="prescription">
                Receta médica
              </option>

              <option value="study">
                Estudio médico
              </option>

              <option value="laboratory">
                Análisis de laboratorio
              </option>

              <option value="certificate">
                Certificado
              </option>

              <option value="indication">
                Indicación médica
              </option>

              <option value="vaccination">
                Certificado de vacunación
              </option>

              <option value="other">
                Otro documento
              </option>
            </select>
          </div>

          <div className="medical-document-form__field">
            <label htmlFor="documentDate">
              Fecha del documento
            </label>

            <input
              type="date"
              id="documentDate"
              name="documentDate"
              className="form-control"
              value={formData.documentDate}
              onChange={handleChange}
              max={
                new Date()
                  .toISOString()
                  .split('T')[0]
              }
            />
          </div>

          <div className="medical-document-form__field medical-document-form__field--wide">
            <label htmlFor="documentTitle">
              Título
            </label>

            <input
              type="text"
              id="documentTitle"
              name="title"
              className="form-control"
              value={formData.title}
              onChange={handleChange}
              placeholder="Ejemplo: receta por infección respiratoria"
            />
          </div>

          <div className="medical-document-form__field">
            <label htmlFor="documentProfessional">
              Profesional
            </label>

            <input
              type="text"
              id="documentProfessional"
              name="professionalName"
              className="form-control"
              value={formData.professionalName}
              onChange={handleChange}
              placeholder="Nombre del profesional"
            />
          </div>

          <div className="medical-document-form__field">
            <label htmlFor="documentMedicalCenter">
              Centro médico
            </label>

            <input
              type="text"
              id="documentMedicalCenter"
              name="medicalCenter"
              className="form-control"
              value={formData.medicalCenter}
              onChange={handleChange}
              placeholder="Hospital, clínica o consultorio"
            />
          </div>

          <div className="medical-document-form__field medical-document-form__field--wide">
            <label htmlFor="documentNotes">
              Observaciones
            </label>

            <textarea
              id="documentNotes"
              name="notes"
              className="form-control"
              value={formData.notes}
              onChange={handleChange}
              rows="3"
              placeholder="Información que la familia necesite recordar."
            />
          </div>
        </div>
      </section>

      <section className="medical-document-form__section">
        <header className="medical-document-form__section-header">
          <i className="bi bi-paperclip" />

          <div>
            <h3>Archivo adjunto</h3>
            <p>
              Podés adjuntar un PDF o una imagen.
            </p>
          </div>
        </header>

        <div className="medical-document-form__upload">
          <input
            ref={fileInputRef}
            type="file"
            id="medicalDocumentFile"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={handleFileChange}
          />

          <label htmlFor="medicalDocumentFile">
            <i className="bi bi-cloud-arrow-up" />

            <span>
              <strong>
                Seleccionar archivo
              </strong>

              <small>
                PDF, JPG, PNG o WEBP · máximo 2 MB
              </small>
            </span>
          </label>
        </div>

        {fileError && (
          <div className="medical-document-form__file-error">
            <i className="bi bi-exclamation-triangle" />
            {fileError}
          </div>
        )}

        {displayedFile && (
          <div className="medical-document-form__selected-file">
            <span>
              <i
                className={`bi ${
                  displayedFile.type ===
                  'application/pdf'
                    ? 'bi-file-earmark-pdf'
                    : 'bi-file-earmark-image'
                }`}
              />
            </span>

            <div>
              <strong>
                {displayedFile.name}
              </strong>

              <small>
                {formatFileSize(
                  displayedFile.size,
                )}
              </small>
            </div>

            <button
              type="button"
              onClick={removeFile}
              aria-label="Eliminar archivo"
            >
              <i className="bi bi-trash3" />
            </button>
          </div>
        )}
      </section>

      <footer className="medical-document-form__actions">
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
              : 'Guardar documento'}
        </button>
      </footer>
    </form>
  );
}

export default MedicalDocumentForm;