import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/auth/contexto-auth";
import { useSessao } from "@/hooks/consultas";
import { Topo } from "./topo";

/**
 * Casca do painel: topo fixo + conteúdo da rota.
 *
 * Também é o portão de autenticação — sem sessão, redireciona para /entrar em
 * vez de deixar as telas renderizarem e tomarem 401 uma a uma.
 */
export function PainelLayout() {
  const { autenticado } = useAuth();
  const { data, isLoading, error } = useSessao(autenticado);

  if (!autenticado) return <Navigate to="/entrar" replace />;
  if (isLoading) return <Carregando />;

  if (error || !data) {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="max-w-md rounded-card border border-critico/35 bg-critico/8 px-5 py-4 text-center">
          <p className="text-sm font-medium text-critico">Não foi possível carregar sua conta</p>
          <p className="mt-1 text-xs text-tinta-2">
            {error instanceof Error ? error.message : "A API não respondeu."} Confira se a API está
            no ar em <code className="text-tinta">localhost:3333</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <Topo usuario={data.usuario} />
      <main className="mx-auto max-w-[1600px] px-4 pt-20 pb-12 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}

function Carregando() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loader2 aria-hidden className="size-6 animate-spin text-tinta-3" />
      <span className="sr-only">Carregando</span>
    </div>
  );
}
