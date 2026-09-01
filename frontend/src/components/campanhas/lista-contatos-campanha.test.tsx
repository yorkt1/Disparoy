// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ContatoDaCampanha, RespostaRecebida, StatusCampanha } from "@disparoy/dominio";

/**
 * A tela em que a resposta do contato aparece — a única do painel.
 *
 * Estes testes cobrem os dois pontos em que ela pode enganar o operador:
 *
 * 1. Resposta só de mídia. Um áudio tem `texto` vazio, e uma linha em branco
 *    embaixo do contato se lê como "não respondeu" — o oposto do que houve.
 * 2. API antiga. Painel e API sobem separado (Vercel e Render), então existe
 *    sempre uma janela em que a tela nova conversa com o servidor velho. Se
 *    `ultimasRespostas` vier `undefined` e a tela cair, o operador perde a
 *    lista INTEIRA por causa de um campo acessório.
 */

const { mockConsulta } = vi.hoisted(() => ({ mockConsulta: vi.fn() }));

// Os intervalos vão junto do hook: o mock substitui o módulo INTEIRO, então
// omitir uma constante que o componente importa derruba a suíte com "No
// export is defined on the mock" — erro que não fala do componente nem do
// teste, e leva um tempo até apontar para esta linha.
vi.mock("@/hooks/consultas", () => ({
  useContatosDaCampanha: mockConsulta,
  INTERVALO_AO_VIVO: 20_000,
  INTERVALO_APOS_DISPARO: 60_000,
}));

import { ListaContatosCampanha } from "./lista-contatos-campanha";

function contato(patch: Partial<ContatoDaCampanha> = {}): ContatoDaCampanha {
  return {
    id: 1,
    contatoId: "c1",
    nome: "Maria",
    telefone: "5548991237324",
    status: "enviado",
    situacao: "respondeu",
    lidaEm: null,
    respostas: 1,
    ultimasRespostas: [],
    ...patch,
  } as ContatoDaCampanha;
}

function comContatos(itens: ContatoDaCampanha[]) {
  mockConsulta.mockReturnValue({
    data: {
      itens,
      resumo: { respondeu: itens.length },
      pagina: 1,
      totalPaginas: 1,
      total: itens.length,
      porPagina: 25,
    },
    isLoading: false,
    isError: false,
  });
  return render(<ListaContatosCampanha id="camp-1" status="concluida" />);
}

/** Só o ritmo interessa aqui, então a lista pode vir vazia. */
function comStatus(status: StatusCampanha) {
  mockConsulta.mockReturnValue({ data: undefined, isLoading: true, isError: false });
  return render(<ListaContatosCampanha id="camp-1" status={status} />);
}

/** O intervalo de atualização com que o componente chamou o hook. */
function intervaloUsado(): number | false {
  return mockConsulta.mock.calls.at(-1)?.[2];
}

function resposta(patch: Partial<RespostaRecebida> = {}): RespostaRecebida {
  return { texto: "pode me ligar agora?", tipo: "texto", recebidaEm: null, ...patch } as RespostaRecebida;
}

/**
 * O ritmo da atualização automática, que é o que estava errado.
 *
 * `aoVivo` era `status === "em_andamento"`, então a lista parava de se
 * atualizar no instante em que o disparo terminava — e resposta e recibo de
 * leitura chegam DEPOIS disso, ao longo de horas. Quem lia a mensagem no
 * celular via o painel seguir dizendo "não lido" até recarregar na mão.
 */
describe("atualização automática", () => {
  it("segue atualizando depois que o disparo termina", () => {
    comStatus("concluida");
    expect(intervaloUsado()).toBe(60_000);
  });

  it("acompanha o painel enquanto dispara", () => {
    comStatus("em_andamento");
    expect(intervaloUsado()).toBe(20_000);
  });

  it("não fica buscando o que ainda não disparou", () => {
    // Rascunho e agendada não mandaram nada e não recebem nada: pedir de novo
    // é pedir a mesma resposta para sempre.
    comStatus("rascunho");
    expect(intervaloUsado()).toBe(false);
  });

  it("uma campanha pausada continua podendo receber resposta", () => {
    // O disparo parou; a conversa de quem já recebeu, não.
    comStatus("pausada");
    expect(intervaloUsado()).toBe(60_000);
  });
});

describe("ListaContatosCampanha", () => {
  it("mostra o texto da resposta, que antes só saía no CSV", () => {
    comContatos([contato({ ultimasRespostas: [resposta()] })]);
    expect(screen.getByText("pode me ligar agora?")).toBeInTheDocument();
  });

  it("resposta só de áudio vira rótulo, não linha em branco", () => {
    comContatos([contato({ ultimasRespostas: [resposta({ texto: "", tipo: "audio" })] })]);
    // Em branco, o operador leria como "não respondeu".
    expect(screen.getByText("[áudio]")).toBeInTheDocument();
  });

  it("legenda de imagem mostra o anexo E o que a pessoa escreveu", () => {
    comContatos([
      contato({ ultimasRespostas: [resposta({ texto: "chegou assim", tipo: "imagem" })] }),
    ]);
    expect(screen.getByText("[imagem] chegou assim")).toBeInTheDocument();
  });

  it("texto em branco no tipo 'texto' não some da tela", () => {
    comContatos([contato({ ultimasRespostas: [resposta({ texto: "   " })] })]);
    expect(screen.getByText("[mensagem]")).toBeInTheDocument();
  });

  it("sobrevive à API que ainda não devolve ultimasRespostas", () => {
    // O servidor antigo omite o campo. A lista tem de continuar de pé.
    const semCampo = contato();
    delete (semCampo as Partial<ContatoDaCampanha>).ultimasRespostas;

    expect(() => comContatos([semCampo])).not.toThrow();
    expect(screen.getByText("Maria")).toBeInTheDocument();
  });

  it("mostra o telefone formatado quando o contato não tem nome", () => {
    comContatos([contato({ nome: null })]);
    expect(screen.queryByText("Maria")).not.toBeInTheDocument();
    expect(screen.getByText(/48/)).toBeInTheDocument();
  });

  it("a busca é rotulada para quem navega por leitor de tela", () => {
    comContatos([contato()]);
    expect(screen.getByLabelText("Buscar contato por telefone")).toBeInTheDocument();
  });

  it("o filtro ativo se anuncia por aria-pressed, não só por cor", () => {
    comContatos([contato()]);
    expect(screen.getByRole("button", { name: /Todos/ })).toHaveAttribute("aria-pressed", "true");
  });
});
