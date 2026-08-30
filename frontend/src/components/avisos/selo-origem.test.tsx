// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ORIGENS, origemDe } from "@disparoy/dominio";
import type { CategoriaFalha } from "@disparoy/dominio";
import { AberturaOrigem, SeloOrigem } from "./selo-origem";

// Derivado de `ORIGENS`, não escrito à mão: uma categoria nova no domínio
// entra nestes testes sozinha, em vez de passar despercebida numa lista
// desatualizada aqui.
const CATEGORIAS = Object.keys(ORIGENS) as CategoriaFalha[];

/**
 * A regra que estes testes protegem não é de renderização: é de produto.
 *
 * `canal` significa "o WhatsApp do cliente caiu, reconecte" e `infra` significa
 * "o problema é nosso, não faça nada". São as duas únicas categorias em que a
 * ação do operador é oposta. Se elas saírem iguais na tela — mesmo tom, mesmo
 * ícone, mesma abertura — o operador conclui que o sistema quebrou e liga para
 * o suporte no exato caso em que ele não deveria fazer nada, ou ignora o caso
 * em que só ele pode agir.
 *
 * Nada aqui compara a string do erro: tudo sai da categoria, como manda o
 * domínio.
 */

function classesDoSelo(categoria: CategoriaFalha): string {
  const { container } = render(<SeloOrigem categoria={categoria} />);
  const selo = container.querySelector("span");
  if (!selo) throw new Error("SeloOrigem não renderizou nenhum elemento.");
  return selo.className;
}

describe("SeloOrigem", () => {
  it("nomeia a origem com o rótulo do domínio, não com texto próprio", () => {
    render(<SeloOrigem categoria="canal" />);
    expect(screen.getByText(origemDe("canal").rotulo)).toBeInTheDocument();
  });

  it.each(CATEGORIAS)("renderiza a categoria %s sem cair", (categoria) => {
    render(<SeloOrigem categoria={categoria} />);
    expect(screen.getByText(ORIGENS[categoria].rotulo)).toBeInTheDocument();
  });

  it("distingue visualmente 'canal' de 'infra' — a confusão que custa caro", () => {
    expect(origemDe("canal").rotulo).not.toBe(origemDe("infra").rotulo);
    expect(origemDe("canal").tom).not.toBe(origemDe("infra").tom);
    expect(classesDoSelo("canal")).not.toBe(classesDoSelo("infra"));
  });

  it("renderiza um ícone em cada categoria", () => {
    const icones = CATEGORIAS.map((categoria) => {
      const { container } = render(<SeloOrigem categoria={categoria} />);
      return container.querySelector("svg")?.getAttribute("class") ?? null;
    });
    expect(icones.every((i) => i !== null)).toBe(true);
  });

  it("cor sai de variável CSS, nunca de hex literal", () => {
    for (const categoria of CATEGORIAS) {
      expect(classesDoSelo(categoria)).not.toMatch(/#[0-9a-f]{3,8}/i);
    }
  });
});

describe("AberturaOrigem", () => {
  it("diz de quem NÃO é a culpa, em cada categoria", () => {
    for (const categoria of CATEGORIAS) {
      const { unmount } = render(<AberturaOrigem categoria={categoria} />);
      expect(screen.getByText(ORIGENS[categoria].abertura)).toBeInTheDocument();
      unmount();
    }
  });

  it("a abertura de 'infra' garante ao operador que o WhatsApp dele está de pé", () => {
    render(<AberturaOrigem categoria="infra" />);
    // Sem esta frase, "Nosso servidor" ainda deixa o operador conferindo o
    // celular do cliente à toa.
    expect(screen.getByText(/continua conectado/i)).toBeInTheDocument();
  });
});
