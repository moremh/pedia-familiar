import {
  useEffect,
  useMemo,
  useState,
} from 'react';

const emptyForm = {
  childId: '',
  treatmentId: '',
  medicineName: '',
  presentation: '',
  currentStock: '',
  minimumStock: '',
  consumptionPerDose: '1',
  stockUnit: 'dose',
  expirationDate: '',
  lotNumber: '',
  storageLocation: '',
  notes: '',
};

function MedicineCabinetForm({
  children,
  treatments,
  initialData = null,
  onSubmit,
  onCancel,
}) {
  const [formData, setFormData] =
    useState(emptyForm);

  const [error, setError] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...emptyForm,
        ...initialData,
        currentStock:
          initialData.currentStock ?? '',
        minimumStock:
          initialData.minimumStock ?? '',
        consumptionPerDose:
          initialData.consumptionPerDose ?? '1',
      });
    } else {
      setFormData({
        ...emptyForm,
        childId:
          children.length === 1
            ? children[0].id
            : '',
      });
    }

    setError('');
  }, [initialData, children]);

  const availableTreatments = useMemo(
    () =>
      treatments.filter(
        (treatment) =>
          treatment.childId ===
          formData.childId,
      ),
    [treatments, formData.childId],
  );

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((currentData) => {
      const updatedData = {
        ...currentData,
        [name]: value,
      };

      if (name === 'childId') {
        updatedData.treatmentId = '';
      }

      return updatedData;
    });
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (!formData.childId) {
      setError(
        'Seleccioná el hijo que utiliza el medicamento.',
      );
      return;
    }

    if (!formData.medicineName.trim()) {
      setError(
        'Ingresá el nombre del medicamento.',
      );
      return;
    }

    if (
      formData.currentStock === '' ||
      Number(formData.currentStock) < 0
    ) {
      setError(
        'Ingresá una cantidad de stock válida.',
      );
      return;
    }

    if (
      formData.minimumStock === '' ||
      Number(formData.minimumStock) < 0
    ) {
      setError(
        'Ingresá un nivel mínimo de stock válido.',
      );
      return;
    }

    if (
      !formData.consumptionPerDose ||
      Number(formData.consumptionPerDose) <= 0
    ) {
      setError(
        'Ingresá cuánto stock se descuenta por cada toma.',
      );
      return;
    }

    setError('');

    onSubmit({
      childId: formData.childId,
      treatmentId: formData.treatmentId,
      medicineName:
        formData.medicineName.trim(),
      presentation:
        formData.presentation.trim(),
      currentStock: Number(
        formData.currentStock,
      ),
      initialStock: initialData
        ? Number(
            initialData.initialStock ??
              formData.currentStock,
          )
        : Number(formData.currentStock),
      minimumStock: Number(
        formData.minimumStock,
      ),
      consumptionPerDose: Number(
        formData.consumptionPerDose,
      ),
      stockUnit: formData.stockUnit,
      expirationDate:
        formData.expirationDate,
      lotNumber: formData.lotNumber.trim(),
      storageLocation:
        formData.storageLocation.trim(),
      notes: formData.notes.trim(),
    });
  }

  return (
    <form
      className="medicine-cabinet-form"
      onSubmit={handleSubmit}
      noValidate
    >
      {error && (
        <div
          className="medicine-cabinet-form__error"
          role="alert"
        >
          <i className="bi bi-exclamation-circle" />
          <span>{error}</span>
        </div>
      )}

      <div className="medicine-cabinet-form__notice">
        <i className="bi bi-info-circle" />

        <p>
          El stock se descuenta solamente cuando una
          toma se marca como administrada. La cantidad
          descontada debe coincidir con la presentación
          cargada por la familia.
        </p>
      </div>

      <section className="medicine-cabinet-form__section">
        <header className="medicine-cabinet-form__section-header">
          <i className="bi bi-person-hearts" />

          <div>
            <h3>Paciente y tratamiento</h3>

            <p>
              Vinculá el medicamento con el hijo y el
              tratamiento que lo utiliza.
            </p>
          </div>
        </header>

        <div className="medicine-cabinet-form__grid">
          <div className="medicine-cabinet-form__field">
            <label htmlFor="cabinetChild">
              Hijo
            </label>

            <select
              id="cabinetChild"
              name="childId"
              className="form-select"
              value={formData.childId}
              onChange={handleChange}
            >
              <option value="">
                Seleccionar hijo
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
          </div>

          <div className="medicine-cabinet-form__field">
            <label htmlFor="cabinetTreatment">
              Tratamiento relacionado
            </label>

            <select
              id="cabinetTreatment"
              name="treatmentId"
              className="form-select"
              value={formData.treatmentId}
              onChange={handleChange}
              disabled={!formData.childId}
            >
              <option value="">
                Sin tratamiento relacionado
              </option>

              {availableTreatments.map(
                (treatment) => (
                  <option
                    key={treatment.id}
                    value={treatment.id}
                  >
                    {treatment.medicationName} —{' '}
                    {treatment.startDate}
                  </option>
                ),
              )}
            </select>

            <small>
              Es necesario vincularlo para descontar
              stock automáticamente.
            </small>
          </div>
        </div>
      </section>

      <section className="medicine-cabinet-form__section">
        <header className="medicine-cabinet-form__section-header">
          <i className="bi bi-capsule-pill" />

          <div>
            <h3>Medicamento</h3>

            <p>
              Registrá el nombre y la presentación
              disponible en casa.
            </p>
          </div>
        </header>

        <div className="medicine-cabinet-form__grid">
          <div className="medicine-cabinet-form__field">
            <label htmlFor="cabinetMedicineName">
              Nombre
            </label>

            <input
              type="text"
              id="cabinetMedicineName"
              name="medicineName"
              className="form-control"
              value={formData.medicineName}
              onChange={handleChange}
              placeholder="Ejemplo: Amoxicilina"
            />
          </div>

          <div className="medicine-cabinet-form__field">
            <label htmlFor="cabinetPresentation">
              Presentación
            </label>

            <input
              type="text"
              id="cabinetPresentation"
              name="presentation"
              className="form-control"
              value={formData.presentation}
              onChange={handleChange}
              placeholder="Ejemplo: jarabe 250 mg/5 ml"
            />
          </div>

          <div className="medicine-cabinet-form__field">
            <label htmlFor="cabinetLot">
              Número de lote
            </label>

            <input
              type="text"
              id="cabinetLot"
              name="lotNumber"
              className="form-control"
              value={formData.lotNumber}
              onChange={handleChange}
              placeholder="Lote del envase"
            />
          </div>

          <div className="medicine-cabinet-form__field">
            <label htmlFor="cabinetLocation">
              Lugar donde se guarda
            </label>

            <input
              type="text"
              id="cabinetLocation"
              name="storageLocation"
              className="form-control"
              value={formData.storageLocation}
              onChange={handleChange}
              placeholder="Ejemplo: estante superior"
            />
          </div>
        </div>
      </section>

      <section className="medicine-cabinet-form__section">
        <header className="medicine-cabinet-form__section-header">
          <i className="bi bi-box-seam" />

          <div>
            <h3>Control de stock</h3>

            <p>
              Configurá la cantidad disponible y el
              nivel mínimo para generar avisos.
            </p>
          </div>
        </header>

        <div className="medicine-cabinet-form__grid">
          <div className="medicine-cabinet-form__field">
            <label htmlFor="cabinetCurrentStock">
              Stock actual
            </label>

            <input
              type="number"
              id="cabinetCurrentStock"
              name="currentStock"
              className="form-control"
              value={formData.currentStock}
              onChange={handleChange}
              min="0"
              step="0.1"
              placeholder="20"
            />
          </div>

          <div className="medicine-cabinet-form__field">
            <label htmlFor="cabinetMinimumStock">
              Avisar cuando queden
            </label>

            <input
              type="number"
              id="cabinetMinimumStock"
              name="minimumStock"
              className="form-control"
              value={formData.minimumStock}
              onChange={handleChange}
              min="0"
              step="0.1"
              placeholder="5"
            />
          </div>

          <div className="medicine-cabinet-form__field">
            <label htmlFor="cabinetStockUnit">
              Unidad del stock
            </label>

            <select
              id="cabinetStockUnit"
              name="stockUnit"
              className="form-select"
              value={formData.stockUnit}
              onChange={handleChange}
            >
              <option value="dose">Dosis</option>
              <option value="tablet">
                Comprimidos
              </option>
              <option value="capsule">
                Cápsulas
              </option>
              <option value="milliliter">
                Mililitros
              </option>
              <option value="sachet">
                Sobres
              </option>
              <option value="ampoule">
                Ampollas
              </option>
              <option value="inhalation">
                Inhalaciones
              </option>
              <option value="application">
                Aplicaciones
              </option>
              <option value="other">
                Otras unidades
              </option>
            </select>
          </div>

          <div className="medicine-cabinet-form__field">
            <label htmlFor="cabinetConsumption">
              Descontar por toma
            </label>

            <input
              type="number"
              id="cabinetConsumption"
              name="consumptionPerDose"
              className="form-control"
              value={
                formData.consumptionPerDose
              }
              onChange={handleChange}
              min="0.1"
              step="0.1"
              placeholder="1"
            />

            <small>
              Ejemplo: 1 comprimido, 5 ml o 2
              aplicaciones.
            </small>
          </div>
        </div>
      </section>

      <section className="medicine-cabinet-form__section">
        <header className="medicine-cabinet-form__section-header">
          <i className="bi bi-calendar-event" />

          <div>
            <h3>Vencimiento</h3>

            <p>
              Cargá la fecha que aparece en el
              envase.
            </p>
          </div>
        </header>

        <div className="medicine-cabinet-form__field">
          <label htmlFor="cabinetExpirationDate">
            Fecha de vencimiento
          </label>

          <input
            type="date"
            id="cabinetExpirationDate"
            name="expirationDate"
            className="form-control"
            value={formData.expirationDate}
            onChange={handleChange}
          />
        </div>
      </section>

      <section className="medicine-cabinet-form__section">
        <header className="medicine-cabinet-form__section-header">
          <i className="bi bi-journal-text" />

          <div>
            <h3>Observaciones</h3>

            <p>
              Información adicional que la familia
              necesite recordar.
            </p>
          </div>
        </header>

        <div className="medicine-cabinet-form__field">
          <label htmlFor="cabinetNotes">
            Observaciones
          </label>

          <textarea
            id="cabinetNotes"
            name="notes"
            className="form-control"
            value={formData.notes}
            onChange={handleChange}
            rows="3"
            placeholder="Ejemplo: conservar según las indicaciones del envase."
          />
        </div>
      </section>

      <footer className="medicine-cabinet-form__actions">
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={onCancel}
        >
          Cancelar
        </button>

        <button
          type="submit"
          className="btn btn-primary"
        >
          <i className="bi bi-check-lg" />

          {initialData
            ? 'Guardar cambios'
            : 'Agregar al botiquín'}
        </button>
      </footer>
    </form>
  );
}

export default MedicineCabinetForm;