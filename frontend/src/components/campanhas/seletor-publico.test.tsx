// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LinhasPlanilha } from "@disparoy/dominio";
import type { ContatoPublico } from "@/hooks/use-formulario-campanha";

/**
 * Quem vai receber a campanha.
 *
 * É a tela onde um erro sai pelo WhatsApp de gente real. Dois riscos moram
 * aqui, e são os que estes testes protegem:
 *
 * 1. Contato descartado em silêncio. Colar 500 números e disparar para 470 sem
 *    o operador saber que 30 caíram é pior do que falhar: ninguém vai atrás de
 *    quem não recebeu.
 *
 * 2. Variável que não vira nada. `montarContatos` precisa receber a ORDEM das
 *    colunas da planilha. Sem ela, `variaveis` sai `{}` para a lista inteira —
 *    a tela promete "as demais colunas viram variáveis", o editor tem um botão
 *    que insere `{{1}}`, e a campanha dispara "Olá {{1}}" literal para todo
 *    mundo. Foi um defeito real.
 */

const { mostrar, upload } = vi.hoisted(() => ({ mostrar: vi.fn(), upload: vi.fn() }));

vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ mostrar }) }));

vi.mock("@/lib/api", async (original) => {
  // `ErroApi` continua o de verdade: o componente faz `instanceof` nele para
  // decidir entre a mensagem da API e o texto genérico de formato.
  const real = await original<typeof import("@/lib/api")>();
  return { ...real, api: { ...real.api, upload } };
});

import { SeletorPublico } from "./seletor-publico";

/** Renderiza controlado, como a página faz, e devolve o que o filho emitiu. */
function montar() {
  const aoMudar = vi.fn();
  function Hospedeiro() {
    const [publico, setPublico] = React.useState<ContatoPublico[]>([]);
    return (
      <SeletorPublico
        publico={publico}
        aoMudar={(c) => {
          aoMudar(c);
          setPublico(c);
        }}
      />
    );
  }
  render(<Hospedeiro />);
  return aoMudar;
}

async function colar(texto: string) {
  await userEvent.click(screen.getByRole("button", { name: /Colar números/i }));
  await userEvent.type(screen.getByLabelText(/Números, um por linha/i), texto);
  await userEvent.click(screen.getByRole("button", { name: /Usar estes números/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SeletorPublico — números colados", () => {
  it("aceita os formatos que o operador realmente cola", async () => {
    const aoMudar = montar();
    await colar("48991237324\n(48) 99123-7325\n+55 48 99123-7326");

    const contatos = aoMudar.mock.calls.at(-1)?.[0] as ContatoPublico[];
    expect(contatos).toHaveLength(3);
    // Normalizados para E.164 pelo domínio — o mesmo código que o backend usa.
    expect(contatos.every((c) => c.telefone.startsWith("+55"))).toBe(true);
  });

  it("descarta número inválido E DIZ quantos caíram", async () => {
    // Descartar em silêncio é o pior desfecho: ninguém vai atrás de quem não
    // recebeu, porque ninguém sabe que alguém ficou de fora.
    const aoMudar = montar();
    await colar("48991237324\nnao-e-telefone\n123");

    expect((aoMudar.mock.calls.at(-1)?.[0] as ContatoPublico[]).length).toBe(1);
    expect(await screen.findByText(/inválido/i)).toBeInTheDocument();
  });

  it("descarta repetido e conta separado do inválido", async () => {
    const aoMudar = montar();
    await colar("48991237324\n48991237324\n(48) 99123-7324");

    expect((aoMudar.mock.calls.at(-1)?.[0] as ContatoPublico[]).length).toBe(1);
    expect(await screen.findByText(/repetido/i)).toBeInTheDocument();
  });

  it("nenhum número válido vira erro, não lista vazia silenciosa", async () => {
    montar();
    await colar("abc\ndef");

    expect(mostrar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "erro" }));
  });

  it("não deixa enviar caixa vazia", async () => {
    montar();
    await userEvent.click(screen.getByRole("button", { name: /Colar números/i }));
    expect(screen.getByRole("button", { name: /Usar estes números/i })).toBeDisabled();
  });

  it("limpar zera a lista e os descartados juntos", async () => {
    const aoMudar = montar();
    await colar("48991237324\nlixo");
    expect(await screen.findByText(/inválido/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Limpar/i }));

    expect(aoMudar.mock.calls.at(-1)?.[0]).toEqual([]);
    expect(screen.queryByText(/inválido/i)).not.toBeInTheDocument();
  });
});

describe("SeletorPublico — planilha", () => {
  const planilha: LinhasPlanilha = {
    colunas: ["nome", "telefone", "empresa", "plano"],
    linhas: [
      { nome: "Maria", telefone: "48991237324", empresa: "Acme", plano: "Ouro" },
      { nome: "João", telefone: "48991237325", empresa: "Beta", plano: "Prata" },
    ],
    totalLinhas: 2,
    truncada: false,
  };

  async function soltarArquivo() {
    const arquivo = new File(["x"], "contatos.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const entrada = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(entrada, arquivo);
  }

  it("as colunas extras viram variáveis do texto", async () => {
    upload.mockResolvedValue(planilha);
    const aoMudar = montar();
    await soltarArquivo();

    await waitFor(() => expect(aoMudar).toHaveBeenCalled());
    const contatos = aoMudar.mock.calls.at(-1)?.[0] as ContatoPublico[];

    expect(contatos).toHaveLength(2);
    expect(Object.values(contatos[0].variaveis)).toContain("Acme");
  });

  it("célula vazia na PRIMEIRA linha não desloca as variáveis das outras", async () => {
    /*
     * A regressão de verdade, e o motivo de `colunas` ser passado.
     *
     * Sem ele, `montarContatos` deriva o mapeamento das chaves da primeira
     * linha lida. O parser omite a chave quando a célula está vazia, então
     * uma primeira linha sem `empresa` produz o mapa {2: "plano"} — e `{{2}}`,
     * que o operador escreveu pensando em "empresa", passa a render o PLANO
     * para a lista inteira. Ninguém vê: as duas colunas têm texto plausível.
     *
     * Com a ordem real da planilha, `{{2}}` é sempre `empresa`, tenha a
     * primeira linha a célula preenchida ou não.
     */
    upload.mockResolvedValue({
      colunas: ["nome", "telefone", "empresa", "plano"],
      // Maria sem `empresa` — a chave nem chega no objeto.
      linhas: [
        { nome: "Maria", telefone: "48991237324", plano: "Ouro" },
        { nome: "João", telefone: "48991237325", empresa: "Beta", plano: "Prata" },
      ],
      totalLinhas: 2,
      truncada: false,
    } satisfies LinhasPlanilha);

    const aoMudar = montar();
    await soltarArquivo();

    await waitFor(() => expect(aoMudar).toHaveBeenCalled());
    const contatos = aoMudar.mock.calls.at(-1)?.[0] as ContatoPublico[];
    const joao = contatos.find((c) => c.nome === "João");

    // `{{2}}` é a primeira coluna extra depois do nome: empresa, não plano.
    expect(joao?.variaveis["2"]).toBe("Beta");
    expect(joao?.variaveis["3"]).toBe("Prata");
  });

  it("reconhece a coluna de nome sozinha", async () => {
    upload.mockResolvedValue(planilha);
    const aoMudar = montar();
    await soltarArquivo();

    await waitFor(() => expect(aoMudar).toHaveBeenCalled());
    const contatos = aoMudar.mock.calls.at(-1)?.[0] as ContatoPublico[];
    expect(contatos[0].nome).toBe("Maria");
  });

  it("planilha sem coluna de telefone não vira campanha vazia em silêncio", async () => {
    upload.mockResolvedValue({
      colunas: ["nome", "cidade"],
      linhas: [{ nome: "Maria", cidade: "Floripa" }],
      totalLinhas: 1,
      truncada: false,
    } satisfies LinhasPlanilha);
    montar();
    await soltarArquivo();

    await waitFor(() =>
      expect(mostrar).toHaveBeenCalledWith(expect.objectContaining({ tipo: "erro" })),
    );
  });

  it("falha ao ler a planilha avisa em vez de deixar a tela parada", async () => {
    upload.mockRejectedValue(new Error("boom"));
    montar();
    await soltarArquivo();

    await waitFor(() =>
      expect(mostrar).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: "erro", titulo: expect.stringMatching(/planilha/i) }),
      ),
    );
  });
});
