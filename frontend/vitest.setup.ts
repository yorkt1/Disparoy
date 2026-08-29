import { beforeEach, vi } from "vitest";

/**
 * O mínimo de navegador para testes que rodam em `environment: "node"`.
 *
 * `lib/sessao.ts` guarda o token no `localStorage` e avisa o React por um
 * evento no `window`. Nenhuma das duas coisas existe no Node, e trazer o jsdom
 * inteiro para tê-las custaria uma dependência nova e alguns segundos por
 * arquivo — caro demais para o que estes testes tocam.
 *
 * O armazenamento é recriado a cada teste, não limpo: assim um teste que
 * substitui o `localStorage` por um dublê próprio não deixa esse dublê de pé
 * para o teste seguinte.
 */

function armazenamentoEmMemoria(): Storage {
  const dados = new Map<string, string>();

  return {
    get length() {
      return dados.size;
    },
    key: (i: number) => [...dados.keys()][i] ?? null,
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void dados.set(chave, String(valor)),
    removeItem: (chave: string) => void dados.delete(chave),
    clear: () => dados.clear(),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", armazenamentoEmMemoria());
  // `EventTarget` basta: de `window`, o código de sessão só usa
  // `dispatchEvent` e `addEventListener`.
  vi.stubGlobal("window", new EventTarget());
});
