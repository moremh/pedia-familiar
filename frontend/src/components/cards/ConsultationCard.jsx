import {
  formatConsultationTime,
  formatShortConsultationDate,
  getConsultationTypeLabel,
} from '../../utils/consultationUtils.js';

import { getInitials } from '../../utils/childUtils.js';

function ConsultationCard({
  consultation,
  child,
  onView,
  onEdit,
  onDelete,
}) {
  const childName =
    child?.fullName ?? 'Perfil no disponible';

  return (
    <article className="consultation-card">
      <header className="consultation-card__header">
        <div className="consultation-card__child">
          <span className="consultation-card__avatar">
            {getInitials(childName)}
          </span>

          <div>
            <h3>{childName}</h3>
            <p>
              {getConsultationTypeLabel(
                consultation.consultationType,
              )}
            </p>
          </div>
        </div>

        <div className="consultation-card__actions">
          <button
            type="button"
            onClick={() => onEdit(consultation)}
            aria-label="Editar consulta"
          >
            <i className="bi bi-pencil" />
          </button>

          <button
            type="button"
            className="consultation-card__delete"
            onClick={() => onDelete(consultation)}
            aria-label="Eliminar consulta"
          >
            <i className="bi bi-trash3" />
          </button>
        </div>
      </header>

      <div className="consultation-card__date">
        <span>
          <i className="bi bi-calendar3" />
          {formatShortConsultationDate(
            consultation.consultationDate,
          )}
        </span>

        <span>
          <i className="bi bi-clock" />
          {formatConsultationTime(
            consultation.consultationTime,
          )}
        </span>
      </div>

      <section className="consultation-card__main">
        <small>Motivo de consulta</small>
        <h4>{consultation.reason}</h4>

        <div className="consultation-card__diagnosis">
          <span>
            <i className="bi bi-clipboard2-pulse" />
          </span>

          <div>
            <small>Diagnóstico informado</small>

            <p>
              {consultation.diagnosis ||
                'Sin diagnóstico registrado'}
            </p>
          </div>
        </div>
      </section>

      <dl className="consultation-card__information">
        <div>
          <dt>Profesional</dt>
          <dd>
            {consultation.professionalName ||
              'No registrado'}
          </dd>
        </div>

        <div>
          <dt>Centro médico</dt>
          <dd>
            {consultation.medicalCenter ||
              'No registrado'}
          </dd>
        </div>
      </dl>

      {consultation.followUpDate && (
        <div className="consultation-card__follow-up">
          <i className="bi bi-calendar2-check" />

          <span>
            Próximo control:{' '}
            <strong>
              {formatShortConsultationDate(
                consultation.followUpDate,
              )}
            </strong>
          </span>
        </div>
      )}

      <button
        type="button"
        className="consultation-card__view"
        onClick={() => onView(consultation)}
      >
        Ver consulta completa
        <i className="bi bi-arrow-right" />
      </button>
    </article>
  );
}

export default ConsultationCard;