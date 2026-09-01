/**
 * Tema do painel: claro (padrão) ou escuro.
 *
 * O estado real é o atributo `data-tema` no <html> — o mesmo que `public/tema.js`
 * escreve antes do primeiro paint. Ler o DOM em vez do localStorage evita a
 * situação em que os dois discordam: se a gravação falhar (aba anônima), a tela
 * continua mostrando o tema que está de fato aplicado, e não o que foi salvo.
 */

export type Tema = "claro" | "escuro";

/** Repetida em `public/tema.js`, que roda fora do bundle e não pode importar. */
const CHAVE = "disparoy:tema";

export function temaAtual(): Tema {
  return document.documentElement.dataset.tema === "escuro" ? "escuro" : "claro";
}

export function definirTema(tema: Tema): void {
  document.documentElement.dataset.tema = tema;

  // A cor da barra do navegador no celular vem daqui; sem atualizar, o topo do
  // Chrome fica preto sobre um painel claro.
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", FUNDO[tema]);

  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    // Sem persistência a escolha vale só nesta aba. É melhor que recusar a
    // troca: o operador vê o que pediu, mesmo que não sobreviva ao F5.
  }

  for (const avisar of OUVINTES) avisar();
}

/**
 * Quem precisa saber que o tema mudou.
 *
 * O tema é trocado em dois lugares — o atalho no menu de perfil e o card em
 * Configurações — e os dois ficam montados ao mesmo tempo quando a tela aberta
 * é a de Configurações. Sem esta notificação, trocar pelo menu deixava o card
 * marcando a opção antiga: a tela inteira mudava de cor e o único componente
 * que existe para dizer qual é o tema continuava afirmando o contrário.
 *
 * O DOM (`data-tema`) segue sendo a verdade; isto só avisa quem depende dela.
 */
const OUVINTES = new Set<() => void>();

export function assinarTema(avisar: () => void): () => void {
  OUVINTES.add(avisar);
  return () => OUVINTES.delete(avisar);
}

/** Igual ao `--color-plano` de cada tema em `estilos.css`. */
const FUNDO: Record<Tema, string> = {
  claro: "#f5f5f2",
  escuro: "#0d0d0d",
};
