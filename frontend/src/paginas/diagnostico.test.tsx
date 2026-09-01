// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ResumoFalha } from "@disparoy/dominio";

/**
 * Diagnóstico — as três perguntas numa tela só.
 *
 * Avisos, Falhas e Auditoria eram três telas no menu respondendo à mesma
 * pergunta em recortes diferentes. Juntas, duas coisas passam a importar e são
 * o que estes testes protegem:
 *
 * 1. Auditoria continua restrita a admin. Ela traz IP e metadados de
 *    importação — material de investigação. A restrição vale para a ABA e para
 *    o conteúdo: esconder só o botão deixaria a seção acessível a quem
 *    conseguisse trocar o estado por outro caminho.
 *
 * 2. A cobertura da taxonomia não afirma com amostra pequena. Verde ou vermelho
 *    ali são os dois uma afirmação, e com poucas falhas na janela não há
 *    afirmação a fazer — a tela mostra "—" e diz por quê.
 */

const { hooks } = vi.hoisted(() => ({
  hooks: {
    contagemAvisos: vi.fn(),
    ehAdmin: vi.fn(),
    sessao: vi.fn(),
    diagnostico: vi.fn(),
    amostras: vi.fn(),
    avisos: vi.fn(),
    logs: vi.fn(),
  },
}));

vi.mock("@/hooks/consultas", () => ({
  useContagemAvisos: () => hooks.contagemAvisos(),
  useEhAdmin: () => hooks.ehAdmin(),
  useSessao: () => hooks.sessao(),
  useDiagnostico: () => hooks.diagnostico(),
  useAmostrasFalha: () => hooks.amostras(),
  useAvisos: () => hooks.avisos(),
  useLogs: () => hooks.logs(),
  useMarcarTodosAvisosLidos: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ mostrar: vi.fn() }) }));

// A tabela de logs tem suíte própria e puxa os próprios dados; aqui só
// interessa se a seção de auditoria chega a ser montada.
vi.mock("@/components/logs/tabela-logs", () => ({
  TabelaLogs: () => <div>tabela-de-logs</div>,
}));

// A faixa de saúde também busca os próprios dados — por quatro consultas que
// nada têm a ver com o que esta suíte protege. Sem o mock, elas cairiam no
// módulo de consultas encenado acima e viriam `undefined`.
vi.mock("@/components/diagnostico/indicadores-saude", () => ({
  IndicadoresSaude: () => <div>indicadores-de-saude</div>,
}));

import { PaginaDiagnostico } from "./diagnostico";

function falha(codigo: string, total: number): ResumoFalha {
  return {
    codigo,
    categoria: codigo === "canal_desconectado" ? "canal" : null,
    total,
    canais: 1,
    campanhas: 1,
    primeiraEm: "2026-01-01T00:00:00.000Z",
    ultimaEm: "2026-01-02T00:00:00.000Z",
  };
}

/**
 * Diagnóstico com `total` falhas, das quais `sem` sem classificação.
 *
 * `nao_registrado` é um dos códigos que o domínio conta como sem classificação
 * — é assim que a tela chega à proporção, somando os totais por código, e não
 * lendo um campo pronto.
 */
function comDiagnostico(total: number, sem: number) {
  const falhas: ResumoFalha[] = [];
  if (sem > 0) falhas.push(falha("nao_registrado", sem));
  if (total - sem > 0) falhas.push(falha("canal_desconectado", total - sem));
  hooks.diagnostico.mockReturnValue({
    data: { falhas, amostras: [] },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.contagemAvisos.mockReturnValue({ data: { total: 0 } });
  hooks.ehAdmin.mockReturnValue(false);
  hooks.sessao.mockReturnValue({ data: { disparo: { ativo: true, pulsoEm: null } } });
  hooks.avisos.mockReturnValue({ data: [], isLoading: false, isError: false });
  hooks.logs.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  hooks.amostras.mockReturnValue({ data: [], isLoading: false, error: null, refetch: vi.fn() });
  comDiagnostico(0, 0);
});

describe("PaginaDiagnostico — auditoria é só de admin", () => {
  it("operador não vê a aba de auditoria", () => {
    hooks.ehAdmin.mockReturnValue(false);
    render(<PaginaDiagnostico />);
    expect(screen.queryByRole("tab", { name: /Auditoria/i })).not.toBeInTheDocument();
  });

  it("admin vê a aba", () => {
    hooks.ehAdmin.mockReturnValue(true);
    render(<PaginaDiagnostico />);
    expect(screen.getByRole("tab", { name: /Auditoria/i })).toBeInTheDocument();
  });

  it("admin chega ao conteúdo da auditoria", async () => {
    hooks.ehAdmin.mockReturnValue(true);
    render(<PaginaDiagnostico />);
    await userEvent.click(screen.getByRole("tab", { name: /Auditoria/i }));
    expect(screen.getByText("tabela-de-logs")).toBeInTheDocument();
  });

  it("perder o papel admin com a aba aberta esconde o conteúdo, não só o botão", () => {
    /*
     * A segunda camada de `{aba === "auditoria" && admin && ...}`.
     *
     * O cenário é real: `useSessao` revalida a cada 20 s, então o papel pode
     * cair enquanto a pessoa já está na aba. Sem esta trava, esconder o botão
     * seria só cosmético — o conteúdo continuaria montado, com IP e metadados
     * de importação na tela de quem deixou de ser admin.
     */
    hooks.ehAdmin.mockReturnValue(true);
    const { rerender } = render(<PaginaDiagnostico />);
    screen.getByRole("tab", { name: /Auditoria/i }).click();

    hooks.ehAdmin.mockReturnValue(false);
    rerender(<PaginaDiagnostico />);

    expect(screen.queryByText("tabela-de-logs")).not.toBeInTheDocument();
  });

  it("as duas abas que todos veem continuam disponíveis", () => {
    render(<PaginaDiagnostico />);
    expect(screen.getByRole("tab", { name: /Avisos/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Falhas/i })).toBeInTheDocument();
  });
});

describe("PaginaDiagnostico — abas", () => {
  it("abre em Avisos, que é o que exige ação", () => {
    // A ordem das abas é a da urgência: agir, analisar, investigar.
    render(<PaginaDiagnostico />);
    expect(screen.getByRole("tab", { name: /Avisos/i })).toHaveAttribute("aria-selected", "true");
  });

  it("a aba selecionada se anuncia por aria-selected, não só por cor", async () => {
    render(<PaginaDiagnostico />);
    await userEvent.click(screen.getByRole("tab", { name: /Falhas/i }));

    expect(screen.getByRole("tab", { name: /Falhas/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Avisos/i })).toHaveAttribute("aria-selected", "false");
  });

  it("o contador de não lidos aparece na aba de avisos", () => {
    hooks.contagemAvisos.mockReturnValue({ data: { total: 3 } });
    render(<PaginaDiagnostico />);
    expect(screen.getByRole("tab", { name: /Avisos/i })).toHaveTextContent("3");
  });

  it("acima de nove o contador vira 9+ em vez de esticar a aba", () => {
    hooks.contagemAvisos.mockReturnValue({ data: { total: 42 } });
    render(<PaginaDiagnostico />);
    expect(screen.getByRole("tab", { name: /Avisos/i })).toHaveTextContent("9+");
  });

  it("sem não lidos, nenhum contador aparece", () => {
    hooks.contagemAvisos.mockReturnValue({ data: { total: 0 } });
    render(<PaginaDiagnostico />);
    expect(screen.getByRole("tab", { name: /Avisos/i })).not.toHaveTextContent(/\d/);
  });
});

describe("PaginaDiagnostico — worker parado", () => {
  it("avisa quando o worker não está batendo pulso", () => {
    // `ativo: false` significa que NENHUMA campanha está saindo. Foi assim por
    // dias sem nada na tela dizer isso.
    hooks.sessao.mockReturnValue({
      data: { disparo: { ativo: false, pulsoEm: "2026-01-01T00:00:00.000Z" } },
    });
    render(<PaginaDiagnostico />);
    expect(screen.getByText(/disparo/i)).toBeInTheDocument();
  });

  it("worker vivo não vira faixa de alerta", () => {
    hooks.sessao.mockReturnValue({ data: { disparo: { ativo: true, pulsoEm: "x" } } });
    render(<PaginaDiagnostico />);
    expect(screen.queryByText(/nenhuma campanha está saindo/i)).not.toBeInTheDocument();
  });
});

describe("PaginaDiagnostico — cobertura da taxonomia", () => {
  async function irParaFalhas() {
    render(<PaginaDiagnostico />);
    await userEvent.click(screen.getByRole("tab", { name: /Falhas/i }));
  }

  it("com amostra pequena não afirma nada: mostra travessão", async () => {
    // Verde ou vermelho aqui seriam os dois uma afirmação sobre a qualidade da
    // taxonomia, e 3 falhas não sustentam afirmação nenhuma.
    comDiagnostico(3, 2);
    await irParaFalhas();

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText(/Poucas falhas na janela/i)).toBeInTheDocument();
  });

  it("com amostra suficiente e muita coisa sem classificar, pede a regra que falta", async () => {
    comDiagnostico(500, 200);
    await irParaFalhas();

    expect(screen.getByText(/escrever a regra que falta/i)).toBeInTheDocument();
  });

  it("com a taxonomia dando conta, o texto é de tranquilidade", async () => {
    comDiagnostico(500, 5);
    await irParaFalhas();

    expect(screen.getByText(/maior parte das falhas está sendo reconhecida/i)).toBeInTheDocument();
  });

  it("a porcentagem mostrada é de COBERTURA, não de falta", async () => {
    // 500 falhas, 50 sem classificar = 90% coberto. Mostrar 10% aqui inverteria
    // a leitura de quem bate o olho.
    comDiagnostico(500, 50);
    await irParaFalhas();

    expect(screen.getByText("90%")).toBeInTheDocument();
  });
});
