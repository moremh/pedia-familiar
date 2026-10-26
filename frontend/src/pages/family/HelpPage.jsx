import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  isMedicationOnlyAccess,
} from '../../services/familyAccessService.js';

import {
  getCommercialContactSettings,
} from '../../services/commercialSettingsService.js';

import '../../styles/help.css';

const MANUAL_SECTIONS = [
  {
    id: 'start',
    icon: 'bi-house-heart',
    title: 'Primeros pasos',
    keywords: 'inicio cuenta familia panel prueba suscripcion',
    paragraphs: [
      'Al ingresar, MiPeque carga la información de tu familia y te lleva al panel correspondiente a tu nivel de acceso.',
      'La cuenta principal puede administrar todos los módulos. Los responsables con acceso limitado ven únicamente las herramientas necesarias para registrar tomas y consultar su historial.',
    ],
    steps: [
      'Completá los datos básicos de la familia desde Configuración.',
      'Registrá al menos un hijo en Mis hijos.',
      'Cargá tratamientos, consultas, vacunas, documentos o medicamentos según lo necesites.',
      'Revisá Alertas y Recordatorios para mantener al día las próximas acciones.',
    ],
  },
  {
    id: 'children',
    icon: 'bi-person-hearts',
    title: 'Mis hijos',
    keywords: 'hijos perfiles pediatra alergias obra social peso altura',
    paragraphs: [
      'Cada hijo tiene su propio perfil y todos los datos médicos se vinculan a ese perfil.',
    ],
    steps: [
      'Entrá en Mis hijos y elegí Agregar hijo.',
      'Completá los datos personales y de salud disponibles.',
      'Podés editar la información cuando cambie.',
      'Si una familia alcanza el cupo habilitado, administración debe ampliar el límite antes de crear otro perfil.',
    ],
  },
  {
    id: 'treatments',
    icon: 'bi-capsule-pill',
    title: 'Tratamientos y tomas',
    keywords: 'tratamiento medicamento dosis horario intervalo toma recordatorio posponer omitir administrar',
    paragraphs: [
      'Los tratamientos generan las tomas que aparecen en Recordatorios. Podés usar una frecuencia por intervalo o definir horarios concretos.',
    ],
    steps: [
      'Creá un tratamiento y seleccioná el hijo.',
      'Indicá medicamento, dosis, vía de administración, fecha de inicio y duración.',
      'Definí la frecuencia y los horarios.',
      'En Recordatorios marcá cada toma como administrada, omitida o pospuesta.',
      'El historial conserva quién registró la acción y cuándo se realizó.',
    ],
  },
  {
    id: 'consultations',
    icon: 'bi-clipboard2-pulse',
    title: 'Consultas médicas',
    keywords: 'consulta medico pediatra diagnostico sintomas seguimiento profesional',
    paragraphs: [
      'Esta sección permite guardar antecedentes de consultas para encontrarlos después sin depender de la memoria o de papeles sueltos.',
    ],
    steps: [
      'Elegí el hijo y registrá fecha, motivo y profesional.',
      'Agregá síntomas, diagnóstico, indicaciones y observaciones si corresponde.',
      'Si existe un control posterior, cargá la fecha de seguimiento para que MiPeque pueda alertarte.',
    ],
  },
  {
    id: 'vaccines',
    icon: 'bi-shield-plus',
    title: 'Vacunas',
    keywords: 'vacuna calendario dosis carnet proxima dosis nacional',
    paragraphs: [
      'Podés registrar vacunas aplicadas y próximas dosis. El calendario visual funciona como referencia y no reemplaza la indicación profesional.',
    ],
    steps: [
      'Registrá la vacuna aplicada y, si corresponde, la próxima dosis.',
      'Usá el calendario nacional para marcar las vacunas ya cumplidas por cada hijo.',
      'Ante dudas sobre esquemas especiales o recupero de dosis, consultá al equipo de salud.',
    ],
  },
  {
    id: 'cabinet',
    icon: 'bi-box-seam',
    title: 'Botiquín',
    keywords: 'botiquin stock medicamento vencimiento lote cantidad',
    paragraphs: [
      'El botiquín ayuda a controlar qué medicamentos tenés disponibles, cuánto queda y cuándo vencen.',
    ],
    steps: [
      'Agregá el medicamento y su cantidad actual.',
      'Definí un stock mínimo para recibir avisos.',
      'Cargá la fecha de vencimiento cuando la conozcas.',
      'Las tomas vinculadas pueden descontar stock automáticamente.',
    ],
  },
  {
    id: 'documents',
    icon: 'bi-folder2-open',
    title: 'Documentos médicos',
    keywords: 'documentos receta estudio certificado pdf imagen archivo',
    paragraphs: [
      'Los adjuntos se guardan de forma privada y se vinculan a un hijo. Podés asociarlos también a una consulta o tratamiento.',
    ],
    steps: [
      'Elegí Agregar documento.',
      'Completá el tipo, título y fecha.',
      'Adjuntá un PDF o imagen compatible de hasta 2 MB.',
      'Cuando abras un archivo, MiPeque genera un acceso temporal seguro.',
    ],
  },
  {
    id: 'caregivers',
    icon: 'bi-people',
    title: 'Responsables e invitaciones',
    keywords: 'responsables familia invitacion acceso limitado completo tomas',
    paragraphs: [
      'La cuenta principal puede agregar responsables y decidir qué nivel de acceso tendrá cada persona.',
    ],
    steps: [
      'Creá el responsable con sus datos.',
      'Si necesita ingresar al sistema, generá una invitación.',
      'Elegí acceso completo o solo administración de tomas.',
      'La persona invitada debe abrir el enlace y aceptar la invitación con su propia cuenta.',
    ],
  },
  {
    id: 'push',
    icon: 'bi-bell-fill',
    title: 'Notificaciones push',
    keywords: 'notificaciones push activar telefono prueba aviso pantalla bloqueo',
    paragraphs: [
      'Cada dispositivo se activa por separado. MiPeque puede avisar sobre tomas, atrasos, vacunas, vencimientos, stock y seguimientos médicos.',
    ],
    steps: [
      'Entrá en Configuración y buscá Notificaciones push.',
      'Tocá Activar en este dispositivo y aceptá el permiso del navegador.',
      'Elegí qué tipos de avisos querés recibir.',
      'Usá Enviar prueba para verificar que el dispositivo esté correctamente registrado.',
      'En iPhone o iPad, primero instalá MiPeque en la pantalla de inicio y abrila desde su ícono.',
    ],
  },
  {
    id: 'backup',
    icon: 'bi-cloud-arrow-down',
    title: 'Copias de seguridad',
    keywords: 'backup copia seguridad exportar importar restaurar datos',
    paragraphs: [
      'Desde Configuración podés descargar una copia de la información familiar y restaurarla cuando sea necesario.',
    ],
    steps: [
      'Elegí Descargar copia y guardá el archivo en un lugar seguro.',
      'Para recuperar información, usá Seleccionar archivo y elegí una copia creada por MiPeque.',
      'Las copias pueden contener información médica sensible: no las compartas con personas no autorizadas.',
    ],
  },
  {
    id: 'subscription',
    icon: 'bi-credit-card',
    title: 'Prueba y suscripción',
    keywords: 'prueba 7 dias mensual anual pago vencimiento plan',
    paragraphs: [
      'Las cuentas nuevas reciben 7 días de prueba. Al finalizar, el acceso depende de que la familia tenga un plan activo.',
    ],
    steps: [
      'Desde la pantalla de suscripción elegí el plan disponible.',
      'MiPeque prepara el pedido y el contacto de pago configurado.',
      'La activación se realiza desde administración una vez confirmado el pago.',
      'Cuando un plan vence o una familia es suspendida, los datos médicos dejan de estar disponibles hasta recuperar el acceso.',
    ],
  },
  {
    id: 'offline',
    icon: 'bi-wifi-off',
    title: 'Uso con conexión inestable',
    keywords: 'offline internet sin conexion sincronizacion pwa',
    paragraphs: [
      'MiPeque conserva una copia local de la información ya cargada para tolerar cortes de conexión. Los cambios pendientes se vuelven a sincronizar cuando regresa internet.',
      'Para acciones que dependen del servidor, como iniciar sesión por primera vez, aceptar invitaciones o subir archivos nuevos, necesitás conexión.',
    ],
    steps: [],
  },
];

function HelpPage() {
  const [searchTerm, setSearchTerm] =
    useState('');

  const limitedAccess =
    isMedicationOnlyAccess();

  const [adminWhatsApp, setAdminWhatsApp] =
    useState(() =>
      String(
        import.meta.env.VITE_ADMIN_WHATSAPP || '',
      ).replace(/\D/g, ''),
    );

  useEffect(() => {
    let active = true;

    getCommercialContactSettings()
      .then((settings) => {
        if (
          active &&
          settings.supportWhatsapp
        ) {
          setAdminWhatsApp(
            settings.supportWhatsapp,
          );
        }
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, []);

  const visibleSections = useMemo(() => {
    const normalizedSearch =
      searchTerm.trim().toLowerCase();

    const allowedSections =
      limitedAccess
        ? MANUAL_SECTIONS.filter((section) =>
            ['start', 'treatments', 'push', 'offline'].includes(section.id),
          )
        : MANUAL_SECTIONS;

    if (!normalizedSearch) {
      return allowedSections;
    }

    return allowedSections.filter((section) =>
      [
        section.title,
        section.keywords,
        ...section.paragraphs,
        ...section.steps,
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [limitedAccess, searchTerm]);

  const supportUrl = adminWhatsApp
    ? `https://wa.me/${adminWhatsApp}?text=${encodeURIComponent(
        'Hola, necesito ayuda con MiPeque.',
      )}`
    : '';

  return (
    <div className="help-page">
      <section className="help-hero">
        <div>
          <span className="help-hero__eyebrow">
            Centro de ayuda
          </span>

          <h2>Manual de usuario de MiPeque</h2>

          <p>
            Encontrá rápidamente cómo usar cada
            sección, resolver dudas frecuentes y
            configurar la aplicación en tus
            dispositivos.
          </p>
        </div>

        <span className="help-hero__icon">
          <i className="bi bi-life-preserver" />
        </span>
      </section>

      <section className="help-search">
        <i className="bi bi-search" />

        <input
          type="search"
          value={searchTerm}
          onChange={(event) =>
            setSearchTerm(event.target.value)
          }
          placeholder="Buscar en el manual..."
          aria-label="Buscar en el manual de MiPeque"
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
      </section>

      {visibleSections.length > 0 ? (
        <div className="help-grid">
          {visibleSections.map((section) => (
            <article
              key={section.id}
              className="help-card"
              id={section.id}
            >
              <header>
                <span>
                  <i className={`bi ${section.icon}`} />
                </span>

                <h3>{section.title}</h3>
              </header>

              {section.paragraphs.map(
                (paragraph) => (
                  <p key={paragraph}>
                    {paragraph}
                  </p>
                ),
              )}

              {section.steps.length > 0 && (
                <ol>
                  {section.steps.map(
                    (step) => (
                      <li key={step}>{step}</li>
                    ),
                  )}
                </ol>
              )}
            </article>
          ))}
        </div>
      ) : (
        <section className="help-empty">
          <i className="bi bi-search" />
          <h3>No encontramos ese tema</h3>
          <p>
            Probá con palabras como medicamento,
            vacuna, backup, notificación o
            responsable.
          </p>
        </section>
      )}

      <section className="help-support">
        <span>
          <i className="bi bi-chat-heart" />
        </span>

        <div>
          <h3>¿Seguís necesitando ayuda?</h3>
          <p>
            Si el manual no resuelve tu problema,
            podés comunicarte con administración.
          </p>
        </div>

        {supportUrl ? (
          <a
            href={supportUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary"
          >
            <i className="bi bi-whatsapp" />
            Pedir ayuda
          </a>
        ) : (
          <span className="help-support__disabled">
            Contacto no configurado
          </span>
        )}
      </section>

      <p className="help-disclaimer">
        MiPeque organiza información familiar y
        recordatorios. No reemplaza el diagnóstico,
        la indicación ni la atención de profesionales
        de la salud.
      </p>
    </div>
  );
}

export default HelpPage;
