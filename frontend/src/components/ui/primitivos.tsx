import * as React from "react";
import { cn } from "@/lib/formato";

/** Blocos visuais base compartilhados por todas as telas do painel. */

// --------------------------------------------------------------------------
// Card
// --------------------------------------------------------------------------

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      /*
        A sombra é variável (`--shadow-card`) e não literal: no tema claro ela é
        elevação, no escuro é um filete de luz na borda de cima. Sombra escura
        sobre fundo quase preto não aparece, e realce branco sobre fundo branco
        também não — são efeitos diferentes para a mesma peça.

        Valor arbitrário apontando para a variável, e não um `shadow-card` vindo
        do `@theme`: o Tailwind RESOLVE os valores de `--shadow-*` ao gerar a
        classe, e o utilitário sairia com o valor do tema claro escrito dentro
        dele — a troca de tema não o alcançaria.

        E não escreva um nome de classe de exemplo em comentário: o Tailwind
        varre o texto bruto do arquivo, não a árvore sintática, e gera CSS a
        partir do que parece classe mesmo aqui dentro.
      */
      className={cn(
        "rounded-card border border-borda bg-superficie shadow-[var(--shadow-card)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardCabecalho({
  titulo,
  descricao,
  acao,
  className,
}: {
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 py-4", className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-tinta">{titulo}</h2>
        {descricao ? <p className="mt-1 text-xs text-tinta-3">{descricao}</p> : null}
      </div>
      {acao ? <div className="shrink-0">{acao}</div> : null}
    </div>
  );
}

export function CardCorpo({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

export function Separador({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-borda", className)} />;
}

// --------------------------------------------------------------------------
// Badge
// --------------------------------------------------------------------------

const TONS = {
  neutro: "bg-superficie-3 text-tinta-2 ring-borda-forte",
  marca: "bg-marca/12 text-marca-tenue ring-marca/30",
  bom: "bg-bom/12 text-bom ring-bom/30",
  aviso: "bg-aviso/12 text-aviso ring-aviso/30",
  serio: "bg-serio/12 text-serio ring-serio/30",
  critico: "bg-critico/15 text-critico ring-critico/35",
} as const;

export type TomBadge = keyof typeof TONS;

export function Badge({
  tom = "neutro",
  icone,
  children,
  className,
}: {
  tom?: TomBadge;
  icone?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset whitespace-nowrap",
        TONS[tom],
        className,
      )}
    >
      {icone}
      {children}
    </span>
  );
}

// --------------------------------------------------------------------------
// Barra de progresso
// --------------------------------------------------------------------------

export function BarraProgresso({
  valor,
  rotulo,
  tom = "marca",
  className,
}: {
  valor: number;
  rotulo?: string;
  tom?: "marca" | "bom" | "critico" | "aviso";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, valor));
  const cores = { marca: "bg-marca", bom: "bg-bom", critico: "bg-critico", aviso: "bg-aviso" };

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={rotulo ?? "Progresso"}
        className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-superficie-3"
      >
        <div
          className={cn("h-full rounded-full transition-[width] duration-500", cores[tom])}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="tabular w-11 shrink-0 text-right text-xs text-tinta-2">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

// --------------------------------------------------------------------------
// Estado vazio
// --------------------------------------------------------------------------

export function EstadoVazio({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone?: React.ReactNode;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icone ? <div className="text-tinta-3">{icone}</div> : null}
      <div>
        <p className="text-sm font-medium text-tinta">{titulo}</p>
        {descricao ? <p className="mt-1 text-xs text-tinta-3">{descricao}</p> : null}
      </div>
      {acao}
    </div>
  );
}

// --------------------------------------------------------------------------
// Cabeçalho de página
// --------------------------------------------------------------------------

export function CabecalhoPagina({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-tinta">{titulo}</h1>
        {descricao ? <p className="mt-1 text-sm text-tinta-3">{descricao}</p> : null}
      </div>
      {acao}
    </div>
  );
}
