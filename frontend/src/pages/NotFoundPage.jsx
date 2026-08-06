import { Link } from 'react-router-dom';

function NotFoundPage() {
  return (
    <main className="not-found-page">
      <div>
        <span>404</span>
        <h1>Página no encontrada</h1>
        <p>La dirección ingresada no existe dentro del sistema.</p>

        <Link to="/login" className="btn btn-primary">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}

export default NotFoundPage;