import { getInitials } from '../../utils/childUtils.js';

import {
  formatFileSize,
  formatShortDocumentDate,
  getDocumentTypeIcon,
  getDocumentTypeLabel,
} from '../../utils/documentUtils.js';

function MedicalDocumentCard({
  document,
  child,
  consultation,
  treatment,
  onView,
  onEdit,
  onDelete,
}) {
  const childName =
    child?.fullName ?? 'Perfil no disponible';

  return (
    <article className="medical-document-card">
      <header className="medical-document-card__header">
        <div className="medical-document-card__child">
          <span className="medical-document-card__avatar">
            {getInitials(childName)}
          </span>

          <div>
            <h3>{childName}</h3>

            <p>
              {formatShortDocumentDate(
                document.documentDate,
              )}
            </p>
          </div>
        </div>

        <div className="medical-document-card__menu">
          <button
            type="button"
            onClick={() => onEdit(document)}
            aria-label="Editar documento"
          >
            <i className="bi bi-pencil" />
          </button>

          <button
            type="button"
            className="medical-document-card__delete"
            onClick={() => onDelete(document)}
            aria-label="Eliminar documento"
          >
            <i className="bi bi-trash3" />
          </button>
        </div>
      </header>

      <section className="medical-document-card__main">
        <span className="medical-document-card__type-icon">
          <i
            className={`bi ${getDocumentTypeIcon(
              document.documentType,
            )}`}
          />
        </span>

        <div>
          <small>
            {getDocumentTypeLabel(
              document.documentType,
            )}
          </small>

          <h4>{document.title}</h4>

          <p>
            {document.professionalName ||
              'Profesional no registrado'}
          </p>
        </div>
      </section>

      <dl className="medical-document-card__relations">
        <div>
          <dt>Consulta</dt>

          <dd>
            {consultation?.reason ||
              'Sin relación'}
          </dd>
        </div>

        <div>
          <dt>Tratamiento</dt>

          <dd>
            {treatment?.medicationName ||
              'Sin relación'}
          </dd>
        </div>
      </dl>

      {document.file ? (
        <div className="medical-document-card__file">
          <i
            className={`bi ${
              document.file.type ===
              'application/pdf'
                ? 'bi-file-earmark-pdf'
                : 'bi-file-earmark-image'
            }`}
          />

          <span>
            <strong>
              {document.file.name}
            </strong>

            <small>
              {formatFileSize(
                document.file.size,
              )}
            </small>
          </span>
        </div>
      ) : (
        <div className="medical-document-card__no-file">
          <i className="bi bi-paperclip" />
          Sin archivo adjunto
        </div>
      )}

      <button
        type="button"
        className="medical-document-card__view"
        onClick={() => onView(document)}
      >
        Ver documento completo
        <i className="bi bi-arrow-right" />
      </button>
    </article>
  );
}

export default MedicalDocumentCard;