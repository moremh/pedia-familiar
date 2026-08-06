import {
  formatChildAge,
  getInitials,
  hasRegisteredAllergies,
} from '../../utils/childUtils.js';

function ChildCard({
  child,
  onView,
  onEdit,
  onDelete,
}) {
  const hasAllergies = hasRegisteredAllergies(
    child.allergies,
  );

  return (
    <article className="children-card">
      <div className="children-card__top">
        <div className="children-card__avatar">
          {getInitials(child.fullName)}
        </div>

        <div className="children-card__identity">
          <h3>{child.fullName}</h3>
          <p>{formatChildAge(child.birthDate)}</p>
        </div>

        <div className="children-card__menu">
          <button
            type="button"
            onClick={() => onEdit(child)}
            aria-label={`Editar perfil de ${child.fullName}`}
          >
            <i className="bi bi-pencil" />
          </button>

          <button
            type="button"
            className="children-card__delete"
            onClick={() => onDelete(child)}
            aria-label={`Eliminar perfil de ${child.fullName}`}
          >
            <i className="bi bi-trash3" />
          </button>
        </div>
      </div>

      {hasAllergies ? (
        <div className="children-card__alert">
          <i className="bi bi-exclamation-triangle-fill" />

          <span>
            <strong>Alergia registrada</strong>
            {child.allergies}
          </span>
        </div>
      ) : (
        <div className="children-card__safe">
          <i className="bi bi-shield-check" />
          Sin alergias registradas
        </div>
      )}

      <dl className="children-card__information">
        <div>
          <dt>Grupo sanguíneo</dt>
          <dd>{child.bloodType || 'No registrado'}</dd>
        </div>

        <div>
          <dt>Peso actual</dt>
          <dd>
            {child.weight !== ''
              ? `${child.weight} kg`
              : 'No registrado'}
          </dd>
        </div>

        <div>
          <dt>Altura</dt>
          <dd>
            {child.height !== ''
              ? `${child.height} cm`
              : 'No registrada'}
          </dd>
        </div>

        <div>
          <dt>Obra social</dt>
          <dd>{child.healthInsurance || 'No registrada'}</dd>
        </div>
      </dl>

      <div className="children-card__doctor">
        <span>
          <i className="bi bi-person-badge" />
        </span>

        <div>
          <small>Pediatra habitual</small>
          <strong>
            {child.pediatricianName || 'No registrado'}
          </strong>
        </div>
      </div>

      <button
        type="button"
        className="children-card__view"
        onClick={() => onView(child)}
      >
        Ver perfil completo
        <i className="bi bi-arrow-right" />
      </button>
    </article>
  );
}

export default ChildCard;