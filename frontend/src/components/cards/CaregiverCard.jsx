import {
  getInitials,
} from '../../utils/childUtils.js';

import {
  formatCaregiverDateTime,
  getRelationshipIcon,
  getRelationshipLabel,
} from '../../utils/caregiverUtils.js';

const accessStatusInformation = {
  active: {
    label: 'Acceso habilitado',
    icon: 'bi-person-check-fill',
    className: 'active',
  },

  pending: {
    label: 'Invitación pendiente',
    icon: 'bi-envelope-clock',
    className: 'pending',
  },

  expired: {
    label: 'Invitación vencida',
    icon: 'bi-envelope-exclamation',
    className: 'expired',
  },
};

function CaregiverCard({
  caregiver,
  historyStats = {
    administered: 0,
    omitted: 0,
    total: 0,
    lastAction: null,
  },
  isSelected,
  onSelect,
  onView,
  onEdit,
  onDelete,
  onSetPrimary,
  onToggleStatus,
  onCopyInvitation,
  onRevokeAccess,
}) {
  const accessInformation =
    accessStatusInformation[
      caregiver.invitationStatus
    ] ?? null;

  const canDelete =
    caregiver.role !== 'owner';

  return (
    <article className="caregiver-card">
      <header className="caregiver-card__header">
        <div className="caregiver-card__identity">
          <span className="caregiver-card__avatar">
            {getInitials(
              caregiver.fullName,
            )}
          </span>

          <div>
            <h3>
              {caregiver.fullName}
            </h3>

            <p>
              <i
                className={`bi ${getRelationshipIcon(
                  caregiver.relationship,
                )}`}
              />

              {getRelationshipLabel(
                caregiver.relationship,
              )}
            </p>
          </div>
        </div>

        <div className="caregiver-card__menu">
          <button
            type="button"
            onClick={() =>
              onEdit(caregiver)
            }
            aria-label="Editar responsable"
          >
            <i className="bi bi-pencil" />
          </button>

          {canDelete && (
            <button
              type="button"
              className="caregiver-card__delete"
              onClick={() =>
                onDelete(caregiver)
              }
              aria-label="Eliminar responsable"
            >
              <i className="bi bi-trash3" />
            </button>
          )}
        </div>
      </header>

      <div className="caregiver-card__badges">
        {caregiver.isPrimary && (
          <span className="caregiver-card__badge caregiver-card__badge--primary">
            <i className="bi bi-star-fill" />
            Principal
          </span>
        )}

        <span
          className={`caregiver-card__badge ${
            caregiver.isActive
              ? 'caregiver-card__badge--active'
              : 'caregiver-card__badge--inactive'
          }`}
        >
          <i
            className={`bi ${
              caregiver.isActive
                ? 'bi-check-circle'
                : 'bi-pause-circle'
            }`}
          />

          {caregiver.isActive
            ? 'Activo'
            : 'Inactivo'}
        </span>

        {isSelected && (
          <span className="caregiver-card__badge caregiver-card__badge--selected">
            <i className="bi bi-person-check-fill" />
            En uso
          </span>
        )}

        {caregiver.role === 'owner' && (
          <span className="caregiver-card__badge caregiver-card__badge--owner">
            <i className="bi bi-shield-check" />
            Propietario
          </span>
        )}

        {accessInformation && (
          <span
            className={`caregiver-card__badge caregiver-card__badge--access-${accessInformation.className}`}
          >
            <i
              className={`bi ${accessInformation.icon}`}
            />

            {accessInformation.label}
          </span>
        )}


        {caregiver.hasSystemAccess &&
          caregiver.role !== 'owner' && (
            <span className="caregiver-card__badge caregiver-card__badge--selected">
              <i
                className={`bi ${
                  caregiver.accessLevel === 'medication_only'
                    ? 'bi-capsule-pill'
                    : 'bi-shield-check'
                }`}
              />

              {caregiver.accessLevel === 'medication_only'
                ? 'Solo tomas'
                : 'Acceso completo'}
            </span>
          )}

        {!caregiver.hasSystemAccess &&
          caregiver.role !== 'owner' && (
            <span className="caregiver-card__badge caregiver-card__badge--no-access">
              <i className="bi bi-person-dash" />
              Sin acceso
            </span>
          )}
      </div>

      <dl className="caregiver-card__contact">
        <div>
          <dt>Teléfono</dt>

          <dd>
            {caregiver.phone ||
              'No registrado'}
          </dd>
        </div>

        <div>
          <dt>Correo</dt>

          <dd>
            {caregiver.email ||
              'No registrado'}
          </dd>
        </div>
      </dl>

      <section className="caregiver-card__history">
        <div>
          <span>Administradas</span>

          <strong>
            {historyStats.administered}
          </strong>
        </div>

        <div>
          <span>Omitidas</span>

          <strong>
            {historyStats.omitted}
          </strong>
        </div>

        <div>
          <span>Total</span>

          <strong>
            {historyStats.total}
          </strong>
        </div>
      </section>

      <div className="caregiver-card__last-action">
        <i className="bi bi-clock-history" />

        <span>
          Última actividad:{' '}

          <strong>
            {formatCaregiverDateTime(
              historyStats.lastAction,
            )}
          </strong>
        </span>
      </div>

      <div className="caregiver-card__actions">
        {caregiver.isActive &&
          !isSelected && (
            <button
              type="button"
              onClick={() =>
                onSelect(caregiver)
              }
            >
              <i className="bi bi-person-check" />
              Usar en recordatorios
            </button>
          )}

        {!caregiver.isPrimary && (
          <button
            type="button"
            onClick={() =>
              onSetPrimary(
                caregiver,
              )
            }
          >
            <i className="bi bi-star" />
            Hacer principal
          </button>
        )}

        <button
          type="button"
          onClick={() =>
            onToggleStatus(
              caregiver,
            )
          }
          disabled={
            caregiver.role ===
              'owner' &&
            caregiver.isActive
          }
        >
          <i
            className={`bi ${
              caregiver.isActive
                ? 'bi-pause'
                : 'bi-play'
            }`}
          />

          {caregiver.isActive
            ? 'Desactivar'
            : 'Activar'}
        </button>

        {[
          'pending',
          'expired',
        ].includes(
          caregiver.invitationStatus,
        ) && (
          <button
            type="button"
            className="caregiver-card__invitation-button"
            onClick={() =>
              onCopyInvitation(
                caregiver,
              )
            }
          >
            <i className="bi bi-link-45deg" />

            {caregiver.invitationStatus ===
            'expired'
              ? 'Renovar invitación'
              : 'Copiar invitación'}
          </button>
        )}

        {caregiver.invitationStatus ===
          'active' &&
          caregiver.role !==
            'owner' && (
            <button
              type="button"
              className="caregiver-card__revoke-button"
              onClick={() =>
                onRevokeAccess(
                  caregiver,
                )
              }
            >
              <i className="bi bi-person-x" />
              Quitar acceso
            </button>
          )}
      </div>

      <button
        type="button"
        className="caregiver-card__view"
        onClick={() =>
          onView(caregiver)
        }
      >
        Ver historial completo
        <i className="bi bi-arrow-right" />
      </button>
    </article>
  );
}

export default CaregiverCard;