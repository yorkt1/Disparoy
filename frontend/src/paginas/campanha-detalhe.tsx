import { Link, useParams } from "react-router-dom";
import { ChevronLeft, CirclePause, Clock, MessageSquare, Play, QrCode, Users } from "lucide-react";
import type { Incidente } from "@disparoy/dominio";
import {
  BarraProgresso,
  Card,
  CardCabecalho,
  CardCorpo,
  Separador,
} from "@/components/ui/primitivos";
import { Botao, BotaoLink } from "@/components/ui/botao";
import { Carregando, ErroCarregamento } from "@/components/ui/estados";
import { useToast } from "@/components/ui/toast";
import { GraficoStatus } from "@/components/charts/grafico-status";
import { AberturaOrigem, SeloOrigem } from "@/components/avisos/selo-origem";
import { ROTULO_CONEXAO, SeloCampanha } from "@/components/campanhas/selo-status";
import {
  useAlterarExecucao,
  useCampanha,
  useCanais,
  useIncidentesAbertos,
} from "@/hooks/consultas";
import { ErroApi } from "@/lib/api";
import {
  formatarDataHora,
  formatarNumero,
  formatarTelefone,
  percentual,
} from "@/lib/formato";

export function PaginaDetalheCampanha() {
  const { id = "" } = useParams();
  const consulta = useCampanha(id);
  const canaisTodos = useCanais();
  const execucao = useAlterarExecucao();
  const { mostrar } = useToast();

  // Só quando o sistema pausou: é a única situação em que a tela precisa saber
  // de quem foi a culpa. Ver `useIncidentesAbertos`.
  const pausadaPeloSistema = consulta.data?.campanha.status === "pausada_por_canal";
  const incidentes = useIncidentesAbertos(pausadaPeloSistema);

  if (consulta.isLoading) return <Carregando rotulo="Carregando campanha…" />;
  if (consulta.error) {
    return (
      <ErroCarregamento erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
    );
  }

  const campanha = consulta.data?.campanha;
  const contatosAmostra = consulta.data?.contatos ?? [];
  if (!campanha) return <ErroCarregamento erro={new Error("Campanha não encontrada.")} />;

  const canais = (canaisTodos.data ?? []).filter((c) => campanha.canaisIds.includes(c.id));
  const progresso = percentual(campanha.metricas.enviadas, campanha.metricas.total);
  

  const podePausar = campanha.status === "em_andamento" || campanha.status === "agendada";
  // `pausada_por_canal` entra aqui: o operador reconecta o QR e precisa de um
  // botão para seguir. Sem isso a campanha ficaria parada sem saída pelo produto.
  const podeRetomar =
    campanha.status === "pausada" ||
    campanha.status === "pausada_por_canal" ||
    campanha.status === "rascunho";

  async function alterar(acao: "pausar" | "retomar") {
    try {
      await execucao.mutateAsync({ id, acao });
      mostrar({
        tipo: "info",
        titulo: acao === "pausar" ? "Campanha pausada" : "Campanha retomada",
        descricao:
          acao === "pausar"
            ? "Os envios ainda na fila não serão processados."
            : "O worker retoma de onde parou.",
      });
    } catch (e) {
      mostrar({
        tipo: "erro",
        titulo: "Não foi possível alterar a campanha",
        descricao: e instanceof ErroApi ? e.message : "Tente novamente.",
      });
    }
  }

  return (
    <>
      <div className="mb-6">
        <Link
          to="/campanhas"
          className="inline-flex items-center gap-1 text-xs text-tinta-3 transition-colors hover:text-tinta"
        >
          <ChevronLeft aria-hidden className="size-3.5" />
          Campanhas
        </Link>

        {campanha.status === "pausada_por_canal" && (
          <FaixaPausaAutomatica
            motivo={campanha.pausadaMotivo}
            incidente={incidenteDaCampanha(incidentes.data, id, campanha.canaisIds)}
          />
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-tinta">{campanha.nome}</h1>
            <SeloCampanha status={campanha.status} />
          </div>

          {podePausar || podeRetomar ? (
            <Botao
              variante={podePausar ? "secundario" : "primario"}
              carregando={execucao.isPending}
              onClick={() => alterar(podePausar ? "pausar" : "retomar")}
            >
              {execucao.isPending ? null : podePausar ? (
                <CirclePause aria-hidden className="size-4" />
              ) : (
                <Play aria-hidden className="size-4" />
              )}
              {podePausar ? "Pausar" : "Retomar"}
            </Botao>
          ) : null}
        </div>

        <p className="mt-1 text-sm text-tinta-3">
          Criada em {formatarDataHora(campanha.criadaEm)}
          {campanha.iniciadaEm ? ` · iniciada em ${formatarDataHora(campanha.iniciadaEm)}` : ""}
          {campanha.agendadaPara
            ? ` · agendada para ${formatarDataHora(campanha.agendadaPara)}`
            : ""}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardCabecalho
              titulo="Progresso"
              descricao={`${formatarNumero(campanha.metricas.enviadas)} de ${formatarNumero(
                campanha.metricas.total,
              )} contatos processados`}
            />
            <CardCorpo>
              <BarraProgresso
                valor={progresso}
                rotulo={`Progresso de ${campanha.nome}`}
                tom={
                  campanha.status === "falhou"
                    ? "critico"
                    : campanha.status === "pausada"
                      ? "aviso"
                      : "marca"
                }
              />
              {campanha.status === "em_andamento" ? (
                <p className="mt-2.5 text-xs text-tinta-3">
                  Atualizando a cada 10 segundos enquanto o worker processa a fila.
                </p>
              ) : null}
            </CardCorpo>
          </Card>

          <Card>
            <CardCabecalho titulo="Mensagens por status" />
            <Separador />
            <GraficoStatus
              enviadas={campanha.metricas.enviadas}
              entregues={campanha.metricas.entregues}
              lidas={campanha.metricas.lidas}
              falhas={campanha.metricas.falhas}
            />
          </Card>

          <Card>
            <CardCabecalho
              titulo="Sequência enviada"
              descricao={`${campanha.sequencia.length} mensagens por contato`}
            />
            <Separador />
            <CardCorpo className="pt-4">
              <ol className="flex flex-col gap-2.5">
                {campanha.sequencia.map((m, i) => (
                  <li
                    key={m.id}
                    className="flex gap-3 rounded-lg border border-borda-forte bg-superficie-2 px-3.5 py-3"
                  >
                    <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-superficie-3 text-[11px] font-semibold text-tinta-2">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm whitespace-pre-wrap text-tinta-2">{m.corpo}</p>
                      {m.midia ? (
                        <p className="mt-1.5 text-xs text-tinta-3">
                          {m.midia.tipo}: {m.midia.nomeArquivo}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </CardCorpo>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardCabecalho titulo="Configuração" />
            <Separador />
            <dl className="divide-y divide-borda">
              <ItemDefinicao
                rotulo="Contatos"
                valor={formatarNumero(campanha.metricas.total)}
                icone={<Users className="size-3.5" />}
              />
              <ItemDefinicao
                rotulo="Mensagens por contato"
                valor={formatarNumero(campanha.sequencia.length)}
                icone={<MessageSquare className="size-3.5" />}
              />
              <ItemDefinicao
                rotulo="Intervalo entre contatos"
                valor={`${campanha.intervaloEntreContatos.minSegundos}–${campanha.intervaloEntreContatos.maxSegundos}s`}
                icone={<Clock className="size-3.5" />}
              />
              <ItemDefinicao
                rotulo="Intervalo entre mensagens"
                valor={`${campanha.intervaloEntreMensagens.minSegundos}–${campanha.intervaloEntreMensagens.maxSegundos}s`}
                icone={<Clock className="size-3.5" />}
              />
              <ItemDefinicao
                rotulo="Validação de números"
                valor={campanha.validarNumeros ? "Ativada" : "Desativada"}
              />
              <ItemDefinicao
                rotulo="Respostas recebidas"
                valor={formatarNumero(campanha.metricas.respostas)}
              />
            </dl>
          </Card>

          <Card>
            <CardCabecalho titulo="Canais usados" />
            <Separador />
            <CardCorpo className="pt-4">
              <ul className="flex flex-col gap-2">
                {canais.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-borda-forte bg-superficie-2 px-3 py-2.5"
                  >
                    <p className="text-sm text-tinta">{c.nome}</p>
                    <p className="tabular mt-0.5 text-xs text-tinta-3">
                      {c.numero ? formatarTelefone(c.numero) : "sem número"} ·{" "}
                      {ROTULO_CONEXAO[c.tipoConexao]}
                    </p>
                  </li>
                ))}
                {canais.length === 0 ? (
                  <li className="text-xs text-tinta-3">Nenhum canal vinculado.</li>
                ) : null}
              </ul>
            </CardCorpo>
          </Card>

          {contatosAmostra.length > 0 ? (
            <Card>
              <CardCabecalho
                titulo="Amostra de contatos"
                descricao={`Primeiros ${Math.min(contatosAmostra.length, 10)} de ${formatarNumero(
                  campanha.metricas.total,
                )}`}
              />
              <Separador />
              <CardCorpo className="pt-4">
                <ul className="flex flex-col gap-1.5">
                  {contatosAmostra.slice(0, 10).map((c) => (
                    <li key={c.telefone} className="tabular flex justify-between gap-3 text-xs">
                      <span className="text-tinta-2">{formatarTelefone(c.telefone)}</span>
                      <span className="truncate text-tinta-3">{c.variaveis["1"] ?? ""}</span>
                    </li>
                  ))}
                </ul>
              </CardCorpo>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}

function ItemDefinicao({
  rotulo,
  valor,
  icone,
}: {
  rotulo: string;
  valor: string;
  icone?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3">
      <dt className="flex items-center gap-1.5 text-xs text-tinta-3">
        {icone}
        {rotulo}
      </dt>
      <dd className="tabular text-xs text-tinta">{valor}</dd>
    </div>
  );
}


/**
 * Qual incidente aberto explica esta pausa.
 *
 * Duas tentativas, nesta ordem, porque o incidente nem sempre carrega a
 * campanha: o worker abre com `campanha_id`, mas a vigilância periódica abre só
 * com `canal_id` — e o índice único agrupa as duas no MESMO incidente. Procurar
 * apenas pela campanha faria a faixa cair no genérico exatamente no caso em que
 * o canal caiu de madrugada, que é o mais comum de todos.
 */
function incidenteDaCampanha(
  incidentes: Incidente[] | undefined,
  campanhaId: string,
  canaisIds: string[],
): Incidente | null {
  const abertos = incidentes ?? [];
  return (
    abertos.find((i) => i.campanhaId === campanhaId) ??
    abertos.find((i) => i.canalId !== null && canaisIds.includes(i.canalId)) ??
    null
  );
}

/**
 * Faixa da pausa automática.
 *
 * É a tela que responde à pergunta que o sistema inteiro não sabia responder:
 * a campanha parou por culpa de quem?
 *
 * A cor e a ação saem da CATEGORIA do incidente, nunca do texto. Antes esta
 * faixa era vermelha e oferecia "Ver canais" em todos os casos — inclusive
 * quando a culpa era nossa. Ou seja: o painel mandava o cliente pegar o celular
 * e escanear um QR Code que estava funcionando, por causa de um servidor fora
 * do ar. Era o defeito que a arquitetura de atribuição de falha existe para
 * eliminar, sobrevivendo no último metro, dentro da tela.
 *
 * `canal` chama para a ação, porque só ela é resolvida por uma pessoa com o
 * aparelho na mão. As outras dizem, em cor calma e sem botão, que não há nada a
 * fazer — e é isso que evita a ligação perguntando se o sistema quebrou.
 *
 * Sem incidente casado, a faixa fica neutra e repete `pausada_motivo`: não
 * saber de quem é a culpa não autoriza a acusar o WhatsApp do cliente.
 */
function FaixaPausaAutomatica({
  motivo,
  incidente,
}: {
  motivo: string | null;
  incidente: Incidente | null;
}) {
  const categoria = incidente?.categoria ?? null;
  const exigeOperador = categoria === "canal";

  const moldura = exigeOperador
    ? "border-critico/35 bg-critico/10"
    : "border-borda-forte bg-superficie-2";

  return (
    <div
      role="status"
      className={`mt-3 flex flex-wrap items-start gap-3 rounded-xl border p-4 ${moldura}`}
    >
      <CirclePause
        aria-hidden
        className={`mt-0.5 size-4 shrink-0 ${exigeOperador ? "text-critico" : "text-tinta-3"}`}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-tinta">O sistema pausou esta campanha</p>
          {categoria ? <SeloOrigem categoria={categoria} /> : null}
        </div>

        <p className="mt-1 text-sm text-tinta-2">
          {categoria ? (
            <>
              <AberturaOrigem categoria={categoria} />{" "}
            </>
          ) : null}
          {motivo ?? incidente?.titulo ?? "Motivo não registrado."}
        </p>

        <p className="mt-1 text-xs text-tinta-3">
          Nenhum contato foi perdido: os pendentes voltaram para a fila e ninguém recebe duas vezes.
          {exigeOperador
            ? " Assim que o aparelho reconectar, a campanha volta sozinha."
            : " A campanha retoma sozinha quando o problema se resolver — não é preciso fazer nada."}
        </p>
      </div>

      {/* Botão só quando existe algo a fazer. Oferecer "Ver canais" numa falha
          de infra é mandar o operador procurar defeito onde não há. */}
      {exigeOperador ? (
        <BotaoLink to="/canais" variante="primario" tamanho="sm">
          <QrCode aria-hidden className="size-4" />
          Reconectar WhatsApp
        </BotaoLink>
      ) : null}
    </div>
  );
}
