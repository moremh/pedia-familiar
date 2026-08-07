import { useEffect, useMemo, useState } from 'react';

import ChildCard from '../../components/cards/ChildCard.jsx';
import ChildForm from '../../components/forms/ChildForm.jsx';

import {
  createChild,
  deleteChild,
  getChildren,
  updateChild,
} from '../../services/childrenService.js';

import {
  assertCanAddChild,
  getCurrentFamilyChildCapacity,
  getDefaultFamilyChildCapacity,
} from '../../services/familyChildrenLimitService.js';

import {
  formatChildAge,
  formatDate,
  getInitials,
  hasRegisteredAllergies,
} from '../../utils/childUtils.js';

import '../../styles/children.css';

function ChildrenPage() {
  const [children, setChildren] = useState(() =>
    getChildren(),
  );

  const [childCapacity, setChildCapacity] =
    useState(() =>
      getDefaultFamilyChildCapacity(
        getChildren().length,
      ),
    );

  const [isLoadingCapacity, setIsLoadingCapacity] =
    useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingChild, setEditingChild] = useState(null);
  const [selectedChild, setSelectedChild] = useState(null);

  const filteredChildren = useMemo(() => {
    const normalizedSearch = searchTerm
      .trim()
      .toLowerCase();

    if (!normalizedSearch) {
      return children;
    }

    return children.filter((child) => {
      const searchableValues = [
        child.fullName,
        child.allergies,
        child.healthInsurance,
        child.pediatricianName,
      ];

      return searchableValues.some((value) =>
        String(value ?? '')
          .toLowerCase()
          .includes(normalizedSearch),
      );
    });
  }, [children, searchTerm]);

  const allergyCount = children.filter((child) =>
    hasRegisteredAllergies(child.allergies),
  ).length;

  const effectiveChildrenLimit = Math.max(
    childCapacity.effectiveLimit || 3,
    children.length,
  );

  const canAddChild =
    children.length < effectiveChildrenLimit;

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
      }),
    [],
  );

  async function refreshChildCapacity() {
    try {
      const capacity =
        await getCurrentFamilyChildCapacity();

      setChildCapacity({
        ...capacity,
        currentCount: children.length,
        effectiveLimit: Math.max(
          capacity.effectiveLimit,
          children.length,
        ),
      });
    } catch (error) {
      console.error(
        'No se pudo cargar el límite de hijos.',
        error,
      );

      setChildCapacity(
        getDefaultFamilyChildCapacity(
          children.length,
        ),
      );
    } finally {
      setIsLoadingCapacity(false);
    }
  }

  useEffect(() => {
    refreshChildCapacity();
  }, []);

  function refreshChildren() {
    setChildren(getChildren());
  }

  function openCreateForm() {
    if (!canAddChild) {
      window.alert(
        `La familia ya alcanzó el límite de ${effectiveChildrenLimit} ${
          effectiveChildrenLimit === 1
            ? 'hijo'
            : 'hijos'
        }. Administración debe habilitar un cupo adicional para agregar otro perfil.`,
      );
      return;
    }

    setEditingChild(null);
    setIsFormOpen(true);
  }

  function openEditForm(child) {
    setSelectedChild(null);
    setEditingChild(child);
    setIsFormOpen(true);
  }

  function closeForm() {
    setEditingChild(null);
    setIsFormOpen(false);
  }

  async function handleSaveChild(childData) {
    try {
      if (editingChild) {
        updateChild(editingChild.id, childData);
      } else {
        await assertCanAddChild();
        createChild(childData);
      }

      const updatedChildren = getChildren();
      setChildren(updatedChildren);

      setChildCapacity((current) => ({
        ...current,
        currentCount: updatedChildren.length,
        effectiveLimit: Math.max(
          current.effectiveLimit || 3,
          updatedChildren.length,
        ),
        canAdd:
          updatedChildren.length <
          Math.max(
            current.effectiveLimit || 3,
            updatedChildren.length,
          ),
      }));

      closeForm();
    } catch (error) {
      window.alert(
        error.message ||
          'No se pudo guardar el perfil infantil.',
      );
    }
  }

  function handleDeleteChild(child) {
    const confirmed = window.confirm(
      `¿Querés eliminar el perfil de ${child.fullName}? Esta acción no se puede deshacer.`,
    );

    if (!confirmed) {
      return;
    }

    deleteChild(child.id);

    if (selectedChild?.id === child.id) {
      setSelectedChild(null);
    }

    const updatedChildren = getChildren();
    setChildren(updatedChildren);
    setChildCapacity((current) => ({
      ...current,
      currentCount: updatedChildren.length,
      canAdd:
        updatedChildren.length <
        Math.max(
          current.effectiveLimit || 3,
          updatedChildren.length,
        ),
    }));
  }

  return (
    <div className="children-page">
      <section className="children-page__header">
        <div>
          <span>Perfiles infantiles</span>
          <h2>Mis hijos</h2>

          <p>
            Administrá la información personal y médica de cada
            hijo.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateForm}
          disabled={
            isLoadingCapacity ||
            !canAddChild
          }
        >
          <i className="bi bi-person-plus" />
          Agregar hijo
        </button>
      </section>

      <section
        className={`children-capacity ${
          canAddChild
            ? ''
            : 'children-capacity--full'
        }`}
      >
        <div className="children-capacity__icon">
          <i
            className={`bi ${
              canAddChild
                ? 'bi-people'
                : 'bi-lock'
            }`}
          />
        </div>

        <div className="children-capacity__content">
          <span>Cupo de perfiles infantiles</span>

          <strong>
            {children.length} de {effectiveChildrenLimit}{' '}
            {effectiveChildrenLimit === 1
              ? 'hijo permitido'
              : 'hijos permitidos'}
          </strong>

          <p>
            {canAddChild
              ? `Tu familia puede agregar ${effectiveChildrenLimit - children.length} ${
                  effectiveChildrenLimit - children.length === 1
                    ? 'perfil más'
                    : 'perfiles más'
                }.`
              : `Alcanzaste el límite actual. Para agregar otro hijo, administración debe habilitar un cupo adicional. Valor actual por hijo extra: ${currencyFormatter.format(
                  childCapacity.extraChildPrice || 0,
                )}.`}
          </p>
        </div>

        <div className="children-capacity__progress">
          <span
            style={{
              width: `${Math.min(
                100,
                (children.length /
                  Math.max(
                    effectiveChildrenLimit,
                    1,
                  )) *
                  100,
              )}%`,
            }}
          />
        </div>
      </section>

      <section className="children-statistics">
        <article>
          <span className="children-statistics__icon">
            <i className="bi bi-person-hearts" />
          </span>

          <div>
            <strong>{children.length}</strong>
            <span>Perfiles registrados</span>
          </div>
        </article>

        <article>
          <span className="children-statistics__icon children-statistics__icon--warning">
            <i className="bi bi-exclamation-triangle" />
          </span>

          <div>
            <strong>{allergyCount}</strong>
            <span>Con alergias registradas</span>
          </div>
        </article>

        <article>
          <span className="children-statistics__icon children-statistics__icon--doctor">
            <i className="bi bi-person-badge" />
          </span>

          <div>
            <strong>
              {
                children.filter(
                  (child) => child.pediatricianName,
                ).length
              }
            </strong>

            <span>Con pediatra habitual</span>
          </div>
        </article>
      </section>

      <section className="children-toolbar">
        <div className="children-toolbar__search">
          <i className="bi bi-search" />

          <input
            type="search"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
            placeholder="Buscar por nombre, alergia, pediatra u obra social"
            aria-label="Buscar perfiles infantiles"
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

        <span className="children-toolbar__result">
          {filteredChildren.length}{' '}
          {filteredChildren.length === 1
            ? 'perfil encontrado'
            : 'perfiles encontrados'}
        </span>
      </section>

      {filteredChildren.length > 0 ? (
        <section className="children-grid">
          {filteredChildren.map((child) => (
            <ChildCard
              key={child.id}
              child={child}
              onView={setSelectedChild}
              onEdit={openEditForm}
              onDelete={handleDeleteChild}
            />
          ))}
        </section>
      ) : (
        <section className="children-empty">
          <span>
            <i className="bi bi-person-hearts" />
          </span>

          <h3>
            {children.length === 0
              ? 'Todavía no hay perfiles'
              : 'No encontramos resultados'}
          </h3>

          <p>
            {children.length === 0
              ? 'Creá el primer perfil infantil para comenzar a organizar su información médica.'
              : 'Probá buscando con otro nombre, pediatra, alergia u obra social.'}
          </p>

          {children.length === 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={openCreateForm}
            >
              Agregar primer hijo
            </button>
          )}
        </section>
      )}

      {isFormOpen && (
        <div
          className="children-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="childFormTitle"
        >
          <button
            type="button"
            className="children-modal__backdrop"
            onClick={closeForm}
            aria-label="Cerrar formulario"
          />

          <div className="children-modal__container children-modal__container--form">
            <header className="children-modal__header">
              <div>
                <span>Perfil infantil</span>

                <h2 id="childFormTitle">
                  {editingChild
                    ? 'Editar perfil'
                    : 'Agregar hijo'}
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

            <div className="children-modal__body">
              <ChildForm
                initialData={editingChild}
                onSubmit={handleSaveChild}
                onCancel={closeForm}
              />
            </div>
          </div>
        </div>
      )}

      {selectedChild && (
        <div
          className="children-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="childDetailTitle"
        >
          <button
            type="button"
            className="children-modal__backdrop"
            onClick={() => setSelectedChild(null)}
            aria-label="Cerrar perfil"
          />

          <div className="children-modal__container">
            <header className="children-modal__header">
              <div>
                <span>Información completa</span>
                <h2 id="childDetailTitle">
                  Perfil infantil
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedChild(null)}
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg" />
              </button>
            </header>

            <div className="children-modal__body">
              <div className="child-detail__identity">
                <div className="child-detail__avatar">
                  {getInitials(selectedChild.fullName)}
                </div>

                <div>
                  <h3>{selectedChild.fullName}</h3>
                  <p>
                    {formatChildAge(
                      selectedChild.birthDate,
                    )}
                  </p>
                </div>

                {hasRegisteredAllergies(
                  selectedChild.allergies,
                ) && (
                  <span className="child-detail__warning">
                    <i className="bi bi-exclamation-triangle-fill" />
                    Alergia registrada
                  </span>
                )}
              </div>

              <section className="child-detail__section">
                <h4>
                  <i className="bi bi-person-vcard" />
                  Datos personales
                </h4>

                <dl className="child-detail__grid">
                  <div>
                    <dt>Fecha de nacimiento</dt>
                    <dd>
                      {formatDate(selectedChild.birthDate)}
                    </dd>
                  </div>

                  <div>
                    <dt>Grupo sanguíneo</dt>
                    <dd>
                      {selectedChild.bloodType ||
                        'No registrado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Peso actual</dt>
                    <dd>
                      {selectedChild.weight !== ''
                        ? `${selectedChild.weight} kg`
                        : 'No registrado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Altura actual</dt>
                    <dd>
                      {selectedChild.height !== ''
                        ? `${selectedChild.height} cm`
                        : 'No registrada'}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="child-detail__section">
                <h4>
                  <i className="bi bi-heart-pulse" />
                  Información médica
                </h4>

                <div className="child-detail__text">
                  <strong>Alergias conocidas</strong>
                  <p>
                    {selectedChild.allergies ||
                      'No se registraron alergias.'}
                  </p>
                </div>

                <div className="child-detail__text">
                  <strong>Antecedentes médicos</strong>
                  <p>
                    {selectedChild.medicalHistory ||
                      'No se registraron antecedentes.'}
                  </p>
                </div>
              </section>

              <section className="child-detail__section">
                <h4>
                  <i className="bi bi-shield-check" />
                  Cobertura y pediatra
                </h4>

                <dl className="child-detail__grid">
                  <div>
                    <dt>Obra social</dt>
                    <dd>
                      {selectedChild.healthInsurance ||
                        'No registrada'}
                    </dd>
                  </div>

                  <div>
                    <dt>Número de afiliado</dt>
                    <dd>
                      {selectedChild.memberNumber ||
                        'No registrado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Pediatra habitual</dt>
                    <dd>
                      {selectedChild.pediatricianName ||
                        'No registrado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Teléfono del pediatra</dt>
                    <dd>
                      {selectedChild.pediatricianPhone ||
                        'No registrado'}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="child-detail__section">
                <h4>
                  <i className="bi bi-telephone" />
                  Contacto de emergencia
                </h4>

                <dl className="child-detail__grid">
                  <div>
                    <dt>Nombre</dt>
                    <dd>
                      {selectedChild.emergencyContactName ||
                        'No registrado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Teléfono</dt>
                    <dd>
                      {selectedChild.emergencyContactPhone ||
                        'No registrado'}
                    </dd>
                  </div>
                </dl>
              </section>

              {selectedChild.notes && (
                <section className="child-detail__section">
                  <h4>
                    <i className="bi bi-journal-text" />
                    Observaciones
                  </h4>

                  <div className="child-detail__text">
                    <p>{selectedChild.notes}</p>
                  </div>
                </section>
              )}
            </div>

            <footer className="children-modal__footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setSelectedChild(null)}
              >
                Cerrar
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  openEditForm(selectedChild)
                }
              >
                <i className="bi bi-pencil" />
                Editar perfil
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChildrenPage;