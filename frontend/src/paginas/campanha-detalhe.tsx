import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft,
  CircleAlert,
  CirclePause,
  Clock,
  Copy,
  Download,
  MessageSquare,
  Pencil,
  Play,
  Trash2,
  Users,
} from "lucide-react";
import type { StatusCampanha } from "@disparoy/dominio";
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
import { RitmoDisparo } from "@/components/campanhas/ritmo-disparo";
import { ROTULO_CONEXAO, SeloCampanha } from "@/components/campanhas/selo-status";
import { ListaContatosCampanha } from "@/components/campanhas/lista-contatos-campanha";
import {
  useAlterarExecucao,
  useCampanha,
  useCanais,
  useDuplicarCampanha,
  useExcluirCampanha,
} from "@/hooks/consultas";
import { baixarArquivo, ErroApi } from "@/lib/api";
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
  const exclusao = useExcluirCampanha();
  const duplicacao = useDuplicarCampanha();
  const navegar = useNavigate();
  const { mostrar } = useToast();
  const [baixando, setBaixando] = useState(false);

  if (consulta.isLoading) return <Carregando rotulo="Carregando campanha…" />;
  if (consulta.error) {
    return (
      <ErroCarregamento erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
    );
  }

  const campanha = consulta.data?.campanha;
  if (!campanha) return <ErroCarregamento erro={new Error("Campanha não encontrada.")} />;

  const canais = (canaisTodos.data ?? []).filter((c) => campanha.canaisIds.includes(c.id));
  const progresso = percentual(campanha.metricas.enviadas, campanha.metricas.total);
  

  const podePausar = campanha.status === "em_andamento" || campanha.status === "agendada";
  // `pausada_por_canal` entra aqui: o operador reconecta o QR e precisa de um
  // botão para seguir. Sem isso a campanha ficaria parada sem saída pelo produto.
  const podeRetomar =
    campanha.status === "pausada" ||
    campanha.status === "pausada_por_canal" ||
    campanha.status === "rascunho" ||
    // `falhou` numa CAMPANHA significa que ela não chegou a disparar — o
    // agendamento venceu, ou não havia canal conectado na hora. Nada foi
    // enviado e os contatos seguem pendentes, então há o que retomar. Sem
    // isto ela ficava sem botão nenhum, e o único caminho era duplicar.
    campanha.status === "falhou";

  /*
   * Rascunho não se "retoma": ele nunca começou.
   *
   * A ação é a mesma para os dois — `retomar` põe a campanha em andamento —,
   * mas o rótulo era o de quem volta de uma pausa. Quem acabava de clicar em
   * "Reenviar" caía numa cópia em rascunho, lia "Retomar", não reconhecia
   * aquilo como "mandar esta campanha" e concluía que o reenvio não funcionou.
   * O botão certo estava ali, com o nome do outro caso.
   */
  // Rascunho e `falhou` nunca dispararam: para os dois o verbo é iniciar, não
  // retomar. "Retomar" só descreve a volta de uma pausa.
  const ehRascunho = campanha.status === "rascunho" || campanha.status === "falhou";

  async function alterar(acao: "pausar" | "retomar") {
    try {
      await execucao.mutateAsync({ id, acao });
      mostrar({
        tipo: "info",
        titulo:
          acao === "pausar"
            ? "Campanha pausada"
            : ehRascunho
              ? "Disparo iniciado"
              : "Campanha retomada",
        descricao:
          acao === "pausar"
            ? "Os envios ainda na fila não serão processados."
            : ehRascunho
              ? "O worker começou a enfileirar os contatos."
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

  /**
   * Baixa o relatório da campanha.
   *
   * Uma linha por contato, com até cinco respostas dele. Baixar não confirma
   * leitura nenhuma no WhatsApp: o painel lê o que o webhook já havia gravado,
   * e a notificação continua no celular de quem operou o disparo.
   */
  async function baixarRelatorio() {
    const campanhaAtual = campanha;
    if (!campanhaAtual) return;

    setBaixando(true);
    try {
      const { total } = await baixarArquivo(
        `/campanhas/${id}/relatorio.csv`,
        `relatorio-${campanhaAtual.nome}.csv`,
      );
      mostrar({
        tipo: "sucesso",
        titulo: `${formatarNumero(total ?? 0)} contato(s) no relatório`,
        descricao: "CSV separado por ponto e vírgula, pronto para abrir no Excel.",
      });
    } catch (e) {
      mostrar({
        tipo: "erro",
        titulo: "Não foi possível baixar o relatório",
        descricao: e instanceof ErroApi ? e.message : "Tente novamente.",
      });
    } finally {
      setBaixando(false);
    }
  }

  /**
   * Duplicar leva para a CÓPIA, não deixa o operador na original.
   *
   * O clique só existe porque ele vai mexer no texto ou na data — quem quer a
   * campanha idêntica já a tem rodando. Ficar na tela antiga obrigaria a achar
   * a cópia na lista, e as duas têm quase o mesmo nome.
   *
   * Sem `window.confirm`: a cópia nasce em rascunho, não dispara nada e é
   * excluível em dois cliques. Confirmar cada ação reversível é o que ensina o
   * operador a clicar "OK" sem ler — inclusive no diálogo de excluir.
   */
  async function duplicar() {
    const campanhaAtual = campanha;
    if (!campanhaAtual) return;
    try {
      const { campanha: copia } = await duplicacao.mutateAsync(id);
      mostrar({
        tipo: "sucesso",
        titulo: campanhaAtual.status === "concluida" ? "Pronta para reenviar" : "Campanha duplicada",
        descricao: `"${copia.nome}" foi criada como rascunho com ${formatarNumero(copia.metricas.total)} contato(s). Nada foi disparado.`,
      });
      navegar(`/campanhas/${copia.id}`);
    } catch (e) {
      mostrar({
        tipo: "erro",
        titulo: "Não foi possível duplicar a campanha",
        descricao: e instanceof ErroApi ? e.message : "Tente novamente.",
      });
    }
  }

  async function excluir() {
    const campanhaAtual = campanha;
    if (!campanhaAtual) return;
    if (!window.confirm(`Excluir a campanha "${campanhaAtual.nome}"? Essa ação não pode ser desfeita.`)) {
      return;
    }
    try {
      await exclusao.mutateAsync(id);
      mostrar({ tipo: "info", titulo: "Campanha excluída" });
      navegar("/campanhas");
    } catch (e) {
      mostrar({
        tipo: "erro",
        titulo: "Não foi possível excluir a campanha",
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

        {/*
          `falhou` só entra na faixa QUANDO tem motivo: a campanha que falhou
          por falta de canal conectado não grava nada em `pausadaMotivo`, e uma
          faixa dizendo "motivo não registrado" é pior do que faixa nenhuma.
        */}
        {(campanha.status === "pausada_por_canal" ||
          (campanha.status === "falhou" && campanha.pausadaMotivo)) && (
          <FaixaParadaPeloSistema status={campanha.status} motivo={campanha.pausadaMotivo} />
        )}

        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-tinta">{campanha.nome}</h1>
            <SeloCampanha status={campanha.status} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Botao
              tamanho="sm"
              variante="secundario"
              carregando={baixando}
              onClick={() => void baixarRelatorio()}
            >
              {!baixando ? <Download aria-hidden className="size-4" /> : null}
              Relatório
            </Botao>
            <BotaoLink to={`/campanhas/${id}/editar`} tamanho="sm" variante="secundario">
              <Pencil aria-hidden className="size-4" />
              Editar
            </BotaoLink>
            {/*
              O rótulo segue a INTENÇÃO, não o mecanismo.

              A ação é a mesma nos dois casos — cria uma cópia em rascunho —,
              mas "Duplicar" só descreve o que o sistema faz. Quem terminou uma
              campanha e quer mandar de novo procura "reenviar", não acha, e
              conclui que o produto não tem isso. Foi exatamente o que
              aconteceu: "como que eu reenvio ela? se tem tá escondido".
            */}
            <Botao
              tamanho="sm"
              variante="secundario"
              carregando={duplicacao.isPending}
              onClick={() => void duplicar()}
              title={
                campanha.status === "concluida"
                  ? "Cria uma cópia desta campanha em rascunho, com o mesmo público e as mesmas mensagens. Nada é disparado até você iniciar."
                  : "Cria uma cópia desta campanha em rascunho, para editar sem mexer na original."
              }
            >
              {!duplicacao.isPending ? <Copy aria-hidden className="size-4" /> : null}
              {campanha.status === "concluida" ? "Reenviar" : "Duplicar"}
            </Botao>
            <Botao tamanho="sm" variante="perigo" carregando={exclusao.isPending} onClick={() => void excluir()}>
              {!exclusao.isPending ? <Trash2 aria-hidden className="size-4" /> : null}
              Excluir
            </Botao>
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
                {podePausar ? "Pausar" : ehRascunho ? "Iniciar disparo" : "Retomar"}
              </Botao>
            ) : null}
          </div>
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

          {/*
            Só enquanto dispara: parada, a campanha não tem ritmo a conferir, e
            o cartão viraria um relógio contando desde a última mensagem de
            ontem. O `?? []` cobre a API que ainda não devolve o campo — painel
            e API sobem separado.
          */}
          {campanha.status === "em_andamento" ? (
            <RitmoDisparo
              ultimosEnvios={consulta.data?.ultimosEnvios ?? []}
              faixa={campanha.intervaloEntreContatos}
            />
          ) : null}

          <ListaContatosCampanha id={id} status={campanha.status} />

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
 * Faixa da pausa automática.
 *
 * É a tela que responde à pergunta que o sistema inteiro não sabia responder:
 * a campanha parou por culpa de quem? O texto vem pronto de `pausada_motivo`,
 * gravado no momento da pausa e já escrito na língua do operador — a tela não
 * interpreta código de erro nem compara string.
 */
/**
 * A faixa que explica o que o SISTEMA fez com a campanha — e ela é obrigatória.
 *
 * Sem isto, os dois casos aqui aparecem na tela como um selo de status e mais
 * nada: o operador vê "pausada" ou "falhou" e não tem como saber o porquê nem o
 * que fazer. É a falha silenciosa que este produto passa o tempo todo tentando
 * não ter.
 *
 * Os dois casos precisam de textos diferentes porque o desfecho é diferente:
 *
 *  - `pausada_por_canal` é reversível. Parte já saiu, os pendentes voltaram
 *    para a fila e reconectar o canal retoma de onde parou. O CTA é o canal.
 *  - `falhou` por agendamento expirado é definitivo. NADA saiu, e a campanha
 *    não volta a andar — `retomar` não a aceita, de propósito. Prometer "nenhum
 *    contato foi perdido" aqui faria o operador esperar por um envio que nunca
 *    vem; o CTA é criar de novo.
 */
function FaixaParadaPeloSistema({
  status,
  motivo,
}: {
  status: StatusCampanha;
  motivo: string | null;
}) {
  const falhou = status === "falhou";
  const Icone = falhou ? CircleAlert : CirclePause;

  return (
    <div
      role="status"
      className="mt-3 flex flex-wrap items-start gap-3 rounded-xl border border-critico/35 bg-critico/10 p-4"
    >
      <Icone aria-hidden className="mt-0.5 size-4 shrink-0 text-critico" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-tinta">
          {falhou ? "Esta campanha não chegou a sair" : "O sistema pausou esta campanha"}
        </p>
        <p className="mt-0.5 text-sm text-tinta-2">{motivo ?? "Motivo não registrado."}</p>
        <p className="mt-1 text-xs text-tinta-3">
          {falhou
            ? "Ninguém recebeu mensagem desta campanha. Ela não será retomada automaticamente."
            : "Nenhum contato foi perdido: os pendentes voltaram para a fila e ninguém recebe duas vezes."}
        </p>
      </div>
      <BotaoLink to={falhou ? "/campanhas/nova" : "/canais"} variante="primario" tamanho="sm">
        {falhou ? "Criar de novo" : "Ver canais"}
      </BotaoLink>
    </div>
  );
}
