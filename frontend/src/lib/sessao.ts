/**
 * Sessão do painel: o token que a API emitiu, guardado no navegador.
 *
 * `localStorage` e não cookie porque a API é stateless e pode viver em outro
 * domínio — cookie exigiria `SameSite=None` mais CSRF token para o mesmo
 * resultado. Sendo ferramenta interna atrás de login, o alvo aqui é XSS, e
 * contra XSS o cookie só ajuda se for `HttpOnly`, o que este fluxo não usa.
 *
 * A escolha assume um modelo de ameaça, e o resto do arquivo existe para
 * reduzir o dano dentro dele: o token vive pouco (12 h vindas da API), some no
 * segundo em que vence e o fim da sessão é sempre ANUNCIADO — inclusive quando
 * quem o descartou foi uma leitura de rotina, e não uma pessoa clicando em Sair.
 */

const CHAVE = "disparoy.sessao";

export const EVENTO_SESSAO = "disparoy:sessao";

/**
 * Por que a sessão acabou.
 *
 * Sem isto, sair no botão e vencer no meio do trabalho chegavam iguais na tela
 * de login — e vencer sem aviso parece o painel ter deslogado sozinho, do nada.
 */
export type MotivoFim = "saiu" | "expirou" | "recusada";

interface SessaoArmazenada {
  token: string;
  expiraEm: string;
}

/** Avisa o React que o token mudou — inclusive quando quem limpou foi o 401. */
function notificar(motivo: MotivoFim): void {
  window.dispatchEvent(new CustomEvent(EVENTO_SESSAO, { detail: { motivo } }));
}

function venceu(sessao: SessaoArmazenada): boolean {
  const limite = new Date(sessao.expiraEm).getTime();
  // `NaN` é data corrompida: trata como vencida em vez de como eterna.
  return !Number.isFinite(limite) || limite <= Date.now();
}

export function lerSessao(): SessaoArmazenada | null {
  const bruto = localStorage.getItem(CHAVE);
  if (!bruto) return null;

  try {
    const sessao = JSON.parse(bruto) as SessaoArmazenada;
    if (!sessao.token || !sessao.expiraEm) return null;

    if (venceu(sessao)) {
      // Descarta antes de usar: mandar um token que já sabemos vencido só
      // renderia um 401 e um piscar de tela de erro no lugar do login.
      localStorage.removeItem(CHAVE);
      /*
       * O aviso sai em microtarefa, não aqui.
       *
       * `lerSessao` roda DENTRO do render — o provider a chama para inicializar
       * o próprio estado — e disparar o evento na hora atualizaria o React no
       * meio da própria renderização. Adiar um tick resolve, e o efeito prático
       * é o que faltava: antes o descarte era silencioso, o provider continuava
       * achando que havia sessão, e a chamada seguinte saía SEM `Authorization`.
       * O 401 que voltava não era reconhecido como sessão morta e a pessoa
       * ficava presa numa tela de erro genérica em vez de ir para o login.
       */
      queueMicrotask(() => notificar("expirou"));
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
  window.dispatchEvent(new CustomEvent(EVENTO_SESSAO, { detail: {} }));
}

export function limparSessao(motivo: MotivoFim = "saiu"): void {
  const tinha = localStorage.getItem(CHAVE) !== null;
  localStorage.removeItem(CHAVE);

  /*
   * Só anuncia se havia o que encerrar.
   *
   * O 401 do próprio login (senha errada) passa por aqui sem sessão nenhuma no
   * bolso; anunciar ali colocaria um aviso de "sessão recusada" ao lado da
   * mensagem real do formulário. Sair é ato explícito e sempre avisa, porque é
   * ele que manda limpar o cache.
   */
  if (tinha || motivo === "saiu") notificar(motivo);
}

/**
 * Quanto falta para o token vencer, em ms. `0` quando já venceu ou não existe.
 *
 * É o que permite ao provider agendar a saída para o instante exato em vez de
 * esperar a próxima chamada à API descobrir.
 */
export function msAteVencer(): number {
  const sessao = lerSessao();
  if (!sessao) return 0;
  return Math.max(0, new Date(sessao.expiraEm).getTime() - Date.now());
}

export function tokenAtual(): string | null {
  return lerSessao()?.token ?? null;
}
