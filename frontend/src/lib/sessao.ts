/**
 * Sessão do painel: o token que a API emitiu, guardado no navegador.
 *
 * `localStorage` e não cookie porque a API é stateless e pode viver em outro
 * domínio — cookie exigiria `SameSite=None` mais CSRF token para o mesmo
 * resultado. Sendo ferramenta interna atrás de login, o alvo aqui é XSS, e
 * contra XSS o cookie só ajuda se for `HttpOnly`, o que este fluxo não usa.
 */

const CHAVE = "disparoy.sessao";

/**
 * Onde a sessão de quem personificou fica guardada enquanto ele está dentro
 * da conta de outro.
 *
 * Sem isto, voltar exigiria fazer login de novo — e o suporte que entra na
 * conta de um cliente para conferir uma coisa acabaria com a própria sessão
 * perdida no meio do atendimento.
 */
const CHAVE_ORIGINAL = "disparoy.sessao.original";

export const EVENTO_SESSAO = "disparoy:sessao";

interface SessaoArmazenada {
  token: string;
  expiraEm: string;
}

/** Avisa o React que o token mudou — inclusive quando quem limpou foi o 401. */
function notificar(): void {
  window.dispatchEvent(new Event(EVENTO_SESSAO));
}

export function lerSessao(): SessaoArmazenada | null {
  const bruto = localStorage.getItem(CHAVE);
  if (!bruto) return null;

  try {
    const sessao = JSON.parse(bruto) as SessaoArmazenada;
    if (!sessao.token || !sessao.expiraEm) return null;

    // Descarta antes de usar: mandar um token que já sabemos vencido só
    // renderia um 401 e um piscar de tela de erro no lugar do login.
    if (new Date(sessao.expiraEm).getTime() <= Date.now()) {
      localStorage.removeItem(CHAVE);
      return null;
    }

    return sessao;
  } catch {
    localStorage.removeItem(CHAVE);
    return null;
  }
}

export function gravarSessao(sessao: SessaoArmazenada): void {
  localStorage.setItem(CHAVE, JSON.stringify(sessao));
  notificar();
}

export function limparSessao(): void {
  localStorage.removeItem(CHAVE);
  // A sessão guardada some junto: sobrevivendo ao logout, ela reapareceria
  // como um botão "voltar para minha conta" na sessão de quem entrasse depois.
  localStorage.removeItem(CHAVE_ORIGINAL);
  notificar();
}

export function tokenAtual(): string | null {
  return lerSessao()?.token ?? null;
}

/**
 * Entra na sessão de outra pessoa, guardando a sua para depois.
 *
 * A troca é feita em uma função só, e não com `gravarSessao` chamado por fora,
 * para que nunca exista o estado intermediário em que a sessão nova já está
 * gravada e a original ainda não — quem recarregasse a página nesse instante
 * ficaria dentro da conta do cliente sem caminho de volta.
 */
export function entrarComoOutro(nova: SessaoArmazenada): void {
  const atual = lerSessao();
  if (atual) localStorage.setItem(CHAVE_ORIGINAL, JSON.stringify(atual));
  gravarSessao(nova);
}

/** Há uma sessão guardada para voltar? */
export function temSessaoOriginal(): boolean {
  return localStorage.getItem(CHAVE_ORIGINAL) !== null;
}

/**
 * Volta para a própria conta.
 *
 * Devolve `false` quando a sessão guardada não serve mais — passou das 12 h
 * enquanto o suporte estava dentro do cliente, por exemplo. Aí o caminho é o
 * login normal, e é melhor dizer isso do que restaurar um token morto e
 * mostrar um 401 sem explicação.
 */
export function voltarParaSessaoOriginal(): boolean {
  const bruto = localStorage.getItem(CHAVE_ORIGINAL);
  localStorage.removeItem(CHAVE_ORIGINAL);
  if (!bruto) return false;

  try {
    const original = JSON.parse(bruto) as SessaoArmazenada;
    if (!original.token || new Date(original.expiraEm).getTime() <= Date.now()) {
      limparSessao();
      return false;
    }
    gravarSessao(original);
    return true;
  } catch {
    limparSessao();
    return false;
  }
}
