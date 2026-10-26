import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  createPromotion,
  deletePromotion,
  getAdminCommercialSettings,
  setPromotionActive,
  updatePromotion,
  updateSubscriptionPlan,
  updateChildLimitSettings,
} from '../../services/commercialSettingsService.js';

const currencyFormatter =
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  });

const dateFormatter =
  new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

function toDateTimeLocal(
  dateValue,
) {
  if (!dateValue) {
    return '';
  }

  const date = new Date(dateValue);

  if (
    Number.isNaN(date.getTime())
  ) {
    return '';
  }

  const offset =
    date.getTimezoneOffset() *
    60_000;

  return new Date(
    date.getTime() - offset,
  )
    .toISOString()
    .slice(0, 16);
}

function getDefaultPromotionForm() {
  return {
    name: '',
    description: '',
    planId: 'all',
    type: 'fixed_price',
    value: '',
    startsAt: toDateTimeLocal(
      new Date(),
    ),
    endsAt: '',
    isActive: true,
    priority: 0,
  };
}

function getPromotionStatus(
  promotion,
) {
  if (!promotion.isActive) {
    return {
      label: 'Pausada',
      className: 'paused',
    };
  }

  const now = Date.now();
  const startsAt = new Date(
    promotion.startsAt,
  ).getTime();

  const endsAt = promotion.endsAt
    ? new Date(
        promotion.endsAt,
      ).getTime()
    : null;

  if (startsAt > now) {
    return {
      label: 'Programada',
      className: 'scheduled',
    };
  }

  if (
    endsAt &&
    endsAt <= now
  ) {
    return {
      label: 'Finalizada',
      className: 'expired',
    };
  }

  return {
    label: 'Activa',
    className: 'active',
  };
}

function formatPromotionValue(
  promotion,
) {
  if (
    promotion.type ===
    'percentage'
  ) {
    return `${promotion.value}% de descuento`;
  }

  if (
    promotion.type ===
    'fixed_discount'
  ) {
    return `${currencyFormatter.format(
      promotion.value,
    )} de descuento`;
  }

  return `Precio final ${currencyFormatter.format(
    promotion.value,
  )}`;
}

function CommercialSettingsPanel({
  onPlansChange,
  onChildSettingsChange,
}) {
  const [plans, setPlans] =
    useState([]);

  const [promotions, setPromotions] =
    useState([]);

  const [priceForm, setPriceForm] =
    useState({
      monthly: '',
      annual: '',
      monthlyActive: true,
      annualActive: true,
    });

  const [childSettingsForm, setChildSettingsForm] =
    useState({
      baseChildrenLimit: 3,
      extraChildPrice: 5000,
    });

  const [contactForm, setContactForm] =
    useState({
      supportWhatsapp: '',
    });

  const [promotionForm, setPromotionForm] =
    useState(
      getDefaultPromotionForm,
    );

  const [editingPromotionId, setEditingPromotionId] =
    useState('');

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSavingPrices, setIsSavingPrices] =
    useState(false);

  const [isSavingChildSettings, setIsSavingChildSettings] =
    useState(false);

  const [isSavingContact, setIsSavingContact] =
    useState(false);

  const [isSavingPromotion, setIsSavingPromotion] =
    useState(false);

  const [feedback, setFeedback] =
    useState(null);

  const planById = useMemo(
    () =>
      new Map(
        plans.map((plan) => [
          plan.id,
          plan,
        ]),
      ),
    [plans],
  );

  const loadSettings =
    useCallback(async () => {
      setIsLoading(true);

      try {
        const settings =
          await getAdminCommercialSettings();

        setPlans(settings.plans);
        setPromotions(
          settings.promotions,
        );

        setPriceForm({
          monthly:
            settings.plans.find(
              (plan) =>
                plan.id === 'monthly',
            )?.baseAmount ?? '',
          annual:
            settings.plans.find(
              (plan) =>
                plan.id === 'annual',
            )?.baseAmount ?? '',
          monthlyActive:
            settings.plans.find(
              (plan) =>
                plan.id === 'monthly',
            )?.isActive !== false,
          annualActive:
            settings.plans.find(
              (plan) =>
                plan.id === 'annual',
            )?.isActive !== false,
        });

        setChildSettingsForm({
          baseChildrenLimit:
            settings.childSettings
              ?.baseChildrenLimit ?? 3,
          extraChildPrice:
            settings.childSettings
              ?.extraChildPrice ?? 5000,
        });

        setContactForm({
          supportWhatsapp:
            settings.contactSettings
              ?.supportWhatsapp ?? '',
        });

        onChildSettingsChange?.(
          settings.childSettings || {
            baseChildrenLimit: 3,
            extraChildPrice: 5000,
          },
        );

        onPlansChange?.(
          Object.fromEntries(
            settings.offers.map(
              (plan) => [
                plan.id,
                plan,
              ],
            ),
          ),
        );
      } catch (error) {
        setFeedback({
          type: 'error',
          message:
            error.message ||
            'No se pudo cargar la configuración comercial.',
        });
      } finally {
        setIsLoading(false);
      }
    }, [
      onPlansChange,
      onChildSettingsChange,
    ]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  function handlePriceChange(
    event,
  ) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setPriceForm(
      (currentForm) => ({
        ...currentForm,
        [name]:
          type === 'checkbox'
            ? checked
            : value,
      }),
    );
  }

  async function handleSavePrices(
    event,
  ) {
    event.preventDefault();
    setIsSavingPrices(true);
    setFeedback(null);

    try {
      await Promise.all([
        updateSubscriptionPlan(
          'monthly',
          {
            price: Number(
              priceForm.monthly,
            ),
            isActive:
              priceForm.monthlyActive,
          },
        ),
        updateSubscriptionPlan(
          'annual',
          {
            price: Number(
              priceForm.annual,
            ),
            isActive:
              priceForm.annualActive,
          },
        ),
      ]);

      await loadSettings();

      setFeedback({
        type: 'success',
        message:
          'Los precios se actualizaron correctamente.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error.message ||
          'No se pudieron guardar los precios.',
      });
    } finally {
      setIsSavingPrices(false);
    }
  }

  function handleChildSettingsChange(
    event,
  ) {
    const { name, value } =
      event.target;

    setChildSettingsForm(
      (currentForm) => ({
        ...currentForm,
        [name]: value,
      }),
    );
  }

  async function handleSaveChildSettings(
    event,
  ) {
    event.preventDefault();
    setIsSavingChildSettings(true);
    setFeedback(null);

    try {
      const updatedSettings =
        await updateChildLimitSettings({
          baseChildrenLimit:
            childSettingsForm.baseChildrenLimit,
          extraChildPrice:
            childSettingsForm.extraChildPrice,
        });

      setChildSettingsForm({
        baseChildrenLimit:
          updatedSettings.baseChildrenLimit,
        extraChildPrice:
          updatedSettings.extraChildPrice,
      });

      onChildSettingsChange?.(
        updatedSettings,
      );

      setFeedback({
        type: 'success',
        message:
          'El límite de hijos y el valor de los cupos extra se actualizaron correctamente.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error.message ||
          'No se pudo guardar la configuración de hijos.',
      });
    } finally {
      setIsSavingChildSettings(false);
    }
  }

  function handleContactChange(event) {
    const { name, value } =
      event.target;

    setContactForm(
      (currentForm) => ({
        ...currentForm,
        [name]: value,
      }),
    );
  }

  async function handleSaveContact(event) {
    event.preventDefault();
    setIsSavingContact(true);
    setFeedback(null);

    try {
      const updatedContact =
        await updateCommercialContactSettings({
          supportWhatsapp:
            contactForm.supportWhatsapp,
        });

      setContactForm({
        supportWhatsapp:
          updatedContact.supportWhatsapp,
      });

      setFeedback({
        type: 'success',
        message:
          'El contacto de WhatsApp se actualizó correctamente.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error.message ||
          'No se pudo guardar el contacto.',
      });
    } finally {
      setIsSavingContact(false);
    }
  }

  function handlePromotionChange(
    event,
  ) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setPromotionForm(
      (currentForm) => ({
        ...currentForm,
        [name]:
          type === 'checkbox'
            ? checked
            : value,
      }),
    );
  }

  function resetPromotionForm() {
    setEditingPromotionId('');
    setPromotionForm(
      getDefaultPromotionForm(),
    );
  }

  function handleEditPromotion(
    promotion,
  ) {
    setEditingPromotionId(
      promotion.id,
    );

    setPromotionForm({
      name: promotion.name,
      description:
        promotion.description,
      planId: promotion.planId,
      type: promotion.type,
      value: promotion.value,
      startsAt: toDateTimeLocal(
        promotion.startsAt,
      ),
      endsAt: toDateTimeLocal(
        promotion.endsAt,
      ),
      isActive:
        promotion.isActive,
      priority:
        promotion.priority,
    });

    document
      .getElementById(
        'promotionFormTitle',
      )
      ?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
  }

  async function handleSavePromotion(
    event,
  ) {
    event.preventDefault();
    setIsSavingPromotion(true);
    setFeedback(null);

    try {
      if (editingPromotionId) {
        await updatePromotion(
          editingPromotionId,
          promotionForm,
        );
      } else {
        await createPromotion(
          promotionForm,
        );
      }

      resetPromotionForm();
      await loadSettings();

      setFeedback({
        type: 'success',
        message: editingPromotionId
          ? 'La promoción se actualizó correctamente.'
          : 'La promoción se creó correctamente.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error.message ||
          'No se pudo guardar la promoción.',
      });
    } finally {
      setIsSavingPromotion(false);
    }
  }

  async function handleTogglePromotion(
    promotion,
  ) {
    try {
      await setPromotionActive(
        promotion.id,
        !promotion.isActive,
      );

      await loadSettings();
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error.message ||
          'No se pudo cambiar el estado de la promoción.',
      });
    }
  }

  async function handleDeletePromotion(
    promotion,
  ) {
    const confirmed = window.confirm(
      `¿Eliminar la promoción “${promotion.name}”?`,
    );

    if (!confirmed) {
      return;
    }

    try {
      await deletePromotion(
        promotion.id,
      );

      if (
        editingPromotionId ===
        promotion.id
      ) {
        resetPromotionForm();
      }

      await loadSettings();

      setFeedback({
        type: 'success',
        message:
          'La promoción fue eliminada.',
      });
    } catch (error) {
      setFeedback({
        type: 'error',
        message:
          error.message ||
          'No se pudo eliminar la promoción.',
      });
    }
  }

  if (isLoading) {
    return (
      <section className="admin-dashboard__panel commercial-panel">
        <div className="commercial-loading">
          <span className="spinner-border spinner-border-sm" />
          Cargando precios y promociones...
        </div>
      </section>
    );
  }

  return (
    <section className="admin-dashboard__panel commercial-panel">
      <header className="admin-panel-header">
        <div>
          <span>
            Configuración comercial
          </span>

          <h2>
            Precios, cupos y promociones
          </h2>

          <p>
            Administrá los precios de los planes, el cupo de hijos por familia y las promociones disponibles.
          </p>
        </div>

        <i className="bi bi-tags commercial-panel__header-icon" />
      </header>

      {feedback && (
        <div className={`commercial-feedback commercial-feedback--${feedback.type}`}>
          <i
            className={`bi ${
              feedback.type === 'success'
                ? 'bi-check-circle'
                : 'bi-exclamation-circle'
            }`}
          />
          {feedback.message}
        </div>
      )}

      <form
        className="commercial-prices"
        onSubmit={handleSavePrices}
      >
        {[
          {
            id: 'monthly',
            priceName: 'monthly',
            activeName: 'monthlyActive',
            title: 'Plan mensual',
            icon: 'bi-calendar-month',
          },
          {
            id: 'annual',
            priceName: 'annual',
            activeName: 'annualActive',
            title: 'Plan anual',
            icon: 'bi-calendar2-check',
          },
        ].map((planItem) => {
          const plan =
            planById.get(
              planItem.id,
            );

          return (
            <article
              key={planItem.id}
              className="commercial-price-card"
            >
              <header>
                <span>
                  <i className={`bi ${planItem.icon}`} />
                </span>

                <div>
                  <small>
                    Precio normal
                  </small>
                  <strong>
                    {planItem.title}
                  </strong>
                </div>
              </header>

              <label>
                Precio en pesos
                <input
                  type="number"
                  name={planItem.priceName}
                  min="1"
                  step="1"
                  value={
                    priceForm[
                      planItem.priceName
                    ]
                  }
                  onChange={handlePriceChange}
                  required
                />
              </label>

              {plan?.promotionName && (
                <div className="commercial-price-card__promotion">
                  <i className="bi bi-stars" />
                  <span>
                    <small>
                      Promoción vigente
                    </small>
                    <strong>
                      {currencyFormatter.format(
                        plan.amount,
                      )}
                    </strong>
                  </span>
                </div>
              )}

              <label className="commercial-switch">
                <input
                  type="checkbox"
                  name={planItem.activeName}
                  checked={
                    priceForm[
                      planItem.activeName
                    ]
                  }
                  onChange={handlePriceChange}
                />
                <span />
                Plan disponible
              </label>
            </article>
          );
        })}

        <button
          type="submit"
          className="btn btn-primary commercial-prices__save"
          disabled={isSavingPrices}
        >
          <i className="bi bi-floppy" />
          {isSavingPrices
            ? 'Guardando...'
            : 'Guardar precios'}
        </button>
      </form>

      <div className="commercial-divider" />

      <form
        className="commercial-child-settings"
        onSubmit={handleSaveContact}
      >
        <header className="commercial-child-settings__header">
          <span>
            <i className="bi bi-whatsapp" />
          </span>

          <div>
            <small>Contacto comercial</small>
            <h3>WhatsApp de MiPeque</h3>
            <p>
              Este número se usa para soporte y para
              que las familias contacten por pagos.
            </p>
          </div>
        </header>

        <div className="commercial-child-settings__grid">
          <label>
            Número con código de país
            <input
              type="tel"
              name="supportWhatsapp"
              value={contactForm.supportWhatsapp}
              onChange={handleContactChange}
              placeholder="549381..."
              inputMode="numeric"
            />
            <small>
              Escribilo solo con números, sin +, espacios ni guiones.
            </small>
          </label>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSavingContact}
        >
          <i className="bi bi-floppy" />
          {isSavingContact
            ? 'Guardando...'
            : 'Guardar WhatsApp'}
        </button>
      </form>

      <div className="commercial-divider" />

      <form
        className="commercial-child-settings"
        onSubmit={handleSaveChildSettings}
      >
        <header className="commercial-child-settings__header">
          <span>
            <i className="bi bi-people" />
          </span>

          <div>
            <small>Perfiles infantiles</small>
            <h3>Límite de hijos por familia</h3>
            <p>
              Definí cuántos hijos incluye cada familia y el valor de referencia de cada cupo adicional.
            </p>
          </div>
        </header>

        <div className="commercial-child-settings__grid">
          <label>
            Hijos incluidos por familia
            <input
              type="number"
              name="baseChildrenLimit"
              min="1"
              max="20"
              step="1"
              value={childSettingsForm.baseChildrenLimit}
              onChange={handleChildSettingsChange}
              required
            />
            <small>
              Este será el límite normal para todas las familias.
            </small>
          </label>

          <label>
            Precio por hijo extra
            <div className="commercial-child-settings__money">
              <span>$</span>
              <input
                type="number"
                name="extraChildPrice"
                min="0"
                step="1"
                value={childSettingsForm.extraChildPrice}
                onChange={handleChildSettingsChange}
                required
              />
            </div>
            <small>
              Valor de referencia para habilitar cada cupo adicional.
            </small>
          </label>
        </div>

        <div className="commercial-child-settings__summary">
          <i className="bi bi-info-circle" />
          <span>
            Cada familia incluye hasta{' '}
            <strong>{childSettingsForm.baseChildrenLimit || 3}</strong>{' '}
            hijos. Cada cupo extra tendrá un valor de{' '}
            <strong>
              {currencyFormatter.format(
                Number(childSettingsForm.extraChildPrice || 0),
              )}
            </strong>.
          </span>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={isSavingChildSettings}
        >
          <i className="bi bi-floppy" />
          {isSavingChildSettings
            ? 'Guardando...'
            : 'Guardar límite de hijos'}
        </button>
      </form>

      <div className="commercial-divider" />

      <div className="commercial-promotions-layout">
        <form
          className="commercial-promotion-form"
          onSubmit={handleSavePromotion}
        >
          <header>
            <span>
              <i className="bi bi-megaphone" />
            </span>

            <div>
              <small>
                {editingPromotionId
                  ? 'Editar promoción'
                  : 'Nueva promoción'}
              </small>

              <h3 id="promotionFormTitle">
                {editingPromotionId
                  ? 'Modificar promoción'
                  : 'Crear una promoción'}
              </h3>
            </div>
          </header>

          <label>
            Nombre
            <input
              type="text"
              name="name"
              value={promotionForm.name}
              onChange={handlePromotionChange}
              placeholder="Ej. Lanzamiento"
              required
            />
          </label>

          <label>
            Descripción
            <textarea
              name="description"
              value={promotionForm.description}
              onChange={handlePromotionChange}
              rows="3"
              placeholder="Texto breve que verá el cliente"
            />
          </label>

          <div className="commercial-form-grid">
            <label>
              Aplicar a
              <select
                name="planId"
                value={promotionForm.planId}
                onChange={handlePromotionChange}
              >
                <option value="all">
                  Ambos planes
                </option>
                <option value="monthly">
                  Plan mensual
                </option>
                <option value="annual">
                  Plan anual
                </option>
              </select>
            </label>

            <label>
              Tipo
              <select
                name="type"
                value={promotionForm.type}
                onChange={handlePromotionChange}
              >
                <option value="fixed_price">
                  Precio promocional
                </option>
                <option value="percentage">
                  Porcentaje de descuento
                </option>
                <option value="fixed_discount">
                  Descuento fijo
                </option>
              </select>
            </label>
          </div>

          <div className="commercial-form-grid">
            <label>
              {promotionForm.type ===
              'percentage'
                ? 'Porcentaje'
                : 'Monto en pesos'}
              <input
                type="number"
                name="value"
                min="1"
                step="1"
                max={
                  promotionForm.type ===
                  'percentage'
                    ? '100'
                    : undefined
                }
                value={promotionForm.value}
                onChange={handlePromotionChange}
                required
              />
            </label>

            <label>
              Prioridad
              <input
                type="number"
                name="priority"
                min="0"
                step="1"
                value={promotionForm.priority}
                onChange={handlePromotionChange}
              />
            </label>
          </div>

          <div className="commercial-form-grid">
            <label>
              Inicio
              <input
                type="datetime-local"
                name="startsAt"
                value={promotionForm.startsAt}
                onChange={handlePromotionChange}
                required
              />
            </label>

            <label>
              Finalización opcional
              <input
                type="datetime-local"
                name="endsAt"
                value={promotionForm.endsAt}
                onChange={handlePromotionChange}
              />
            </label>
          </div>

          <label className="commercial-switch">
            <input
              type="checkbox"
              name="isActive"
              checked={promotionForm.isActive}
              onChange={handlePromotionChange}
            />
            <span />
            Promoción habilitada
          </label>

          <div className="commercial-promotion-form__actions">
            {editingPromotionId && (
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={resetPromotionForm}
              >
                Cancelar edición
              </button>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSavingPromotion}
            >
              <i className="bi bi-check2-circle" />
              {isSavingPromotion
                ? 'Guardando...'
                : editingPromotionId
                  ? 'Guardar cambios'
                  : 'Crear promoción'}
            </button>
          </div>
        </form>

        <section className="commercial-promotions-list">
          <header>
            <div>
              <small>
                Promociones guardadas
              </small>
              <h3>
                Historial y estado
              </h3>
            </div>

            <strong>
              {promotions.length}
            </strong>
          </header>

          {promotions.length > 0 ? (
            <div className="commercial-promotions-list__items">
              {promotions.map(
                (promotion) => {
                  const status =
                    getPromotionStatus(
                      promotion,
                    );

                  return (
                    <article
                      key={promotion.id}
                      className="commercial-promotion-card"
                    >
                      <header>
                        <div>
                          <span className={`commercial-promotion-status commercial-promotion-status--${status.className}`}>
                            {status.label}
                          </span>

                          <h4>
                            {promotion.name}
                          </h4>
                        </div>

                        <strong>
                          {formatPromotionValue(
                            promotion,
                          )}
                        </strong>
                      </header>

                      <p>
                        {promotion.description ||
                          'Sin descripción.'}
                      </p>

                      <dl>
                        <div>
                          <dt>Plan</dt>
                          <dd>
                            {promotion.planId ===
                            'all'
                              ? 'Ambos'
                              : promotion.planId ===
                                  'monthly'
                                ? 'Mensual'
                                : 'Anual'}
                          </dd>
                        </div>

                        <div>
                          <dt>Desde</dt>
                          <dd>
                            {dateFormatter.format(
                              new Date(
                                promotion.startsAt,
                              ),
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt>Hasta</dt>
                          <dd>
                            {promotion.endsAt
                              ? dateFormatter.format(
                                  new Date(
                                    promotion.endsAt,
                                  ),
                                )
                              : 'Sin fecha'}
                          </dd>
                        </div>
                      </dl>

                      <footer>
                        <button
                          type="button"
                          onClick={() =>
                            handleEditPromotion(
                              promotion,
                            )
                          }
                        >
                          <i className="bi bi-pencil" />
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            handleTogglePromotion(
                              promotion,
                            )
                          }
                        >
                          <i className={`bi ${promotion.isActive ? 'bi-pause-circle' : 'bi-play-circle'}`} />
                          {promotion.isActive
                            ? 'Pausar'
                            : 'Activar'}
                        </button>

                        <button
                          type="button"
                          className="is-danger"
                          onClick={() =>
                            handleDeletePromotion(
                              promotion,
                            )
                          }
                        >
                          <i className="bi bi-trash" />
                          Eliminar
                        </button>
                      </footer>
                    </article>
                  );
                },
              )}
            </div>
          ) : (
            <div className="commercial-empty">
              <i className="bi bi-tags" />
              <p>
                Todavía no creaste promociones.
              </p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

export default CommercialSettingsPanel;
