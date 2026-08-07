import {
  useEffect,
  useRef,
  useState,
} from 'react';

import { getChildren } from '../../services/childrenService.js';
import { getConsultations } from '../../services/consultationsService.js';
import { getDocuments } from '../../services/documentsService.js';
import { getTreatments } from '../../services/treatmentsService.js';
import { getVaccines } from '../../services/vaccinesService.js';

import {
  getReminderRecords,
} from '../../services/remindersService.js';

import {
  getMedicineCabinetItems,
} from '../../services/medicineCabinetService.js';

import {
  getActiveCaregiverId,
  getCaregivers,
  setActiveCaregiverId,
} from '../../services/caregiversService.js';

import {
  clearAllFamilyData,
  downloadFamilyBackup,
  getFamilySettings,
  importFamilyBackup,
  resetFamilySettings,
  saveFamilySettings,
} from '../../services/familySettingsService.js';

import {
  DEFAULT_PUSH_PREFERENCES,
  disablePushNotifications,
  enablePushNotifications,
  getPushNotificationState,
  savePushNotificationPreferences,
  sendTestPushNotification,
} from '../../services/pushNotificationsService.js';

import '../../styles/settings.css';

function getInitialSettings() {
  const settings = getFamilySettings();

  return {
    ...settings,
    defaultCaregiverId:
      settings.defaultCaregiverId ||
      getActiveCaregiverId(),
  };
}

function SettingsPage() {
  const importInputRef = useRef(null);

  const [caregivers] = useState(() =>
    getCaregivers(),
  );

  const [settings, setSettings] =
    useState(getInitialSettings);

  const [message, setMessage] =
    useState(null);

  const [isExporting, setIsExporting] =
    useState(false);

  const [isImporting, setIsImporting] =
    useState(false);

  const [isDeleting, setIsDeleting] =
    useState(false);

  const [pushState, setPushState] =
    useState({
      loading: true,
      supported: false,
      subscribed: false,
      permission: 'default',
      iosNeedsInstall: false,
      apiSupported: true,
      vapidConfigured: true,
      secureContext: true,
      preferences: {
        ...DEFAULT_PUSH_PREFERENCES,
      },
    });

  const [pushPreferences, setPushPreferences] =
    useState({
      ...DEFAULT_PUSH_PREFERENCES,
    });

  const [isUpdatingPush, setIsUpdatingPush] =
    useState(false);

  const [isTestingPush, setIsTestingPush] =
    useState(false);

  const [dataCounts] = useState(() => ({
    children: getChildren().length,
    consultations:
      getConsultations().length,
    treatments: getTreatments().length,
    reminders:
      getReminderRecords().length,
    cabinet:
      getMedicineCabinetItems().length,
    vaccines: getVaccines().length,
    documents: getDocuments().length,
    caregivers: getCaregivers().length,
  }));

  useEffect(() => {
    let isMounted = true;

    async function loadPushState() {
      try {
        const state =
          await getPushNotificationState();

        if (!isMounted) {
          return;
        }

        setPushState({
          loading: false,
          ...state,
        });

        setPushPreferences({
          ...DEFAULT_PUSH_PREFERENCES,
          ...state.preferences,
        });
      } catch (error) {
        console.error(
          'No se pudo cargar el estado de las notificaciones push.',
          error,
        );

        if (isMounted) {
          setPushState((currentState) => ({
            ...currentState,
            loading: false,
          }));
        }
      }
    }

    loadPushState();

    return () => {
      isMounted = false;
    };
  }, []);

  function showMessage(type, text) {
    setMessage({
      type,
      text,
    });

    window.setTimeout(() => {
      setMessage(null);
    }, 5000);
  }

  function handleChange(event) {
    const {
      name,
      value,
      type,
      checked,
    } = event.target;

    setSettings((currentSettings) => ({
      ...currentSettings,
      [name]:
        type === 'checkbox'
          ? checked
          : type === 'number'
            ? Number(value)
            : value,
    }));
  }

  function handleSave(event) {
    event.preventDefault();

    if (!settings.familyName.trim()) {
      showMessage(
        'error',
        'Ingresá un nombre para identificar a la familia.',
      );

      return;
    }

    if (settings.contactEmail.trim()) {
      const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailPattern.test(
          settings.contactEmail.trim(),
        )
      ) {
        showMessage(
          'error',
          'Ingresá un correo electrónico válido.',
        );

        return;
      }
    }

    if (
      settings.reminderAdvanceMinutes < 0 ||
      settings.reminderAdvanceMinutes > 1440
    ) {
      showMessage(
        'error',
        'El aviso previo debe estar entre 0 y 1440 minutos.',
      );

      return;
    }

    if (
      settings.expirationWarningDays < 1 ||
      settings.expirationWarningDays > 365
    ) {
      showMessage(
        'error',
        'El aviso de vencimiento debe estar entre 1 y 365 días.',
      );

      return;
    }

    const savedSettings =
      saveFamilySettings({
        ...settings,
        familyName:
          settings.familyName.trim(),
        contactName:
          settings.contactName.trim(),
        contactEmail:
          settings.contactEmail.trim(),
        phone: settings.phone.trim(),
      });

    setSettings(savedSettings);

    setActiveCaregiverId(
      savedSettings.defaultCaregiverId,
    );

    showMessage(
      'success',
      'La configuración familiar se guardó correctamente.',
    );
  }

  function handlePushPreferenceChange(event) {
    const { name, checked } = event.target;

    setPushPreferences((currentPreferences) => ({
      ...currentPreferences,
      [name]: checked,
    }));
  }

  async function refreshPushState() {
    const state =
      await getPushNotificationState();

    setPushState({
      loading: false,
      ...state,
    });

    setPushPreferences({
      ...DEFAULT_PUSH_PREFERENCES,
      ...state.preferences,
    });

    return state;
  }

  async function handleEnablePush() {
    setIsUpdatingPush(true);

    try {
      await enablePushNotifications(
        pushPreferences,
      );

      await refreshPushState();

      showMessage(
        'success',
        'Las notificaciones quedaron activadas en este dispositivo.',
      );
    } catch (error) {
      showMessage(
        'error',
        error.message ||
          'No se pudieron activar las notificaciones.',
      );
    } finally {
      setIsUpdatingPush(false);
    }
  }

  async function handleSavePushPreferences() {
    setIsUpdatingPush(true);

    try {
      await savePushNotificationPreferences(
        pushPreferences,
      );

      await refreshPushState();

      showMessage(
        'success',
        'Las preferencias de notificaciones se guardaron correctamente.',
      );
    } catch (error) {
      showMessage(
        'error',
        error.message ||
          'No se pudieron guardar las preferencias de notificaciones.',
      );
    } finally {
      setIsUpdatingPush(false);
    }
  }

  async function handleDisablePush() {
    const confirmed = window.confirm(
      '¿Querés dejar de recibir notificaciones de MiPeque en este dispositivo?',
    );

    if (!confirmed) {
      return;
    }

    setIsUpdatingPush(true);

    try {
      await disablePushNotifications();
      await refreshPushState();

      showMessage(
        'success',
        'Las notificaciones se desactivaron en este dispositivo.',
      );
    } catch (error) {
      showMessage(
        'error',
        error.message ||
          'No se pudieron desactivar las notificaciones.',
      );
    } finally {
      setIsUpdatingPush(false);
    }
  }

  async function handleTestPush() {
    setIsTestingPush(true);

    try {
      await sendTestPushNotification();

      showMessage(
        'success',
        'La notificación de prueba fue enviada. Puede tardar unos segundos en aparecer.',
      );
    } catch (error) {
      showMessage(
        'error',
        error.message ||
          'No se pudo enviar la notificación de prueba.',
      );
    } finally {
      setIsTestingPush(false);
    }
  }

  function handleResetSettings() {
    const confirmed = window.confirm(
      '¿Querés restablecer únicamente las preferencias? Los hijos, tratamientos y demás registros no se eliminarán.',
    );

    if (!confirmed) {
      return;
    }

    const resetSettings =
      resetFamilySettings();

    setSettings(resetSettings);

    setActiveCaregiverId('');

    showMessage(
      'success',
      'Las preferencias fueron restablecidas.',
    );
  }

  async function handleExportBackup() {
    setIsExporting(true);

    try {
      await downloadFamilyBackup();

      showMessage(
        'success',
        'La copia de seguridad se descargó correctamente.',
      );
    } catch (error) {
      showMessage(
        'error',
        error.message ||
          'No se pudo crear la copia de seguridad.',
      );
    } finally {
      setIsExporting(false);
    }
  }

  function openImportSelector() {
    importInputRef.current?.click();
  }

  async function handleImportBackup(event) {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    const normalizedFileName =
      file.name.toLowerCase();

    const isSupportedBackup =
      normalizedFileName.endsWith(
        '.html',
      ) ||
      normalizedFileName.endsWith(
        '.json',
      ) ||
      normalizedFileName.endsWith(
        '.mipeque',
      );

    if (!isSupportedBackup) {
      showMessage(
        'error',
        'Seleccioná una copia de seguridad de MiPeque.',
      );

      return;
    }

    const confirmed = window.confirm(
      'La copia de seguridad reemplazará los registros que tengan las mismas claves. ¿Querés continuar?',
    );

    if (!confirmed) {
      return;
    }

    setIsImporting(true);

    try {
      const content = await file.text();

      const restoredItems =
        await importFamilyBackup(
          content,
        );

      window.alert(
        `La copia se restauró correctamente. Se recuperaron ${restoredItems} grupos de datos y se guardaron en Supabase.`,
      );

      window.location.reload();
    } catch (error) {
      showMessage(
        'error',
        error.message ||
          'No se pudo importar la copia de seguridad.',
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function handleDeleteAllData() {
    const firstConfirmation =
      window.confirm(
        'Esta acción eliminará de MiPeque los hijos, consultas, tratamientos, tomas, vacunas, documentos y medicamentos del botiquín. La cuenta, la suscripción y los responsables se conservarán. ¿Querés continuar?',
      );

    if (!firstConfirmation) {
      return;
    }

    const confirmationText =
      window.prompt(
        'Escribí BORRAR para confirmar la eliminación definitiva.',
      );

    if (
      confirmationText?.trim().toUpperCase() !==
      'BORRAR'
    ) {
      showMessage(
        'error',
        'La eliminación fue cancelada.',
      );

      return;
    }

    setIsDeleting(true);

    try {
      const deletionResult =
        await clearAllFamilyData();

      const cleanupMessage =
        deletionResult.fileCleanupWarning
          ? `\n\nAviso: ${deletionResult.fileCleanupWarning}`
          : '';

      window.alert(
        `Los datos familiares fueron eliminados correctamente. La cuenta, la suscripción y los responsables se conservaron.${cleanupMessage}`,
      );

      window.location.reload();
    } catch (error) {
      showMessage(
        'error',
        error.message ||
          'No se pudieron eliminar los datos familiares.',
      );
    } finally {
      setIsDeleting(false);
    }
  }

  const activeCaregivers =
    caregivers.filter(
      (caregiver) => caregiver.isActive,
    );

  return (
    <div className="family-settings-page">
      <section className="family-settings-page__header">
        <div>
          <span>Preferencias del sistema</span>

          <h2>Configuración familiar</h2>

          <p>
            Personalizá el perfil familiar,
            responsable predeterminado, alertas y
            copias de seguridad.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
        >
          <i className="bi bi-check-lg" />
          Guardar cambios
        </button>
      </section>

      {message && (
        <div
          className={`family-settings-message family-settings-message--${message.type}`}
          role="alert"
        >
          <i
            className={`bi ${
              message.type === 'success'
                ? 'bi-check-circle'
                : 'bi-exclamation-circle'
            }`}
          />

          <span>{message.text}</span>
        </div>
      )}

      <form
        className="family-settings-form"
        onSubmit={handleSave}
      >
        <section className="family-settings-section">
          <header className="family-settings-section__header">
            <span>
              <i className="bi bi-house-heart" />
            </span>

            <div>
              <h3>Perfil familiar</h3>

              <p>
                Datos utilizados para identificar
                esta cuenta familiar.
              </p>
            </div>
          </header>

          <div className="family-settings-fields">
            <div className="family-settings-field">
              <label htmlFor="familyName">
                Nombre de la familia
              </label>

              <input
                type="text"
                id="familyName"
                name="familyName"
                className="form-control"
                value={settings.familyName}
                onChange={handleChange}
                placeholder="Ejemplo: Familia García"
              />
            </div>

            <div className="family-settings-field">
              <label htmlFor="contactName">
                Persona de contacto
              </label>

              <input
                type="text"
                id="contactName"
                name="contactName"
                className="form-control"
                value={settings.contactName}
                onChange={handleChange}
                placeholder="Nombre completo"
              />
            </div>

            <div className="family-settings-field">
              <label htmlFor="contactEmail">
                Correo electrónico
              </label>

              <input
                type="email"
                id="contactEmail"
                name="contactEmail"
                className="form-control"
                value={
                  settings.contactEmail
                }
                onChange={handleChange}
                placeholder="familia@ejemplo.com"
              />
            </div>

            <div className="family-settings-field">
              <label htmlFor="familyPhone">
                Teléfono
              </label>

              <input
                type="tel"
                id="familyPhone"
                name="phone"
                className="form-control"
                value={settings.phone}
                onChange={handleChange}
                placeholder="3815555555"
              />
            </div>
          </div>
        </section>

        <section className="family-settings-section">
          <header className="family-settings-section__header">
            <span>
              <i className="bi bi-person-check" />
            </span>

            <div>
              <h3>
                Responsable predeterminado
              </h3>

              <p>
                Será seleccionado automáticamente
                al registrar una toma.
              </p>
            </div>
          </header>

          <div className="family-settings-field">
            <label htmlFor="defaultCaregiver">
              Responsable activo
            </label>

            <select
              id="defaultCaregiver"
              name="defaultCaregiverId"
              className="form-select"
              value={
                settings.defaultCaregiverId
              }
              onChange={handleChange}
            >
              <option value="">
                Sin responsable predeterminado
              </option>

              {activeCaregivers.map(
                (caregiver) => (
                  <option
                    key={caregiver.id}
                    value={caregiver.id}
                  >
                    {caregiver.fullName}

                    {caregiver.isPrimary
                      ? ' — Principal'
                      : ''}
                  </option>
                ),
              )}
            </select>

            {activeCaregivers.length === 0 && (
              <small>
                Primero registrá un responsable
                familiar activo.
              </small>
            )}
          </div>
        </section>

        <section className="family-settings-section">
          <header className="family-settings-section__header">
            <span>
              <i className="bi bi-bell" />
            </span>

            <div>
              <h3>Preferencias de alertas</h3>

              <p>
                Configurá qué situaciones deben
                aparecer en el centro de alertas.
              </p>
            </div>
          </header>

          <div className="family-settings-fields">
            <div className="family-settings-field">
              <label htmlFor="reminderAdvanceMinutes">
                Aviso previo de las tomas
              </label>

              <div className="family-settings-field__unit">
                <input
                  type="number"
                  id="reminderAdvanceMinutes"
                  name="reminderAdvanceMinutes"
                  className="form-control"
                  value={
                    settings.reminderAdvanceMinutes
                  }
                  onChange={handleChange}
                  min="0"
                  max="1440"
                />

                <span>minutos</span>
              </div>
            </div>

            <div className="family-settings-field">
              <label htmlFor="expirationWarningDays">
                Avisar antes del vencimiento
              </label>

              <div className="family-settings-field__unit">
                <input
                  type="number"
                  id="expirationWarningDays"
                  name="expirationWarningDays"
                  className="form-control"
                  value={
                    settings.expirationWarningDays
                  }
                  onChange={handleChange}
                  min="1"
                  max="365"
                />

                <span>días</span>
              </div>
            </div>

            <div className="family-settings-field">
              <label htmlFor="vaccineWarningDays">
                Avisar antes de una vacuna
              </label>

              <div className="family-settings-field__unit">
                <input
                  type="number"
                  id="vaccineWarningDays"
                  name="vaccineWarningDays"
                  className="form-control"
                  value={
                    settings.vaccineWarningDays
                  }
                  onChange={handleChange}
                  min="1"
                  max="365"
                />

                <span>días</span>
              </div>
            </div>
          </div>

          <div className="family-settings-options">
            <label
              className={
                settings.showOverdueAlerts
                  ? 'is-selected'
                  : ''
              }
            >
              <input
                type="checkbox"
                name="showOverdueAlerts"
                checked={
                  settings.showOverdueAlerts
                }
                onChange={handleChange}
              />

              <i className="bi bi-clock-history" />

              <span>
                <strong>
                  Tomas atrasadas
                </strong>

                <small>
                  Mostrar recordatorios que ya
                  pasaron de hora.
                </small>
              </span>
            </label>

            <label
              className={
                settings.showStockAlerts
                  ? 'is-selected'
                  : ''
              }
            >
              <input
                type="checkbox"
                name="showStockAlerts"
                checked={
                  settings.showStockAlerts
                }
                onChange={handleChange}
              />

              <i className="bi bi-box-seam" />

              <span>
                <strong>Poco stock</strong>

                <small>
                  Mostrar medicamentos agotados o
                  con pocas unidades.
                </small>
              </span>
            </label>

            <label
              className={
                settings.showExpirationAlerts
                  ? 'is-selected'
                  : ''
              }
            >
              <input
                type="checkbox"
                name="showExpirationAlerts"
                checked={
                  settings.showExpirationAlerts
                }
                onChange={handleChange}
              />

              <i className="bi bi-calendar-x" />

              <span>
                <strong>Vencimientos</strong>

                <small>
                  Mostrar medicamentos vencidos o
                  próximos a vencer.
                </small>
              </span>
            </label>

            <label
              className={
                settings.showVaccineAlerts
                  ? 'is-selected'
                  : ''
              }
            >
              <input
                type="checkbox"
                name="showVaccineAlerts"
                checked={
                  settings.showVaccineAlerts
                }
                onChange={handleChange}
              />

              <i className="bi bi-shield-plus" />

              <span>
                <strong>Próximas vacunas</strong>

                <small>
                  Mostrar las fechas registradas
                  para futuras dosis.
                </small>
              </span>
            </label>
          </div>
        </section>

        <section className="family-settings-section family-settings-push">
          <header className="family-settings-section__header">
            <span>
              <i className="bi bi-phone-vibrate" />
            </span>

            <div>
              <h3>Notificaciones push</h3>

              <p>
                Recibí avisos aunque MiPeque esté cerrada.
                La activación se realiza por dispositivo.
              </p>
            </div>
          </header>

          <div className="family-settings-push__status">
            <span
              className={`family-settings-push__status-icon ${
                pushState.subscribed
                  ? 'is-active'
                  : ''
              }`}
            >
              <i
                className={`bi ${
                  pushState.subscribed
                    ? 'bi-bell-fill'
                    : 'bi-bell-slash'
                }`}
              />
            </span>

            <div>
              <strong>
                {pushState.loading
                  ? 'Revisando este dispositivo...'
                  : pushState.subscribed
                    ? 'Notificaciones activadas'
                    : 'Notificaciones desactivadas'}
              </strong>

              <p>
                {pushState.iosNeedsInstall
                  ? 'En iPhone o iPad, primero agregá MiPeque a la pantalla de inicio y abrila desde su ícono.'
                  : pushState.permission === 'denied'
                    ? 'El permiso está bloqueado desde la configuración del navegador o del sistema.'
                    : !pushState.secureContext
                      ? 'Las notificaciones push requieren HTTPS.'
                      : !pushState.apiSupported
                        ? 'Este navegador no admite notificaciones push.'
                        : !pushState.vapidConfigured
                          ? 'Falta configurar la clave pública VAPID del proyecto.'
                          : pushState.subscribed
                            ? 'Este dispositivo recibirá los avisos seleccionados abajo.'
                            : 'Activá las notificaciones para comenzar a recibir avisos en este dispositivo.'}
              </p>
            </div>

            {!pushState.subscribed && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleEnablePush}
                disabled={
                  pushState.loading ||
                  isUpdatingPush ||
                  pushState.permission === 'denied' ||
                  !pushState.supported
                }
              >
                <i className="bi bi-bell" />
                {isUpdatingPush
                  ? 'Activando...'
                  : 'Activar en este dispositivo'}
              </button>
            )}
          </div>

          <div className="family-settings-push__options">
            <label
              className={
                pushPreferences.notifyMedicationDue
                  ? 'is-selected'
                  : ''
              }
            >
              <input
                type="checkbox"
                name="notifyMedicationDue"
                checked={
                  pushPreferences.notifyMedicationDue
                }
                onChange={handlePushPreferenceChange}
              />

              <i className="bi bi-capsule-pill" />

              <span>
                <strong>Tomas programadas</strong>
                <small>
                  Avisar antes o al llegar la hora de una toma.
                </small>
              </span>
            </label>

            <label
              className={
                pushPreferences.notifyMedicationOverdue
                  ? 'is-selected'
                  : ''
              }
            >
              <input
                type="checkbox"
                name="notifyMedicationOverdue"
                checked={
                  pushPreferences.notifyMedicationOverdue
                }
                onChange={handlePushPreferenceChange}
              />

              <i className="bi bi-clock-history" />

              <span>
                <strong>Tomas atrasadas</strong>
                <small>
                  Avisar cuando una toma siga sin registrarse.
                </small>
              </span>
            </label>

            <label
              className={
                pushPreferences.notifyVaccines
                  ? 'is-selected'
                  : ''
              }
            >
              <input
                type="checkbox"
                name="notifyVaccines"
                checked={
                  pushPreferences.notifyVaccines
                }
                onChange={handlePushPreferenceChange}
              />

              <i className="bi bi-shield-plus" />

              <span>
                <strong>Vacunas</strong>
                <small>
                  Avisar por las próximas dosis con fecha registrada.
                </small>
              </span>
            </label>

            <label
              className={
                pushPreferences.notifyExpirations
                  ? 'is-selected'
                  : ''
              }
            >
              <input
                type="checkbox"
                name="notifyExpirations"
                checked={
                  pushPreferences.notifyExpirations
                }
                onChange={handlePushPreferenceChange}
              />

              <i className="bi bi-calendar-x" />

              <span>
                <strong>Vencimientos</strong>
                <small>
                  Avisar por medicamentos próximos a vencer.
                </small>
              </span>
            </label>

            <label
              className={
                pushPreferences.notifyStock
                  ? 'is-selected'
                  : ''
              }
            >
              <input
                type="checkbox"
                name="notifyStock"
                checked={
                  pushPreferences.notifyStock
                }
                onChange={handlePushPreferenceChange}
              />

              <i className="bi bi-box-seam" />

              <span>
                <strong>Poco stock</strong>
                <small>
                  Avisar cuando un medicamento llegue al mínimo configurado.
                </small>
              </span>
            </label>

            <label
              className={
                pushPreferences.notifyFollowups
                  ? 'is-selected'
                  : ''
              }
            >
              <input
                type="checkbox"
                name="notifyFollowups"
                checked={
                  pushPreferences.notifyFollowups
                }
                onChange={handlePushPreferenceChange}
              />

              <i className="bi bi-clipboard2-pulse" />

              <span>
                <strong>Seguimientos médicos</strong>
                <small>
                  Avisar por fechas de seguimiento registradas en consultas.
                </small>
              </span>
            </label>
          </div>

          <label
            className={`family-settings-push__privacy ${
              pushPreferences.showDetails
                ? 'is-selected'
                : ''
            }`}
          >
            <input
              type="checkbox"
              name="showDetails"
              checked={pushPreferences.showDetails}
              onChange={handlePushPreferenceChange}
            />

            <i className="bi bi-lock" />

            <span>
              <strong>Mostrar detalles en la notificación</strong>
              <small>
                Si está desactivado, la pantalla bloqueada mostrará un aviso general sin nombres de hijos ni medicamentos.
              </small>
            </span>
          </label>

          {pushState.subscribed && (
            <div className="family-settings-push__actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSavePushPreferences}
                disabled={isUpdatingPush}
              >
                <i className="bi bi-check-lg" />
                {isUpdatingPush
                  ? 'Guardando...'
                  : 'Guardar preferencias'}
              </button>

              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={handleTestPush}
                disabled={isTestingPush}
              >
                <i className="bi bi-send" />
                {isTestingPush
                  ? 'Enviando...'
                  : 'Enviar prueba'}
              </button>

              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={handleDisablePush}
                disabled={isUpdatingPush}
              >
                <i className="bi bi-bell-slash" />
                Desactivar
              </button>
            </div>
          )}

          <div className="family-settings-push__note">
            <i className="bi bi-info-circle" />
            <p>
              El sonido depende del dispositivo, del modo silencio y de No molestar. Las notificaciones sirven como apoyo y pueden demorarse si el sistema restringe la conexión en segundo plano.
            </p>
          </div>
        </section>

        <footer className="family-settings-form__footer">
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={handleResetSettings}
          >
            <i className="bi bi-arrow-counterclockwise" />
            Restablecer preferencias
          </button>

          <button
            type="submit"
            className="btn btn-primary"
          >
            <i className="bi bi-check-lg" />
            Guardar configuración
          </button>
        </footer>
      </form>

      <section className="family-settings-section">
        <header className="family-settings-section__header">
          <span>
            <i className="bi bi-database" />
          </span>

          <div>
            <h3>Datos guardados</h3>

            <p>
              Resumen de la información guardada
              actualmente en MiPeque.
            </p>
          </div>
        </header>

        <div className="family-settings-data-grid">
          <article>
            <strong>{dataCounts.children}</strong>
            <span>Hijos</span>
          </article>

          <article>
            <strong>
              {dataCounts.treatments}
            </strong>
            <span>Tratamientos</span>
          </article>

          <article>
            <strong>
              {dataCounts.reminders}
            </strong>
            <span>Acciones de tomas</span>
          </article>

          <article>
            <strong>{dataCounts.cabinet}</strong>
            <span>Medicamentos</span>
          </article>

          <article>
            <strong>
              {dataCounts.consultations}
            </strong>
            <span>Consultas</span>
          </article>

          <article>
            <strong>
              {dataCounts.vaccines}
            </strong>
            <span>Vacunas</span>
          </article>

          <article>
            <strong>
              {dataCounts.documents}
            </strong>
            <span>Documentos</span>
          </article>

          <article>
            <strong>
              {dataCounts.caregivers}
            </strong>
            <span>Responsables</span>
          </article>
        </div>
      </section>

      <section className="family-settings-section">
        <header className="family-settings-section__header">
          <span>
            <i className="bi bi-cloud-arrow-down" />
          </span>

          <div>
            <h3>Copia de seguridad</h3>

            <p>
              Creá una copia fácil de reconocer y
              restaurala cuando la necesites.
            </p>
          </div>
        </header>

        <div className="family-settings-backup">
          <article>
            <span>
              <i className="bi bi-download" />
            </span>

            <div>
              <strong>
                Exportar información
              </strong>

              <p>
                Descarga un archivo que podés abrir en
                cualquier navegador y volver a cargar en MiPeque.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={handleExportBackup}
              disabled={isExporting}
            >
              {isExporting
                ? 'Preparando copia...'
                : 'Descargar copia'}
            </button>
          </article>

          <article>
            <span>
              <i className="bi bi-upload" />
            </span>

            <div>
              <strong>
                Restaurar información
              </strong>

              <p>
                Recupera los datos desde una copia
                creada anteriormente.
              </p>
            </div>

            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={openImportSelector}
              disabled={isImporting}
            >
              {isImporting
                ? 'Importando...'
                : 'Seleccionar archivo'}
            </button>

            <input
              ref={importInputRef}
              type="file"
              accept=".html,.json,.mipeque,text/html,application/json"
              hidden
              onChange={handleImportBackup}
            />
          </article>
        </div>
      </section>

      <section className="family-settings-danger">
        <div>
          <span>
            <i className="bi bi-exclamation-triangle" />
          </span>

          <div>
            <h3>Eliminar todos los datos</h3>

            <p>
              Borra los datos médicos y familiares,
              pero conserva la cuenta, la suscripción
              y los responsables con acceso.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-outline-danger"
          onClick={handleDeleteAllData}
          disabled={isDeleting}
        >
          <i className="bi bi-trash3" />
          {isDeleting
            ? 'Eliminando datos...'
            : 'Eliminar información'}
        </button>
      </section>
    </div>
  );
}

export default SettingsPage;