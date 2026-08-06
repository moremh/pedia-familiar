import { Link } from 'react-router-dom';

import {
  formatAlertDateTime,
  getAlertPriorityLabel,
  getAlertTypeLabel,
} from '../../utils/alertUtils.js';

function FamilyAlertCard({ alert }) {
  return (
    <article
      className={`family-alert-card family-alert-card--${alert.priority}`}
    >
      <span className="family-alert-card__priority-line" />

      <header className="family-alert-card__header">
        <span
          className={`family-alert-card__icon family-alert-card__icon--${alert.type}`}
        >
          <i className={`bi ${alert.icon}`} />
        </span>

        <div className="family-alert-card__heading">
          <div className="family-alert-card__labels">
            <span>
              {getAlertTypeLabel(alert.type)}
            </span>

            <strong>
              {getAlertPriorityLabel(
                alert.priority,
              )}
            </strong>
          </div>

          <h3>{alert.title}</h3>

          <p>{alert.description}</p>
        </div>
      </header>

      <section className="family-alert-card__information">
        <div>
          <i className="bi bi-person-heart" />

          <span>
            <small>Hijo</small>

            <strong>
              {alert.childName ||
                'Sin perfil relacionado'}
            </strong>
          </span>
        </div>

        <div>
          <i className="bi bi-clock" />

          <span>
            <small>Fecha</small>

            <strong>
              {alert.date
                ? formatAlertDateTime(
                    alert.date,
                  )
                : alert.dateLabel}
            </strong>
          </span>
        </div>
      </section>

      <div className="family-alert-card__status">
        <i
          className={`bi ${
            alert.priority === 'urgent'
              ? 'bi-exclamation-triangle'
              : alert.priority === 'high'
                ? 'bi-bell'
                : 'bi-info-circle'
          }`}
        />

        <span>{alert.statusLabel}</span>
      </div>

      <footer className="family-alert-card__footer">
        <span>{alert.dateLabel}</span>

        <Link to={alert.path}>
          {alert.actionLabel}
          <i className="bi bi-arrow-right" />
        </Link>
      </footer>
    </article>
  );
}

export default FamilyAlertCard;