/*
 * Aplica o tema escolhido ANTES do primeiro paint.
 *
 * Arquivo separado, e não um <script> inline no index.html, porque a CSP do
 * `vercel.json` traz `script-src 'self'` sem `unsafe-inline`: um bloco inline
 * seria bloqueado em produção e o painel abriria sempre claro.
 *
 * Também não pode viver no bundle: `main.tsx` é um módulo, roda depois do
 * parse do HTML, e quem escolheu o tema escuro veria um lampejo branco em toda
 * abertura. Este arquivo é carregado de forma bloqueante no <head>.
 *
 * A chave do localStorage está repetida em `src/lib/tema.ts` — aqui é a
 * leitura, lá é a escrita. É o preço de rodar fora do bundle.
 */
(function () {
  var tema = "claro";
  try {
    // `localStorage` lança em aba anônima com cookies de terceiros bloqueados;
    // sem o try o painel inteiro deixaria de carregar por causa da cor.
    if (localStorage.getItem("disparoy:tema") === "escuro") tema = "escuro";
  } catch {
    /* Sem acesso ao armazenamento: segue no tema claro, que é o padrão. */
  }
  document.documentElement.dataset.tema = tema;
})();
