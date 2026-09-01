import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatarQuando } from "./formato";

/**
 * `formatarQuando` decide entre "há 12 min" e a data escrita.
 *
 * As fronteiras são o que quebra num helper de tempo, e são três: o minuto
 * (abaixo dele não existe "há 0 min"), as 48 h (onde o relativo para de ajudar)
 * e o ZERO — data no futuro, que é a campanha agendada. Sem a última, uma
 * campanha marcada para amanhã apareceria como "há -840 min".
 */

const AGORA = new Date("2026-08-31T15:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(AGORA);
});

afterEach(() => {
  vi.useRealTimers();
});

/** `n` minutos antes de AGORA, em ISO. */
function atras(minutos: number): string {
  return new Date(AGORA.getTime() - minutos * 60_000).toISOString();
}

describe("formatarQuando", () => {
  it("menos de um minuto é 'agora', não 'há 0 min'", () => {
    expect(formatarQuando(atras(0))).toBe("agora");
    expect(formatarQuando(atras(0.5))).toBe("agora");
  });

  it("conta em minutos dentro da primeira hora", () => {
    expect(formatarQuando(atras(1))).toBe("há 1 min");
    expect(formatarQuando(atras(59))).toBe("há 59 min");
  });

  it("vira horas exatamente aos 60 minutos", () => {
    expect(formatarQuando(atras(60))).toBe("há 1 h");
    expect(formatarQuando(atras(47 * 60))).toBe("há 47 h");
  });

  it("passadas 48 h, o relativo vira conta de cabeça e cede lugar à data", () => {
    expect(formatarQuando(atras(48 * 60))).not.toMatch(/há/);
    expect(formatarQuando(atras(48 * 60))).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("data futura não vira tempo negativo — campanha agendada mostra quando sai", () => {
    const amanha = new Date(AGORA.getTime() + 24 * 60 * 60_000).toISOString();

    const saida = formatarQuando(amanha);
    expect(saida).not.toMatch(/há/);
    expect(saida).not.toMatch(/-/);
    expect(saida).toMatch(/01\/09\/2026/);
  });

  it("sem data, e com data inválida, devolve travessão em vez de 'Invalid Date'", () => {
    expect(formatarQuando(null)).toBe("—");
    expect(formatarQuando(undefined)).toBe("—");
    expect(formatarQuando("nao é uma data")).toBe("—");
  });
});
