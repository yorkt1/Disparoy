
import * as React from "react";

import {
  BadgeCheck,
  Download,
  KeyRound,
  Plus,
  PlugZap,
  QrCode,
  RefreshCw,
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
import { ROTULO_CONEXAO, SeloCanal } from "@/components/campanhas/selo-status";
import {
  apresentarCanal,
  AQUECIMENTO,
  limiteSugerido,
  normalizarTelefone,
  type Canal,
  type MetodoPareamento,
} from "@disparoy/dominio";
import { cn, formatarDataHora, formatarTelefone } from "@/lib/formato";
import { baixarArquivo, ErroApi } from "@/lib/api";
import {
  useAjustarCanal,
  useCriarCanal,
  useExcluirCanal,
  useReconectarCanal,
  useVerificarCanal,
  type Pareamento,
} from "@/hooks/consultas";

/** Mensagem de erro legível, preferindo o texto que a API mandou. */
function mensagemDe(e: unknown, padrao: string): string {
  if (e instanceof ErroApi) return e.primeiroCampo ?? e.message;
  return e instanceof Error ? e.message : padrao;
}

export function ListaCanais({ canais }: { canais: Canal[] }) {
  const [status, setStatus] = React.useState("todos");
  const [conectando, setConectando] = React.useState(false);
  const [reconectando, setReconectando] = React.useState<Canal | null>(null);
  const [extraindo, setExtraindo] = React.useState<string | null>(null);
  const { mostrar } = useToast();

  const mudanca = useAjustarCanal();
  const exclusao = useExcluirCanal();
  const verificacao = useVerificarCanal();
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
   * Pergunta ao gateway agora.
   *
   * `confirmado: false` é reportado como "não deu para perguntar", nunca como
   * desconectado: um é problema da nossa infraestrutura, o outro é o WhatsApp
   * do cliente, e trocar os dois manda o operador atrás de um QR que funciona.
   */
  async function verificar(canal: Canal) {
    try {
      const r = await verificacao.mutateAsync(canal.id);
      mostrar(
        r.confirmado
          ? {
              tipo: "info",
              titulo: r.canal.status === "conectado" ? "Canal conectado" : "Canal desconectado",
              descricao: `${canal.nome} — confirmado com o gateway agora.`,
            }
          : {
              tipo: "aviso",
              titulo: "Não foi possível confirmar",
              descricao:
                "O gateway não respondeu. Nada foi alterado — o problema é do nosso lado, " +
                "não do WhatsApp do cliente.",
            },
      );
    } catch (e) {
      mostrar({
        tipo: "erro",
        titulo: "Não foi possível verificar o canal",
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

  async function excluir(canal: Canal) {
    if (!confirm(`Excluir o canal "${canal.nome}"? As campanhas já enviadas continuam no histórico.`)) {
      return;
    }
    try {
      await exclusao.mutateAsync(canal.id);
      mostrar({ tipo: "info", titulo: "Canal excluído", descricao: canal.nome });
    } catch (e) {
      // A API devolve 409 quando o canal já foi usado em campanha: a mensagem
      // dela explica o porquê melhor do que um texto genérico.
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
      titulo: "Uso hoje",
      alinhamento: "direita",
      celula: (c) => (
        <span className="tabular text-tinta-2">
          {c.enviadasHoje}/{c.limiteDiario}
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
          <Botao
            tamanho="sm"
            variante="fantasma"
            disabled={verificacao.isPending && verificacao.variables === c.id}
            onClick={() => verificar(c)}
          >
            <RefreshCw
              aria-hidden
              className={`size-3.5 ${
                verificacao.isPending && verificacao.variables === c.id ? "animate-spin" : ""
              }`}
            />
            Verificar
          </Botao>
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
            onClick={() => excluir(c)}
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
    </>
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
