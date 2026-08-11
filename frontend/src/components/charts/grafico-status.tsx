
import * as React from "react";
import { cn, formatarNumero, percentual } from "@/lib/formato";

/**
 * "Mensagens por status" — barras horizontais.
 *
 * As três primeiras faixas são etapas de um funil (enviada -> entregue -> lida),
 * então usam uma rampa ORDINAL de um hue só (azul, claro -> escuro), validada
 * para a superfície #1a1a19. "Falhas" não é etapa do funil: é estado de erro e
 * recebe a cor reservada de status crítico, sempre acompanhada de rótulo.
 *
 * A barra é ancorada na base (canto esquerdo reto) e arredondada só na ponta
 * do dado, que é a extremidade que carrega a informação.
 */

export interface FaixaStatus {
  chave: string;
  rotulo: string;
  valor: number;
  cor: string;
  /** Denominador para o percentual do tooltip. */
  baseComparacao?: number;
  legendaBase?: string;
}

export function GraficoStatus({
  enviadas,
  entregues,
  lidas,
  falhas,
}: {
  enviadas: number;
  entregues: number;
  lidas: number;
  falhas: number;
}) {
  const faixas: FaixaStatus[] = [
    { chave: "enviadas", rotulo: "Enviadas", valor: enviadas, cor: "var(--color-serie-1)" },
    {
      chave: "entregues",
      rotulo: "Entregues",
      valor: entregues,
      cor: "var(--color-serie-2)",
      baseComparacao: enviadas,
      legendaBase: "das enviadas",
    },
    {
      chave: "lidas",
      rotulo: "Lidas",
      valor: lidas,
      cor: "var(--color-serie-3)",
      baseComparacao: entregues,
      legendaBase: "das entregues",
    },
    {
      chave: "falhas",
      rotulo: "Falhas",
      valor: falhas,
      cor: "var(--color-serie-falha)",
      baseComparacao: enviadas,
      legendaBase: "das enviadas",
    },
  ];

  const maximo = Math.max(...faixas.map((f) => f.valor), 1);
  const [ativa, setAtiva] = React.useState<string | null>(null);

  return (
    <div className="px-5 pt-1 pb-5">
      <ul className="flex flex-col gap-4">
        {faixas.map((faixa) => {
          const largura = Math.max((faixa.valor / maximo) * 100, faixa.valor > 0 ? 1.5 : 0);
          const emFoco = ativa === faixa.chave;
          const relativo =
            faixa.baseComparacao !== undefined
              ? percentual(faixa.valor, faixa.baseComparacao)
              : null;

          return (
            <li
              key={faixa.chave}
              className="relative"
              onMouseEnter={() => setAtiva(faixa.chave)}
              onMouseLeave={() => setAtiva(null)}
              onFocus={() => setAtiva(faixa.chave)}
              onBlur={() => setAtiva(null)}
            >
              <div className="mb-1.5 flex items-baseline justify-between gap-4">
                <span className="flex items-center gap-2 text-xs text-tinta-2">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-[1px]"
                    style={{ backgroundColor: faixa.cor }}
                  />
                  {faixa.rotulo}
                </span>
                <span className="tabular text-xs font-medium text-tinta">
                  {formatarNumero(faixa.valor)}
                  {relativo !== null ? (
                    <span className="ml-1.5 font-normal text-tinta-3">
                      {relativo.toFixed(1).replace(".", ",")}%
                    </span>
                  ) : null}
                </span>
              </div>

              {/* Alvo de hover maior que a marca, conforme guia de interação. */}
              <div
                tabIndex={0}
                role="img"
                aria-label={`${faixa.rotulo}: ${formatarNumero(faixa.valor)} mensagens${
                  relativo !== null ? `, ${relativo.toFixed(1)}% ${faixa.legendaBase}` : ""
                }`}
                className="-my-1.5 cursor-default py-1.5"
              >
                <div className="h-2 w-full overflow-hidden rounded-[2px] bg-superficie-3">
                  <div
                    className={cn(
                      "h-full rounded-r-[4px] transition-[width,filter] duration-700",
                      emFoco && "brightness-115",
                    )}
                    style={{ width: `${largura}%`, backgroundColor: faixa.cor }}
                  />
                </div>
              </div>

              {emFoco ? (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute top-full right-0 z-20 mt-1 rounded-lg border border-borda-forte bg-superficie-2 px-3 py-2 text-xs whitespace-nowrap shadow-xl"
                >
                  <p className="font-medium text-tinta">{faixa.rotulo}</p>
                  <p className="tabular mt-0.5 text-tinta-2">
                    {formatarNumero(faixa.valor)} mensagens
                  </p>
                  {relativo !== null ? (
                    <p className="tabular mt-0.5 text-tinta-3">
                      {relativo.toFixed(1).replace(".", ",")}% {faixa.legendaBase}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
