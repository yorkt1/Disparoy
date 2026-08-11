
import * as React from "react";
import { ArrowDown, ArrowUp, Braces, Image as ImagemIcone, Shuffle, Trash2, Type } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo } from "@/components/ui/campos";
import { EXTENSOES_MIDIA, LIMITES, MAX_BYTES_MIDIA } from "@disparoy/dominio";
import type { MensagemSequencia, Spintax, TipoMidia } from "@disparoy/dominio";
import { combinacoesPossiveis, validarReferencias } from "@disparoy/dominio";
import { Dropzone } from "@/components/ui/dropzone";
import { MensagemErro } from "@/components/ui/campos";
import { api, ErroApi } from "@/lib/api";
import { cn } from "@/lib/formato";
import { ModalVariacoes } from "./gerenciador-spintax";

const ROTULO_MIDIA: Record<TipoMidia, string> = {
  imagem: "Imagem",
  video: "Vídeo",
  documento: "Documento",
  audio: "Áudio",
};

interface MidiaEnviada {
  url: string;
  tipo: TipoMidia;
  nomeArquivo: string;
  tamanho: number;
}

/** Um passo da sequência: tipo, corpo com variáveis/variações e reordenação. */
export function EditorMensagem({
  mensagem,
  indice,
  total,
  variacoes,
  aoAtualizar,
  aoRemover,
  aoMover,
  aoMudarVariacoes,
}: {
  mensagem: MensagemSequencia;
  indice: number;
  total: number;
  variacoes: Spintax[];
  aoAtualizar: (campos: Partial<MensagemSequencia>) => void;
  aoRemover: () => void;
  aoMover: (direcao: -1 | 1) => void;
  /** As variações são globais: criar ou excluir uma aqui muda a lista inteira. */
  aoMudarVariacoes: (lista: Spintax[]) => void;
}) {
  const problemas = validarReferencias(mensagem.corpo, variacoes);
  const combinacoes = combinacoesPossiveis(mensagem.corpo, variacoes);
  const refTexto = React.useRef<HTMLTextAreaElement>(null);
  const [variacoesAberto, setVariacoesAberto] = React.useState(false);

  /**
   * Insere um trecho na posição do cursor, preservando a seleção.
   *
   * Cada mensagem tem o próprio botão, então o destino é sempre este textarea —
   * não existe o caso de inserir na mensagem errada por causa do foco.
   */
  function inserir(trecho: string) {
    const el = refTexto.current;
    if (!el) {
      aoAtualizar({ corpo: mensagem.corpo + trecho });
      return;
    }
    const { selectionStart: ini, selectionEnd: fim } = el;
    const novo = mensagem.corpo.slice(0, ini) + trecho + mensagem.corpo.slice(fim);
    aoAtualizar({ corpo: novo.slice(0, LIMITES.maxCaracteresMensagem) });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(ini + trecho.length, ini + trecho.length);
    });
  }

  return (
    <li className="rounded-lg border border-borda-forte bg-superficie-2">
      <div className="flex flex-wrap items-center gap-2 border-b border-borda px-3.5 py-2.5">
        <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-superficie-3 text-[11px] font-semibold text-tinta-2">
          {indice + 1}
        </span>

        <div className="flex overflow-hidden rounded-lg ring-1 ring-borda-forte ring-inset">
          {(["texto", "midia"] as const).map((tipo) => (
            <button
              key={tipo}
              type="button"
              onClick={() => aoAtualizar({ tipo })}
              aria-pressed={mensagem.tipo === tipo}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs transition-colors",
                mensagem.tipo === tipo
                  ? "bg-marca text-white"
                  : "bg-superficie-3 text-tinta-2 hover:text-tinta",
              )}
            >
              {tipo === "texto" ? (
                <Type aria-hidden className="size-3" />
              ) : (
                <ImagemIcone aria-hidden className="size-3" />
              )}
              {tipo === "texto" ? "Texto" : "Mídia"}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <Botao
            tamanho="icone"
            variante="fantasma"
            onClick={() => aoMover(-1)}
            disabled={indice === 0}
            aria-label={`Mover mensagem ${indice + 1} para cima`}
          >
            <ArrowUp aria-hidden className="size-3.5" />
          </Botao>
          <Botao
            tamanho="icone"
            variante="fantasma"
            onClick={() => aoMover(1)}
            disabled={indice === total - 1}
            aria-label={`Mover mensagem ${indice + 1} para baixo`}
          >
            <ArrowDown aria-hidden className="size-3.5" />
          </Botao>
          <Botao
            tamanho="icone"
            variante="fantasma"
            onClick={aoRemover}
            disabled={total <= 1}
            aria-label={`Remover mensagem ${indice + 1}`}
            className="hover:bg-critico/15 hover:text-critico"
          >
            <Trash2 aria-hidden className="size-3.5" />
          </Botao>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-3.5 py-3">
        {mensagem.tipo === "midia" ? (
          <SeletorMidia midia={mensagem.midia} aoDefinir={(midia) => aoAtualizar({ midia })} />
        ) : null}

        <AreaTexto
          ref={refTexto}
          rotulo={mensagem.tipo === "midia" ? "Legenda" : "Mensagem"}
          value={mensagem.corpo}
          onChange={(e) => aoAtualizar({ corpo: e.target.value })}
          rows={4}
          maxCaracteres={LIMITES.maxCaracteresMensagem}
          placeholder="Escreva a mensagem. Use {{1}} para variáveis e {{*nome*}} para variações."
          acessorio={
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => inserir("{{1}}")}
                title="Inserir variável posicional"
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-tinta-3 hover:bg-superficie-3 hover:text-tinta"
              >
                <Braces aria-hidden className="size-3" />
                Variável
              </button>
              <button
                type="button"
                onClick={() => setVariacoesAberto(true)}
                title="Escolher ou criar uma variação"
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-tinta-3 hover:bg-superficie-3 hover:text-tinta"
              >
                <Shuffle aria-hidden className="size-3" />
                Variação
              </button>
            </div>
          }
        />

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          {combinacoes > 1 ? (
            <span className="text-tinta-3">
              <span className="tabular text-marca-tenue">{combinacoes.toLocaleString("pt-BR")}</span>{" "}
              variações possíveis deste texto
            </span>
          ) : null}

          {problemas.map((p) => (
            <span key={p.nome} className="text-aviso">
              {p.tipo === "variacao_inexistente"
                ? `A variação {{*${p.nome}*}} não existe — crie-a ou remova a referência.`
                : `A variação {{*${p.nome}*}} está sem opções.`}
            </span>
          ))}
        </div>
      </div>

      {/* Montado só quando aberto: são até 10 editores na tela, e cada um
          carrega um <dialog> próprio. */}
      {variacoesAberto ? (
        <ModalVariacoes
          aberto
          aoFechar={() => setVariacoesAberto(false)}
          variacoes={variacoes}
          aoMudar={aoMudarVariacoes}
          aoSelecionar={(nome) => inserir(`{{*${nome}*}}`)}
        />
      ) : null}
    </li>
  );
}

/**
 * Escolha da mídia: arquivo do computador, ou URL para quem já hospeda fora.
 *
 * O tipo (imagem/vídeo/documento/áudio) sai da extensão, não de um seletor.
 * Escolher o tipo errado à mão mandaria um `mediatype` que não bate com o
 * conteúdo, e o WhatsApp só recusa na hora do disparo — com a campanha andando.
 */
function SeletorMidia({
  midia,
  aoDefinir,
}: {
  midia: MensagemSequencia["midia"];
  aoDefinir: (m: NonNullable<MensagemSequencia["midia"]>) => void;
}) {
  const [enviando, setEnviando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [porUrl, setPorUrl] = React.useState(false);
  const [miniaturaFalhou, setMiniaturaFalhou] = React.useState(false);

  // Arquivo novo, miniatura nova: sem isso a falha de um arquivo anterior
  // esconderia a miniatura do que acabou de subir.
  React.useEffect(() => setMiniaturaFalhou(false), [midia?.url]);

  async function enviar(arquivo: File) {
    setErro(null);
    setEnviando(true);
    try {
      const formulario = new FormData();
      formulario.append("arquivo", arquivo);
      const r = await api.upload<{ midia: MidiaEnviada }>("/midia", formulario);
      aoDefinir({ tipo: r.midia.tipo, url: r.midia.url, nomeArquivo: r.midia.nomeArquivo });
    } catch (e) {
      setErro(
        e instanceof ErroApi
          ? (e.primeiroCampo ?? e.message)
          : "Não foi possível enviar o arquivo.",
      );
    } finally {
      setEnviando(false);
    }
  }

  if (porUrl) {
    return (
      <div className="flex flex-col gap-2">
        <Campo
          rotulo="URL do arquivo"
          value={midia?.url ?? ""}
          onChange={(e) =>
            aoDefinir({
              tipo: midia?.tipo ?? "imagem",
              url: e.target.value,
              nomeArquivo: midia?.nomeArquivo || e.target.value.split("/").pop() || "arquivo",
            })
          }
          placeholder="https://cdn.suaempresa.com/banner.jpg"
          dica="Precisa ser público: quem baixa é o servidor do WhatsApp."
        />
        <button
          type="button"
          onClick={() => setPorUrl(false)}
          className="self-start text-xs text-tinta-3 hover:text-tinta"
        >
          Enviar um arquivo do computador
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Dropzone
        extensoes={EXTENSOES_MIDIA}
        maxBytes={MAX_BYTES_MIDIA}
        carregando={enviando}
        aoSelecionar={(a) => void enviar(a)}
        arquivoAtual={midia?.url ? { nome: midia.nomeArquivo, tamanho: 0 } : null}
        aoRemover={() => aoDefinir({ tipo: "imagem", url: "", nomeArquivo: "" })}
        descricao="Imagem até 5 MB · vídeo e áudio até 16 MB · documento até 50 MB"
      />

      {midia?.url ? (
        <div className="flex items-center gap-2.5">
          {midia.tipo === "imagem" && !miniaturaFalhou ? (
            <img
              src={midia.url}
              alt=""
              onError={() => setMiniaturaFalhou(true)}
              className="size-11 shrink-0 rounded-md border border-borda object-cover"
            />
          ) : null}
          <p className="text-xs text-tinta-3">
            {ROTULO_MIDIA[midia.tipo]} pronta para envio — confira na prévia.
          </p>
        </div>
      ) : null}

      <MensagemErro>{erro}</MensagemErro>

      <button
        type="button"
        onClick={() => setPorUrl(true)}
        className="self-start text-xs text-tinta-3 hover:text-tinta"
      >
        Já está hospedado? Usar uma URL
      </button>
    </div>
  );
}
