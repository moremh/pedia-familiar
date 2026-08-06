import {
  formatHistoryDateTime,
  getHistoryStatusIcon,
  getHistoryStatusLabel,
} from '../../utils/medicationHistoryUtils.js';

function MedicationHistoryCard({
  historyItem,
}) {
  return (
    <article
      className={`medication-history-card medication-history-card--${historyItem.status}`}
    >
      <header className="medication-history-card__header">
        <span
          className={`medication-history-card__status-icon medication-history-card__status-icon--${historyItem.status}`}
        >
          <i
            className={`bi ${getHistoryStatusIcon(
              historyItem.status,
            )}`}
          />
        </span>

        <div className="medication-history-card__title">
          <span>
            {getHistoryStatusLabel(
              historyItem.status,
            )}
          </span>

          <h3>
            {historyItem.medicationName}
          </h3>

          <p>{historyItem.childName}</p>
        </div>

        <span
          className={`medication-history-card__badge medication-history-card__badge--${historyItem.status}`}
        >
          {getHistoryStatusLabel(
            historyItem.status,
          )}
        </span>
      </header>

      <section className="medication-history-card__medicine">
        <div>
          <span>Presentación</span>

          <strong>
            {historyItem.presentation ||
              'No registrada'}
          </strong>
        </div>

        <div>
          <span>Indicación</span>

          <strong>
            {historyItem.dosageInstruction ||
              'No registrada'}
          </strong>
        </div>
      </section>

      <section className="medication-history-card__dates">
        <div>
          <i className="bi bi-alarm" />

          <span>
            <small>Horario programado</small>

            <strong>
              {formatHistoryDateTime(
                historyItem.scheduledAt,
              )}
            </strong>
          </span>
        </div>

        <div>
          <i className="bi bi-clock-history" />

          <span>
            <small>Acción registrada</small>

            <strong>
              {formatHistoryDateTime(
                historyItem.actionAt,
              )}
            </strong>
          </span>
        </div>
      </section>

      <section className="medication-history-card__responsible">
        <span>
          <i className="bi bi-person-check" />
        </span>

        <div>
          <small>Responsable</small>

          <strong>
            {historyItem.responsibleName}
          </strong>
        </div>
      </section>

      {historyItem.notes && (
        <section className="medication-history-card__notes">
          <i className="bi bi-journal-text" />

          <p>{historyItem.notes}</p>
        </section>
      )}
    </article>
  );
}

export default MedicationHistoryCard;