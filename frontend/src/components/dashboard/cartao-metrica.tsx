import * as React from "react";
import { cn } from "@/lib/formato";
import { Card } from "@/components/ui/primitivos";

/**
 * Stat tile: um número que fala por si, com rótulo e uma linha de contexto.
 * O valor usa figuras proporcionais (é número solto, não coluna de tabela).
 */
export function CartaoMetrica({
  rotulo,
  valor,
  contexto,
  icone,
  tom = "neutro",
  medidor,
}: {
  rotulo: string;
  valor: string;
  contexto?: React.ReactNode;
  icone?: React.ReactNode;
  tom?: "neutro" | "marca" | "bom" | "aviso" | "critico";
  /** Razão 0..100 desenhada como medidor fino sob o valor. */
  medidor?: number;
}) {
  const cores = {
    neutro: "text-tinta-3",
    marca: "text-marca-tenue",
    bom: "text-bom",
    aviso: "text-aviso",
    critico: "text-critico",
  };
  const barras = {
    neutro: "bg-tinta-3",
    marca: "bg-marca",
    bom: "bg-bom",
    aviso: "bg-aviso",
    critico: "bg-critico",
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-tinta-3">{rotulo}</p>
        {icone ? (
          <span aria-hidden className={cn("shrink-0", cores[tom])}>
            {icone}
          </span>
        ) : null}
      </div>

      <p className="mt-2.5 text-2xl leading-none font-semibold text-tinta">{valor}</p>

      {medidor !== undefined ? (
        <div aria-hidden className="mt-3 h-1 overflow-hidden rounded-full bg-superficie-3">
          <div
            className={cn("h-full rounded-full", barras[tom])}
            style={{ width: `${Math.min(Math.max(medidor, 0), 100)}%` }}
          />
        </div>
      ) : null}

      {contexto ? <p className="mt-2 text-xs text-tinta-3">{contexto}</p> : null}
    </Card>
  );
}
