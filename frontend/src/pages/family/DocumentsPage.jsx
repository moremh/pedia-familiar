import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import MedicalDocumentCard from '../../components/cards/MedicalDocumentCard.jsx';
import MedicalDocumentForm from '../../components/forms/MedicalDocumentForm.jsx';

import { getChildren } from '../../services/childrenService.js';
import { getConsultations } from '../../services/consultationsService.js';
import { getTreatments } from '../../services/treatmentsService.js';

import {
  createDocument,
  deleteDocument,
  getDocuments,
  refreshDocumentFile,
  updateDocument,
} from '../../services/documentsService.js';

import {
  formatDocumentDate,
  formatFileSize,
  getDocumentTypeIcon,
  getDocumentTypeLabel,
  isImageFile,
  isPdfFile,
} from '../../utils/documentUtils.js';

import '../../styles/documents.css';

function DocumentsPage() {
  const [children] = useState(() =>
    getChildren(),
  );

  const [consultations] = useState(() =>
    getConsultations(),
  );

  const [treatments] = useState(() =>
    getTreatments(),
  );

  const [documents, setDocuments] = useState(
    () => getDocuments(),
  );

  const [searchTerm, setSearchTerm] =
    useState('');

  const [childFilter, setChildFilter] =
    useState('all');

  const [typeFilter, setTypeFilter] =
    useState('all');

  const [isFormOpen, setIsFormOpen] =
    useState(false);

  const [editingDocument, setEditingDocument] =
    useState(null);

  const [selectedDocument, setSelectedDocument] =
    useState(null);

  const [documentFileError, setDocumentFileError] =
    useState('');

  useEffect(() => {
    const modalIsOpen =
      isFormOpen || Boolean(selectedDocument);

    if (!modalIsOpen) {
      return undefined;
    }

    const previousBodyOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    function handleEscape(event) {
      if (event.key !== 'Escape') {
        return;
      }

      if (isFormOpen) {
        setEditingDocument(null);
        setIsFormOpen(false);
        return;
      }

      setSelectedDocument(null);
    }

    window.addEventListener(
      'keydown',
      handleEscape,
    );

    return () => {
      document.body.style.overflow =
        previousBodyOverflow;

      window.removeEventListener(
        'keydown',
        handleEscape,
      );
    };
  }, [isFormOpen, selectedDocument]);

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

  const consultationsMap = useMemo(
    () =>
      Object.fromEntries(
        consultations.map((consultation) => [
          consultation.id,
          consultation,
        ]),
      ),
    [consultations],
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

  const filteredDocuments = useMemo(() => {
    const normalizedSearch = searchTerm
      .trim()
      .toLowerCase();

    return documents.filter((document) => {
      const child =
        childrenMap[document.childId];

      const consultation =
        consultationsMap[
          document.consultationId
        ];

      const treatment =
        treatmentsMap[document.treatmentId];

      const matchesChild =
        childFilter === 'all' ||
        document.childId === childFilter;

      const matchesType =
        typeFilter === 'all' ||
        document.documentType === typeFilter;

      const searchableValues = [
        child?.fullName,
        document.title,
        getDocumentTypeLabel(
          document.documentType,
        ),
        document.professionalName,
        document.medicalCenter,
        document.notes,
        document.file?.name,
        consultation?.reason,
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
        matchesType &&
        matchesSearch
      );
    });
  }, [
    documents,
    childrenMap,
    consultationsMap,
    treatmentsMap,
    childFilter,
    typeFilter,
    searchTerm,
  ]);

  const prescriptionsCount =
    documents.filter(
      (document) =>
        document.documentType ===
        'prescription',
    ).length;

  const studiesCount = documents.filter(
    (document) =>
      ['study', 'laboratory'].includes(
        document.documentType,
      ),
  ).length;

  const attachedFilesCount =
    documents.filter(
      (document) => document.file,
    ).length;

  function refreshDocuments() {
    setDocuments(getDocuments());
  }

  function openCreateForm() {
    if (children.length === 0) {
      return;
    }

    setEditingDocument(null);
    setSelectedDocument(null);
    setIsFormOpen(true);
  }

  function openEditForm(document) {
    setSelectedDocument(null);
    setEditingDocument(document);
    setIsFormOpen(true);
  }

  function closeForm() {
    setEditingDocument(null);
    setIsFormOpen(false);
  }

  async function openDocumentDetail(document) {
    setDocumentFileError('');
    setSelectedDocument(document);

    if (!document?.file?.storagePath) {
      return;
    }

    try {
      const refreshedFile =
        await refreshDocumentFile(document);

      setSelectedDocument((currentDocument) =>
        currentDocument?.id === document.id
          ? {
              ...currentDocument,
              file: refreshedFile,
            }
          : currentDocument,
      );
    } catch (error) {
      setDocumentFileError(
        error.message ||
          'No se pudo abrir el archivo. Volvé a intentarlo.',
      );
    }
  }

  async function handleSaveDocument(data) {
    if (editingDocument) {
      updateDocument(
        editingDocument.id,
        data,
      );
    } else {
      createDocument(data);
    }

    refreshDocuments();
    closeForm();
  }

  function handleDeleteDocument(document) {
    const confirmed = window.confirm(
      `¿Querés eliminar el documento “${document.title}”?`,
    );

    if (!confirmed) {
      return;
    }

    deleteDocument(document.id);

    if (
      selectedDocument?.id === document.id
    ) {
      setSelectedDocument(null);
    }

    refreshDocuments();
  }

  return (
    <div className="documents-page">
      <section className="documents-page__header">
        <div>
          <span>Archivos médicos</span>
          <h2>Documentos médicos</h2>

          <p>
            Guardá recetas, estudios, certificados
            e indicaciones de cada hijo.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateForm}
          disabled={children.length === 0}
        >
          <i className="bi bi-file-earmark-plus" />
          Agregar documento
        </button>
      </section>

      {children.length === 0 && (
        <section className="documents-page__warning">
          <i className="bi bi-person-exclamation" />

          <div>
            <strong>
              Primero necesitás crear un perfil
              infantil
            </strong>

            <p>
              Cada documento debe estar asociado a
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

      <section className="documents-statistics">
        <article>
          <span className="documents-statistics__icon">
            <i className="bi bi-files" />
          </span>

          <div>
            <strong>{documents.length}</strong>
            <span>Documentos registrados</span>
          </div>
        </article>

        <article>
          <span className="documents-statistics__icon documents-statistics__icon--prescription">
            <i className="bi bi-prescription2" />
          </span>

          <div>
            <strong>
              {prescriptionsCount}
            </strong>

            <span>Recetas médicas</span>
          </div>
        </article>

        <article>
          <span className="documents-statistics__icon documents-statistics__icon--study">
            <i className="bi bi-file-medical" />
          </span>

          <div>
            <strong>{studiesCount}</strong>
            <span>Estudios y análisis</span>
          </div>
        </article>

        <article>
          <span className="documents-statistics__icon documents-statistics__icon--file">
            <i className="bi bi-paperclip" />
          </span>

          <div>
            <strong>
              {attachedFilesCount}
            </strong>

            <span>Con archivo adjunto</span>
          </div>
        </article>
      </section>

      <section className="documents-toolbar">
        <div className="documents-toolbar__search">
          <i className="bi bi-search" />

          <input
            type="search"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(event.target.value)
            }
            placeholder="Buscar por título, hijo, profesional o archivo"
            aria-label="Buscar documentos médicos"
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
          value={childFilter}
          onChange={(event) =>
            setChildFilter(event.target.value)
          }
          aria-label="Filtrar por hijo"
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
          value={typeFilter}
          onChange={(event) =>
            setTypeFilter(event.target.value)
          }
          aria-label="Filtrar por tipo"
        >
          <option value="all">
            Todos los tipos
          </option>

          <option value="prescription">
            Recetas
          </option>

          <option value="study">
            Estudios
          </option>

          <option value="laboratory">
            Laboratorio
          </option>

          <option value="certificate">
            Certificados
          </option>

          <option value="indication">
            Indicaciones
          </option>

          <option value="vaccination">
            Vacunación
          </option>

          <option value="other">
            Otros
          </option>
        </select>
      </section>

      <div className="documents-page__result">
        {filteredDocuments.length}{' '}
        {filteredDocuments.length === 1
          ? 'documento encontrado'
          : 'documentos encontrados'}
      </div>

      {filteredDocuments.length > 0 ? (
        <section className="documents-grid">
          {filteredDocuments.map(
            (document) => (
              <MedicalDocumentCard
                key={document.id}
                document={document}
                child={
                  childrenMap[document.childId]
                }
                consultation={
                  consultationsMap[
                    document.consultationId
                  ]
                }
                treatment={
                  treatmentsMap[
                    document.treatmentId
                  ]
                }
                onView={openDocumentDetail}
                onEdit={openEditForm}
                onDelete={
                  handleDeleteDocument
                }
              />
            ),
          )}
        </section>
      ) : (
        <section className="documents-empty">
          <span>
            <i className="bi bi-file-earmark-medical" />
          </span>

          <h3>
            {documents.length === 0
              ? 'Todavía no hay documentos'
              : 'No encontramos resultados'}
          </h3>

          <p>
            {documents.length === 0
              ? 'Guardá la primera receta, estudio o indicación para comenzar a crear el archivo médico.'
              : 'Probá cambiando los filtros o utilizando otro término de búsqueda.'}
          </p>

          {documents.length === 0 &&
            children.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={openCreateForm}
              >
                Agregar primer documento
              </button>
            )}
        </section>
      )}

      {isFormOpen && (
        <div
          className="documents-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="medicalDocumentFormTitle"
        >
          <button
            type="button"
            className="documents-modal__backdrop"
            onClick={closeForm}
            aria-label="Cerrar formulario"
          />

          <div className="documents-modal__container documents-modal__container--form">
            <header className="documents-modal__header">
              <div>
                <span>Archivos médicos</span>

                <h2 id="medicalDocumentFormTitle">
                  {editingDocument
                    ? 'Editar documento'
                    : 'Agregar documento'}
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

            <div className="documents-modal__body documents-modal__body--form">
              <MedicalDocumentForm
                children={children}
                consultations={consultations}
                treatments={treatments}
                initialData={editingDocument}
                onSubmit={handleSaveDocument}
                onCancel={closeForm}
              />
            </div>
          </div>
        </div>
      )}

      {selectedDocument && (
        <div
          className="documents-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="medicalDocumentDetailTitle"
        >
          <button
            type="button"
            className="documents-modal__backdrop"
            onClick={() =>
              setSelectedDocument(null)
            }
            aria-label="Cerrar documento"
          />

          <div className="documents-modal__container">
            <header className="documents-modal__header">
              <div>
                <span>Información completa</span>

                <h2 id="medicalDocumentDetailTitle">
                  Documento médico
                </h2>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedDocument(null)
                }
                aria-label="Cerrar"
              >
                <i className="bi bi-x-lg" />
              </button>
            </header>

            <div className="documents-modal__body documents-modal__body--detail">
              <section className="medical-document-detail__hero">
                <div className="medical-document-detail__hero-icon">
                  <i
                    className={`bi ${getDocumentTypeIcon(
                      selectedDocument.documentType,
                    )}`}
                  />
                </div>

                <div>
                  <span>
                    {getDocumentTypeLabel(
                      selectedDocument.documentType,
                    )}
                  </span>

                  <h3>
                    {selectedDocument.title}
                  </h3>

                  <p>
                    {
                      childrenMap[
                        selectedDocument.childId
                      ]?.fullName
                    }
                  </p>
                </div>
              </section>

              <section className="medical-document-detail__section">
                <h4>
                  <i className="bi bi-info-circle" />
                  Datos del documento
                </h4>

                <dl className="medical-document-detail__grid">
                  <div>
                    <dt>Fecha</dt>

                    <dd>
                      {formatDocumentDate(
                        selectedDocument.documentDate,
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt>Profesional</dt>

                    <dd>
                      {selectedDocument.professionalName ||
                        'No registrado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Centro médico</dt>

                    <dd>
                      {selectedDocument.medicalCenter ||
                        'No registrado'}
                    </dd>
                  </div>

                  <div>
                    <dt>Tipo</dt>

                    <dd>
                      {getDocumentTypeLabel(
                        selectedDocument.documentType,
                      )}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="medical-document-detail__section">
                <h4>
                  <i className="bi bi-link-45deg" />
                  Registros relacionados
                </h4>

                <dl className="medical-document-detail__grid">
                  <div>
                    <dt>Consulta</dt>

                    <dd>
                      {consultationsMap[
                        selectedDocument
                          .consultationId
                      ]?.reason ||
                        'Sin consulta relacionada'}
                    </dd>
                  </div>

                  <div>
                    <dt>Tratamiento</dt>

                    <dd>
                      {treatmentsMap[
                        selectedDocument.treatmentId
                      ]?.medicationName ||
                        'Sin tratamiento relacionado'}
                    </dd>
                  </div>
                </dl>
              </section>

              {selectedDocument.notes && (
                <section className="medical-document-detail__section">
                  <h4>
                    <i className="bi bi-journal-text" />
                    Observaciones
                  </h4>

                  <div className="medical-document-detail__text">
                    <p>
                      {selectedDocument.notes}
                    </p>
                  </div>
                </section>
              )}

              <section className="medical-document-detail__section">
                <h4>
                  <i className="bi bi-paperclip" />
                  Archivo adjunto
                </h4>

                {documentFileError && (
                  <div className="alert alert-danger py-2" role="alert">
                    {documentFileError}
                  </div>
                )}

                {selectedDocument.file ? (
                  <>
                    <div className="medical-document-detail__file-information">
                      <span>
                        <i
                          className={`bi ${
                            isPdfFile(
                              selectedDocument.file,
                            )
                              ? 'bi-file-earmark-pdf'
                              : 'bi-file-earmark-image'
                          }`}
                        />
                      </span>

                      <div>
                        <strong>
                          {
                            selectedDocument.file
                              .name
                          }
                        </strong>

                        <small>
                          {formatFileSize(
                            selectedDocument.file
                              .size,
                          )}
                        </small>
                      </div>

                      <a
                        href={
                          selectedDocument.file
                            .dataUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-outline-primary"
                      >
                        <i className="bi bi-box-arrow-up-right" />
                        Abrir
                      </a>
                    </div>

                    {isImageFile(
                      selectedDocument.file,
                    ) && (
                      <div className="medical-document-detail__image-preview">
                        <img
                          src={
                            selectedDocument.file
                              .dataUrl
                          }
                          alt={
                            selectedDocument.file
                              .name
                          }
                        />
                      </div>
                    )}

                    {isPdfFile(
                      selectedDocument.file,
                    ) && (
                      <div className="medical-document-detail__pdf-preview">
                        <iframe
                          src={
                            selectedDocument.file
                              .dataUrl
                          }
                          title={
                            selectedDocument.file
                              .name
                          }
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="medical-document-detail__no-file">
                    <i className="bi bi-file-earmark-x" />

                    <p>
                      Este registro no tiene un
                      archivo adjunto.
                    </p>
                  </div>
                )}
              </section>
            </div>

            <footer className="documents-modal__footer">
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() =>
                  setSelectedDocument(null)
                }
              >
                Cerrar
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  openEditForm(selectedDocument)
                }
              >
                <i className="bi bi-pencil" />
                Editar documento
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentsPage;