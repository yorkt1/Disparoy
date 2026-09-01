
import { Link } from "react-router-dom";
import { Megaphone, SquareArrowOutUpRight } from "lucide-react";
import { Tabela, type Coluna } from "@/components/ui/tabela";
import { BotaoLink } from "@/components/ui/botao";
import { BarraProgresso, EstadoVazio } from "@/components/ui/primitivos";
import { SeloCampanha } from "@/components/campanhas/selo-status";
import type { ResumoCampanha } from "@disparoy/dominio";
import { formatarData, formatarNumero } from "@/lib/formato";

export interface LinhaCampanha extends ResumoCampanha {
  canaisRotulo: string;
}

export function TabelaUltimasCampanhas({
  campanhas,
  porPagina = 6,
  comBusca = false,
}: {
  campanhas: LinhaCampanha[];
  porPagina?: number;
  comBusca?: boolean;
}) {
  const colunas: Coluna<LinhaCampanha>[] = [
    {
      chave: "nome",
      titulo: "Campanha",
      celula: (c) => (
        <Link
          to={`/campanhas/${c.id}`}
          className="inline-block max-w-72 truncate font-medium text-tinta underline decoration-transparent underline-offset-4 transition-colors hover:text-marca-tenue hover:decoration-current"
        >
          {c.nome}
        </Link>
      ),
    },
    {
      chave: "canal",
      titulo: "Canal",
      celula: (c) => <span className="text-tinta-2">{c.canaisRotulo}</span>,
    },
    {
      chave: "template",
      titulo: "Template",
      celula: (c) =>
        c.templatePrincipal ? (
          <code className="rounded bg-superficie-3 px-1.5 py-0.5 text-xs text-tinta-2">
            {c.templatePrincipal}
          </code>
        ) : (
          <span className="text-tinta-3">Texto livre</span>
        ),
    },
    {
      chave: "contatos",
      titulo: "Contatos",
      alinhamento: "direita",
      celula: (c) => (
        <span className="tabular text-tinta-2">{formatarNumero(c.metricas.total)}</span>
      ),
    },
    {
      chave: "status",
      titulo: "Status",
      celula: (c) => <SeloCampanha status={c.status} />,
    },
    {
      chave: "progresso",
      titulo: "Progresso",
      larguraClasse: "w-44",
      celula: (c) => (
        <BarraProgresso
          valor={c.progresso}
          rotulo={`Progresso de ${c.nome}`}
          tom={c.status === "falhou" ? "critico" : c.status === "pausada" ? "aviso" : "marca"}
        />
      ),
    },
    {
      chave: "data",
      titulo: "Data",
      alinhamento: "direita",
      celula: (c) => (
        <span className="tabular whitespace-nowrap text-tinta-3">
          {formatarData(c.iniciadaEm ?? c.agendadaPara ?? c.criadaEm)}
        </span>
      ),
    },
    {
      /*
       * Um botão de verdade para abrir a campanha.
       *
       * O caminho até os detalhes era o nome da campanha, com uma setinha de
       * 14px ao lado. Nome de item em tabela não parece link — parece rótulo —
       * e a seta só aparecia depois de reparar nela. O resultado é que a tela
       * de detalhes, que é onde se acompanha contato por contato e se pausa o
       * disparo, ficava escondida atrás de um clique que ninguém adivinha.
       *
       * O nome continua clicável para quem já conhece o caminho; o botão é
       * para quem não conhece.
       */
      chave: "acoes",
      titulo: "Ações",
      alinhamento: "direita",
      celula: (c) => (
        <BotaoLink
          to={`/campanhas/${c.id}`}
          tamanho="sm"
          variante="secundario"
          aria-label={`Ver detalhes da campanha ${c.nome}`}
        >
          <SquareArrowOutUpRight aria-hidden className="size-3.5" />
          Ver detalhes
        </BotaoLink>
      ),
    },
  ];

  /*
   * "Não existe nenhuma" e "a busca não achou" são telas diferentes.
   *
   * O `vazio` da `Tabela` cobre só o segundo caso: ela filtra por dentro, e a
   * mensagem aparece depois da busca. Passar "Crie a primeira" ali mandava o
   * operador criar campanha porque digitou um nome que não casou — com
   * dezenas delas na tela um segundo antes. É o mesmo desenho de
   * `lista-templates`, `lista-canais` e `lista-usuarios`: estado vazio fora da
   * tabela, mensagem de filtro dentro.
   */
  if (campanhas.length === 0) {
    return (
      <EstadoVazio
        icone={<Megaphone className="size-7" />}
        titulo="Nenhuma campanha ainda"
        descricao="Crie a primeira em “Nova Campanha”."
      />
    );
  }

  return (
    <Tabela
      colunas={colunas}
      itens={campanhas}
      chaveDe={(c) => c.id}
      porPagina={porPagina}
      buscaPlaceholder={comBusca ? "Buscar campanha pelo nome…" : undefined}
      textoBusca={comBusca ? (c) => `${c.nome} ${c.canaisRotulo}` : undefined}
      vazio="Nenhuma campanha com esse nome."
    />
  );
}
