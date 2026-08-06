import { getInitials } from '../../utils/childUtils.js';

import {
  formatNextDose,
  formatShortTreatmentDate,
  getNextTreatmentDose,
  getTreatmentRouteLabel,
  getTreatmentScheduleDescription,
  getTreatmentStatus,
  getTreatmentStatusLabel,
} from '../../utils/treatmentUtils.js';

function TreatmentCard({
  treatment,
  child,
  onView,
  onEdit,
  onDelete,
  onTogglePause,
  onComplete,
}) {
  const childName =
    child?.fullName ?? 'Perfil no disponible';

  const status = getTreatmentStatus(treatment);
  const nextDose = getNextTreatmentDose(treatment);

  return (
    <article className="treatment-card">
      <header className="treatment-card__header">
        <div className="treatment-card__child">
          <span className="treatment-card__avatar">
            {getInitials(childName)}
          </span>

          <div>
            <h3>{childName}</h3>
            <p>{getTreatmentRouteLabel(
              treatment.administrationRoute,
            )}</p>
          </div>
        </div>

        <div className="treatment-card__menu">
          <button
            type="button"
            onClick={() => onEdit(treatment)}
            aria-label="Editar tratamiento"
          >
            <i className="bi bi-pencil" />
          </button>

          <button
            type="button"
            className="treatment-card__delete"
            onClick={() => onDelete(treatment)}
            aria-label="Eliminar tratamiento"
          >
            <i className="bi bi-trash3" />
          </button>
        </div>
      </header>

      <div className="treatment-card__title">
        <span className="treatment-card__medicine-icon">
          <i className="bi bi-capsule-pill" />
        </span>

        <div>
          <small>Medicamento</small>
          <h4>{treatment.medicationName}</h4>
          <p>
            {treatment.presentation ||
              'Presentación no registrada'}
          </p>
        </div>

        <span
          className={`treatment-status treatment-status--${status}`}
        >
          {getTreatmentStatusLabel(treatment)}
        </span>
      </div>

      <div className="treatment-card__instruction">
        <small>Indicación recetada</small>
        <p>{treatment.dosageInstruction}</p>
      </div>

      <dl className="treatment-card__dates">
        <div>
          <dt>Inicio</dt>
          <dd>
            {formatShortTreatmentDate(
              treatment.startDate,
            )}
          </dd>
        </div>

        <div>
          <dt>Finalización</dt>
          <dd>
            {formatShortTreatmentDate(
              treatment.endDate,
            )}
          </dd>
        </div>
      </dl>

      <div className="treatment-card__schedule">
        <i className="bi bi-clock-history" />

        <div>
          <small>Frecuencia</small>
          <strong>
            {getTreatmentScheduleDescription(treatment)}
          </strong>
        </div>
      </div>

      <div className="treatment-card__next-dose">
        <i className="bi bi-bell" />

        <span>
          <small>Próxima toma</small>
          <strong>{formatNextDose(nextDose)}</strong>
        </span>
      </div>

      <div className="treatment-card__secondary-actions">
        {status !== 'completed' && (
          <button
            type="button"
            onClick={() => onTogglePause(treatment)}
          >
            <i
              className={`bi ${
                status === 'paused'
                  ? 'bi-play-fill'
                  : 'bi-pause-fill'
              }`}
            />

            {status === 'paused'
              ? 'Reanudar'
              : 'Pausar'}
          </button>
        )}

        {status !== 'completed' && (
          <button
            type="button"
            onClick={() => onComplete(treatment)}
          >
            <i className="bi bi-check-circle" />
            Finalizar
          </button>
        )}
      </div>

      <button
        type="button"
        className="treatment-card__view"
        onClick={() => onView(treatment)}
      >
        Ver tratamiento completo
        <i className="bi bi-arrow-right" />
      </button>
    </article>
  );
}

export default TreatmentCard;