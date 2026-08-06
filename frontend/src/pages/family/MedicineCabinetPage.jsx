import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import MedicineCabinetCard from '../../components/cards/MedicineCabinetCard.jsx';
import MedicineCabinetForm from '../../components/forms/MedicineCabinetForm.jsx';

import { getChildren } from '../../services/childrenService.js';
import { getTreatments } from '../../services/treatmentsService.js';

import {
  createMedicineCabinetItem,
  deleteMedicineCabinetItem,
  getMedicineCabinetItems,
  updateMedicineCabinetItem,
} from '../../services/medicineCabinetService.js';

import {
  formatCabinetDate,
  getExpirationDescription,
  getMedicineCabinetState,
  getMedicineCabinetStateLabel,
  getStockUnitLabel,
  isMedicineExpired,
  isMedicineExpiringSoon,
  isMedicineLowStock,
  isMedicineOutOfStock,
} from '../../utils/medicineCabinetUtils.js';

import '../../styles/medicine-cabinet.css';

function MedicineCabinetPage() {
  const [children] = useState(() =>
    getChildren(),
  );

  const [treatments] = useState(() =>
    getTreatments(),
  );

  const [items, setItems] = useState(() =>
    getMedicineCabinetItems(),
  );

  const [searchTerm, setSearchTerm] =
    useState('');

  const [childFilter, setChildFilter] =
    useState('all');

  const [stateFilter, setStateFilter] =
    useState('all');

  const [isFormOpen, setIsFormOpen] =
    useState(false);

  const [editingItem, setEditingItem] =
    useState(null);

  const [selectedItem, setSelectedItem] =
    useState(null);

  const childrenMap = useMemo(
    () =>
      Object.fromEntries(
        children.map((child) => [
          child.id,
          child,
        ]),
      ),
    [children],
  );

  const treatmentsMap = useMemo(
    () =>
      Object.fromEntries(
        treatments.map((treatment) => [
          treatment.id,
          treatment,
        ]),
      ),
    [treatments],
  );

  const filteredItems = useMemo(() => {
    const normalizedSearch = searchTerm
      .trim()
      .toLowerCase();

    return items.filter((item) => {
      const child =
        childrenMap[item.childId];

      const treatment =
        treatmentsMap[item.treatmentId];

      const state =
        getMedicineCabinetState(item);

      const matchesChild =
        childFilter === 'all' ||
        item.childId === childFilter;

      const matchesState =
        stateFilter === 'all' ||
        state === stateFilter;

      const searchableValues = [
        child?.fullName,
        item.medicineName,
        item.presentation,
        item.lotNumber,
        item.storageLocation,
        item.notes,
        treatment?.medicationName,
      ];

      const matchesSearch =
        !normalizedSearch ||
        searchableValues.some((value) =>
          String(value ?? '')
            .toLowerCase()
            .includes(normalizedSearch),
        );

      return (
        matchesChild &&
        matchesState &&
        matchesSearch
      );
    });
  }, [
    items,
    childrenMap,
    treatmentsMap,
    childFilter,
    stateFilter,
    searchTerm,
  ]);

  const lowStockCount = items.filter(
    (item) =>
      isMedicineLowStock(item) ||
      isMedicineOutOfStock(item),
  ).length;

  const expiringCount = items.filter(
    (item) =>
      isMedicineExpiringSoon(item) ||
      isMedicineExpired(item),
  ).length;

  const linkedCount = items.filter(
    (item) => item.treatmentId,
  ).length;

  function refreshItems() {
    setItems(getMedicineCabinetItems());
  }

  function openCreateForm() {
    if (children.length === 0) {
      return;
    }

    setEditingItem(null);
    setSelectedItem(null);
    setIsFormOpen(true);
  }

  function openEditForm(item) {
    setSelectedItem(null);
    setEditingItem(item);
    setIsFormOpen(true);
  }

  function closeForm() {
    setEditingItem(null);
    setIsFormOpen(false);
  }

  function handleSaveItem(data) {
    if (editingItem) {
      updateMedicineCabinetItem(
        editingItem.id,
        data,
      );
    } else {
      createMedicineCabinetItem(data);
    }

    refreshItems();
    closeForm();
  }

  function handleDeleteItem(item) {
    const confirmed = window.confirm(
      `¿Querés eliminar ${item.medicineName} del botiquín?`,
    );

    if (!confirmed) {
      return;
    }

    deleteMedicineCabinetItem(item.id);

    if (selectedItem?.id === item.id) {
      setSelectedItem(null);
    }

    refreshItems();
  }

  return (
    <div className="medicine-cabinet-page">
      <section className="medicine-cabinet-page__header">
        <div>
          <span>Organización familiar</span>
          <h2>Botiquín</h2>

          <p>
            Controlá medicamentos disponibles,
            vencimientos y stock relacionado con los
            tratamientos.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateForm}
          disabled={children.length === 0}
        >
          <i className="bi bi-plus-circle" />
          Agregar medicamento
        </button>
      </section>

      {children.length === 0 && (
        <section className="medicine-cabinet-page__warning">
          <i className="bi bi-person-exclamation" />

          <div>
            <strong>
              Primero necesitás crear un perfil
              infantil
            </strong>

            <p>
              Cada medicamento debe estar asociado a
              uno de los hijos.
            </p>
          </div>

          <Link
            to="/dashboard/children"
            className="btn btn-outline-primary"
          >
            Ir a Mis hijos
          </Link>
        </section>
      )}

      <section className="medicine-cabinet-statistics">
        <article>
          <span className="medicine-cabinet-statistics__icon">
            <i className="bi bi-capsule-pill" />
          </span>

          <div>
            <strong>{items.length}</strong>
            <span>
              Medicamentos registrados
            </span>
          </div>
        </article>

        <article>
          <span className="medicine-cabinet-statistics__icon medicine-cabinet-statistics__icon--stock">
            <i className="bi bi-box-seam" />
          </span>

          <div>
            <strong>{lowStockCount}</strong>
            <span>
              Con poco stock o agotados
            </span>
          </div>
        </article>

        <article>
          <span className="medicine-cabinet-statistics__icon medicine-cabinet-statistics__icon--expiration">
            <i className="bi bi-calendar-x" />
          </span>

          <div>
            <strong>{expiringCount}</strong>
            <span>
              Por vencer o vencidos
            </span>
          </div>
        </article>

        <article>
          <span className="medicine-cabinet-statistics__icon medicine-cabinet-statistics__icon--linked">
            <i className="bi bi-link-45deg" />
          </span>

          <div>
            <strong>{linkedCount}</strong>
            <span>
              Vinculados a tratamientos
            </span>
          </div>
        </article>
      </section>

      <section className="medicine-cabinet-toolbar">
        <div className="medicine-cabinet-toolbar__search">
          <i className="bi bi-search" />

          <input
            type="search"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
            placeholder="Buscar medicamento, hijo, lote o ubicación"
          />

          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Limpiar búsqueda"
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>

        <select
          value={childFilter}
          onChange={(event) =>
            setChildFilter(event.target.value)
          }
        >
          <option value="all">
            Todos los hijos
          </option>

          {children.map((child) => (
            <option
              key={child.id}
              value={child.id}
            >
              {child.fullName}
            </option>
          ))}
        </select>

        <select
          value={stateFilter}
          onChange={(event) =>
            setStateFilter(event.target.value)
          }
        >
          <option value="all">
            Todos los estados
          </option>

          <option value="available">
            Disponible
          </option>

          <option value="lowStock">
            Poco stock
          </option>

          <option value="outOfStock">
            Sin stock
          </option>

          <option value="expiring">
            Próximo a vencer
          </option>

          <option value="expired">
            Vencido
          </option>
        </select>
      </section>

      <div className="medicine-cabinet-page__result">
        {filteredItems.length}{' '}
        {filteredItems.length === 1
          ? 'medicamento encontrado'
          : 'medicamentos encontrados'}
      </div>

      {filteredItems.length > 0 ? (
        <section className="medicine-cabinet-grid">
          {filteredItems.map((item) => (
            <MedicineCabinetCard
              key={item.id}
              item={item}
              child={childrenMap[item.childId]}
              treatment={
                treatmentsMap[item.treatmentId]
              }
              onView={setSelectedItem}
              onEdit={openEditForm}
              onDelete={handleDeleteItem}
            />
          ))}
        </section>
      ) : (
        <section className="medicine-cabinet-empty">
          <span>
            <i className="bi bi-capsule-pill" />
          </span>

          <h3>
            {items.length === 0
              ? 'El botiquín está vacío'
              : 'No encontramos resultados'}
          </h3>

          <p>
            {items.length === 0
              ? 'Agregá el primer medicamento para comenzar a controlar su stock y vencimiento.'
              : 'Probá cambiando los filtros o utilizando otro término de búsqueda.'}
          </p>

          {items.length === 0 &&
            children.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={openCreateForm}
              >
                Agregar primer medicamento
              </button>
            )}
        </section>
      )}

      {isFormOpen && (
        <div
          className="medicine-cabinet-modal"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="medicine-cabinet-modal__backdrop"
            onClick={closeForm}
            aria-label="Cerrar formulario"
          />

          <div className="medicine-cabinet-modal__container medicine-cabinet-modal__container--form">
            <header className="medicine-cabinet-modal__header">
              <div>
                <span>Botiquín familiar</span>

                <h2>
                  {editingItem
                    ? 'Editar medicamento'
                    : 'Agregar medicamento'}
                </h2>
              </div>

              <button
                type="button"
                onClick={closeForm}
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg" />
              </button>
            </header>

            <div className="medicine-cabinet-modal__body">
              <MedicineCabinetForm
                children={children}
                treatments={treatments}
                initialData={editingItem}
                onSubmit={handleSaveItem}
                onCancel={closeForm}
              />
            </div>
          </div>
        </div>
      )}

      {selectedItem && (
        <div
          className="medicine-cabinet-modal"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="medicine-cabinet-modal__backdrop"
            onClick={() =>
              setSelectedItem(null)
            }
            aria-label="Cerrar detalle"
          />

          <div className="medicine-cabinet-modal__container">
            <header className="medicine-cabinet-modal__header">
              <div>
                <span>Información completa</span>
                <h2>Medicamento del botiquín</h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedItem(null)
                }
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg" />
              </button>
            </header>

            <div className="medicine-cabinet-modal__body">
              <section className="medicine-cabinet-detail__hero">
                <span>
                  <i className="bi bi-capsule-pill" />
                </span>

                <div>
                  <small>
                    {getMedicineCabinetStateLabel(
                      selectedItem,
                    )}
                  </small>

                  <h3>
                    {selectedItem.medicineName}
                  </h3>

                  <p>
                    {
                      childrenMap[
                        selectedItem.childId
                      ]?.fullName
                    }
                  </p>
                </div>
              </section>

              <section className="medicine-cabinet-detail__section">
                <h4>
                  <i className="bi bi-box-seam" />
                  Stock
                </h4>

                <dl className="medicine-cabinet-detail__grid">
                  <div>
                    <dt>Stock actual</dt>

                    <dd>
                      {selectedItem.currentStock}{' '}
                      {getStockUnitLabel(
                        selectedItem.stockUnit,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Stock mínimo</dt>

                    <dd>
                      {selectedItem.minimumStock}{' '}
                      {getStockUnitLabel(
                        selectedItem.stockUnit,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Descuento por toma</dt>

                    <dd>
                      {
                        selectedItem.consumptionPerDose
                      }{' '}
                      {getStockUnitLabel(
                        selectedItem.stockUnit,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Tratamiento</dt>

                    <dd>
                      {treatmentsMap[
                        selectedItem.treatmentId
                      ]?.medicationName ||
                        'Sin tratamiento vinculado'}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="medicine-cabinet-detail__section">
                <h4>
                  <i className="bi bi-calendar-event" />
                  Vencimiento
                </h4>

                <div className="medicine-cabinet-detail__expiration">
                  <strong>
                    {formatCabinetDate(
                      selectedItem.expirationDate,
                    )}
                  </strong>

                  <span>
                    {getExpirationDescription(
                      selectedItem,
                    )}
                  </span>
                </div>
              </section>

              <section className="medicine-cabinet-detail__section">
                <h4>
                  <i className="bi bi-info-circle" />
                  Información adicional
                </h4>

                <dl className="medicine-cabinet-detail__grid">
                  <div>
                    <dt>Presentación</dt>

                    <dd>
                      {selectedItem.presentation ||
                        'No registrada'}
                    </dd>
                  </div>

                  <div>
                    <dt>Número de lote</dt>

                    <dd>
                      {selectedItem.lotNumber ||
                        'No registrado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Ubicación</dt>

                    <dd>
                      {selectedItem.storageLocation ||
                        'No registrada'}
                    </dd>
                  </div>
                </dl>
              </section>

              {selectedItem.notes && (
                <section className="medicine-cabinet-detail__section">
                  <h4>
                    <i className="bi bi-journal-text" />
                    Observaciones
                  </h4>

                  <p className="medicine-cabinet-detail__notes">
                    {selectedItem.notes}
                  </p>
                </section>
              )}
            </div>

            <footer className="medicine-cabinet-modal__footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() =>
                  setSelectedItem(null)
                }
              >
                Cerrar
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  openEditForm(selectedItem)
                }
              >
                <i className="bi bi-pencil" />
                Editar medicamento
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default MedicineCabinetPage;