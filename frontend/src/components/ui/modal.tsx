
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/formato";
import { Botao } from "./botao";

/**
 * Modal sobre <dialog> nativo — foco preso, Esc e backdrop vêm de graça do
 * browser, sem biblioteca de overlay.
 */
export function Modal({
  aberto,
  aoFechar,
  aoConfirmar,
  confirmando = false,
  titulo,
  descricao,
  children,
  rodape,
  largura = "md",
}: {
  aberto: boolean;
  aoFechar: () => void;
  /**
   * A ação principal do rodapé, para o Enter chamar.
   *
   * Sem isso, Enter não fazia nada em modal nenhum do painel: só as telas de
   * login e de perfil usam `<form>`, e todo o resto é este modal com botões
   * soltos. Quem digita nome e aperta Enter esperando salvar ficava olhando
   * para uma tela que não reagia.
   *
   * É um prop explícito, e não um "clica no último botão do rodapé" achado no
   * DOM: qual botão é o principal é decisão de quem monta o modal, e adivinhar
   * pela posição quebra em silêncio no dia em que alguém inverte a ordem.
   */
  aoConfirmar?: () => void;
  /** Enquanto a ação corre, o Enter para — senão a segunda tecla envia de novo. */
  confirmando?: boolean;
  titulo: string;
  descricao?: string;
  children: React.ReactNode;
  rodape?: React.ReactNode;
  largura?: "sm" | "md" | "lg";
}) {
  const ref = React.useRef<HTMLDialogElement>(null);

  React.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (aberto && !dialog.open) dialog.showModal();
    if (!aberto && dialog.open) dialog.close();
  }, [aberto]);

  function aoTeclar(evento: React.KeyboardEvent<HTMLDialogElement>) {
    if (evento.key !== "Enter" || !aoConfirmar || confirmando) return;
    // Enter com modificador é outro gesto (quebra de linha, atalho do SO).
    if (evento.shiftKey || evento.altKey || evento.metaKey || evento.ctrlKey) return;

    const alvo = evento.target as HTMLElement;
    // Textarea precisa do Enter para quebrar linha — é o corpo da mensagem que
    // se está escrevendo. Botão e link já respondem ao Enter sozinhos, e
    // interceptar faria a tecla disparar duas ações: a do foco e a principal.
    if (alvo.tagName === "TEXTAREA" || alvo.tagName === "BUTTON" || alvo.tagName === "A") return;
    if (alvo.isContentEditable) return;

    evento.preventDefault();
    aoConfirmar();
  }

  const larguras = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl" };

  return (
    <dialog
      ref={ref}
      onClose={aoFechar}
      onKeyDown={aoTeclar}
      // Sem fechar no clique do backdrop de propósito: estes modais têm
      // formulário, e o clique fora — ou soltar fora uma seleção de texto que
      // começou dentro — descartava o que foi digitado. Fecha pelo Esc, pelo X
      // ou pelo botão do rodapé.
      aria-labelledby="modal-titulo"
      className={cn(
        "m-auto w-[calc(100vw-2rem)] rounded-card border border-borda bg-superficie p-0 text-tinta",
        "backdrop:bg-black/70 backdrop:backdrop-blur-sm",
        larguras[largura],
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-borda px-5 py-4">
        <div>
          <h2 id="modal-titulo" className="text-sm font-semibold text-tinta">
            {titulo}
          </h2>
          {descricao ? <p className="mt-1 text-xs text-tinta-3">{descricao}</p> : null}
        </div>
        <Botao tamanho="icone" variante="fantasma" onClick={aoFechar} aria-label="Fechar">
          <X aria-hidden className="size-4" />
        </Botao>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>

      {rodape ? (
        <div className="flex items-center justify-end gap-2 border-t border-borda px-5 py-3">
          {rodape}
        </div>
      ) : null}
    </dialog>
  );
}
