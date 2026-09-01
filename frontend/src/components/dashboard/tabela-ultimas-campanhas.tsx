import * as React from "react";
import { Link } from "react-router-dom";
import { Megaphone, SquareArrowOutUpRight } from "lucide-react";
import { Tabela, type Coluna } from "@/components/ui/tabela";
import { BotaoLink } from "@/components/ui/botao";
import { BarraProgresso, EstadoVazio } from "@/components/ui/primitivos";
import { SeloCampanha } from "@/components/campanhas/selo-status";
import type { Canal, ResumoCampanha } from "@disparoy/dominio";
import { formatarNumero, formatarQuando } from "@/lib/formato";

interface LinhaCampanha extends ResumoCampanha {
  canaisRotulo: string;
}

export function TabelaUltimasCampanhas({
  campanhas,
  canais,
  porPagina = 6,
  comBusca = false,
  acaoCompacta = false,
}: {
  campanhas: ResumoCampanha[];
  canais: Canal[];
  porPagina?: number;
  comBusca?: boolean;
  /** Só o ícone no botão de detalhes — para a tabela estreita do dashboard. */
  acaoCompacta?: boolean;
}) {
  /*
   * O rótulo do canal é montado AQUI, e não em cada tela.
   *
   * Estava duplicado byte a byte no dashboard e em `/campanhas`, e o defeito
   * que isso produz é o pior tipo: corrigir num lugar deixa o outro mentindo, e
   * as duas telas mostram a mesma tabela.
   */
  const nomeDoCanal = React.useMemo(
    () => new Map(canais.map((c) => [c.id, c.nome])),
    [canais],
  );

  const linhas: LinhaCampanha[] = React.useMemo(
    () => campanhas.map((c) => ({ ...c, canaisRotulo: rotularCanais(c, nomeDoCanal) })),
    [campanhas, nomeDoCanal],
  );

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
      /*
       * Barra enquanto roda; RESULTADO quando terminou.
       *
       * Toda campanha concluída mostrava "Concluída" e "100%" lado a lado —
       * duas colunas dizendo a mesma coisa, e nenhuma respondendo a pergunta
       * que o operador tem depois de um disparo, que é "deu certo?". Uma
       * campanha pode concluir 100% com metade das mensagens falhando e ficar
       * idêntica, na tabela, a uma que funcionou.
       *
       * Os números já vinham na linha (`metricas`); só não estavam sendo
       * mostrados.
       */
      chave: "resultado",
      titulo: "Resultado",
      larguraClasse: "w-44",
      celula: (c) => (terminou(c.status) ? <Resultado campanha={c} /> : <Andamento campanha={c} />),
    },
    {
      chave: "data",
      titulo: "Data",
      alinhamento: "direita",
      celula: (c) => {
        const quando = c.iniciadaEm ?? c.agendadaPara ?? c.criadaEm;
        return (
          <span
            className="tabular whitespace-nowrap text-tinta-3"
            // O relativo perde a precisão que às vezes importa (comparar com o
            // horário de um incidente). O absoluto continua a um hover.
            title={new Date(quando).toLocaleString("pt-BR")}
          >
            {formatarQuando(quando)}
          </span>
        );
      },
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
          tamanho={acaoCompacta ? "icone" : "sm"}
          variante="secundario"
          aria-label={`Ver detalhes da campanha ${c.nome}`}
          title={acaoCompacta ? "Ver detalhes" : undefined}
        >
          <SquareArrowOutUpRight aria-hidden className="size-3.5" />
          {/* No dashboard a tabela divide a largura com o gráfico: com o rótulo
              escrito ela passa a rolar na horizontal, e a última coluna — que é
              justamente a ação — some da vista. */}
          {!acaoCompacta && "Ver detalhes"}
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
  if (linhas.length === 0) {
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
      itens={linhas}
      chaveDe={(c) => c.id}
      porPagina={porPagina}
      buscaPlaceholder={comBusca ? "Buscar campanha pelo nome…" : undefined}
      textoBusca={comBusca ? (c) => `${c.nome} ${c.canaisRotulo}` : undefined}
      vazio="Nenhuma campanha com esse nome."
    />
  );
}

/** Terminou de vez: não há mais o que acompanhar, só o que avaliar. */
function terminou(status: ResumoCampanha["status"]): boolean {
  return status === "concluida" || status === "falhou";
}

function Andamento({ campanha }: { campanha: ResumoCampanha }) {
  return (
    <BarraProgresso
      valor={campanha.progresso}
      rotulo={`Progresso de ${campanha.nome}`}
      tom={
        campanha.status === "pausada" || campanha.status === "pausada_por_canal"
          ? "aviso"
          : "marca"
      }
    />
  );
}

/**
 * O que sobrou da campanha, em números.
 *
 * A falha vem em linha própria e em cor crítica, e só aparece quando existe:
 * é a única parte que pede ação (reler o diagnóstico, reenviar para quem caiu).
 * Somada na mesma linha das entregues, ela desaparecia na leitura rápida.
 */
function Resultado({ campanha }: { campanha: ResumoCampanha }) {
  const { entregues, falhas, total } = campanha.metricas;

  return (
    <div className="leading-tight">
      <span className="tabular text-xs text-tinta-2">
        {formatarNumero(entregues)} de {formatarNumero(total)} entregues
      </span>
      {falhas > 0 ? (
        <span className="tabular mt-0.5 block text-xs font-medium text-critico">
          {formatarNumero(falhas)} {falhas === 1 ? "falhou" : "falharam"}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Qual canal disparou esta campanha.
 *
 * Zero canais era mostrado como "0 canais" — que se lê como "rodou sem canal
 * nenhum", coisa que não acontece. O que houve foi o canal ter sido EXCLUÍDO
 * depois do disparo; a campanha guarda o id, e o id não resolve mais para
 * nome. Rascunho é o único caso em que zero significa mesmo "ainda não
 * escolhi".
 *
 * O `nomes.size === 0` evita a segunda mentira: enquanto a lista de canais não
 * chegou, nenhum id resolve, e sem esta guarda a tabela inteira afirmaria
 * "canal removido" por um instante a cada carregamento.
 */
function rotularCanais(campanha: ResumoCampanha, nomes: Map<string, string>): string {
  if (campanha.canaisIds.length === 0) {
    return campanha.status === "rascunho" ? "nenhum escolhido" : "canal removido";
  }

  if (campanha.canaisIds.length === 1) {
    const nome = nomes.get(campanha.canaisIds[0]);
    if (nome) return nome;
    return nomes.size === 0 ? "—" : "canal removido";
  }

  return `${campanha.canaisIds.length} canais`;
}
