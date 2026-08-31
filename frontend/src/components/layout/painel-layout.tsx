import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Eye, Loader2 } from "lucide-react";
import { useAuth } from "@/auth/contexto-auth";
import { useSessao } from "@/hooks/consultas";
import { LimiteErro } from "@/components/ui/limite-erro";
import { Botao } from "@/components/ui/botao";
import { cn } from "@/lib/formato";
import { voltarParaSessaoOriginal } from "@/lib/sessao";
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
            {error instanceof Error ? error.message : "A API não respondeu."}{" "}
            {/*
              A dica de localhost é para QUEM DESENVOLVE, e só aparece aqui.

              Em produção ela chegou à tela de um cliente, embaixo de "Este
              acesso foi desativado": ele não tem localhost:3333 nenhum para
              conferir, e o que a frase comunica é que o sistema está pela
              metade — bem no momento em que ele já está com um problema.
            */}
            {import.meta.env.DEV
              ? "Confira se a API está no ar em localhost:3333."
              : "Tente novamente em alguns instantes. Se continuar, avise o suporte."}
          </p>
          <Botao
            variante="secundario"
            tamanho="sm"
            onClick={() => window.location.reload()}
            className="mt-3"
          >
            Tentar de novo
          </Botao>
        </div>
      </div>
    );
  }

  const via = data.usuario.personificadoPor;

  return (
    <div className="min-h-dvh">
      {via ? <TarjaPersonificacao nome={data.usuario.nome} via={via.nome} /> : null}
      <Topo usuario={data.usuario} />
      <main
        className={cn(
          "mx-auto max-w-[1600px] px-4 pb-12 sm:px-6",
          // A tarja empurra o topo fixo para baixo; sem isto o conteúdo entra
          // por baixo dele.
          via ? "pt-32" : "pt-20",
        )}
      >
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

function Carregando() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Loader2 aria-hidden className="size-6 animate-spin text-tinta-3" />
      <span className="sr-only">Carregando</span>
    </div>
  );
}

/**
 * A tarja que diz "você não é você agora".
 *
 * Fixa no topo, acima de tudo, e em cor de alerta de propósito: dentro da
 * conta de um cliente o painel é IDÊNTICO ao normal, e o erro que isso convida
 * — pausar a campanha errada, excluir o canal errado — é caro e não tem
 * desfazer. A tarja é a única coisa na tela que distingue as duas situações.
 *
 * O botão de voltar recarrega a página em vez de só trocar o estado do React:
 * a sessão mudou por baixo do react-query, e recarregar é o jeito mais curto
 * de garantir que nada do cliente sobreviva na memória da aba.
 */
function TarjaPersonificacao({ nome, via }: { nome: string; via: string }) {
  function voltar() {
    if (!voltarParaSessaoOriginal()) {
      // A sessão guardada venceu enquanto o suporte estava dentro do cliente.
      // Dizer isso é melhor que restaurar um token morto e mostrar um 401.
      window.location.assign("/entrar");
      return;
    }
    window.location.assign("/dashboard");
  }

  return (
    <div className="fixed inset-x-0 top-0 z-50 bg-aviso/95 text-superficie backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 sm:px-6">
        <Eye aria-hidden className="size-4 shrink-0" />
        <p className="min-w-0 flex-1 text-xs font-medium">
          Você está dentro da conta de <strong>{nome.replace(` (via ${via})`, "")}</strong>. Tudo
          que fizer aqui vale para o cliente, e fica registrado como feito por você.
        </p>
        <Botao tamanho="sm" variante="secundario" onClick={voltar} className="shrink-0">
          Voltar para minha conta
        </Botao>
      </div>
    </div>
  );
}
