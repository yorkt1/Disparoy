
import { Sparkles, TriangleAlert } from "lucide-react";
import { CADENCIA_MAXIMA_SEGUNDOS, CADENCIA_MINIMA_SEGUNDOS, LIMITES } from "@disparoy/dominio";
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
  automatico,
  aoMudarAutomatico,
}: {
  titulo: string;
  descricao: string;
  valor: IntervaloAleatorio;
  aoMudar: (v: IntervaloAleatorio) => void;
  /**
   * A faixa saiu do tamanho da leva, e o operador não a digitou.
   *
   * Ausente no intervalo ENTRE MENSAGENS, que não tem modo automático: ele
   * mede a pausa entre os passos da sequência para a MESMA pessoa, e não tem
   * nada a ver com o tamanho do público — escalá-lo faria o contato esperar
   * minutos entre a mensagem 1 e a 2.
   */
  automatico?: boolean;
  aoMudarAutomatico?: (v: boolean) => void;
}) {
  const temAutomatico = automatico !== undefined && aoMudarAutomatico !== undefined;
  const invertido = valor.maxSegundos < valor.minSegundos;
  const arriscado = valor.minSegundos < LIMITES.intervaloMinimoRecomendadoSegundos;

  const entrada =
    "tabular h-9 w-full rounded-lg border border-borda-forte bg-superficie px-2.5 text-sm text-tinta focus:border-marca focus:outline-none";

  return (
    <div className="rounded-lg border border-borda-forte bg-superficie-2 p-3.5">
      <h3 className="text-xs font-medium text-tinta">{titulo}</h3>
      <p className="mt-1 text-xs text-tinta-3">{descricao}</p>

      {temAutomatico && automatico ? (
        <div className="mt-3">
          <p className="flex items-baseline gap-2">
            <Sparkles aria-hidden className="size-3.5 shrink-0 self-center text-marca-tenue" />
            <span className="tabular text-sm text-tinta">
              {valor.minSegundos} a {valor.maxSegundos}s
            </span>
            <span className="text-xs text-tinta-3">calculado pelo tamanho da leva</span>
          </p>
          <p className="mt-1.5 text-xs text-tinta-3">
            Leva pequena anda perto de {CADENCIA_MINIMA_SEGUNDOS}s; leva grande, perto de{" "}
            {CADENCIA_MAXIMA_SEGUNDOS}s. O que queima um número é o volume do dia, não o disparo
            em si.
          </p>
          <button
            type="button"
            onClick={() => aoMudarAutomatico(false)}
            className="mt-2 text-xs text-marca-tenue underline underline-offset-2 hover:text-marca"
          >
            Ajustar à mão
          </button>
        </div>
      ) : (
        <ControleManual
          valor={valor}
          aoMudar={aoMudar}
          entrada={entrada}
          invertido={invertido}
          arriscado={arriscado}
          aoVoltarParaAutomatico={
            temAutomatico ? () => aoMudarAutomatico(true) : undefined
          }
        />
      )}
    </div>
  );
}

function ControleManual({
  valor,
  aoMudar,
  entrada,
  invertido,
  arriscado,
  aoVoltarParaAutomatico,
}: {
  valor: IntervaloAleatorio;
  aoMudar: (v: IntervaloAleatorio) => void;
  entrada: string;
  invertido: boolean;
  arriscado: boolean;
  aoVoltarParaAutomatico?: () => void;
}) {
  return (
    <>
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

      {aoVoltarParaAutomatico ? (
        <button
          type="button"
          onClick={aoVoltarParaAutomatico}
          className="mt-2 text-xs text-marca-tenue underline underline-offset-2 hover:text-marca"
        >
          Voltar ao automático
        </button>
      ) : null}
    </>
  );
}
