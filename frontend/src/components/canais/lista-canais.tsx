import * as React from "react";

import { BadgeCheck, Download, Plus, PlugZap, QrCode, Smartphone, Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { EstadoVazio } from "@/components/ui/primitivos";
import { Tabela, FiltroSelecao, type Coluna } from "@/components/ui/tabela";
import { useToast } from "@/components/ui/toast";
import { ROTULO_CONEXAO, SeloCanal } from "@/components/campanhas/selo-status";
import { apresentarCanal, type Canal } from "@disparoy/dominio";
import { cn, formatarDataHora, formatarNumero, formatarTelefone } from "@/lib/formato";
import { baixarArquivo, mensagemDe } from "@/lib/api";
import { ModalExcluirCanal } from "./modal-excluir-canal";
import { ModalConectarCanal } from "./modal-conectar-canal";
import { ModalReconectarCanal } from "./modal-reconectar-canal";
import { contarContatosDoCanal, useExcluirCanal, useVerificarCanal } from "@/hooks/consultas";

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
