import * as React from "react";

import {
  BadgeCheck,
  CheckCircle2,
  Download,
  KeyRound,
  Plus,
  PlugZap,
  QrCode,
  RefreshCw,
  Smartphone,
  TimerOff,
  Trash2,
} from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo, MensagemErro } from "@/components/ui/campos";
import { Modal } from "@/components/ui/modal";
import { EstadoVazio } from "@/components/ui/primitivos";
import { Tabela, FiltroSelecao, type Coluna } from "@/components/ui/tabela";
import { useToast } from "@/components/ui/toast";
import { ROTULO_CONEXAO, SeloCampanha, SeloCanal } from "@/components/campanhas/selo-status";
import {
  apresentarCanal,
  normalizarTelefone,
  type Canal,
  type MetodoPareamento,
} from "@disparoy/dominio";
import { cn, formatarDataHora, formatarNumero, formatarTelefone } from "@/lib/formato";
import { baixarArquivo, ErroApi } from "@/lib/api";
import {
  contarContatosDoCanal,
  useCriarCanal,
  useExcluirCanal,
  useReconectarCanal,
  useVerificarCanal,
  useVinculosCanal,
  type Pareamento,
} from "@/hooks/consultas";

/** Mensagem de erro legível, preferindo o texto que a API mandou. */
function mensagemDe(e: unknown, padrao: string): string {
  if (e instanceof ErroApi) return e.primeiroCampo ?? e.message;
  return e instanceof Error ? e.message : padrao;
}

/**
 * Enquanto o QR/código está na tela, pergunta ao gateway se já pareou.
 *
 * Sem isto, descobrir que o número conectou dependia de uma de duas coisas:
 * o webhook `CONNECTION_UPDATE` — que nunca chegou nenhuma vez neste sistema,
 * porque exige o gateway alcançar a API — ou a vigilância do worker, que roda
 * de minuto em minuto. Daí os ~40 segundos olhando para um QR já escaneado,
 * sem saber se tinha dado certo.
 *
 * Perguntar direto ao gateway resolve em segundos e não depende de nenhuma das
 * duas. O intervalo de 3 s é curto porque a janela é curta: são poucos
 * segundos entre escanear e confirmar, e ninguém fica nessa tela por muito
 * tempo.
 */
function usePareamentoAoVivo(canalId: string | null, ativo: boolean): Canal | null {
  const verificacao = useVerificarCanal();
  const [conectado, setConectado] = React.useState<Canal | null>(null);

  const verificar = React.useRef(verificacao.mutateAsync);
  verificar.current = verificacao.mutateAsync;

  React.useEffect(() => {
    if (!ativo || !canalId) {
      setConectado(null);
      return;
    }

    let parado = false;
    const timer = setInterval(async () => {
      if (parado) return;
      try {
        const r = await verificar.current(canalId);
        if (!parado && r.confirmado && r.canal.status === "conectado") {
          setConectado(r.canal);
          clearInterval(timer);

          /*
           * Começa a buscar a agenda agora, enquanto a pessoa lê "conexão
           * bem-sucedida".
           *
           * A busca leva ~1 s na Evolution e o resultado fica no cache do
           * servidor, então o download seguinte custa só a montagem da
           * planilha. Como o gatilho é o pareamento — que acontece uma vez por
           * canal — isso não vira carga recorrente no gateway.
           *
           * `void` e `catch` vazio de propósito: é adiantamento, não promessa.
           * Se falhar, o clique no botão faz o caminho normal.
           */
          void contarContatosDoCanal(canalId).catch(() => undefined);
        }
      } catch {
        // Gateway mudo entre uma tentativa e outra é normal durante o
        // pareamento; a próxima rodada tenta de novo.
      }
    }, 3000);

    return () => {
      parado = true;
      clearInterval(timer);
    };
  }, [canalId, ativo]);

  return conectado;
}

/**
 * Confere sozinho, ao abrir a tela, os canais sem verificação recente.
 *
 * Substituiu o botão "Verificar". Um botão transfere para o operador a tarefa
 * de desconfiar do que a tela mostra — e a tela existe justamente para ele não
 * precisar desconfiar. Quem abre Canais quer saber o estado AGORA.
 *
 * Três cuidados que o botão não precisava ter:
 *
 *  - Só os desatualizados. Verificar todos a cada abertura seria uma chamada
 *    HTTP à Evolution por canal, toda vez.
 *  - Um de cada vez, em série. Em paralelo, dez canais viram dez requisições
 *    simultâneas ao gateway, que é exatamente como se toma 429.
 *  - Uma tentativa por montagem, guardada em `ref`. Quando o gateway não
 *    responde nada é gravado, o canal continua desatualizado — e sem esta
 *    trava a tela tentaria de novo em loop infinito.
 */
function useVerificacaoAutomatica(canais: Canal[]): boolean {
  const verificacao = useVerificarCanal();
  const jaTentados = React.useRef(new Set<string>());
  const [rodando, setRodando] = React.useState(false);

  // `mutateAsync` muda de identidade a cada render; a ref mantém o efeito
  // dependendo só da lista de canais.
  const verificar = React.useRef(verificacao.mutateAsync);
  verificar.current = verificacao.mutateAsync;

  const pendentes = canais
    .filter((c) => c.tipoConexao === "qrcode")
    .filter((c) => apresentarCanal(c).confianca !== "confirmado")
    .map((c) => c.id)
    .filter((id) => !jaTentados.current.has(id));

  // Chave estável: sem ela o array novo a cada render reexecutaria o efeito.
  const chave = pendentes.join(",");

  React.useEffect(() => {
    if (!chave) return;
    let cancelado = false;

    (async () => {
      setRodando(true);
      for (const id of chave.split(",")) {
        if (cancelado) break;
        jaTentados.current.add(id);
        // Falha de um canal não pode interromper a fila dos outros.
        await verificar.current(id).catch(() => undefined);
      }
      if (!cancelado) setRodando(false);
    })();

    return () => {
      cancelado = true;
    };
  }, [chave]);

  return rodando;
}

export function ListaCanais({ canais }: { canais: Canal[] }) {
  const [status, setStatus] = React.useState("todos");
  const [conectando, setConectando] = React.useState(false);
  const [reconectando, setReconectando] = React.useState<Canal | null>(null);
  const [extraindo, setExtraindo] = React.useState<string | null>(null);
  const [excluindo, setExcluindo] = React.useState<Canal | null>(null);
  const { mostrar } = useToast();

  const exclusao = useExcluirCanal();
  // Roda em silêncio: o retorno é ignorado de propósito, a tela não anuncia.
  useVerificacaoAutomatica(canais);
  const emAcao = exclusao.isPending ? (exclusao.variables?.id ?? null) : null;

    const filtrados = canais.filter((c) => status === "todos" || c.status === status);

  /*
   * `mudarStatus` saiu junto com o botão Desconectar.
   *
   * Ele gravava o status direto no banco sem tocar na sessão do gateway — era
   * o caminho mais curto para o painel voltar a mentir sobre o estado de um
   * canal. Quem muda o estado agora é o WhatsApp do dono; o painel confere.
   */

  /**
   * Baixa a agenda do número em planilha.
   *
   * Nada é gravado no painel: o arquivo sai com `nome` e `numero`, no mesmo
   * cabeçalho do modelo de importação, para poder voltar por cima depois de
   * editado no Excel.
   */
  /**
   * Espera a agenda chegar antes de baixar.
   *
   * Logo depois do pareamento o WhatsApp ainda está sincronizando os contatos
   * para o gateway, que responde uma lista VAZIA sem erro nenhum. Baixar nesse
   * instante produzia uma planilha em branco e a mensagem "nenhum contato na
   * agenda deste número" — falsa, porque a agenda existe e só não tinha
   * chegado.
   *
   * Então o botão fica girando e a contagem é consultada até vir algo. O teto
   * de 90 s existe porque a espera precisa terminar de algum jeito: um número
   * recém-criado pode realmente ter zero contatos, e girar para sempre seria
   * trocar uma mentira por outra.
   */
  async function extrair(canal: Canal) {
    setExtraindo(canal.id);
    mostrar({
      tipo: "info",
      titulo: "Buscando os contatos no WhatsApp…",
      descricao: "A agenda vem do aparelho conectado; pode levar alguns segundos.",
    });

    const ate = Date.now() + 90_000;
    try {
      let disponiveis = 0;
      while (Date.now() < ate) {
        disponiveis = (await contarContatosDoCanal(canal.id)).total;
        if (disponiveis > 0) break;
        await new Promise((r) => setTimeout(r, 2500));
      }

      if (disponiveis === 0) {
        mostrar({
          tipo: "aviso",
          titulo: "A agenda ainda não chegou",
          descricao:
            "O WhatsApp não terminou de sincronizar os contatos deste número. Tente de novo em um minuto.",
        });
        return;
      }

      const { total } = await baixarArquivo(
        `/canais/${canal.id}/contatos.xlsx`,
        `contatos-${canal.nome}.xlsx`,
      );
      mostrar({
        tipo: "sucesso",
        titulo: `${total ?? disponiveis} contato(s) na planilha`,
        descricao: "Baixada com as colunas nome e numero.",
      });
    } catch (e) {
      mostrar({
        tipo: "erro",
        titulo: "Não foi possível extrair os contatos",
        descricao: mensagemDe(e, "Tente novamente."),
      });
    } finally {
      setExtraindo(null);
    }
  }

  async function confirmarExclusao(canal: Canal) {
    try {
      await exclusao.mutateAsync({ id: canal.id, forcar: true });
      setExcluindo(null);
      mostrar({ tipo: "info", titulo: "Canal excluído", descricao: canal.nome });
    } catch (e) {
      mostrar({
        tipo: "erro",
        titulo: "Não foi possível excluir o canal",
        descricao: mensagemDe(e, "Tente novamente."),
      });
    }
  }

  const colunas: Coluna<Canal>[] = [
    {
      chave: "nome",
      titulo: "Canal",
      celula: (c) => (
        <div className="flex items-center gap-2.5">
          {/*
            A foto do WhatsApp no lugar do ícone genérico.

            Com vários números conectados, o ícone era o mesmo para todos e
            "de qual WhatsApp estou disparando?" virava uma pergunta respondida
            lendo o número dígito a dígito.

            `onError` volta ao ícone: a imagem mora no nosso Storage, mas um
            arquivo removido à mão não pode deixar um quadrado quebrado na
            tabela.
          */}
          {c.fotoUrl ? (
            <img
              src={c.fotoUrl}
              alt=""
              width={32}
              height={32}
              loading="lazy"
              className="size-8 shrink-0 rounded-lg object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
                e.currentTarget.nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <span
            aria-hidden
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg bg-superficie-3 text-tinta-3",
              c.fotoUrl && "hidden",
            )}
          >
            {c.tipoConexao === "api_oficial" ? (
              <BadgeCheck className="size-4" />
            ) : (
              <QrCode className="size-4" />
            )}
          </span>
          <div>
            <p className="text-sm font-medium text-tinta">{c.nome}</p>
            <p className="text-xs text-tinta-3">{ROTULO_CONEXAO[c.tipoConexao]}</p>
          </div>
        </div>
      ),
    },
    {
      chave: "numero",
      titulo: "Número",
      celula: (c) =>
        c.numero ? (
          <span className="tabular text-tinta-2">{formatarTelefone(c.numero)}</span>
        ) : (
          // Antes de parear ninguém sabe qual é — inclusive o sistema.
          <span className="text-xs text-tinta-3">aguardando pareamento</span>
        ),
    },
    {
      chave: "uso",
      titulo: "Enviadas hoje",
      alinhamento: "direita",
      /*
       * Só o número, sem "/50".
       *
       * O teto diário deixou de existir por padrão — mostrar `0/50` anunciava
       * um limite que não é aplicado, e um limite falso é pior que limite
       * nenhum: leva a planejar a campanha em torno dele.
       */
      celula: (c) => (
        <span className="tabular text-tinta-2">
          {formatarNumero(c.enviadasHoje)}
          {c.limiteDiario !== null && (
            <span className="text-tinta-3">/{formatarNumero(c.limiteDiario)}</span>
          )}
        </span>
      ),
    },
    {
      chave: "status",
      titulo: "Status",
      /*
       * O selo sai de `apresentarCanal()`, não de `c.status` cru. O status
       * gravado é cache do webhook, e foi ele que produziu um canal "Conectado"
       * que nunca pareou — a tela afirmando o que o próprio dado negava.
       */
      celula: (c) => {
        const a = apresentarCanal(c);
        return (
          <div>
            <SeloCanal status={a.status} confianca={a.confianca} />
            {a.detalhe ? <p className="mt-1 text-xs text-tinta-3">{a.detalhe}</p> : null}
          </div>
        );
      },
    },
    {
      chave: "solicitado",
      titulo: "Solicitado em",
      alinhamento: "direita",
      celula: (c) => (
        <span className="tabular whitespace-nowrap text-tinta-3">
          {formatarDataHora(c.solicitadoEm)}
        </span>
      ),
    },
    {
      chave: "conectado",
      titulo: "Conectado em",
      alinhamento: "direita",
      celula: (c) => (
        <span className="tabular whitespace-nowrap text-tinta-3">
          {formatarDataHora(c.conectadoEm)}
        </span>
      ),
    },
    {
      chave: "acoes",
      titulo: "Ações",
      alinhamento: "direita",
      celula: (c) => (
        <div className="flex items-center justify-end gap-1">
          {/* Só faz sentido com sessão aberta: sem ela a Evolution devolve
              lista vazia, e o operador baixaria zero linhas achando que a
              agenda dele está vazia. */}
          {c.status === "conectado" && (
            /*
             * `carregando` em vez de um ícone piscando.
             *
             * A busca leva alguns segundos — quase um da Evolution, mais a
             * volta pela rede — e o pulso discreto no ícone não parecia
             * trabalho em andamento: parecia clique perdido. O `carregando` do
             * Botao troca o ícone por spinner, desabilita e muda o rótulo, que
             * é o mesmo tratamento dado a toda ação demorada no painel.
             */
            <Botao
              tamanho="sm"
              variante="fantasma"
              carregando={extraindo === c.id}
              onClick={() => extrair(c)}
              title="Baixa a agenda deste número em planilha (nome e numero)"
            >
              {/*
                O rótulo não muda — só o ícone.

                Trocar "Contatos" por "Buscando…" faz o botão mudar de largura
                no meio do clique, e a linha inteira da tabela dança. O giro no
                lugar do ícone diz a mesma coisa sem mexer no layout.
              */}
              {extraindo !== c.id && <Download aria-hidden className="size-3.5" />}
              Contatos
            </Botao>
          )}
          {/*
            Não existe mais "Desconectar".
            Desconectar é ato do dono do aparelho, no WhatsApp dele — o painel
            não derruba a sessão de ninguém. O que o painel faz é oferecer o
            caminho de volta: quando a sessão cai, aparece "Conectar".

            O botão antigo também mentia: chamava `PATCH { status }`, que só
            GRAVAVA o estado sem tocar na sessão real.
          */}
          {c.status !== "conectado" && (
            <Botao
              tamanho="sm"
              variante="fantasma"
              disabled={emAcao === c.id}
              onClick={() => setReconectando(c)}
            >
              <PlugZap aria-hidden className="size-3.5" />
              Conectar
            </Botao>
          )}
          <Botao
            tamanho="icone"
            variante="fantasma"
            disabled={emAcao === c.id}
            onClick={() => setExcluindo(c)}
            aria-label={`Excluir canal ${c.nome}`}
            className="hover:bg-critico/15 hover:text-critico"
          >
            <Trash2 aria-hidden className="size-3.5" />
          </Botao>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-tinta">Canais</h1>
          {/* A verificação acontece em silêncio.
              Anunciar "conferindo⬦" transferia para o operador a tarefa de
              esperar e reparar no processo. Ele quer o estado certo, não o
              relatório de como o sistema chegou nele. */}
          <p className="mt-1 text-sm text-tinta-3">
            Números de WhatsApp disponíveis para disparo.
          </p>
        </div>
        <Botao variante="primario" onClick={() => setConectando(true)}>
          <Plus aria-hidden className="size-4" />
          Conectar canal
        </Botao>
      </div>

      <div className="overflow-hidden rounded-card border border-borda bg-superficie">
        {canais.length === 0 ? (
          <EstadoVazio
            icone={<Smartphone className="size-7" />}
            titulo="Nenhum canal conectado"
            descricao="Conecte um número via QR Code para começar a disparar."
            acao={
              <Botao variante="primario" onClick={() => setConectando(true)}>
                <Plus aria-hidden className="size-4" />
                Conectar canal
              </Botao>
            }
          />
        ) : (
          <Tabela
            colunas={colunas}
            itens={filtrados}
            chaveDe={(c) => c.id}
            porPagina={10}
            buscaPlaceholder="Buscar por nome, número ou empresa⬦"
            textoBusca={(c) => `${c.nome} ${c.numero ?? ""}`}
            vazio="Nenhum canal com esse filtro."
            filtros={
              <FiltroSelecao
                rotulo="Status"
                valor={status}
                aoMudar={setStatus}
                opcoes={[
                  { valor: "todos", texto: "Todos" },
                  { valor: "conectado", texto: "Conectado" },
                  { valor: "desconectado", texto: "Desconectado" },
                  { valor: "aguardando_qr", texto: "Aguardando QR" },
                ]}
              />
            }
          />
        )}
      </div>

      {/* Os modais recebem `extrair` em vez de refazê-lo: a espera pela agenda
          e o tratamento de erro são os mesmos da lista. */}
      <ModalConectarCanal
        aberto={conectando}
        aoFechar={() => setConectando(false)}
        aoExtrair={extrair}
        extraindo={extraindo}
      />
      <ModalReconectarCanal
        canal={reconectando}
        aoFechar={() => setReconectando(null)}
        aoExtrair={extrair}
        extraindo={extraindo}
      />
      <ModalExcluirCanal
        canal={excluindo}
        excluindo={exclusao.isPending}
        aoFechar={() => setExcluindo(null)}
        aoConfirmar={confirmarExclusao}
      />
    </>
  );
}

/**
 * Confirmação de exclusão que mostra o que vai junto.
 *
 * A API recusava excluir canal usado em campanha e mandava "desconecte em vez
 * de excluir" — o canal ficava na lista para sempre, sem saída pelo produto, e
 * o operador só descobria o problema DEPOIS de clicar.
 *
 * Agora a verificação vem antes: as campanhas vinculadas são carregadas ao
 * abrir e listadas, com as ativas em destaque. Excluir passa a ser possível, e
 * informado.
 */
function ModalExcluirCanal({
  canal,
  excluindo,
  aoFechar,
  aoConfirmar,
}: {
  canal: Canal | null;
  excluindo: boolean;
  aoFechar: () => void;
  aoConfirmar: (c: Canal) => void;
}) {
  const vinculos = useVinculosCanal(canal?.id ?? null);
  const campanhas = vinculos.data?.campanhas ?? [];
  const ativas = campanhas.filter((c) =>
    ["em_andamento", "agendada", "pausada_por_canal"].includes(c.status),
  );

  return (
    <Modal
      aberto={canal !== null}
      aoFechar={aoFechar}
      titulo={`Excluir ${canal?.nome ?? "canal"}?`}
      descricao="A instância também é removida da Evolution. Não dá para desfazer."
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            variante="perigo"
            carregando={excluindo}
            // Só habilita depois de saber o que está em jogo: confirmar antes
            // de a lista carregar é confirmar sem a informação que o modal
            // existe para dar.
            disabled={vinculos.isLoading}
            onClick={() => canal && aoConfirmar(canal)}
          >
            <Trash2 aria-hidden className="size-4" />
            Excluir mesmo assim
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {vinculos.isLoading && <p className="text-sm text-tinta-3">Conferindo dependências⬦</p>}

        {!vinculos.isLoading && campanhas.length === 0 && (
          <p className="text-sm text-tinta-2">
            Nenhuma campanha usa este canal. A exclusão não afeta mais nada.
          </p>
        )}

        {campanhas.length > 0 && (
          <>
            <p className="text-sm text-tinta-2">
              {campanhas.length} campanha{campanhas.length === 1 ? "" : "s"} usa
              {campanhas.length === 1 ? "" : "m"} este canal
              {ativas.length > 0 && (
                <>
                  {" — "}
                  <strong className="text-critico">
                    {ativas.length} ainda {ativas.length === 1 ? "vai disparar" : "vão disparar"}
                  </strong>
                </>
              )}
              .
            </p>

            <ul className="max-h-52 overflow-y-auto rounded-lg border border-borda bg-superficie-2 p-2">
              {campanhas.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-tinta">{c.nome}</span>
                  <SeloCampanha status={c.status} />
                </li>
              ))}
            </ul>

            <p className="text-xs text-tinta-3">
              Elas continuam existindo e o histórico do que já foi enviado é preservado — some
              apenas o vínculo com este canal. Campanha que ainda não disparou precisará de outro
              canal para sair.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}

/**
 * Reabre o pareamento de um canal existente.
 *
 * Separado da criação porque o canal já existe: aqui não há nome nem
 * aquecimento a escolher, só COMO parear. O método pode ser diferente do usado
 * na primeira vez — quem tentou pelo QR e não tinha uma segunda tela troca para
 * o código sem precisar recriar o canal.
 */
function ModalReconectarCanal({
  canal,
  aoFechar,
  aoExtrair,
  extraindo,
}: {
  canal: Canal | null;
  aoFechar: () => void;
  aoExtrair: (canal: Canal) => void;
  extraindo: string | null;
}) {
  const [metodo, setMetodo] = React.useState<MetodoPareamento>("qrcode");
  const [numero, setNumero] = React.useState("");
  const [sessao, setSessao] = React.useState<Pareamento | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  /**
   * O texto do 409, quando a API pede confirmação para derrubar a sessão viva.
   *
   * Estado separado de `erro` de propósito: `erro` é beco sem saída — a pessoa
   * lê e fecha. Este aqui é uma PERGUNTA, e precisa mudar o rodapé do modal
   * para oferecer a resposta. Guardar os dois no mesmo lugar foi como o botão
   * de confirmar deixou de existir: a mensagem "Confirme para prosseguir" caía
   * no `MensagemErro` e morria ali.
   */
  const [confirmarDerrubar, setConfirmarDerrubar] = React.useState<string | null>(null);
  const reconexao = useReconectarCanal();

  const conectado = usePareamentoAoVivo(canal?.id ?? null, sessao !== null);

  function fechar() {
    aoFechar();
    setMetodo("qrcode");
    setNumero("");
    setSessao(null);
    setErro(null);
    setConfirmarDerrubar(null);
  }

  /**
   * Abre o pareamento. Com `forcar`, depois de a pessoa confirmar o 409.
   *
   * `forcar` só é enviado quando é `true`: mandar `forcar: false` explícito
   * daria no mesmo no servidor, mas some com a distinção entre "ainda não
   * perguntei" e "perguntei e a pessoa disse não" em quem for ler o payload
   * investigando um disparo cortado no meio.
   */
  async function solicitar(forcar = false) {
    if (!canal) return;
    setErro(null);

    let numeroPareamento: string | undefined;
    if (metodo === "codigo") {
      const n = normalizarTelefone(numero || (canal.numero ?? ""));
      if (!n.valido) {
        setErro("Informe o número do WhatsApp com DDD, no formato +55 48 91234-5678.");
        return;
      }
      numeroPareamento = n.e164;
    }

    try {
      setSessao(
        await reconexao.mutateAsync({
          id: canal.id,
          metodoPareamento: metodo,
          ...(numeroPareamento ? { numeroPareamento } : {}),
          ...(forcar ? { forcar: true } : {}),
        }),
      );
      setConfirmarDerrubar(null);
    } catch (e) {
      // 409 é a API dizendo "a sessão está viva, confirma que quer derrubar?".
      // Não é falha: é a pergunta, e a resposta é reenviar com `forcar`.
      if (e instanceof ErroApi && e.status === 409) {
        setConfirmarDerrubar(e.message);
        return;
      }
      setErro(mensagemDe(e, "Não foi possível abrir o pareamento."));
    }
  }

  return (
    <Modal
      aberto={canal !== null}
      aoFechar={fechar}
      titulo={
        conectado
          ? "Pronto"
          : sessao
            ? sessao.codigo
              ? "Digite o código no WhatsApp"
              : "Escaneie o QR Code"
            : confirmarDerrubar
              ? `${canal?.nome ?? "Este canal"} já está conectado`
              : `Conectar ${canal?.nome ?? ""}`
      }
      descricao={
        conectado
          ? undefined
          : sessao
            ? "WhatsApp > Aparelhos conectados > Conectar um aparelho."
            : confirmarDerrubar
              ? undefined
              : "O canal só volta a enviar depois que o aparelho parear de novo."
      }
      rodape={
        sessao ? (
          <Botao variante="primario" onClick={fechar}>
            {conectado ? "Concluir" : "Fechar"}
          </Botao>
        ) : confirmarDerrubar ? (
          <>
            <Botao variante="fantasma" onClick={fechar}>
              Manter conectado
            </Botao>
            <Botao
              variante="perigo"
              onClick={() => void solicitar(true)}
              carregando={reconexao.isPending}
            >
              Derrubar e reconectar
            </Botao>
          </>
        ) : (
          <>
            <Botao variante="fantasma" onClick={fechar}>
              Cancelar
            </Botao>
            <Botao
              variante="primario"
              onClick={() => void solicitar()}
              carregando={reconexao.isPending}
            >
              {metodo === "codigo" ? "Gerar código" : "Gerar QR Code"}
            </Botao>
          </>
        )
      }
    >
      {conectado ? (
        <PareamentoConcluido
          canal={conectado}
          aoBaixarContatos={() => aoExtrair(conectado)}
          baixando={extraindo === conectado.id}
        />
      ) : sessao ? (
        // Gerar de novo aqui é literalmente refazer o mesmo pedido.
        <PainelPareamento
          sessao={sessao}
          aoGerarNovo={() => void solicitar()}
          gerando={reconexao.isPending}
        />
      ) : confirmarDerrubar ? (
        /*
         * O texto vem da API, não daqui.
         *
         * Quem sabe o que vai ser derrubado é o servidor — ele perguntou ao
         * gateway. Reescrever a frase no front criaria uma segunda versão do
         * aviso, que divergiria da do servidor no primeiro ajuste e explicaria
         * ao operador uma consequência diferente da que vai acontecer.
         */
        <div className="flex items-start gap-3 rounded-lg bg-critico/10 p-3.5 ring-1 ring-inset ring-critico/25">
          <PlugZap className="mt-0.5 size-4 shrink-0 text-critico" />
          <p className="text-sm leading-relaxed text-tinta-2">{confirmarDerrubar}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <EscolhaMetodo metodo={metodo} aoMudar={setMetodo} />

          {metodo === "codigo" && (
            <Campo
              rotulo="Número do WhatsApp"
              // Prefill com o número que já pareou antes: reconectar quase
              // sempre é o MESMO aparelho, e redigitar é só chance de errar.
              value={numero || (canal?.numero ? formatarTelefone(canal.numero) : "")}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="+55 48 91234-5678"
              dica="O celular onde o WhatsApp está logado — é nele que o código será digitado."
              inputMode="tel"
              required
            />
          )}

          <MensagemErro>{erro}</MensagemErro>
        </div>
      )}
    </Modal>
  );
}

function ModalConectarCanal({
  aberto,
  aoFechar,
  aoExtrair,
  extraindo,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoExtrair: (canal: Canal) => void;
  extraindo: string | null;
}) {
  const [nome, setNome] = React.useState("");
  const [metodo, setMetodo] = React.useState<MetodoPareamento>("qrcode");
  const [numero, setNumero] = React.useState("");
  const [sessao, setSessao] = React.useState<Pareamento | null>(null);
  const [canalId, setCanalId] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const { mostrar } = useToast();
  const criacao = useCriarCanal();

  // Enquanto o QR/código está na tela, pergunta ao gateway a cada 3 s.
  const conectado = usePareamentoAoVivo(canalId, sessao !== null);

  // Dois caracteres é o mínimo que a API aceita — o mesmo gatilho da revelação
  // e da validação, para a tela não abrir opções que o servidor recusaria.
  const nomeValido = nome.trim().length >= 2;

  /**
   * Abre um pareamento novo para o canal que acabou de ser criado.
   *
   * Vai por `reconectar` e não por `criar`: o canal já existe no banco, e
   * recriá-lo deixaria um canal órfão a cada código expirado.
   */
  const reconexao = useReconectarCanal();
  const [regerando, setRegerando] = React.useState(false);

  async function regerar() {
    if (!canalId) return;

    // O número já passou pela validação ao abrir o pareamento; aqui só é
    // normalizado de novo porque a união exige o estreitamento.
    let numeroPareamento: string | undefined;
    if (metodo === "codigo") {
      const n = normalizarTelefone(numero);
      if (!n.valido) {
        setErro("Informe o número do WhatsApp com DDD, no formato +55 48 91234-5678.");
        return;
      }
      numeroPareamento = n.e164;
    }

    setRegerando(true);
    try {
      setSessao(
        await reconexao.mutateAsync({
          id: canalId,
          metodoPareamento: metodo,
          ...(numeroPareamento ? { numeroPareamento } : {}),
        }),
      );
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível gerar um novo código."));
    } finally {
      setRegerando(false);
    }
  }

  function fechar() {
    aoFechar();
    setNome("");
    setMetodo("qrcode");
    setNumero("");
    setSessao(null);
    setCanalId(null);
    setErro(null);
  }

  async function solicitar() {
    setErro(null);

    let numeroPareamento: string | undefined;
    if (metodo === "codigo") {
      const normalizado = normalizarTelefone(numero);
      if (!normalizado.valido) {
        // Barrado aqui e não só no servidor: lá o canal já teria sido criado, e
        // sobraria um canal órfão no banco para cada número digitado errado.
        setErro("Informe o número do WhatsApp com DDD, no formato +55 48 91234-5678.");
        return;
      }
      numeroPareamento = normalizado.e164;
    }

    try {
      const r = await criacao.mutateAsync({
        nome,
        // Sem teto e sem estágio de aquecimento: o campo prometia "até 50
        // msgs/dia" de um limite que deixou de ser aplicado, e limite falso é
        // pior que limite nenhum — leva a planejar a campanha em torno dele.
        limiteDiario: null,
        estagioAquecimento: 0,
        metodoPareamento: metodo,
        ...(numeroPareamento ? { numeroPareamento } : {}),
      });
      setSessao(r);
      setCanalId(r.canal.id);
      mostrar({
        tipo: r.qr || r.codigo ? "info" : "aviso",
        titulo: "Canal criado",
        descricao:
          r.aviso ??
          (r.codigo
            ? "Digite o código no WhatsApp do aparelho para concluir."
            : r.qr
              ? "Escaneie o QR Code no WhatsApp do aparelho para concluir."
              : "Abra o pareamento pela lista de canais para concluir."),
      });
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível criar o canal."));
    }
  }

  const pareando = sessao !== null;

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo={
        conectado
          ? "Pronto"
          : pareando
            ? sessao.codigo
              ? "Digite o código no WhatsApp"
              : "Escaneie o QR Code"
            : "Conectar novo canal"
      }
      descricao={
        conectado
          ? undefined
          : pareando
            ? "WhatsApp > Aparelhos conectados > Conectar um aparelho."
            : "Dê um nome ao canal e escolha como o número vai parear."
      }
      rodape={
        pareando ? (
          <Botao variante="primario" onClick={fechar}>
            {conectado ? "Concluir" : "Fechar"}
          </Botao>
        ) : (
          <>
            <Botao variante="fantasma" onClick={fechar}>
              Cancelar
            </Botao>
            <Botao variante="primario" onClick={solicitar} carregando={criacao.isPending}>
              {metodo === "codigo" ? "Gerar código" : "Gerar QR Code"}
            </Botao>
          </>
        )
      }
    >
      {conectado ? (
        <PareamentoConcluido
          canal={conectado}
          aoBaixarContatos={() => aoExtrair(conectado)}
          baixando={extraindo === conectado.id}
        />
      ) : pareando ? (
        <PainelPareamento
          sessao={sessao}
          // Gerar de novo é pedir o mesmo pareamento outra vez: o canal já
          // existe, então este caminho vai por `reconectar`, não recria nada.
          aoGerarNovo={() => void regerar()}
          gerando={regerando}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <Campo
            rotulo="Nome do canal"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Comercial, Suporte, Vendas⬦"
            dica="Só isto. O número aparece sozinho quando o aparelho parear."
            required
            autoFocus
          />

          {/*
            O resto do formulário só aparece depois do nome.

            Uma pergunta de cada vez: quem abre o modal decide o nome, e só
            então escolhe como parear. Mostrar tudo de uma vez faz a tela
            parecer mais trabalho do que é — são dois campos.

            O `prefers-reduced-motion` global já anula a transição para quem
            pediu menos movimento; não é preciso tratar aqui.
          */}
          <Revelar visivel={nomeValido}>
            <div className="flex flex-col gap-4">
              <EscolhaMetodo metodo={metodo} aoMudar={setMetodo} />

              <Revelar visivel={metodo === "codigo"}>
                <Campo
                  rotulo="Número do WhatsApp"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="+55 48 91234-5678"
                  dica="O celular onde o WhatsApp está logado — é nele que o código será digitado."
                  inputMode="tel"
                  required
                />
              </Revelar>
            </div>
          </Revelar>

          <MensagemErro>{erro}</MensagemErro>
        </div>
      )}
    </Modal>
  );
}

/**
 * Revela o conteúdo com altura animada.
 *
 * `grid-rows-[0fr] → [1fr]` em vez de `max-height`: com max-height é preciso
 * chutar um valor maior que o conteúdo, e o chute sempre erra — ou corta o
 * texto, ou deixa a animação lenta no começo por causa do espaço que não
 * existe. O grid anima até a altura real, qualquer que seja ela.
 *
 * `invisible` no final fecha um detalhe de acessibilidade: sem ele o conteúdo
 * escondido continua focável pelo Tab, e o operador tabularia para dentro de
 * um campo que não está na tela.
 */
function Revelar({ visivel, children }: { visivel: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={!visivel}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
        visivel ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className={cn("min-h-0 overflow-hidden", !visivel && "invisible")}>{children}</div>
    </div>
  );
}

/**
 * Escolha entre ler o QR e digitar um código.
 *
 * Existem porque resolvem situações diferentes, não porque uma é melhor: o QR
 * exige DUAS telas — o painel mostrando e o celular lendo. Quem abre o painel
 * no próprio celular, ou opera um número que está com outra pessoa, não tem
 * como usá-lo. Aí o código de 8 dígitos é o único caminho.
 */
function EscolhaMetodo({
  metodo,
  aoMudar,
}: {
  metodo: MetodoPareamento;
  aoMudar: (m: MetodoPareamento) => void;
}) {
  const opcoes = [
    {
      valor: "qrcode" as const,
      icone: <QrCode className="size-4" />,
      titulo: "QR Code",
      descricao: "Leia com a câmera. Precisa de uma segunda tela.",
    },
    {
      valor: "codigo" as const,
      icone: <KeyRound className="size-4" />,
      titulo: "Código de 8 dígitos",
      descricao: "Digite no próprio celular. Precisa do número.",
    },
  ];

  return (
    <fieldset>
      <legend className="mb-1.5 block text-xs font-medium text-tinta-2">Como vai parear</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {opcoes.map((o) => {
          const ativo = metodo === o.valor;
          return (
            <button
              key={o.valor}
              type="button"
              onClick={() => aoMudar(o.valor)}
              aria-pressed={ativo}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                ativo
                  ? "border-marca bg-marca/10"
                  : "border-borda-forte bg-superficie-2 hover:bg-superficie-3",
              )}
            >
              <span
                className={cn(
                  "flex items-center gap-2 text-sm font-medium",
                  ativo ? "text-marca-tenue" : "text-tinta",
                )}
              >
                {o.icone}
                {o.titulo}
              </span>
              <span className="mt-1 block text-xs text-tinta-3">{o.descricao}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Confirmação do pareamento.
 *
 * Aparece sozinha assim que o gateway confirma — sem o operador clicar em nada.
 * Antes, o QR sumia da tela sem dizer se tinha funcionado, e a única forma de
 * saber era voltar para a lista e esperar.
 */
function PareamentoConcluido({
  canal,
  aoBaixarContatos,
  baixando,
}: {
  canal: Canal;
  aoBaixarContatos: () => void;
  baixando: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-bom/15 text-bom">
        <CheckCircle2 aria-hidden className="size-6" />
      </span>
      <div>
        <p className="text-sm font-medium text-tinta">Conexão bem-sucedida</p>
        <p className="mt-1 text-sm text-tinta-2">
          {canal.numero
            ? `${canal.nome} está conectado com o número ${formatarTelefone(canal.numero)}.`
            : `${canal.nome} está conectado.`}
        </p>
      </div>

      {/*
        O download mora aqui porque é aqui que ele acontece na prática: a
        agenda se extrai uma vez, logo depois de conectar. Deixar só na lista
        obrigava a fechar o modal e caçar o botão na linha certa.

        Quando este botão aparece, a busca já começou em segundo plano — o
        clique costuma pegar a agenda pronta no servidor.
      */}
      <Botao variante="secundario" onClick={aoBaixarContatos} carregando={baixando}>
        {!baixando && <Download aria-hidden className="size-4" />}
        Baixar contatos
      </Botao>

      <p className="max-w-sm text-xs text-tinta-3">
        Já dá para disparar por ele. Se o aparelho for desconectado no WhatsApp, o painel avisa e
        o botão Conectar volta a aparecer.
      </p>
    </div>
  );
}

/**
 * Segundos restantes até o pareamento expirar. `0` = expirou.
 *
 * O QR vale ~1 minuto e o código alguns minutos. Sem contagem, a pessoa ficava
 * olhando um código morto sem saber — escaneava, não acontecia nada, e a
 * conclusão natural era que o sistema estava quebrado.
 */
function useTempoRestante(expiraEm: string | null): number {
  const calcular = React.useCallback(
    () => (expiraEm ? Math.max(0, Math.ceil((new Date(expiraEm).getTime() - Date.now()) / 1000)) : 0),
    [expiraEm],
  );
  const [restante, setRestante] = React.useState(calcular);

  React.useEffect(() => {
    setRestante(calcular());
    const t = setInterval(() => setRestante(calcular()), 1000);
    return () => clearInterval(t);
  }, [calcular]);

  return restante;
}

/** "1:05" — o formato que se lê de relance num contador. */
function comoRelogio(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
}

/** O QR ou o código, conforme o que a Evolution devolveu. */
function PainelPareamento({
  sessao,
  aoGerarNovo,
  gerando,
}: {
  sessao: Pareamento;
  aoGerarNovo: () => void;
  gerando: boolean;
}) {
  const restante = useTempoRestante(sessao.expiraEm);

  /*
   * Expirado: o código sai da tela.
   *
   * Deixá-lo visível com um aviso ao lado convidaria a tentar de novo com algo
   * que já não funciona. Some, e no lugar fica o único caminho que resolve.
   */
  if ((sessao.qr || sessao.codigo) && restante === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-aviso/15 text-aviso">
          <TimerOff aria-hidden className="size-6" />
        </span>
        <div>
          <p className="text-sm font-medium text-tinta">
            {sessao.codigo ? "O código expirou" : "O QR Code expirou"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-tinta-2">
            {sessao.codigo
              ? "Códigos de pareamento valem por poucos minutos. Gere outro para continuar."
              : "O QR Code do WhatsApp vale cerca de um minuto. Gere outro para continuar."}
          </p>
        </div>
        <Botao variante="primario" onClick={aoGerarNovo} carregando={gerando}>
          {!gerando && <RefreshCw aria-hidden className="size-4" />}
          Gerar {sessao.codigo ? "novo código" : "novo QR Code"}
        </Botao>
      </div>
    );
  }

  return <ConteudoPareamento sessao={sessao} restante={restante} />;
}

/** Contador discreto: vira aviso nos últimos 15 segundos. */
function Contador({ restante }: { restante: number }) {
  const acabando = restante <= 15;
  return (
    <p className={cn("tabular text-xs", acabando ? "text-aviso" : "text-tinta-3")}>
      {acabando ? "Expira em" : "Válido por"} {comoRelogio(restante)}
    </p>
  );
}

function ConteudoPareamento({ sessao, restante }: { sessao: Pareamento; restante: number }) {
  if (sessao.codigo) {
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        {/* Espaçado e monoespaçado: é para ser LIDO em voz alta e digitado em
            outro aparelho, muitas vezes por outra pessoa ao telefone. */}
        <p className="rounded-xl bg-superficie-3 px-6 py-4 font-mono text-3xl tracking-[0.3em] text-tinta">
          {sessao.codigo}
        </p>
        <ol className="max-w-sm list-decimal space-y-1 pl-5 text-xs text-tinta-2">
          <li>No celular, abra o WhatsApp.</li>
          <li>
            Toque em <strong className="text-tinta">Aparelhos conectados</strong> →{" "}
            <strong className="text-tinta">Conectar um aparelho</strong>.
          </li>
          <li>
            Escolha <strong className="text-tinta">Conectar com número de telefone</strong> e digite
            o código acima.
          </li>
        </ol>
        {/* O contador substitui "vale por poucos minutos": o número exato tira
            a dúvida de quem está com o celular na mão. */}
        <Contador restante={restante} />
      </div>
    );
  }

  if (sessao.qr) {
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        <img
          src={sessao.qr}
          alt="QR Code para parear o número no WhatsApp"
          width={220}
          height={220}
          className="rounded-lg bg-white p-2"
        />
        <Contador restante={restante} />
      </div>
    );
  }

  // Canal criado, pareamento não. `aviso` explica o porquê — e sem esta tela o
  // operador ficaria olhando um modal vazio sem saber o que deu errado.
  return (
    <div className="rounded-xl border border-aviso/35 bg-aviso/10 p-4">
      <p className="text-sm font-medium text-tinta">O canal foi criado, mas o pareamento não abriu</p>
      <p className="mt-1 text-sm text-tinta-2">
        {sessao.aviso ?? "O gateway não respondeu com QR Code nem com código."}
      </p>
      <p className="mt-1 text-xs text-tinta-3">Tente de novo pelo botão Conectar na lista.</p>
    </div>
  );
}
