import * as React from "react";
import { Activity } from "lucide-react";
import type { IntervaloAleatorio } from "@disparoy/dominio";
import { Card, CardCabecalho, Separador } from "@/components/ui/primitivos";
import { cn } from "@/lib/formato";

/**
 * O ritmo real do disparo, contra o configurado.
 *
 * A faixa de intervalo diz o que DEVERIA acontecer. Esta tela diz o que
 * aconteceu — e a diferença entre as duas é a única forma de conferir que o
 * espaçamento está de pé sem abrir o banco.
 *
 * Existe para o teste de campanha nova, que era feito no escuro: o operador
 * configurava 30 s, disparava, e não tinha como saber se saiu 30 s, 3 s ou
 * tudo de uma vez. Intervalo que não está sendo respeitado é o defeito mais
 * caro do produto — é assim que um número é bloqueado — e era invisível.
 */
export function RitmoDisparo({
  ultimosEnvios,
  faixa,
}: {
  /** Horários das últimas mensagens, do mais novo para o mais antigo. */
  ultimosEnvios: string[];
  faixa: IntervaloAleatorio;
}) {
  const agora = useAgora(ultimosEnvios.length > 0);

  if (ultimosEnvios.length === 0) {
    return (
      <Card>
        <CardCabecalho titulo="Ritmo do disparo" />
        <Separador />
        <p className="px-5 py-4 text-xs text-tinta-3">
          Nenhuma mensagem saiu ainda. Os intervalos aparecem aqui a partir da segunda.
        </p>
      </Card>
    );
  }

  const ultimo = new Date(ultimosEnvios[0]).getTime();
  const desdeUltimo = Math.max(0, Math.round((agora - ultimo) / 1000));

  /*
   * Os intervalos entre envios consecutivos.
   *
   * `ultimosEnvios` vem do mais novo para o mais antigo, então a diferença é
   * sempre `anterior - atual` na ordem do array. São N-1 intervalos para N
   * envios: com uma mensagem só não há intervalo nenhum a mostrar, que é
   * diferente de "o intervalo é zero".
   */
  const intervalos = ultimosEnvios
    .slice(0, -1)
    .map((quando, i) =>
      Math.round((new Date(quando).getTime() - new Date(ultimosEnvios[i + 1]).getTime()) / 1000),
    );

  return (
    <Card>
      <CardCabecalho
        titulo="Ritmo do disparo"
        descricao={`Configurado: ${faixa.minSegundos} a ${faixa.maxSegundos}s entre contatos.`}
      />
      <Separador />

      <div className="px-5 py-4">
        <p className="flex items-baseline gap-2">
          <Activity aria-hidden className="size-4 shrink-0 self-center text-marca-tenue" />
          <span className="tabular text-2xl text-tinta">{desdeUltimo}s</span>
          <span className="text-xs text-tinta-3">desde a última mensagem</span>
        </p>

        {/*
          O contador anda de segundo em segundo na tela, mas o dado vem do
          servidor a cada 10 s. Na virada de uma mensagem para a outra ele pode
          passar do teto antes de zerar — e o operador leria isso como intervalo
          estourado. Dizer o atraso é mais honesto do que fingir tempo real.
        */}
        <p className="mt-1 text-xs text-tinta-3">
          Atualiza a cada 10s, então a virada pode aparecer com esse atraso.
        </p>

        {intervalos.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-tinta-2">
              Últimos intervalos, do mais recente
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {intervalos.map((segundos, i) => (
                // Índice como chave: a lista vem pronta do servidor, não
                // reordena e não guarda estado próprio.
                // eslint-disable-next-line react/no-array-index-key
                <li key={i}>
                  <span
                    className={cn(
                      "tabular inline-block rounded-md px-2 py-1 text-xs",
                      // Fora da faixa é o que interessa ver. Não é
                      // necessariamente defeito — a fila pode ter esperado
                      // canal, cota ou validação de número —, mas é onde se
                      // olha primeiro quando o disparo não está no ritmo.
                      dentroDaFaixa(segundos, faixa)
                        ? "bg-superficie-3 text-tinta-2"
                        : "bg-aviso/15 text-aviso",
                    )}
                    title={
                      dentroDaFaixa(segundos, faixa)
                        ? "Dentro da faixa configurada"
                        : `Fora da faixa de ${faixa.minSegundos}–${faixa.maxSegundos}s`
                    }
                  >
                    {segundos}s
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-xs text-tinta-3">
            Só uma mensagem saiu até agora — o primeiro intervalo aparece na próxima.
          </p>
        )}
      </div>
    </Card>
  );
}

/**
 * O relógio que faz o contador andar.
 *
 * Um `setInterval` de 1 s só enquanto há o que contar: parar quando não há
 * envio nenhum evita a tela de campanha em rascunho ficar re-renderizando uma
 * vez por segundo até alguém fechar a aba.
 */
function useAgora(ativo: boolean): number {
  const [agora, setAgora] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (!ativo) return;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ativo]);

  return agora;
}

/**
 * O intervalo bate com o configurado?
 *
 * Com folga de um segundo nas duas pontas: o carimbo é gravado quando a linha
 * entra em `mensagens_enviadas`, não no instante exato da entrega ao gateway,
 * e marcar 91 s como fora de uma faixa que termina em 90 seria ruído.
 */
function dentroDaFaixa(segundos: number, faixa: IntervaloAleatorio): boolean {
  return segundos >= faixa.minSegundos - 1 && segundos <= faixa.maxSegundos + 1;
}
