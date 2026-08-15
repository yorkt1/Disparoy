import { useState } from "react";
import { BellOff, CheckCheck } from "lucide-react";
import type { CategoriaFalha } from "@disparoy/dominio";
import { ORIGENS } from "@disparoy/dominio";
import { Botao } from "@/components/ui/botao";
import { Carregando, ErroCarregamento } from "@/components/ui/estados";
import { CartaoAviso } from "@/components/avisos/cartao-aviso";
import { useAvisos, useMarcarTodosAvisosLidos } from "@/hooks/consultas";

const CATEGORIAS = Object.keys(ORIGENS) as CategoriaFalha[];

/**
 * Caixa cheia.
 *
 * O filtro é por CATEGORIA, não por texto: é a pergunta que o operador
 * realmente tem — "isso é problema meu ou de vocês?" — respondida em um clique.
 */
export function PaginaAvisos() {
  const [incluirLidos, setIncluirLidos] = useState(true);
  const [filtro, setFiltro] = useState<CategoriaFalha | "todas">("todas");

  const consulta = useAvisos(incluirLidos);
  const marcarTodos = useMarcarTodosAvisosLidos();

  const avisos = (consulta.data ?? []).filter(
    (a) => filtro === "todas" || a.categoria === filtro,
  );
  const naoLidos = (consulta.data ?? []).filter((a) => a.lidaEm === null).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-medium text-tinta">Avisos</h1>
        {naoLidos > 0 && (
          <span className="rounded-full bg-critico/15 px-2.5 py-1 text-xs font-medium text-critico ring-1 ring-critico/35 ring-inset">
            {naoLidos} {naoLidos === 1 ? "novo" : "novos"}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <Botao
            variante="fantasma"
            tamanho="sm"
            onClick={() => setIncluirLidos((v) => !v)}
          >
            {incluirLidos ? "Só não lidos" : "Mostrar lidos"}
          </Botao>
          {naoLidos > 0 && (
            <Botao
              tamanho="sm"
              onClick={() => marcarTodos.mutate()}
              carregando={marcarTodos.isPending}
            >
              <CheckCheck className="size-4" />
              Marcar todos como lidos
            </Botao>
          )}
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <FiltroChip ativo={filtro === "todas"} onClick={() => setFiltro("todas")}>
          Todas
        </FiltroChip>
        {CATEGORIAS.map((c) => (
          <FiltroChip key={c} ativo={filtro === c} onClick={() => setFiltro(c)}>
            {ORIGENS[c].rotulo}
          </FiltroChip>
        ))}
      </div>

      {consulta.isLoading && <Carregando rotulo="Carregando avisos…" />}
      {consulta.error && (
        <ErroCarregamento erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      )}

      {!consulta.isLoading && !consulta.error && avisos.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-borda bg-superficie-2 px-6 py-12 text-center">
          <BellOff className="size-5 text-tinta-3" aria-hidden />
          <p className="text-sm font-medium text-tinta">Nada por aqui</p>
          <p className="max-w-sm text-sm text-tinta-2">
            Quando um canal cair ou uma campanha parar, o aviso aparece nesta tela.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {avisos.map((a) => (
          <CartaoAviso key={a.id} aviso={a} />
        ))}
      </div>
    </div>
  );
}

function FiltroChip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
        ativo
          ? "bg-marca/12 text-marca-tenue ring-marca/30"
          : "bg-superficie-2 text-tinta-2 ring-borda-forte hover:bg-superficie-3",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
