import { getInitials } from '../../utils/childUtils.js';

import {
  formatFileSize,
} from '../../utils/documentUtils.js';

import {
  formatShortVaccineDate,
  getNextDoseDescription,
  getVaccineState,
  getVaccineStateLabel,
} from '../../utils/vaccineUtils.js';

function VaccineCard({
  vaccine,
  child,
  onView,
  onEdit,
  onDelete,
}) {
  const childName =
    child?.fullName ?? 'Perfil no disponible';

  const vaccineState =
    getVaccineState(vaccine);

  return (
    <article className="vaccine-card">
      <header className="vaccine-card__header">
        <div className="vaccine-card__child">
          <span className="vaccine-card__avatar">
            {getInitials(childName)}
          </span>

          <div>
            <h3>{childName}</h3>

            <p>
              Aplicada el{' '}
              {formatShortVaccineDate(
                vaccine.applicationDate,
              )}
            </p>
          </div>
        </div>

        <div className="vaccine-card__menu">
          <button
            type="button"
            onClick={() => onEdit(vaccine)}
            aria-label="Editar vacuna"
          >
            <i className="bi bi-pencil" />
          </button>

          <button
            type="button"
            className="vaccine-card__delete"
            onClick={() => onDelete(vaccine)}
            aria-label="Eliminar vacuna"
          >
            <i className="bi bi-trash3" />
          </button>
        </div>
      </header>

      <section className="vaccine-card__main">
        <span className="vaccine-card__icon">
          <i className="bi bi-shield-plus" />
        </span>

        <div>
          <small>Vacuna</small>
          <h4>{vaccine.vaccineName}</h4>
          <p>{vaccine.doseLabel}</p>
        </div>
      </section>

      <div
        className={`vaccine-card__state vaccine-card__state--${vaccineState}`}
      >
        <i
          className={`bi ${
            vaccineState === 'overdue'
              ? 'bi-exclamation-triangle'
              : vaccineState === 'today'
                ? 'bi-bell'
                : vaccineState === 'upcoming'
                  ? 'bi-calendar2-check'
                  : 'bi-check-circle'
          }`}
        />

        <div>
          <strong>
            {getVaccineStateLabel(vaccine)}
          </strong>

          <span>
            {getNextDoseDescription(vaccine)}
          </span>
        </div>
      </div>

      <dl className="vaccine-card__information">
        <div>
          <dt>Próxima dosis</dt>

          <dd>
            {vaccine.nextDoseDate
              ? formatShortVaccineDate(
                  vaccine.nextDoseDate,
                )
              : 'No registrada'}
          </dd>
        </div>

        <div>
          <dt>Lote</dt>

          <dd>
            {vaccine.lotNumber ||
              'No registrado'}
          </dd>
        </div>

        <div>
          <dt>Centro</dt>

          <dd>
            {vaccine.vaccinationCenter ||
              'No registrado'}
          </dd>
        </div>

        <div>
          <dt>Profesional</dt>

          <dd>
            {vaccine.professionalName ||
              'No registrado'}
          </dd>
        </div>
      </dl>

      {vaccine.proofFile ? (
        <div className="vaccine-card__file">
          <i
            className={`bi ${
              vaccine.proofFile.type ===
              'application/pdf'
                ? 'bi-file-earmark-pdf'
                : 'bi-file-earmark-image'
            }`}
          />

          <span>
            <strong>
              {vaccine.proofFile.name}
            </strong>

            <small>
              {formatFileSize(
                vaccine.proofFile.size,
              )}
            </small>
          </span>
        </div>
      ) : (
        <div className="vaccine-card__no-file">
          <i className="bi bi-paperclip" />
          Sin comprobante adjunto
        </div>
      )}

      <button
        type="button"
        className="vaccine-card__view"
        onClick={() => onView(vaccine)}
      >
        Ver registro completo
        <i className="bi bi-arrow-right" />
      </button>
    </article>
  );
}

export default VaccineCard;