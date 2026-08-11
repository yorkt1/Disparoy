/**
 * Sessão do painel: o token que a API emitiu, guardado no navegador.
 *
 * `localStorage` e não cookie porque a API é stateless e pode viver em outro
 * domínio — cookie exigiria `SameSite=None` mais CSRF token para o mesmo
 * resultado. Sendo ferramenta interna atrás de login, o alvo aqui é XSS, e
 * contra XSS o cookie só ajuda se for `HttpOnly`, o que este fluxo não usa.
 */

const CHAVE = "disparoy.sessao";

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
  notificar();
}

export function tokenAtual(): string | null {
  return lerSessao()?.token ?? null;
}
