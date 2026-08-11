
import { TriangleAlert } from "lucide-react";
import { LIMITES } from "@disparoy/dominio";
import type { IntervaloAleatorio } from "@disparoy/dominio";

/**
 * Par mín/máx em segundos. O valor real é sorteado dentro da faixa a cada
 * envio — intervalo fixo é padrão de robô e é o que costuma derrubar o número.
 */
export function ControleIntervalo({
  titulo,
  descricao,
  valor,
  aoMudar,
}: {
  titulo: string;
  descricao: string;
  valor: IntervaloAleatorio;
  aoMudar: (v: IntervaloAleatorio) => void;
}) {
  const invertido = valor.maxSegundos < valor.minSegundos;
  const arriscado = valor.minSegundos < LIMITES.intervaloMinimoRecomendadoSegundos;

  const entrada =
    "tabular h-9 w-full rounded-lg border border-borda-forte bg-superficie px-2.5 text-sm text-tinta focus:border-marca focus:outline-none";

  return (
    <div className="rounded-lg border border-borda-forte bg-superficie-2 p-3.5">
      <h3 className="text-xs font-medium text-tinta">{titulo}</h3>
      <p className="mt-1 text-xs text-tinta-3">{descricao}</p>

      <div className="mt-3 flex items-end gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-[11px] text-tinta-3">Mínimo (s)</span>
          <input
            type="number"
            min={0}
            max={3600}
            value={valor.minSegundos}
            onChange={(e) =>
              aoMudar({ ...valor, minSegundos: Math.max(0, Number(e.target.value) || 0) })
            }
            className={entrada}
          />
        </label>
        <span aria-hidden className="pb-2 text-xs text-tinta-3">
          até
        </span>
        <label className="flex-1">
          <span className="mb-1 block text-[11px] text-tinta-3">Máximo (s)</span>
          <input
            type="number"
            min={0}
            max={3600}
            value={valor.maxSegundos}
            onChange={(e) =>
              aoMudar({ ...valor, maxSegundos: Math.max(0, Number(e.target.value) || 0) })
            }
            className={entrada}
          />
        </label>
      </div>

      {invertido ? (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-xs text-critico">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />O máximo precisa ser
          maior ou igual ao mínimo.
        </p>
      ) : arriscado ? (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-aviso">
          <TriangleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
          Abaixo de {LIMITES.intervaloMinimoRecomendadoSegundos}s o risco de bloqueio do número
          cresce bastante.
        </p>
      ) : null}
    </div>
  );
}
