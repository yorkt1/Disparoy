
import * as React from "react";
import { Check, FileText, Music, Play, RefreshCw, Image as ImagemIcone } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import type { Contato, MensagemSequencia, Spintax, TipoMidia } from "@disparoy/dominio";
import { indexarVariacoes, renderizarMensagem } from "@disparoy/dominio";

const ICONE_MIDIA: Record<TipoMidia, React.ReactNode> = {
  imagem: <ImagemIcone className="size-4" />,
  video: <Play className="size-4" />,
  documento: <FileText className="size-4" />,
  audio: <Music className="size-4" />,
};

/**
 * Prévia do que o contato vê.
 *
 * Sorteia as variações de verdade, então o botão "sortear de novo" mostra
 * exatamente a variedade que a campanha vai produzir — não um texto fixo.
 */
export function PreviaConversa({
  sequencia,
  variacoes,
  contatoExemplo,
}: {
  sequencia: MensagemSequencia[];
  variacoes: Spintax[];
  contatoExemplo?: Contato;
}) {
  const [semente, setSemente] = React.useState(0);

  /**
   * Só as variáveis do contato real importado.
   *
   * Sem contato, as referências ficam literais (`{{1}}` aparece como `{{1}}`)
   * em vez de inventar um nome: assim o operador vê exatamente o que ainda não
   * está resolvido, em vez de uma prévia bonita que esconde o buraco.
   */
  // Memorizado: sem isso o objeto seria novo a cada render e o spintax seria
  // re-sorteado o tempo todo, fazendo a prévia piscar textos diferentes.
  const variaveis = React.useMemo(() => contatoExemplo?.variaveis ?? {}, [contatoExemplo]);

  const indice = React.useMemo(() => indexarVariacoes(variacoes), [variacoes]);

  const renderizadas = React.useMemo(
    () =>
      sequencia.map((m) => ({
        ...m,
        texto: renderizarMensagem(m.corpo, { variacoes: indice, variaveis }),
      })),
    // `semente` entra de propósito: mudá-la força um novo sorteio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sequencia, indice, variaveis, semente],
  );

  // Hora real: a prévia mostra como a mensagem sairia agora.
  const horario = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date());

  const nomeContato = contatoExemplo?.nome?.trim() || "Contato";
  const inicial = nomeContato.charAt(0).toUpperCase();

  return (
    <div className="overflow-hidden rounded-lg border border-borda-forte">
      {/* Barra do painel — fora da conversa, para não passar por parte do app. */}
      <div className="flex items-center justify-between gap-3 border-b border-borda bg-superficie-2 px-3.5 py-2.5">
        <h3 className="text-xs font-medium text-tinta">
          Prévia
          <span className="ml-1.5 font-normal text-tinta-3">
            {contatoExemplo
              ? "com o 1º contato importado"
              : "importe contatos para preencher as variáveis"}
          </span>
        </h3>
        <Botao tamanho="sm" variante="fantasma" onClick={() => setSemente((s) => s + 1)}>
          <RefreshCw aria-hidden className="size-3.5" />
          Sortear de novo
        </Botao>
      </div>

      {/* Daqui para baixo, as cores são as do WhatsApp escuro, não as do painel:
          a prévia serve para julgar como a mensagem vai parecer no aparelho. */}
      <div className="flex items-center gap-2.5 bg-[#202c33] px-3 py-2">
        <span
          aria-hidden
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#6a7175] text-sm font-medium text-[#e9edef]"
        >
          {inicial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm leading-tight text-[#e9edef]">{nomeContato}</p>
          <p className="text-[11px] leading-tight text-[#8696a0]">online</p>
        </div>
      </div>

      <div
        className="flex flex-col gap-2 bg-[#0b141a] px-3 py-3.5"
        style={{
          // Trama sutil no lugar do papel de parede do WhatsApp, que é imagem.
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.045) 1px, transparent 0)",
          backgroundSize: "16px 16px",
        }}
      >
        <div className="mb-1 flex justify-center">
          <span className="rounded-md bg-[#182229] px-2.5 py-1 text-[11px] text-[#8696a0] shadow-sm">
            HOJE
          </span>
        </div>

        {renderizadas.map((m, i) => (
          <div key={m.id} className="flex justify-end">
            <div className="relative max-w-[85%] rounded-lg rounded-tr-none bg-[#005c4b] px-2 py-1.5 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
              {/* Bico da bolha: é o que faz a forma ser lida como WhatsApp. */}
              <span
                aria-hidden
                className="absolute top-0 -right-2 size-0 border-t-[8px] border-l-[8px] border-t-[#005c4b] border-l-transparent"
              />

              {m.tipo === "midia" && m.midia ? <MidiaNaBolha midia={m.midia} /> : null}

              {m.texto.trim() ? (
                <p className="px-1 text-sm leading-[1.35] whitespace-pre-wrap text-[#e9edef]">
                  {m.texto}
                </p>
              ) : (
                <p className="px-1 text-sm text-[#e9edef]/40 italic">Mensagem {i + 1} ainda vazia</p>
              )}

              {/* Um traço só: a prévia não tem status de entrega para exibir. */}
              <span className="mt-0.5 flex items-center justify-end gap-1 pr-1 text-[11px] text-[#ffffff]/60">
                {horario}
                <Check aria-hidden className="size-3" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A mídia como o contato a recebe: a imagem aparece, não o nome do arquivo.
 *
 * Ver o arquivo aqui é o que transforma a prévia em conferência — anexar a foto
 * errada é um erro que só o olho pega, e depois do disparo não há como desfazer.
 *
 * Documento continua sendo um cartão com o nome, porque é assim que o WhatsApp
 * o entrega. Falha de carregamento cai no mesmo cartão: uma URL colada à mão
 * pode não ser pública, e o quadrado quebrado esconderia justamente esse aviso.
 */
function MidiaNaBolha({ midia }: { midia: NonNullable<MensagemSequencia["midia"]> }) {
  const [falhou, setFalhou] = React.useState(false);

  // Trocar de arquivo limpa a falha anterior, senão o cartão ficaria para sempre.
  React.useEffect(() => setFalhou(false), [midia.url]);

  if (!midia.url || falhou || midia.tipo === "documento") {
    return (
      <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-black/25 px-2.5 py-2 text-xs text-white/80">
        <span aria-hidden className="text-white/70">{ICONE_MIDIA[midia.tipo]}</span>
        <span className="truncate">{midia.nomeArquivo || "arquivo"}</span>
        {falhou ? <span className="ml-auto shrink-0 text-white/45">não carregou</span> : null}
      </div>
    );
  }

  if (midia.tipo === "imagem") {
    return (
      <div className="mb-1.5 overflow-hidden rounded-lg bg-black/25">
        <img
          src={midia.url}
          alt={midia.nomeArquivo || "Imagem anexada"}
          onError={() => setFalhou(true)}
          className="max-h-64 w-full object-contain"
        />
      </div>
    );
  }

  if (midia.tipo === "video") {
    return (
      <div className="mb-1.5 overflow-hidden rounded-lg bg-black/25">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          src={midia.url}
          controls
          preload="metadata"
          onError={() => setFalhou(true)}
          className="max-h-64 w-full"
        />
      </div>
    );
  }

  return (
    <div className="mb-1.5 rounded-lg bg-black/25 px-2 py-1.5">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        src={midia.url}
        controls
        preload="metadata"
        onError={() => setFalhou(true)}
        className="w-full"
      />
    </div>
  );
}
