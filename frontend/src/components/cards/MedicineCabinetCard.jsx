import { getInitials } from '../../utils/childUtils.js';

import {
  formatShortCabinetDate,
  getExpirationDescription,
  getMedicineCabinetState,
  getMedicineCabinetStateLabel,
  getStockPercentage,
  getStockUnitLabel,
} from '../../utils/medicineCabinetUtils.js';

function MedicineCabinetCard({
  item,
  child,
  treatment,
  onView,
  onEdit,
  onDelete,
}) {
  const childName =
    child?.fullName ?? 'Perfil no disponible';

  const state =
    getMedicineCabinetState(item);

  const stockPercentage =
    getStockPercentage(item);

  return (
    <article className="medicine-cabinet-card">
      <header className="medicine-cabinet-card__header">
        <div className="medicine-cabinet-card__child">
          <span className="medicine-cabinet-card__avatar">
            {getInitials(childName)}
          </span>

          <div>
            <h3>{childName}</h3>

            <p>
              {treatment
                ? 'Vinculado a tratamiento'
                : 'Sin tratamiento vinculado'}
            </p>
          </div>
        </div>

        <div className="medicine-cabinet-card__menu">
          <button
            type="button"
            onClick={() => onEdit(item)}
            aria-label="Editar medicamento"
          >
            <i className="bi bi-pencil" />
          </button>

          <button
            type="button"
            className="medicine-cabinet-card__delete"
            onClick={() => onDelete(item)}
            aria-label="Eliminar medicamento"
          >
            <i className="bi bi-trash3" />
          </button>
        </div>
      </header>

      <section className="medicine-cabinet-card__main">
        <span className="medicine-cabinet-card__icon">
          <i className="bi bi-capsule-pill" />
        </span>

        <div>
          <small>Medicamento</small>

          <h4>{item.medicineName}</h4>

          <p>
            {item.presentation ||
              'Presentación no registrada'}
          </p>
        </div>

        <span
          className={`medicine-cabinet-card__state medicine-cabinet-card__state--${state}`}
        >
          {getMedicineCabinetStateLabel(item)}
        </span>
      </section>

      <section className="medicine-cabinet-card__stock">
        <div>
          <span>Stock disponible</span>

          <strong>
            {item.currentStock}{' '}
            {getStockUnitLabel(item.stockUnit)}
          </strong>
        </div>

        <div className="medicine-cabinet-card__progress">
          <span
            style={{
              width: `${stockPercentage}%`,
            }}
          />
        </div>

        <small>
          Se descuentan {item.consumptionPerDose}{' '}
          {getStockUnitLabel(item.stockUnit)} por
          toma.
        </small>
      </section>

      <div
        className={`medicine-cabinet-card__expiration medicine-cabinet-card__expiration--${state}`}
      >
        <i className="bi bi-calendar-event" />

        <div>
          <strong>
            {item.expirationDate
              ? formatShortCabinetDate(
                  item.expirationDate,
                )
              : 'Sin vencimiento registrado'}
          </strong>

          <span>
            {getExpirationDescription(item)}
          </span>
        </div>
      </div>

      <dl className="medicine-cabinet-card__information">
        <div>
          <dt>Tratamiento</dt>

          <dd>
            {treatment?.medicationName ||
              'Sin vincular'}
          </dd>
        </div>

        <div>
          <dt>Lote</dt>

          <dd>
            {item.lotNumber ||
              'No registrado'}
          </dd>
        </div>

        <div>
          <dt>Ubicación</dt>

          <dd>
            {item.storageLocation ||
              'No registrada'}
          </dd>
        </div>

        <div>
          <dt>Stock mínimo</dt>

          <dd>
            {item.minimumStock}{' '}
            {getStockUnitLabel(item.stockUnit)}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        className="medicine-cabinet-card__view"
        onClick={() => onView(item)}
      >
        Ver información completa
        <i className="bi bi-arrow-right" />
      </button>
    </article>
  );
}

export default MedicineCabinetCard;