import {
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
        `Se restauraron ${restoredItems} grupos de datos. La página se recargará para aplicar los cambios.`,
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