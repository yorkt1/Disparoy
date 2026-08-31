// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ehModuloDesatualizado, recarregarPorVersaoNova } from "./versao";

/**
 * A aba aberta durante um deploy.
 *
 * Cada página é um chunk com hash no nome. O deploy publica nomes novos e
 * apaga os antigos, e a aba que ficou aberta quebra na primeira página que
 * ainda não tinha baixado — dando a impressão de que "a campanha não abre às
 * vezes", quando o que houve foi um deploy no meio do uso.
 */
describe("ehModuloDesatualizado", () => {
  /*
   * Um caso por navegador, porque cada um escreve a mesma falha com outra
   * frase e nenhum expõe código. Se um deles mudar o texto, é este teste que
   * avisa — em vez de o operador voltar a ver "esta tela quebrou".
   */
  it("reconhece o Chrome", () => {
    const erro = new TypeError(
      "Failed to fetch dynamically imported module: https://x.app/assets/campanha-editar-IBA2gy11.js",
    );
    expect(ehModuloDesatualizado(erro)).toBe(true);
  });

  it("reconhece o Firefox", () => {
    expect(ehModuloDesatualizado(new TypeError("error loading dynamically imported module"))).toBe(
      true,
    );
  });

  it("reconhece o Safari", () => {
    expect(ehModuloDesatualizado(new TypeError("Importing a module script failed."))).toBe(true);
  });

  it("não confunde com defeito de tela", () => {
    // O erro que motivou o botão "Copiar detalhes" não pode virar "recarregue":
    // recarregar não conserta um `.length` de undefined, e a pessoa ficaria
    // recarregando para sempre sem nunca relatar o bug.
    const erro = new TypeError("Cannot read properties of undefined (reading 'length')");
    expect(ehModuloDesatualizado(erro)).toBe(false);
  });
});

describe("recarregarPorVersaoNova", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal("location", { reload: vi.fn() } as unknown as Location);
  });

  it("recarrega na primeira vez", () => {
    expect(recarregarPorVersaoNova()).toBe(true);
    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  it("não recarrega de novo em seguida", () => {
    // Sem esta trava, um arquivo que sumiu de verdade — rollback, CDN
    // devolvendo 404 para todo mundo — viraria laço infinito de recarga, que é
    // pior que a mensagem: a pessoa não consegue nem ler o que aconteceu.
    recarregarPorVersaoNova();
    expect(recarregarPorVersaoNova()).toBe(false);
    expect(window.location.reload).toHaveBeenCalledOnce();
  });

  it("volta a permitir depois da janela", () => {
    recarregarPorVersaoNova();
    vi.setSystemTime(Date.now() + 31_000);
    expect(recarregarPorVersaoNova()).toBe(true);
    vi.useRealTimers();
  });
});
