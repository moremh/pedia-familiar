function FamilySectionPage({
  eyebrow = 'MiPeque',
  title,
  description,
  icon = 'bi-grid',
}) {
  return (
    <section className="family-section-page">
      <header className="family-section-page__header">
        <div className="family-section-page__icon">
          <i className={`bi ${icon}`} />
        </div>

        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </header>

      <div className="family-empty-state">
        <span className="family-empty-state__icon">
          <i className={`bi ${icon}`} />
        </span>

        <h3>Sección preparada</h3>

        <p>
          La navegación ya funciona correctamente. En los próximos pasos
          construiremos todas las funciones de esta sección.
        </p>
      </div>
    </section>
  );
}

export default FamilySectionPage;