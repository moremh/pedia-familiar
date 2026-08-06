import { getInitials } from '../../utils/childUtils.js';

import {
  formatReminderTime,
  getReminderEffectiveDate,
  getReminderStatusLabel,
  getReminderTemporalState,
} from '../../utils/reminderUtils.js';

function ReminderCard({
  reminder,
  onAdminister,
  onOmit,
  onPostpone,
  onReset,
}) {
  const temporalState =
    getReminderTemporalState(reminder);

  const effectiveDate =
    getReminderEffectiveDate(reminder);

  const canModify = [
    'pending',
    'postponed',
    'overdue',
  ].includes(temporalState);

  return (
    <article
      className={`reminder-card reminder-card--${temporalState}`}
    >
      <div className="reminder-card__time">
        <strong>
          {formatReminderTime(effectiveDate)}
        </strong>

        {reminder.status === 'postponed' && (
          <span>
            Original: {reminder.originalTime}
          </span>
        )}
      </div>

      <div className="reminder-card__identity">
        <span className="reminder-card__avatar">
          {getInitials(reminder.childName)}
        </span>

        <div>
          <h4>{reminder.childName}</h4>
          <p>{reminder.medicationName}</p>
        </div>
      </div>

      <div className="reminder-card__instruction">
        <small>Indicación</small>
        <p>{reminder.dosageInstruction}</p>
      </div>

      <span
        className={`reminder-card__status reminder-card__status--${temporalState}`}
      >
        {temporalState === 'overdue'
          ? 'Atrasada'
          : getReminderStatusLabel(
              reminder.status,
            )}
      </span>

      {reminder.responsibleName && (
        <div className="reminder-card__responsible">
          <i className="bi bi-person-check" />

          <span>
            Registrada por{' '}
            <strong>
              {reminder.responsibleName}
            </strong>
          </span>
        </div>
      )}

      <div className="reminder-card__actions">
        {canModify ? (
          <>
            <button
              type="button"
              className="reminder-card__action reminder-card__action--administer"
              onClick={() =>
                onAdminister(reminder)
              }
            >
              <i className="bi bi-check-lg" />
              Administrada
            </button>

            <button
              type="button"
              className="reminder-card__action"
              onClick={() =>
                onPostpone(reminder)
              }
            >
              <i className="bi bi-clock-history" />
              Posponer
            </button>

            <button
              type="button"
              className="reminder-card__action reminder-card__action--omit"
              onClick={() => onOmit(reminder)}
            >
              <i className="bi bi-x-lg" />
              Omitir
            </button>
          </>
        ) : onReset ? (
          <button
            type="button"
            className="reminder-card__action reminder-card__action--reset"
            onClick={() => onReset(reminder)}
          >
            <i className="bi bi-arrow-counterclockwise" />
            Volver a pendiente
          </button>
        ) : null}
      </div>
    </article>
  );
}

export default ReminderCard;