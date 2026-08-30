import * as React from "react";
import type { Canal } from "@disparoy/dominio";
import { contarContatosDoCanal, useVerificarCanal } from "@/hooks/consultas";

/**
 * As peças do pareamento, compartilhadas por conectar e reconectar.
 *
 * Os dois modais fazem a MESMA coisa depois que a sessão abre: mostram o QR ou
 * o código, contam o tempo até expirar e anunciam quando o aparelho pareia. O
 * que muda é só o que vem antes — um cria o canal, o outro já tem um. Manter
 * essas peças num arquivo próprio é o que impede as duas telas de divergirem
 * quando alguém ajusta uma e esquece a outra.
 */

/**
 * Enquanto o QR/código está na tela, pergunta ao gateway se já pareou.
 *
 * Sem isto, descobrir que o número conectou dependia de uma de duas coisas:
 * o webhook `CONNECTION_UPDATE` — que nunca chegou nenhuma vez neste sistema,
 * porque exige o gateway alcançar a API — ou a vigilância do worker, que roda
 * de minuto em minuto. Daí os ~40 segundos olhando para um QR já escaneado,
 * sem saber se tinha dado certo.
 *
 * Perguntar direto ao gateway resolve em segundos e não depende de nenhuma das
 * duas. O intervalo de 3 s é curto porque a janela é curta: são poucos
 * segundos entre escanear e confirmar, e ninguém fica nessa tela por muito
 * tempo.
 */
export function usePareamentoAoVivo(canalId: string | null, ativo: boolean): Canal | null {
  const verificacao = useVerificarCanal();
  const [conectado, setConectado] = React.useState<Canal | null>(null);

  const verificar = React.useRef(verificacao.mutateAsync);
  verificar.current = verificacao.mutateAsync;

  React.useEffect(() => {
    if (!ativo || !canalId) {
      setConectado(null);
      return;
    }

    let parado = false;
    const timer = setInterval(async () => {
      if (parado) return;
      try {
        const r = await verificar.current(canalId);
        if (!parado && r.confirmado && r.canal.status === "conectado") {
          setConectado(r.canal);
          clearInterval(timer);

          /*
           * Começa a buscar a agenda agora, enquanto a pessoa lê "conexão
           * bem-sucedida".
           *
           * A busca leva ~1 s na Evolution e o resultado fica no cache do
           * servidor, então o download seguinte custa só a montagem da
           * planilha. Como o gatilho é o pareamento — que acontece uma vez por
           * canal — isso não vira carga recorrente no gateway.
           *
           * `void` e `catch` vazio de propósito: é adiantamento, não promessa.
           * Se falhar, o clique no botão faz o caminho normal.
           */
          void contarContatosDoCanal(canalId).catch(() => undefined);
        }
      } catch {
        // Gateway mudo entre uma tentativa e outra é normal durante o
        // pareamento; a próxima rodada tenta de novo.
      }
    }, 3000);

    return () => {
      parado = true;
      clearInterval(timer);
    };
  }, [canalId, ativo]);

  return conectado;
}
