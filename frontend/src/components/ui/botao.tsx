
import * as React from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/formato";

const VARIANTES = {
  primario:
    "bg-marca text-white hover:bg-marca-forte active:bg-marca-suave disabled:bg-marca/40 disabled:text-white/60",
  secundario:
    "bg-superficie-3 text-tinta ring-1 ring-inset ring-borda-forte hover:bg-borda-forte disabled:text-tinta-3",
  fantasma: "text-tinta-2 hover:bg-superficie-3 hover:text-tinta disabled:text-tinta-3",
  perigo:
    "bg-critico/15 text-critico ring-1 ring-inset ring-critico/35 hover:bg-critico/25 disabled:opacity-50",
} as const;

const TAMANHOS = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9.5 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
  icone: "h-8 w-8 justify-center",
} as const;

export interface PropsBotao extends React.ComponentProps<"button"> {
  variante?: keyof typeof VARIANTES;
  tamanho?: keyof typeof TAMANHOS;
  carregando?: boolean;
}

const base =
  "inline-flex items-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed select-none";

export function Botao({
  variante = "secundario",
  tamanho = "md",
  carregando = false,
  disabled,
  className,
  children,
  ...props
}: PropsBotao) {
  return (
    <button
      type="button"
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      className={cn(base, VARIANTES[variante], TAMANHOS[tamanho], className)}
      {...props}
    >
      {carregando ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function BotaoLink({
  variante = "secundario",
  tamanho = "md",
  className,
  ...props
}: React.ComponentProps<typeof Link> & {
  variante?: keyof typeof VARIANTES;
  tamanho?: keyof typeof TAMANHOS;
}) {
  return (
    <Link className={cn(base, VARIANTES[variante], TAMANHOS[tamanho], className)} {...props} />
  );
}
