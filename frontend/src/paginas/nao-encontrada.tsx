import { Link } from "react-router-dom";

export function PaginaNaoEncontrada() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="text-sm font-medium text-tinta-3">404</p>
        <h1 className="mt-1 text-xl font-semibold text-tinta">Página não encontrada</h1>
        <Link
          to="/dashboard"
          className="mt-4 inline-block rounded-lg bg-marca px-4 py-2 text-sm font-medium text-white hover:bg-marca-forte"
        >
          Voltar ao Dashboard
        </Link>
      </div>
    </div>
  );
}
