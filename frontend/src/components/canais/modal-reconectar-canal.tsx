import * as React from "react";
import { PlugZap } from "lucide-react";
import { normalizarTelefone, type Canal, type MetodoPareamento } from "@disparoy/dominio";
import { Botao } from "@/components/ui/botao";
import { Campo, MensagemErro } from "@/components/ui/campos";
import { Modal } from "@/components/ui/modal";
import { useReconectarCanal, type Pareamento } from "@/hooks/consultas";
import { ErroApi, mensagemDe } from "@/lib/api";
import { formatarTelefone } from "@/lib/formato";
import {
  EscolhaMetodo,
  PainelPareamento,
  PareamentoConcluido,
} from "./pareamento";
import { usePareamentoAoVivo } from "./use-pareamento-ao-vivo";

/**
 * Reabre o pareamento de um canal existente.
 *
 * Separado da criação porque o canal já existe: aqui não há nome nem
 * aquecimento a escolher, só COMO parear. O método pode ser diferente do usado
 * na primeira vez — quem tentou pelo QR e não tinha uma segunda tela troca para
 * o código sem precisar recriar o canal.
 */
export function ModalReconectarCanal({
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
      // Fora do estado de formulário, Enter não confirma nada: com o QR na
      // tela não há ação, e em `confirmarDerrubar` a ação é derrubar uma
      // sessão que está funcionando — isso se clica, não se tecla sem querer.
      aoConfirmar={sessao || conectado || confirmarDerrubar ? undefined : () => void solicitar()}
      confirmando={reconexao.isPending}
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
