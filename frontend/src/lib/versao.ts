/**
 * A aba aberta durante um deploy.
 *
 * Cada página do painel é um chunk separado, carregado sob demanda. O
 * `index-*.js` que a aba tem na memória aponta para nomes de arquivo com hash
 * — `campanha-editar-IBA2gy11.js` — e o deploy seguinte publica outros nomes e
 * apaga os antigos. A aba continua funcionando enquanto navega pelo que já
 * baixou, e quebra na primeira página nova que tentar abrir:
 *
 *   TypeError: Failed to fetch dynamically imported module:
 *   .../assets/campanha-editar-IBA2gy11.js
 *
 * Não é bug de tela nenhuma, e é por isso que aparecia aleatório: quebrava a
 * página que a pessoa não tinha visitado antes do deploy. Num dia de vários
 * deploys, dá a impressão de que "a campanha não abre às vezes".
 *
 * A saída é recarregar — a aba busca o `index.html` novo e volta com os nomes
 * certos. O que este arquivo faz é reconhecer o caso e recarregar UMA vez.
 */

/**
 * Cada navegador escreve esta falha com uma frase diferente, e nenhum expõe um
 * código. Comparar texto é frágil por natureza; o que torna aceitável é o
 * fallback: se a frase mudar, o erro volta a cair na tela de "esta tela
 * quebrou", que continua oferecendo recarregar à mão.
 */
const FRASES = [
  // Chrome, Edge, Opera
  "failed to fetch dynamically imported module",
  // Firefox
  "error loading dynamically imported module",
  // Safari
  "importing a module script failed",
  // Vite, ao pré-carregar
  "unable to preload css",
];

export function ehModuloDesatualizado(erro: unknown): boolean {
  const texto = erro instanceof Error ? `${erro.name}: ${erro.message}` : String(erro);
  const minusculo = texto.toLowerCase();
  return FRASES.some((f) => minusculo.includes(f));
}

/**
 * Marca do último recarregamento automático, em `sessionStorage`.
 *
 * `sessionStorage` e não `localStorage`: a trava é por aba. Duas abas abertas
 * têm o mesmo problema separadamente, e uma não pode consumir a única chance
 * da outra.
 */
const CHAVE = "disparoy.recarga-versao";
const JANELA_MS = 30_000;

/**
 * Recarrega por causa de versão nova — no máximo uma vez a cada 30 s.
 *
 * A trava não é zelo excessivo: se o arquivo sumiu de verdade (rollback na
 * Vercel, CDN servindo 404 para todo mundo), recarregar resolve nada e sem
 * limite viraria um laço infinito de recarga, que é uma tela pior do que a
 * mensagem de erro — a pessoa não consegue nem ler o que aconteceu.
 *
 * Devolve `false` quando não recarregou, para quem chamou poder mostrar a
 * mensagem em vez de esperar por uma recarga que não vem.
 */
export function recarregarPorVersaoNova(): boolean {
  let ultima = 0;
  try {
    ultima = Number(sessionStorage.getItem(CHAVE) ?? 0);
  } catch {
    // Aba anônima com armazenamento bloqueado: sem trava possível, o mais
    // seguro é NÃO recarregar e deixar a mensagem aparecer.
    return false;
  }

  if (Date.now() - ultima < JANELA_MS) return false;

  try {
    sessionStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    return false;
  }

  // `reload()` sem argumento: o navegador revalida o documento, que é o que
  // traz o `index.html` novo com os nomes de chunk atuais.
  window.location.reload();
  return true;
}

/**
 * Liga o aviso que o próprio Vite emite ao falhar um pré-carregamento.
 *
 * Chega ANTES do erro estourar no React, então pega o caso mais comum sem que
 * ninguém veja tela de erro nenhuma. O boundary continua existindo para o que
 * escapar daqui — navegação direta, chunk pedido fora do preload.
 */
export function vigiarVersaoNova(): void {
  window.addEventListener("vite:preloadError", (evento) => {
    // Sem `preventDefault` o Vite relança, e a recarga já está a caminho.
    evento.preventDefault();
    recarregarPorVersaoNova();
  });
}
