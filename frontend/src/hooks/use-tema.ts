import * as React from "react";
import { assinarTema, temaAtual, type Tema } from "@/lib/tema";

/**
 * O tema aplicado agora, reagindo a quem o trocar.
 *
 * `useSyncExternalStore` e não `useState`: a fonte da verdade é o atributo
 * `data-tema` no <html>, que vive fora do React — escrito por `public/tema.js`
 * antes do primeiro paint e por `definirTema` depois. Uma cópia em `useState`
 * seria só isso, uma cópia, e ficaria para trás assim que outro componente
 * trocasse o tema.
 *
 * O terceiro argumento é o valor do servidor. Não há SSR aqui, mas os testes
 * rodam em `node` sem `document`, e sem ele o hook quebraria ao ser importado.
 */
export function useTema(): Tema {
  return React.useSyncExternalStore(assinarTema, temaAtual, () => "claro");
}
