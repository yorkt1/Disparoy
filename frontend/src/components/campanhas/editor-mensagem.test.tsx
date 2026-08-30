// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LIMITES, type MensagemSequencia, type Spintax } from "@disparoy/dominio";

/**
 * O passo da sequência — onde o texto que vai para o cliente é escrito.
 *
 * O risco central aqui é o mesmo do público: marcação que não vira nada. Uma
 * `{{*promo*}}` que não existe na lista de variações não quebra o disparo — ela
 * SAI LITERAL no WhatsApp de quem recebeu. Por isso os problemas de referência
 * são mostrados na tela, e por isso eles têm teste.
 *
 * O `ModalVariacoes` é encenado: ele monta um `<dialog>` próprio e tem suíte
 * separada. O que interessa aqui é o editor, não ele.
 */

vi.mock("./gerenciador-spintax", () => ({
  ModalVariacoes: ({ aoSelecionar }: { aoSelecionar: (nome: string) => void }) => (
    <button type="button" onClick={() => aoSelecionar("promo")}>
      escolher-variacao-promo
    </button>
  ),
}));

vi.mock("@/lib/api", async (original) => {
  const real = await original<typeof import("@/lib/api")>();
  return { ...real, api: { ...real.api, upload: vi.fn() } };
});

import { EditorMensagem } from "./editor-mensagem";

function mensagem(patch: Partial<MensagemSequencia> = {}): MensagemSequencia {
  return { id: "m1", tipo: "texto", corpo: "", ...patch };
}

function variacao(nome: string, opcoes: string[]): Spintax {
  return { id: `s-${nome}`, nome, opcoes, criadoEm: "2026-01-01T00:00:00.000Z" };
}

/** Renderiza um passo com callbacks espionados. */
function montar(
  msg: MensagemSequencia = mensagem(),
  opts: { indice?: number; total?: number; variacoes?: Spintax[] } = {},
) {
  const aoAtualizar = vi.fn();
  const aoRemover = vi.fn();
  const aoMover = vi.fn();
  render(
    <ul>
      <EditorMensagem
        mensagem={msg}
        indice={opts.indice ?? 0}
        total={opts.total ?? 2}
        variacoes={opts.variacoes ?? []}
        aoAtualizar={aoAtualizar}
        aoRemover={aoRemover}
        aoMover={aoMover}
        aoMudarVariacoes={vi.fn()}
      />
    </ul>,
  );
  return { aoAtualizar, aoRemover, aoMover };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EditorMensagem — referências que sairiam literais", () => {
  it("acusa variação inexistente em vez de deixar passar", async () => {
    // Sem este aviso, "{{*promo*}}" sai ao pé da letra no WhatsApp do cliente:
    // o disparo não falha, ele entrega o texto errado.
    montar(mensagem({ corpo: "Oi, {{*promo*}}" }), { variacoes: [] });
    expect(await screen.findByText(/não existe/i)).toBeInTheDocument();
  });

  it("acusa variação que existe mas está sem opções", async () => {
    // Caso distinto: a variação foi criada e ficou vazia. Sortear entre zero
    // opções não dá texto nenhum.
    montar(mensagem({ corpo: "Oi, {{*promo*}}" }), { variacoes: [variacao("promo", [])] });
    expect(await screen.findByText(/sem opções/i)).toBeInTheDocument();
  });

  it("variação válida não vira aviso", () => {
    montar(mensagem({ corpo: "Oi, {{*promo*}}" }), {
      variacoes: [variacao("promo", ["bom dia", "boa tarde"])],
    });
    expect(screen.queryByText(/não existe/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sem opções/i)).not.toBeInTheDocument();
  });

  it("mostra quantas mensagens distintas o texto gera", () => {
    // Aviso de variedade real: 2 x 2 = 4. Uma campanha grande com pouca
    // variação é o que faz o WhatsApp tratar o número como spam.
    montar(mensagem({ corpo: "{{*saudacao*}} {{*fecho*}}" }), {
      variacoes: [
        variacao("saudacao", ["oi", "olá"]),
        variacao("fecho", ["abraço", "até mais"]),
      ],
    });
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});

describe("EditorMensagem — inserção no cursor", () => {
  /** Põe o cursor onde o teste precisa — é o que o componente lê para inserir. */
  function porCursorEm(posicao: number) {
    const area = screen.getByRole("textbox") as HTMLTextAreaElement;
    area.setSelectionRange(posicao, posicao);
    return area;
  }

  it("insere no fim quando o cursor está no fim", async () => {
    const { aoAtualizar } = montar(mensagem({ corpo: "Oi " }));
    porCursorEm(3);
    await userEvent.click(screen.getByRole("button", { name: /Variável/i }));

    expect(aoAtualizar).toHaveBeenCalledWith(expect.objectContaining({ corpo: "Oi {{1}}" }));
  });

  it("insere NO CURSOR, não no fim do texto", async () => {
    // A promessa do componente é essa. Concatenar no fim seria mais simples e
    // erraria toda vez que a pessoa clica no meio de uma frase já escrita.
    const { aoAtualizar } = montar(mensagem({ corpo: "Ola , tudo bem?" }));
    porCursorEm(4);
    await userEvent.click(screen.getByRole("button", { name: /Variável/i }));

    expect(aoAtualizar).toHaveBeenCalledWith(
      expect.objectContaining({ corpo: "Ola {{1}}, tudo bem?" }),
    );
  });

  it("escolher uma variação insere a marcação dela no cursor", async () => {
    const { aoAtualizar } = montar(mensagem({ corpo: "Oi " }));
    porCursorEm(3);
    await userEvent.click(screen.getByRole("button", { name: /Variação/i }));
    await userEvent.click(screen.getByRole("button", { name: /escolher-variacao-promo/i }));

    expect(aoAtualizar).toHaveBeenCalledWith(
      expect.objectContaining({ corpo: "Oi {{*promo*}}" }),
    );
  });

  it("com trecho selecionado, a marcação SUBSTITUI a seleção", async () => {
    const { aoAtualizar } = montar(mensagem({ corpo: "Ola NOME, tudo bem?" }));
    const area = screen.getByRole("textbox") as HTMLTextAreaElement;
    area.setSelectionRange(4, 8); // "NOME"
    await userEvent.click(screen.getByRole("button", { name: /Variável/i }));

    expect(aoAtualizar).toHaveBeenCalledWith(
      expect.objectContaining({ corpo: "Ola {{1}}, tudo bem?" }),
    );
  });

  it("inserir não estoura o limite de caracteres da mensagem", async () => {
    // O corpo já cheio não pode crescer: o que passa do limite é cortado aqui,
    // não descoberto pela API depois que a campanha já foi montada.
    const cheio = "x".repeat(LIMITES.maxCaracteresMensagem);
    const { aoAtualizar } = montar(mensagem({ corpo: cheio }));
    await userEvent.click(screen.getByRole("button", { name: /Variável/i }));

    const corpo = aoAtualizar.mock.calls.at(-1)?.[0].corpo as string;
    expect(corpo.length).toBe(LIMITES.maxCaracteresMensagem);
  });
});

describe("EditorMensagem — ordem e remoção", () => {
  it("o primeiro passo não sobe", () => {
    montar(mensagem(), { indice: 0, total: 3 });
    expect(screen.getByRole("button", { name: /para cima/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /para baixo/i })).toBeEnabled();
  });

  it("o último passo não desce", () => {
    montar(mensagem(), { indice: 2, total: 3 });
    expect(screen.getByRole("button", { name: /para baixo/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /para cima/i })).toBeEnabled();
  });

  it("mover avisa a direção", async () => {
    const { aoMover } = montar(mensagem(), { indice: 1, total: 3 });
    await userEvent.click(screen.getByRole("button", { name: /para cima/i }));
    expect(aoMover).toHaveBeenCalledWith(-1);
  });

  it("a última mensagem não pode ser removida — campanha sem passo não dispara", () => {
    montar(mensagem(), { indice: 0, total: 1 });
    expect(screen.getByRole("button", { name: /Remover mensagem/i })).toBeDisabled();
  });

  it("com mais de uma, remover fica disponível", async () => {
    const { aoRemover } = montar(mensagem(), { indice: 0, total: 2 });
    await userEvent.click(screen.getByRole("button", { name: /Remover mensagem/i }));
    expect(aoRemover).toHaveBeenCalled();
  });

  it("os rótulos das ações dizem de qual passo são", () => {
    // São até 10 editores na tela. Sem o número no rótulo, quem navega por
    // leitor de tela ouve "Remover mensagem" dez vezes iguais.
    montar(mensagem(), { indice: 4, total: 10 });
    expect(screen.getByRole("button", { name: "Remover mensagem 5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mover mensagem 5 para cima" })).toBeInTheDocument();
  });
});

describe("EditorMensagem — tipo do passo", () => {
  it("troca de texto para mídia", async () => {
    const { aoAtualizar } = montar(mensagem({ tipo: "texto" }));
    await userEvent.click(screen.getByRole("button", { name: /^Mídia$/i }));
    expect(aoAtualizar).toHaveBeenCalledWith({ tipo: "midia" });
  });

  it("em mídia, o campo de texto vira Legenda", () => {
    montar(mensagem({ tipo: "midia" }));
    expect(screen.getByLabelText(/Legenda/i)).toBeInTheDocument();
  });

  it("o tipo ativo se anuncia por aria-pressed, não só por cor", () => {
    montar(mensagem({ tipo: "texto" }));
    expect(screen.getByRole("button", { name: /^Texto$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
