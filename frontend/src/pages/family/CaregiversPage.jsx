import {
  useMemo,
  useState,
} from 'react';

import CaregiverCard from '../../components/cards/CaregiverCard.jsx';
import CaregiverForm from '../../components/forms/CaregiverForm.jsx';

import {
  createCaregiver,
  deleteCaregiver,
  getActiveCaregiverId,
  getCaregivers,
  setActiveCaregiverId,
  setPrimaryCaregiver,
  toggleCaregiverStatus,
  updateCaregiver,
} from '../../services/caregiversService.js';

import {
  ensureCaregiverSystemAccess,
  renewCaregiverInvitation,
  revokeCaregiverSystemAccess,
} from '../../services/familyInvitationsService.js';

import {
  getReminderRecords,
} from '../../services/remindersService.js';

import {
  formatCaregiverDateTime,
  getCaregiverHistoryStats,
  getRelationshipLabel,
} from '../../utils/caregiverUtils.js';

import '../../styles/caregivers.css';

const invitationDateFormatter =
  new Intl.DateTimeFormat(
    'es-AR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  );

function formatInvitationDate(
  dateValue,
) {
  if (!dateValue) {
    return 'Sin fecha';
  }

  const date =
    new Date(dateValue);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return 'Sin fecha';
  }

  return invitationDateFormatter.format(
    date,
  );
}

async function copyText(
  text,
) {
  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {
    await navigator.clipboard.writeText(
      text,
    );

    return;
  }

  const textarea =
    document.createElement(
      'textarea',
    );

  textarea.value = text;
  textarea.style.position =
    'fixed';
  textarea.style.opacity = '0';

  document.body.appendChild(
    textarea,
  );

  textarea.select();
  document.execCommand('copy');
  textarea.remove();
}

function CaregiversPage() {
  const [caregivers, setCaregivers] =
    useState(() =>
      getCaregivers(),
    );

  const [reminderRecords] =
    useState(() =>
      getReminderRecords(),
    );

  const [
    activeCaregiverId,
    setActiveCaregiverState,
  ] = useState(() =>
    getActiveCaregiverId(),
  );

  const [
    searchTerm,
    setSearchTerm,
  ] = useState('');

  const [
    relationshipFilter,
    setRelationshipFilter,
  ] = useState('all');

  const [
    statusFilter,
    setStatusFilter,
  ] = useState('all');

  const [
    isFormOpen,
    setIsFormOpen,
  ] = useState(false);

  const [
    editingCaregiver,
    setEditingCaregiver,
  ] = useState(null);

  const [
    selectedCaregiver,
    setSelectedCaregiver,
  ] = useState(null);

  const [
    invitationShare,
    setInvitationShare,
  ] = useState(null);

  const [
    feedback,
    setFeedback,
  ] = useState(null);

  const caregiverStatsMap =
    useMemo(
      () =>
        Object.fromEntries(
          caregivers.map(
            (caregiver) => [
              caregiver.id,

              getCaregiverHistoryStats(
                caregiver.id,
                reminderRecords,
              ),
            ],
          ),
        ),
      [
        caregivers,
        reminderRecords,
      ],
    );

  const filteredCaregivers =
    useMemo(() => {
      const normalizedSearch =
        searchTerm
          .trim()
          .toLowerCase();

      return caregivers.filter(
        (caregiver) => {
          const matchesRelationship =
            relationshipFilter ===
              'all' ||
            caregiver.relationship ===
              relationshipFilter;

          const matchesStatus =
            statusFilter ===
              'all' ||
            (
              statusFilter ===
                'active' &&
              caregiver.isActive
            ) ||
            (
              statusFilter ===
                'inactive' &&
              !caregiver.isActive
            );

          const searchableValues = [
            caregiver.fullName,
            caregiver.phone,
            caregiver.email,
            caregiver.notes,

            getRelationshipLabel(
              caregiver.relationship,
            ),
          ];

          const matchesSearch =
            !normalizedSearch ||
            searchableValues.some(
              (value) =>
                String(
                  value ?? '',
                )
                  .toLowerCase()
                  .includes(
                    normalizedSearch,
                  ),
            );

          return (
            matchesRelationship &&
            matchesStatus &&
            matchesSearch
          );
        },
      );
    }, [
      caregivers,
      relationshipFilter,
      statusFilter,
      searchTerm,
    ]);

  const activeCount =
    caregivers.filter(
      (caregiver) =>
        caregiver.isActive,
    ).length;

  const accessCount =
    caregivers.filter(
      (caregiver) =>
        caregiver.invitationStatus ===
          'active' ||
        caregiver.role === 'owner',
    ).length;

  const administeredCount =
    reminderRecords.filter(
      (record) =>
        record.status ===
          'administered' &&
        record.responsibleId,
    ).length;

  const omittedCount =
    reminderRecords.filter(
      (record) =>
        record.status ===
          'omitted' &&
        record.responsibleId,
    ).length;

  function refreshCaregivers() {
    setCaregivers(
      getCaregivers(),
    );

    setActiveCaregiverState(
      getActiveCaregiverId(),
    );
  }

  function showFeedback(
    type,
    message,
  ) {
    setFeedback({
      type,
      message,
    });

    window.setTimeout(() => {
      setFeedback(null);
    }, 4500);
  }

  function openCreateForm() {
    setEditingCaregiver(null);
    setSelectedCaregiver(null);
    setIsFormOpen(true);
    setFeedback(null);
  }

  function openEditForm(
    caregiver,
  ) {
    setSelectedCaregiver(null);
    setEditingCaregiver(
      caregiver,
    );
    setIsFormOpen(true);
    setFeedback(null);
  }

  function closeForm() {
    setEditingCaregiver(null);
    setIsFormOpen(false);
  }

  async function handleSaveCaregiver(
    data,
  ) {
    try {
      const savedCaregiver =
        editingCaregiver
          ? await updateCaregiver(
              editingCaregiver.id,
              data,
            )
          : await createCaregiver(
              data,
            );

      if (!savedCaregiver) {
        throw new Error(
          'No se pudo guardar el responsable.',
        );
      }

      const accessResult =
        await ensureCaregiverSystemAccess({
          ...savedCaregiver,
          hasSystemAccess:
            Boolean(data.hasSystemAccess),
          accessLevel:
            data.accessLevel ||
            'full_access',
        });

      refreshCaregivers();
      closeForm();

      if (
        accessResult.status ===
          'pending' &&
        accessResult.invitation
      ) {
        setInvitationShare({
          caregiverName:
            savedCaregiver.fullName,

          email:
            savedCaregiver.email,

          url:
            accessResult.url,

          expiresAt:
            accessResult.invitation
              .expiresAt,
        });

        return;
      }

      if (
        accessResult.status ===
        'active'
      ) {
        showFeedback(
          'success',
          data.accessLevel === 'medication_only'
            ? 'El responsable puede entrar para administrar tomas.'
            : 'El responsable tiene acceso completo habilitado a la familia.',
        );

        return;
      }

      showFeedback(
        'success',
        editingCaregiver
          ? 'Los cambios se guardaron correctamente.'
          : 'El responsable fue agregado correctamente.',
      );
    } catch (error) {
      showFeedback(
        'error',
        error.message ||
          'No se pudo guardar el responsable.',
      );
    }
  }

  async function handleDeleteCaregiver(
    caregiver,
  ) {
    if (
      caregiver.role === 'owner'
    ) {
      showFeedback(
        'error',
        'La cuenta propietaria no puede eliminarse.',
      );

      return;
    }

    const confirmed =
      window.confirm(
        `¿Querés eliminar a ${caregiver.fullName} de los responsables familiares? El historial anterior conservará su nombre.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      await revokeCaregiverSystemAccess(
        caregiver,
      );

      await deleteCaregiver(
        caregiver.id,
      );

      if (
        selectedCaregiver?.id ===
        caregiver.id
      ) {
        setSelectedCaregiver(
          null,
        );
      }

      refreshCaregivers();

      showFeedback(
        'success',
        'El responsable fue eliminado.',
      );
    } catch (error) {
      showFeedback(
        'error',
        error.message ||
          'No se pudo eliminar el responsable.',
      );
    }
  }

  function handleSelectCaregiver(
    caregiver,
  ) {
    setActiveCaregiverId(
      caregiver.id,
    );

    setActiveCaregiverState(
      caregiver.id,
    );
  }

  async function handleSetPrimary(
    caregiver,
  ) {
    try {
      await setPrimaryCaregiver(
        caregiver.id,
      );

      refreshCaregivers();

      showFeedback(
        'success',
        `${caregiver.fullName} ahora es el responsable principal.`,
      );
    } catch (error) {
      showFeedback(
        'error',
        error.message ||
          'No se pudo cambiar el responsable principal.',
      );
    }
  }

  async function handleToggleStatus(
    caregiver,
  ) {
    if (
      caregiver.role ===
        'owner' &&
      caregiver.isActive
    ) {
      showFeedback(
        'error',
        'La cuenta propietaria no puede desactivarse.',
      );

      return;
    }

    try {
      await toggleCaregiverStatus(
        caregiver.id,
      );

      refreshCaregivers();
    } catch (error) {
      showFeedback(
        'error',
        error.message ||
          'No se pudo modificar el responsable.',
      );
    }
  }

  async function handleCopyInvitation(
    caregiver,
  ) {
    try {
      const result =
        caregiver.invitationStatus ===
        'expired'
          ? await renewCaregiverInvitation(
              caregiver,
            )
          : await ensureCaregiverSystemAccess(
              {
                ...caregiver,
                hasSystemAccess:
                  true,
              },
            );

      if (
        result.status ===
          'active'
      ) {
        showFeedback(
          'success',
          'Este responsable ya tiene acceso habilitado.',
        );

        refreshCaregivers();

        return;
      }

      setInvitationShare({
        caregiverName:
          caregiver.fullName,

        email:
          caregiver.email,

        url:
          result.url,

        expiresAt:
          result.invitation
            ?.expiresAt,
      });

      refreshCaregivers();
    } catch (error) {
      showFeedback(
        'error',
        error.message ||
          'No se pudo generar la invitación.',
      );
    }
  }

  async function handleRevokeAccess(
    caregiver,
  ) {
    const confirmed =
      window.confirm(
        `¿Querés quitarle a ${caregiver.fullName} el acceso al sistema? Seguirá figurando como responsable familiar.`,
      );

    if (!confirmed) {
      return;
    }

    try {
      await revokeCaregiverSystemAccess(
        caregiver,
      );

      refreshCaregivers();

      showFeedback(
        'success',
        'El acceso al sistema fue deshabilitado.',
      );
    } catch (error) {
      showFeedback(
        'error',
        error.message ||
          'No se pudo quitar el acceso.',
      );
    }
  }

  async function handleCopyLink() {
    if (
      !invitationShare?.url
    ) {
      return;
    }

    try {
      await copyText(
        invitationShare.url,
      );

      showFeedback(
        'success',
        'El enlace de invitación fue copiado.',
      );
    } catch {
      showFeedback(
        'error',
        'No se pudo copiar el enlace.',
      );
    }
  }

  async function handleShareInvitation() {
    if (
      !invitationShare?.url
    ) {
      return;
    }

    const shareText =
      `Hola ${invitationShare.caregiverName}, ` +
      'te invitaron a compartir una familia en MiPeque. ' +
      'Abrí este enlace para crear tu contraseña y aceptar la invitación:';

    try {
      if (
        typeof navigator.share ===
        'function'
      ) {
        await navigator.share({
          title:
            'Invitación a MiPeque',
          text: shareText,
          url:
            invitationShare.url,
        });

        return;
      }

      await copyText(
        `${shareText}
${invitationShare.url}`,
      );

      showFeedback(
        'success',
        'La invitación fue copiada para compartir.',
      );
    } catch (error) {
      if (
        error?.name ===
        'AbortError'
      ) {
        return;
      }

      showFeedback(
        'error',
        'No se pudo compartir la invitación.',
      );
    }
  }

  const selectedHistory =
    selectedCaregiver
      ? caregiverStatsMap[
          selectedCaregiver.id
        ]?.records ?? []
      : [];

  return (
    <div className="caregivers-page">
      <section className="caregivers-page__header">
        <div>
          <span>
            Organización familiar
          </span>

          <h2>
            Responsables familiares
          </h2>

          <p>
            Registrá quién administra los
            medicamentos e invitá a otras personas a
            entrar a la misma familia.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={
            openCreateForm
          }
        >
          <i className="bi bi-person-plus" />
          Agregar responsable
        </button>
      </section>

      {feedback && (
        <div
          className={`caregivers-feedback caregivers-feedback--${feedback.type}`}
          role="alert"
        >
          <i
            className={`bi ${
              feedback.type ===
              'success'
                ? 'bi-check-circle'
                : 'bi-exclamation-circle'
            }`}
          />

          <span>
            {feedback.message}
          </span>
        </div>
      )}

      <section className="caregivers-statistics">
        <article>
          <span className="caregivers-statistics__icon">
            <i className="bi bi-people" />
          </span>

          <div>
            <strong>
              {caregivers.length}
            </strong>

            <span>
              Responsables registrados
            </span>
          </div>
        </article>

        <article>
          <span className="caregivers-statistics__icon caregivers-statistics__icon--active">
            <i className="bi bi-person-check" />
          </span>

          <div>
            <strong>
              {activeCount}
            </strong>

            <span>
              Responsables activos
            </span>
          </div>
        </article>

        <article>
          <span className="caregivers-statistics__icon caregivers-statistics__icon--administered">
            <i className="bi bi-person-lock" />
          </span>

          <div>
            <strong>
              {accessCount}
            </strong>

            <span>
              Con acceso al sistema
            </span>
          </div>
        </article>

        <article>
          <span className="caregivers-statistics__icon caregivers-statistics__icon--omitted">
            <i className="bi bi-activity" />
          </span>

          <div>
            <strong>
              {administeredCount +
                omittedCount}
            </strong>

            <span>
              Acciones registradas
            </span>
          </div>
        </article>
      </section>

      <section className="caregivers-toolbar">
        <div className="caregivers-toolbar__search">
          <i className="bi bi-search" />

          <input
            type="search"
            value={
              searchTerm
            }
            onChange={(event) =>
              setSearchTerm(
                event.target.value,
              )
            }
            placeholder="Buscar por nombre, teléfono o correo"
          />

          {searchTerm && (
            <button
              type="button"
              onClick={() =>
                setSearchTerm('')
              }
              aria-label="Limpiar búsqueda"
            >
              <i className="bi bi-x-lg" />
            </button>
          )}
        </div>

        <select
          value={
            relationshipFilter
          }
          onChange={(event) =>
            setRelationshipFilter(
              event.target.value,
            )
          }
        >
          <option value="all">
            Todas las relaciones
          </option>

          <option value="mother">
            Madre
          </option>

          <option value="father">
            Padre
          </option>

          <option value="tutor">
            Tutor/a
          </option>

          <option value="grandparent">
            Abuelo/a
          </option>

          <option value="sibling">
            Hermano/a
          </option>

          <option value="babysitter">
            Cuidador/a
          </option>

          <option value="other">
            Otros
          </option>
        </select>

        <select
          value={
            statusFilter
          }
          onChange={(event) =>
            setStatusFilter(
              event.target.value,
            )
          }
        >
          <option value="all">
            Todos los estados
          </option>

          <option value="active">
            Activos
          </option>

          <option value="inactive">
            Inactivos
          </option>
        </select>
      </section>

      <div className="caregivers-page__result">
        {filteredCaregivers.length}{' '}

        {filteredCaregivers.length ===
        1
          ? 'responsable encontrado'
          : 'responsables encontrados'}
      </div>

      {filteredCaregivers.length >
      0 ? (
        <section className="caregivers-grid">
          {filteredCaregivers.map(
            (caregiver) => (
              <CaregiverCard
                key={
                  caregiver.id
                }
                caregiver={
                  caregiver
                }
                historyStats={
                  caregiverStatsMap[
                    caregiver.id
                  ]
                }
                isSelected={
                  caregiver.id ===
                  activeCaregiverId
                }
                onSelect={
                  handleSelectCaregiver
                }
                onView={
                  setSelectedCaregiver
                }
                onEdit={
                  openEditForm
                }
                onDelete={
                  handleDeleteCaregiver
                }
                onSetPrimary={
                  handleSetPrimary
                }
                onToggleStatus={
                  handleToggleStatus
                }
                onCopyInvitation={
                  handleCopyInvitation
                }
                onRevokeAccess={
                  handleRevokeAccess
                }
              />
            ),
          )}
        </section>
      ) : (
        <section className="caregivers-empty">
          <span>
            <i className="bi bi-people" />
          </span>

          <h3>
            {caregivers.length ===
            0
              ? 'Todavía no hay responsables'
              : 'No encontramos resultados'}
          </h3>

          <p>
            {caregivers.length ===
            0
              ? 'Agregá a la primera persona responsable para registrar quién administra cada medicamento.'
              : 'Probá cambiando los filtros o el término de búsqueda.'}
          </p>

          {caregivers.length ===
            0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={
                openCreateForm
              }
            >
              Agregar primer responsable
            </button>
          )}
        </section>
      )}

      {isFormOpen && (
        <div
          className="caregivers-modal"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="caregivers-modal__backdrop"
            onClick={
              closeForm
            }
            aria-label="Cerrar formulario"
          />

          <div className="caregivers-modal__container caregivers-modal__container--form">
            <header className="caregivers-modal__header">
              <div>
                <span>
                  Organización familiar
                </span>

                <h2>
                  {editingCaregiver
                    ? 'Editar responsable'
                    : 'Agregar responsable'}
                </h2>
              </div>

              <button
                type="button"
                onClick={
                  closeForm
                }
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg" />
              </button>
            </header>

            <div className="caregivers-modal__body">
              <CaregiverForm
                initialData={
                  editingCaregiver
                }
                onSubmit={
                  handleSaveCaregiver
                }
                onCancel={
                  closeForm
                }
              />
            </div>
          </div>
        </div>
      )}

      {invitationShare && (
        <div
          className="caregivers-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invitationShareTitle"
        >
          <button
            type="button"
            className="caregivers-modal__backdrop"
            onClick={() =>
              setInvitationShare(
                null,
              )
            }
            aria-label="Cerrar invitación"
          />

          <div className="caregivers-modal__container caregivers-modal__container--invitation">
            <header className="caregivers-modal__header">
              <div>
                <span>
                  Acceso compartido
                </span>

                <h2 id="invitationShareTitle">
                  Invitación generada
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setInvitationShare(
                    null,
                  )
                }
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg" />
              </button>
            </header>

            <div className="caregivers-modal__body">
              <section className="caregiver-invitation">
                <span className="caregiver-invitation__icon">
                  <i className="bi bi-envelope-check" />
                </span>

                <h3>
                  Invitá a{' '}
                  {
                    invitationShare.caregiverName
                  }
                </h3>

                <p>
                  Compartí este enlace con{' '}
                  <strong>
                    {
                      invitationShare.email
                    }
                  </strong>
                  . La persona podrá crear su
                  contraseña y entrar a la misma
                  familia.
                </p>

                <div className="caregiver-invitation__link">
                  <input
                    type="text"
                    value={
                      invitationShare.url
                    }
                    readOnly
                    aria-label="Enlace de invitación"
                  />

                  <button
                    type="button"
                    onClick={
                      handleCopyLink
                    }
                  >
                    <i className="bi bi-copy" />
                    Copiar
                  </button>
                </div>

                <div className="caregiver-invitation__expiration">
                  <i className="bi bi-clock-history" />

                  <span>
                    Vence el{' '}
                    <strong>
                      {formatInvitationDate(
                        invitationShare.expiresAt,
                      )}
                    </strong>
                  </span>
                </div>

              </section>
            </div>

            <footer className="caregivers-modal__footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() =>
                  setInvitationShare(
                    null,
                  )
                }
              >
                Cerrar
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={
                  handleShareInvitation
                }
              >
                <i className="bi bi-share" />
                Compartir invitación
              </button>
            </footer>
          </div>
        </div>
      )}

      {selectedCaregiver && (
        <div
          className="caregivers-modal"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="caregivers-modal__backdrop"
            onClick={() =>
              setSelectedCaregiver(
                null,
              )
            }
            aria-label="Cerrar historial"
          />

          <div className="caregivers-modal__container">
            <header className="caregivers-modal__header">
              <div>
                <span>
                  Historial familiar
                </span>

                <h2>
                  {
                    selectedCaregiver.fullName
                  }
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedCaregiver(
                    null,
                  )
                }
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg" />
              </button>
            </header>

            <div className="caregivers-modal__body">
              <section className="caregiver-detail__hero">
                <span>
                  {selectedCaregiver.fullName
                    .split(' ')
                    .map(
                      (part) =>
                        part[0],
                    )
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()}
                </span>

                <div>
                  <small>
                    {getRelationshipLabel(
                      selectedCaregiver.relationship,
                    )}
                  </small>

                  <h3>
                    {
                      selectedCaregiver.fullName
                    }
                  </h3>

                  <p>
                    {selectedCaregiver.isPrimary
                      ? 'Responsable principal'
                      : 'Responsable familiar'}
                  </p>
                </div>
              </section>

              <section className="caregiver-detail__statistics">
                <article>
                  <strong>
                    {
                      caregiverStatsMap[
                        selectedCaregiver
                          .id
                      ].administered
                    }
                  </strong>

                  <span>
                    Administradas
                  </span>
                </article>

                <article>
                  <strong>
                    {
                      caregiverStatsMap[
                        selectedCaregiver
                          .id
                      ].omitted
                    }
                  </strong>

                  <span>
                    Omitidas
                  </span>
                </article>

                <article>
                  <strong>
                    {
                      caregiverStatsMap[
                        selectedCaregiver
                          .id
                      ].total
                    }
                  </strong>

                  <span>
                    Total de acciones
                  </span>
                </article>
              </section>

              <section className="caregiver-detail__section">
                <h4>
                  <i className="bi bi-person-lock" />
                  Acceso al sistema
                </h4>

                <div className="caregiver-detail__access">
                  <strong>
                    {selectedCaregiver.role ===
                      'owner' ||
                    selectedCaregiver.invitationStatus ===
                      'active'
                      ? 'Acceso habilitado'
                      : selectedCaregiver.invitationStatus ===
                          'pending'
                        ? 'Invitación pendiente'
                        : selectedCaregiver.invitationStatus ===
                            'expired'
                          ? 'Invitación vencida'
                          : 'Sin acceso'}
                  </strong>

                  <span>
                    {selectedCaregiver.email ||
                      'No hay correo registrado'}
                  </span>
                </div>
              </section>

              <section className="caregiver-detail__section">
                <h4>
                  <i className="bi bi-clock-history" />
                  Actividad registrada
                </h4>

                {selectedHistory.length >
                0 ? (
                  <div className="caregiver-history">
                    {selectedHistory.map(
                      (record) => (
                        <article
                          key={
                            record.id
                          }
                        >
                          <span
                            className={`caregiver-history__icon caregiver-history__icon--${record.status}`}
                          >
                            <i
                              className={`bi ${
                                record.status ===
                                'administered'
                                  ? 'bi-check-lg'
                                  : 'bi-x-lg'
                              }`}
                            />
                          </span>

                          <div>
                            <strong>
                              {record.status ===
                              'administered'
                                ? 'Toma administrada'
                                : 'Toma omitida'}
                            </strong>

                            <p>
                              {record.notes ||
                                'Sin observaciones'}
                            </p>

                            <small>
                              {formatCaregiverDateTime(
                                record.completedAt ??
                                  record.updatedAt,
                              )}
                            </small>
                          </div>
                        </article>
                      ),
                    )}
                  </div>
                ) : (
                  <div className="caregiver-history__empty">
                    <i className="bi bi-clock-history" />

                    <p>
                      Este responsable todavía no
                      tiene acciones registradas.
                    </p>
                  </div>
                )}
              </section>
            </div>

            <footer className="caregivers-modal__footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() =>
                  setSelectedCaregiver(
                    null,
                  )
                }
              >
                Cerrar
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  openEditForm(
                    selectedCaregiver,
                  )
                }
              >
                <i className="bi bi-pencil" />
                Editar responsable
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default CaregiversPage;