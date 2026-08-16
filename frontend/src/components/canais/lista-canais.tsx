
import * as React from "react";

import {
  BadgeCheck,
  Download,
  KeyRound,
  Plus,
  PlugZap,
  QrCode,
  Smartphone,
  Trash2,
  Unplug,
} from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo, MensagemErro, Selecao } from "@/components/ui/campos";
import { Modal } from "@/components/ui/modal";
import { EstadoVazio } from "@/components/ui/primitivos";
import { Tabela, FiltroSelecao, type Coluna } from "@/components/ui/tabela";
import { useToast } from "@/components/ui/toast";
import { ROTULO_CONEXAO, SeloCampanha, SeloCanal } from "@/components/campanhas/selo-status";
import {
  apresentarCanal,
  AQUECIMENTO,
  limiteSugerido,
  normalizarTelefone,
  type Canal,
  type MetodoPareamento,
} from "@disparoy/dominio";
import { cn, formatarDataHora, formatarNumero, formatarTelefone } from "@/lib/formato";
import { baixarArquivo, ErroApi } from "@/lib/api";
import {
  useAjustarCanal,
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

  const mudanca = useAjustarCanal();
  const exclusao = useExcluirCanal();
  // Roda em silêncio: o retorno é ignorado de propósito, a tela não anuncia.
  useVerificacaoAutomatica(canais);
  const emAcao = mudanca.isPending || exclusao.isPending ? (mudanca.variables?.id ?? exclusao.variables) : null;

  const filtrados = canais.filter((c) => status === "todos" || c.status === status);

  async function mudarStatus(canal: Canal, novo: "conectado" | "desconectado") {
    try {
      await mudanca.mutateAsync({ id: canal.id, status: novo });
      mostrar({
        tipo: "info",
        titulo: novo === "conectado" ? "Canal reconectado" : "Canal desconectado",
        descricao: canal.nome,
      });
    } catch (e) {
      mostrar({
        tipo: "erro",
        titulo: "Não foi possível alterar o canal",
        descricao: mensagemDe(e, "Tente novamente."),
      });
    }
  }

  /**
   * Baixa a agenda do número em planilha.
   *
   * Nada é gravado no painel: o arquivo sai com `nome` e `numero`, no mesmo
   * cabeçalho do modelo de importação, para poder voltar por cima depois de
   * editado no Excel.
   */
  async function extrair(canal: Canal) {
    setExtraindo(canal.id);
    try {
      const { total } = await baixarArquivo(
        `/canais/${canal.id}/contatos.xlsx`,
        `contatos-${canal.nome}.xlsx`,
      );
      mostrar({
        tipo: total === 0 ? "aviso" : "sucesso",
        titulo:
          total === 0
            ? "Nenhum contato na agenda deste número"
            : `${total ?? ""} contato(s) na planilha`,
        descricao: total === 0 ? undefined : "Baixada com as colunas nome e numero.",
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
          <span
            aria-hidden
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-superficie-3 text-tinta-3"
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
            <Botao
              tamanho="sm"
              variante="fantasma"
              disabled={extraindo === c.id}
              onClick={() => extrair(c)}
              title="Baixa a agenda deste número em planilha (nome e numero)"
            >
              <Download
                aria-hidden
                className={`size-3.5 ${extraindo === c.id ? "animate-pulse" : ""}`}
              />
              Contatos
            </Botao>
          )}
          {c.status === "conectado" ? (
            <Botao
              tamanho="sm"
              variante="fantasma"
              disabled={emAcao === c.id}
              onClick={() => mudarStatus(c, "desconectado")}
            >
              <Unplug aria-hidden className="size-3.5" />
              Desconectar
            </Botao>
          ) : (
            /*
             * Abre um pareamento de verdade.
             *
             * Este botão chamava `PATCH /canais/:id { status: "conectado" }` —
             * ele apenas GRAVAVA "conectado" no banco, sem parear coisa
             * nenhuma. É a origem mais provável do canal que aparecia conectado
             * sem número: um clique aqui bastava para o painel passar a mentir.
             */
            <Botao
              tamanho="sm"
              variante="fantasma"
              disabled={emAcao === c.id}
              onClick={() => setReconectando(c)}
            >
              <PlugZap aria-hidden className="size-3.5" />
              Reconectar
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
              Anunciar "conferindo…" transferia para o operador a tarefa de
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
            buscaPlaceholder="Buscar por nome, número ou empresa…"
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

      <ModalConectarCanal aberto={conectando} aoFechar={() => setConectando(false)} />
      <ModalReconectarCanal canal={reconectando} aoFechar={() => setReconectando(null)} />
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
        {vinculos.isLoading && <p className="text-sm text-tinta-3">Conferindo dependências…</p>}

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
function ModalReconectarCanal({ canal, aoFechar }: { canal: Canal | null; aoFechar: () => void }) {
  const [metodo, setMetodo] = React.useState<MetodoPareamento>("qrcode");
  const [numero, setNumero] = React.useState("");
  const [sessao, setSessao] = React.useState<Pareamento | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const reconexao = useReconectarCanal();

  function fechar() {
    aoFechar();
    setMetodo("qrcode");
    setNumero("");
    setSessao(null);
    setErro(null);
  }

  async function solicitar() {
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
        }),
      );
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível abrir o pareamento."));
    }
  }

  return (
    <Modal
      aberto={canal !== null}
      aoFechar={fechar}
      titulo={
        sessao
          ? sessao.codigo
            ? "Digite o código no WhatsApp"
            : "Escaneie o QR Code"
          : `Reconectar ${canal?.nome ?? ""}`
      }
      descricao={
        sessao
          ? "WhatsApp > Aparelhos conectados > Conectar um aparelho."
          : "O canal só volta a enviar depois que o aparelho parear de novo."
      }
      rodape={
        sessao ? (
          <Botao variante="primario" onClick={fechar}>
            Concluir
          </Botao>
        ) : (
          <>
            <Botao variante="fantasma" onClick={fechar}>
              Cancelar
            </Botao>
            <Botao variante="primario" onClick={solicitar} carregando={reconexao.isPending}>
              {metodo === "codigo" ? "Gerar código" : "Gerar QR Code"}
            </Botao>
          </>
        )
      }
    >
      {sessao ? (
        <PainelPareamento sessao={sessao} />
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

function ModalConectarCanal({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const [nome, setNome] = React.useState("");
  const [estagio, setEstagio] = React.useState(0);
  const [metodo, setMetodo] = React.useState<MetodoPareamento>("qrcode");
  const [numero, setNumero] = React.useState("");
  const [sessao, setSessao] = React.useState<Pareamento | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const { mostrar } = useToast();
  const criacao = useCriarCanal();

  function fechar() {
    aoFechar();
    setNome("");
    setEstagio(0);
    setMetodo("qrcode");
    setNumero("");
    setSessao(null);
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
        limiteDiario: limiteSugerido(estagio),
        estagioAquecimento: estagio,
        metodoPareamento: metodo,
        ...(numeroPareamento ? { numeroPareamento } : {}),
      });
      setSessao(r);
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
        pareando
          ? sessao.codigo
            ? "Digite o código no WhatsApp"
            : "Escaneie o QR Code"
          : "Conectar novo canal"
      }
      descricao={
        pareando
          ? "WhatsApp > Aparelhos conectados > Conectar um aparelho."
          : "Dê um nome ao canal e escolha como o número vai parear."
      }
      rodape={
        pareando ? (
          <Botao variante="primario" onClick={fechar}>
            Concluir
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
      {pareando ? (
        <PainelPareamento sessao={sessao} />
      ) : (
        <div className="flex flex-col gap-4">
          <Campo
            rotulo="Nome do canal"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Comercial, Suporte, Vendas…"
            dica="Só isto. O número aparece sozinho quando o aparelho parear."
            required
          />

          <EscolhaMetodo metodo={metodo} aoMudar={setMetodo} />

          {metodo === "codigo" && (
            <Campo
              rotulo="Número do WhatsApp"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="+55 48 91234-5678"
              dica="O celular onde o WhatsApp está logado — é nele que o código será digitado."
              inputMode="tel"
              required
            />
          )}

          {/* Aquecimento tem padrão seguro (número novo, teto baixo), então não
              precisa estar no caminho de quem só quer conectar um número. */}
          <details className="group">
            <summary className="cursor-pointer list-none text-xs text-tinta-3 hover:text-tinta">
              Opções avançadas
              <span className="ml-1.5 inline-block transition-transform group-open:rotate-90">
                ›
              </span>
            </summary>
            <div className="mt-3">
              <Selecao
                rotulo="Estágio de aquecimento"
                value={String(estagio)}
                onChange={(e) => setEstagio(Number(e.target.value))}
              >
                {AQUECIMENTO.map((a) => (
                  <option key={a.estagio} value={a.estagio}>
                    {a.rotulo} — até {a.limiteDiario} msgs/dia
                  </option>
                ))}
              </Selecao>
            </div>
          </details>

          <MensagemErro>{erro}</MensagemErro>
        </div>
      )}
    </Modal>
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

/** O QR ou o código, conforme o que a Evolution devolveu. */
function PainelPareamento({ sessao }: { sessao: Pareamento }) {
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
        <p className="text-center text-xs text-tinta-3">
          O código vale por poucos minutos. Se expirar, gere outro pela lista de canais.
        </p>
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
        <p className="text-center text-xs text-tinta-3">
          O código expira em cerca de 1 minuto. Se expirar, gere outro pela lista de canais.
        </p>
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
      <p className="mt-1 text-xs text-tinta-3">Tente de novo pelo botão Reconectar na lista.</p>
    </div>
  );
}
