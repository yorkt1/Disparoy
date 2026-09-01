import * as React from "react";
import { Search } from "lucide-react";
import type {
  ContatoDaCampanha,
  RespostaRecebida,
  ResumoSituacao,
  SituacaoContato,
  StatusCampanha,
  TipoResposta,
} from "@disparoy/dominio";
import { Card, CardCabecalho, EstadoVazio, Separador } from "@/components/ui/primitivos";
import { Paginacao } from "@/components/ui/tabela";
import { Carregando } from "@/components/ui/estados";
import { ROTULO_SITUACAO, SeloSituacao } from "./selo-status";
import { INTERVALO_AO_VIVO, INTERVALO_APOS_DISPARO, useContatosDaCampanha } from "@/hooks/consultas";
import { cn, formatarDataHora, formatarNumero, formatarTelefone } from "@/lib/formato";

/**
 * Quem recebeu, quem leu, quem respondeu.
 *
 * A tela de campanha mostrava o TOTAL de respostas e uma amostra de telefones
 * sem estado nenhum — quem disparava e recebia resposta não via nada mudar. É
 * a tela que faltava, e é a única do painel em que a resposta de um contato
 * aparece.
 *
 * Ver aqui não custa a notificação no celular de quem operou o disparo: o
 * painel lê o que o webhook gravou, e nada em caminho nenhum confirma leitura
 * no WhatsApp.
 */

/**
 * A ordem dos filtros é a do funil, invertida.
 *
 * "Respondeu" primeiro porque é o único que pede AÇÃO — tem gente esperando
 * resposta do outro lado. Ordenar por volume colocaria "Na fila" na frente no
 * começo do disparo e o empurraria para o fim no meio, e um filtro que muda de
 * lugar sozinho obriga a reler a barra toda vez.
 */
const FILTROS: (SituacaoContato | "todas")[] = [
  "todas",
  "respondeu",
  "lido",
  "enviado",
  "falhou",
  "pendente",
];

/**
 * De quanto em quanto tempo a lista se atualiza sozinha, pelo status da
 * campanha.
 *
 * A pergunta não é "a campanha está rodando?" e sim "ainda pode chegar coisa
 * nova nesta tela?" — e as duas têm respostas diferentes. Enquanto dispara,
 * mudam situação e contagem, então vale o ritmo do resto do painel. Depois que
 * termina, continuam chegando resposta e recibo de leitura, durante horas: uma
 * campanha `concluida` é o caso em que esta lista MAIS importa, e era
 * exatamente onde a atualização automática estava desligada.
 *
 * `rascunho` e `agendada` não disparam nada e não recebem nada — ali buscar
 * de novo é pedir a mesma resposta para sempre.
 */
function intervaloPara(status: StatusCampanha): number | false {
  if (status === "rascunho" || status === "agendada") return false;
  return status === "em_andamento" ? INTERVALO_AO_VIVO : INTERVALO_APOS_DISPARO;
}

export function ListaContatosCampanha({ id, status }: { id: string; status: StatusCampanha }) {
  const [situacao, setSituacao] = React.useState<SituacaoContato | "todas">("todas");
  const [busca, setBusca] = React.useState("");
  const [pagina, setPagina] = React.useState(1);

  // Debounce: sem ele cada tecla vira uma requisição, e um telefone de 13
  // dígitos manda treze buscas das quais só a última interessa.
  const [buscaAplicada, setBuscaAplicada] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [busca]);

  const consulta = useContatosDaCampanha(
    id,
    { pagina, situacao, busca: buscaAplicada },
    intervaloPara(status),
  );

  const dados = consulta.data;
  const itens = dados?.itens ?? [];
  const resumo: ResumoSituacao = dados?.resumo ?? {};
  const totalGeral = Object.values(resumo).reduce((s, n) => s + (n ?? 0), 0);

  function trocarFiltro(novo: SituacaoContato | "todas") {
    setSituacao(novo);
    // Voltar para a primeira página é obrigatório: quem estava na página 7 de
    // "todas" e filtra por "respondeu" cairia numa página que não existe, e a
    // tela ficaria vazia com o contador dizendo que há resultados.
    setPagina(1);
  }

  return (
    <Card>
      <CardCabecalho
        titulo="Contatos"
        descricao={
          totalGeral > 0
            ? `${formatarNumero(totalGeral)} no público da campanha`
            : "Ninguém no público ainda"
        }
      />

      <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
        {FILTROS.map((f) => {
          const quantos = f === "todas" ? totalGeral : (resumo[f] ?? 0);
          const ativo = situacao === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => trocarFiltro(f)}
              aria-pressed={ativo}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                ativo
                  ? "border-marca bg-marca/12 text-marca-tenue"
                  : "border-borda-forte bg-superficie-2 text-tinta-2 hover:border-borda-forte hover:text-tinta",
              )}
            >
              {f === "todas" ? "Todos" : ROTULO_SITUACAO[f]}
              <span className="tabular text-tinta-3">{formatarNumero(quantos)}</span>
            </button>
          );
        })}

        <div className="relative ml-auto">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-tinta-3"
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar telefone"
            aria-label="Buscar contato por telefone"
            className="h-9 w-48 rounded-lg border border-borda-forte bg-superficie-2 pr-3 pl-8 text-sm text-tinta placeholder:text-tinta-3 focus:border-marca focus:outline-none"
          />
        </div>
      </div>

      <Separador />

      {consulta.isLoading ? (
        <Carregando rotulo="Carregando contatos…" />
      ) : itens.length === 0 ? (
        <EstadoVazio
          titulo={
            buscaAplicada
              ? "Nenhum contato com esse telefone"
              : situacao === "todas"
                ? "A campanha ainda não tem público"
                : `Ninguém em "${ROTULO_SITUACAO[situacao as SituacaoContato]}"`
          }
          descricao={
            situacao === "respondeu"
              ? "As respostas aparecem aqui assim que o contato escrever de volta."
              : undefined
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-borda text-left">
                  <th className="px-5 py-2.5 text-xs font-medium text-tinta-3">Contato</th>
                  <th className="px-5 py-2.5 text-xs font-medium text-tinta-3">Situação</th>
                  <th className="px-5 py-2.5 text-right text-xs font-medium text-tinta-3">
                    Respostas
                  </th>
                  <th className="px-5 py-2.5 text-xs font-medium text-tinta-3">Lido em</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((c) => (
                  <LinhaContato key={c.id} contato={c} />
                ))}
              </tbody>
            </table>
          </div>

          {dados && dados.totalPaginas > 1 ? (
            <Paginacao
              pagina={dados.pagina}
              totalPaginas={dados.totalPaginas}
              total={dados.total}
              porPagina={dados.porPagina}
              aoMudar={setPagina}
            />
          ) : null}
        </>
      )}
    </Card>
  );
}

function LinhaContato({ contato }: { contato: ContatoDaCampanha }) {
  /*
   * `?? []` cobre a API que ainda não devolve o campo.
   *
   * Painel e API sobem separado — Vercel e Render —, então existe SEMPRE uma
   * janela em que a tela nova conversa com o servidor antigo. Sem o padrão,
   * `ultimasRespostas` chega `undefined` e a tela inteira cai no limite de
   * erro com "Cannot read properties of undefined": o operador perde a lista
   * de contatos completa por causa de um campo acessório. Mesmo motivo do
   * `situacao ?? "pendente"` em `paraContatoDaCampanha`.
   */
  const respostas = contato.ultimasRespostas ?? [];

  return (
    <tr className="border-b border-borda last:border-0">
      <td className="px-5 py-3 align-top">
        <p className="text-tinta">{contato.nome ?? formatarTelefone(contato.telefone)}</p>
        {contato.nome ? (
          <p className="tabular mt-0.5 text-xs text-tinta-3">
            {formatarTelefone(contato.telefone)}
          </p>
        ) : null}
        {/*
          O motivo da falha entra embaixo do contato, e não numa coluna
          própria: ele só existe em uma situação, e uma coluna vazia em 95%
          das linhas custa largura que a tabela não tem sobrando.
        */}
        {contato.situacao === "falhou" && contato.motivo ? (
          <p className="mt-1 text-xs text-critico">{contato.motivo}</p>
        ) : null}
        {/*
          O que a pessoa escreveu, embaixo de quem ela é.
          A coluna "Respostas" dizia 3 e o operador não tinha como saber que uma
          delas era "pode me ligar agora?" sem baixar o CSV do relatório — o
          texto estava gravado desde sempre e nunca chegava à tela. Aqui, e não
          numa coluna própria: resposta é frase, não valor, e uma coluna a
          espremeria em duas palavras por linha.
        */}
        {respostas.length > 0 ? (
          <ul className="mt-1.5 flex flex-col gap-1">
            {respostas.map((r, i) => (
              <li
                /* Índice na key porque `RespostaRecebida` não tem id e
                   `recebidaEm` colide quando duas chegam no mesmo segundo. É
                   seguro aqui: a lista vem pronta do servidor, tem no máximo
                   MAX_RESPOSTAS_NA_LISTA itens, não reordena e não guarda
                   estado — nada que o React possa reaproveitar no nó errado. */
                // eslint-disable-next-line react/no-array-index-key
                key={`${contato.id}-${i}`}
                className="border-l-2 border-marca/40 pl-2 text-xs text-tinta-2"
              >
                <span className="whitespace-pre-wrap break-words">{textoDaResposta(r)}</span>
                {r.recebidaEm ? (
                  <span className="tabular ml-1.5 text-tinta-3">
                    {formatarDataHora(r.recebidaEm)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </td>
      <td className="px-5 py-3 align-top">
        <SeloSituacao situacao={contato.situacao} />
      </td>
      <td className="tabular px-5 py-3 text-right align-top text-tinta-2">
        {contato.respostas > 0 ? formatarNumero(contato.respostas) : "—"}
      </td>
      <td className="tabular px-5 py-3 align-top text-xs text-tinta-3">
        {contato.lidaEm ? formatarDataHora(contato.lidaEm) : "—"}
      </td>
    </tr>
  );
}

/**
 * Mídia não tem texto, e uma linha em branco se lê como "não respondeu".
 *
 * O rótulo entre colchetes é o mesmo do CSV do relatório de propósito: o
 * operador que confere a planilha e a tela lado a lado não deve ter de
 * traduzir dois vocabulários para o mesmo áudio.
 */
const ROTULO_MIDIA: Record<Exclude<TipoResposta, "texto">, string> = {
  imagem: "[imagem]",
  audio: "[áudio]",
  video: "[vídeo]",
  documento: "[documento]",
  figurinha: "[figurinha]",
  outro: "[mensagem]",
};

function textoDaResposta(r: RespostaRecebida): string {
  const texto = r.texto.trim();
  // Legenda de imagem chega com texto E tipo `imagem`: mostrar os dois diz o
  // que a pessoa escreveu sem esconder que veio anexo junto.
  if (r.tipo === "texto") return texto || ROTULO_MIDIA.outro;
  return texto ? `${ROTULO_MIDIA[r.tipo]} ${texto}` : ROTULO_MIDIA[r.tipo];
}
