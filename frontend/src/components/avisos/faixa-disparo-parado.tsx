import { AlertTriangle } from "lucide-react";
import { formatarDataHora } from "@/lib/formato";

/**
 * O processo que envia as mensagens não está rodando.
 *
 * Já morou no layout, acima de qualquer tela, porque o sintoma aparece em
 * todas: a campanha é aceita, marca "Em andamento" e não sai nada. Saiu de lá
 * porque alerta que acompanha toda navegação vira paisagem — quem opera o
 * painel o dia inteiro para de enxergar a faixa em uma semana.
 *
 * O custo da mudança é real e vale dito: quem não abrir o diagnóstico não fica
 * sabendo, e a única pista restante é a porcentagem parada em 0%, que se
 * explica de mil maneiras. É por isso que aqui ela é a PRIMEIRA coisa da
 * página, antes das abas, e não é dispensável: enquanto durar, nenhum disparo
 * acontece.
 */
export function FaixaDisparoParado({ pulsoEm }: { pulsoEm: string | null }) {
  return (
    <div
      role="alert"
      className="mb-5 flex flex-wrap items-start gap-3 rounded-xl border border-critico/35 bg-critico/10 p-4"
    >
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-critico" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-tinta">Nenhuma campanha está sendo enviada</p>
        <p className="mt-0.5 text-sm text-tinta-2">
          O processo de disparo não dá sinal de vida. Campanhas continuam sendo criadas e ficam
          paradas em “Em andamento” até ele voltar — nada é perdido.
        </p>
        <p className="mt-1 text-xs text-tinta-3">
          {pulsoEm
            ? `Último sinal em ${formatarDataHora(pulsoEm)}.`
            : "Nenhum sinal desde que o sistema subiu."}
        </p>
      </div>
    </div>
  );
}
