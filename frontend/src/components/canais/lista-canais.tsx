
import * as React from "react";

import { BadgeCheck, Plus, PlugZap, QrCode, Smartphone, Trash2, Unplug } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo, MensagemErro, Selecao } from "@/components/ui/campos";
import { Modal } from "@/components/ui/modal";
import { EstadoVazio } from "@/components/ui/primitivos";
import { Tabela, FiltroSelecao, type Coluna } from "@/components/ui/tabela";
import { useToast } from "@/components/ui/toast";
import { ROTULO_CONEXAO, SeloCanal } from "@/components/campanhas/selo-status";
import { AQUECIMENTO, limiteSugerido, type Canal } from "@disparoy/dominio";
import { formatarDataHora, formatarTelefone } from "@/lib/formato";
import { ErroApi } from "@/lib/api";
import { useCriarCanal, useExcluirCanal, useAjustarCanal } from "@/hooks/consultas";

/** Mensagem de erro legível, preferindo o texto que a API mandou. */
function mensagemDe(e: unknown, padrao: string): string {
  if (e instanceof ErroApi) return e.primeiroCampo ?? e.message;
  return e instanceof Error ? e.message : padrao;
}

export function ListaCanais({ canais }: { canais: Canal[] }) {
  const [status, setStatus] = React.useState("todos");
  const [conectando, setConectando] = React.useState(false);
  const { mostrar } = useToast();

  const mudanca = useAjustarCanal();
  const exclusao = useExcluirCanal();
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
    { chave: "status", titulo: "Status", celula: (c) => <SeloCanal status={c.status} /> },
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
            <Botao
              tamanho="sm"
              variante="fantasma"
              disabled={emAcao === c.id}
              onClick={() => mudarStatus(c, "conectado")}
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
    </>
  );
}

function ModalConectarCanal({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const [nome, setNome] = React.useState("");
  const [estagio, setEstagio] = React.useState(0);
  const [qr, setQr] = React.useState<string | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const { mostrar } = useToast();
  const criacao = useCriarCanal();

  function fechar() {
    aoFechar();
    setNome("");
    setEstagio(0);
    setQr(null);
    setErro(null);
  }

  async function solicitar() {
    setErro(null);
    try {
      const r = await criacao.mutateAsync({
        nome,
        limiteDiario: limiteSugerido(estagio),
        estagioAquecimento: estagio,
      });
      setQr(r.qr);
      mostrar({
        tipo: "info",
        titulo: "Canal criado",
        descricao: r.qr
          ? "Escaneie o QR Code no WhatsApp do aparelho para concluir."
          : "Gere o QR Code pela lista para concluir o pareamento.",
      });
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível criar o canal."));
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo={qr ? "Escaneie o QR Code" : "Conectar novo canal"}
      descricao={
        qr
          ? "WhatsApp > Aparelhos conectados > Conectar um aparelho."
          : "Dê um nome ao canal. O número vem do aparelho que escanear o QR."
      }
      rodape={
        qr ? (
          <Botao variante="primario" onClick={fechar}>
            Concluir
          </Botao>
        ) : (
          <>
            <Botao variante="fantasma" onClick={fechar}>
              Cancelar
            </Botao>
            <Botao variante="primario" onClick={solicitar} carregando={criacao.isPending}>
              Gerar QR Code
            </Botao>
          </>
        )
      }
    >
      {qr ? (
        <div className="flex flex-col items-center gap-3 py-2">
          <img
            src={qr}
            alt="QR Code para parear o número no WhatsApp"
            width={220}
            height={220}
            className="rounded-lg bg-white p-2"
          />
          <p className="text-center text-xs text-tinta-3">
            O código expira em cerca de 1 minuto. Se expirar, gere outro pela lista de canais.
          </p>
        </div>
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
