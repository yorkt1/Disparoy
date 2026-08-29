import { describe, expect, it, vi } from "vitest";
import { EVENTO_SESSAO, gravarSessao, lerSessao, limparSessao, tokenAtual } from "./sessao";

const CHAVE = "disparoy.sessao";

/** Instante em ISO, deslocado do agora. Negativo = passado. */
function daquiA(minutos: number): string {
  return new Date(Date.now() + minutos * 60_000).toISOString();
}

function gravarCru(valor: unknown): void {
  localStorage.setItem(CHAVE, typeof valor === "string" ? valor : JSON.stringify(valor));
}

describe("lerSessao", () => {
  it("devolve null quando não há nada guardado", () => {
    expect(lerSessao()).toBeNull();
  });

  it("devolve a sessão válida", () => {
    const sessao = { token: "abc", expiraEm: daquiA(60) };
    gravarCru(sessao);

    expect(lerSessao()).toEqual(sessao);
    expect(tokenAtual()).toBe("abc");
  });

  /**
   * O token vencido é descartado ANTES de ser usado, e não quando a API o
   * recusa: mandá-lo renderia um 401 e um piscar de tela de erro no lugar do
   * login. Quem lê precisa ver a sessão como já inexistente.
   */
  it("descarta o token vencido e apaga o registro", () => {
    gravarCru({ token: "vencido", expiraEm: daquiA(-1) });

    expect(lerSessao()).toBeNull();
    expect(tokenAtual()).toBeNull();
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  /** Expirar É no instante exato, não depois dele. */
  it("trata o instante exato da expiração como vencido", () => {
    const agora = new Date("2026-01-01T12:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(agora);
    gravarCru({ token: "no-limite", expiraEm: agora.toISOString() });

    expect(lerSessao()).toBeNull();
    vi.useRealTimers();
  });

  /**
   * JSON corrompido não pode derrubar o painel inteiro: `lerSessao` roda na
   * primeira renderização, antes de qualquer limite de erro montar.
   */
  it("limpa registro corrompido em vez de estourar", () => {
    gravarCru("{isto não é json");

    expect(() => lerSessao()).not.toThrow();
    expect(lerSessao()).toBeNull();
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it("recusa registro sem token ou sem expiração", () => {
    gravarCru({ expiraEm: daquiA(60) });
    expect(lerSessao()).toBeNull();

    gravarCru({ token: "abc" });
    expect(lerSessao()).toBeNull();
  });
});

/**
 * O evento é o que acorda o provider de sessão. Sem ele, o 401 limpa o token e
 * a tela continua exibindo o painel logado até alguém navegar — inclusive com
 * o polling do React Query batendo em rota autenticada.
 */
describe("aviso de mudança de sessão", () => {
  it("notifica ao gravar e ao limpar", () => {
    const avisos: string[] = [];
    window.addEventListener(EVENTO_SESSAO, () => avisos.push("mudou"));

    gravarSessao({ token: "abc", expiraEm: daquiA(60) });
    expect(avisos).toHaveLength(1);

    limparSessao();
    expect(avisos).toHaveLength(2);
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });
});
