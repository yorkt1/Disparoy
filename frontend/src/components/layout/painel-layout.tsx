import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/auth/contexto-auth";
import { useSessao } from "@/hooks/consultas";
import { LimiteErro } from "@/components/ui/limite-erro";
import { formatarDataHora } from "@/lib/formato";
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
  const { pathname } = useLocation();

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
        {!data.disparo.ativo && <FaixaDisparoParado pulsoEm={data.disparo.pulsoEm} />}
        {/*
          O boundary fica DENTRO do layout, e não em volta dele: uma tela que
          quebra não pode levar o topo junto, ou o operador perde a navegação e
          fica sem caminho de volta a não ser digitar a URL.

          A chave é o pathname — sair da rota quebrada limpa o erro sozinho.
        */}
        <LimiteErro chave={pathname}>
          <Outlet />
        </LimiteErro>
      </main>
    </div>
  );
}

/**
 * O processo que envia as mensagens não está rodando.
 *
 * Fica no layout, acima de qualquer tela, porque o sintoma aparece em todas: a
 * campanha é aceita, marca "Em andamento" e não sai nada. Aconteceu por dias
 * sem que nada no painel dissesse isso — a única pista era a porcentagem
 * parada em 0%, que se explica de mil maneiras.
 *
 * Não é dispensável de propósito: enquanto durar, nenhum disparo acontece.
 */
function FaixaDisparoParado({ pulsoEm }: { pulsoEm: string | null }) {
  return (
    <div
      role="alert"
      className="mb-5 flex flex-wrap items-start gap-3 rounded-xl border border-critico/35 bg-critico/10 p-4"
    >
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-critico" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-tinta">Nenhuma campanha está sendo enviada</p>
        <p className="mt-0.5 text-sm text-tinta-2">
          O processo de disparo não dá sinal de vida. Campanhas continuam sendo criadas e ficam
          paradas em “Em andamento” até ele voltar — nada é perdido.
        </p>
        <p className="mt-1 text-xs text-tinta-3">
          {pulsoEm
            ? `Último sinal em ${formatarDataHora(pulsoEm)}.`
            : "Nenhum sinal desde que o sistema subiu."}
        </p>
      </div>
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
