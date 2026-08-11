
import * as React from "react";
import { Check, CircleAlert } from "lucide-react";
import { cn } from "@/lib/formato";

/**
 * Peça reutilizável de formulário multi-etapa "tudo na mesma tela": um bloco
 * numerado que mostra o próprio estado de preenchimento.
 *
 * Diferente de um wizard paginado, todas as etapas ficam visíveis — o número
 * serve de orientação e o selo de status diz o que ainda falta.
 */

export type EstadoEtapa = "pendente" | "preenchida" | "erro";

export function Etapa({
  numero,
  titulo,
  descricao,
  estado = "pendente",
  resumo,
  acao,
  children,
  className,
}: {
  numero: number;
  titulo: string;
  descricao?: string;
  estado?: EstadoEtapa;
  /** Linha curta com o que já foi escolhido, ex. "2 canais selecionados". */
  resumo?: React.ReactNode;
  acao?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const marcador = {
    pendente: "border-borda-forte bg-superficie-2 text-tinta-3",
    preenchida: "border-bom/40 bg-bom/12 text-bom",
    erro: "border-critico/40 bg-critico/12 text-critico",
  }[estado];

  return (
    <section
      aria-labelledby={`etapa-${numero}-titulo`}
      className={cn("rounded-card border border-borda bg-superficie", className)}
    >
      <div className="flex items-start gap-4 px-5 py-4">
        <span
          aria-hidden
          className={cn(
            "tabular mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
            marcador,
          )}
        >
          {estado === "preenchida" ? (
            <Check className="size-4" />
          ) : estado === "erro" ? (
            <CircleAlert className="size-4" />
          ) : (
            numero
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id={`etapa-${numero}-titulo`} className="text-sm font-semibold text-tinta">
              <span className="sr-only">Etapa {numero}: </span>
              {titulo}
            </h2>
            {resumo ? <span className="text-xs text-tinta-3">{resumo}</span> : null}
          </div>
          {descricao ? <p className="mt-1 text-xs text-tinta-3">{descricao}</p> : null}
        </div>

        {acao ? <div className="shrink-0">{acao}</div> : null}
      </div>

      <div className="border-t border-borda px-5 py-5">{children}</div>
    </section>
  );
}
