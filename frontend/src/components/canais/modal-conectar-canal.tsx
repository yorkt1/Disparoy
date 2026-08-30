import * as React from "react";
import { normalizarTelefone, type Canal, type MetodoPareamento } from "@disparoy/dominio";
import { Botao } from "@/components/ui/botao";
import { Campo, MensagemErro } from "@/components/ui/campos";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useCriarCanal, useReconectarCanal, type Pareamento } from "@/hooks/consultas";
import { mensagemDe } from "@/lib/api";
import {
  EscolhaMetodo,
  PainelPareamento,
  PareamentoConcluido,
  Revelar,
} from "./pareamento";
import { usePareamentoAoVivo } from "./use-pareamento-ao-vivo";

export function ModalConectarCanal({
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
      // Enter só vale enquanto o modal é formulário. Depois que o QR aparece
      // não há nada para confirmar, e a tecla dispararia um pareamento novo
      // por cima do que está na tela.
      aoConfirmar={pareando || conectado ? undefined : solicitar}
      confirmando={criacao.isPending}
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
            placeholder="Comercial, Suporte, Vendas…"
            dica="Só isto. O número aparece sozinho quando o aparelho parear."
            required
            /* O modal acabou de abrir por ação explícita do operador e este é
               seu único campo. Sem o foco, o teclado continua na página atrás
               e o primeiro Tab volta para a lista de canais. A regra existe
               para autoFocus em carga de página, que não é o caso. */
            // eslint-disable-next-line jsx-a11y/no-autofocus
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
