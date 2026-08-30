// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Canal } from "@disparoy/dominio";

/**
 * A tela mais perigosa do painel.
 *
 * Excluir um canal REMOVE a instância na Evolution — o próprio modal diz que
 * não dá para desfazer. E o canal pode estar preso a campanhas que ainda vão
 * disparar: antes, a API recusava a exclusão e mandava "desconecte em vez de
 * excluir", o canal ficava na lista para sempre e o operador só descobria o
 * problema DEPOIS de clicar.
 *
 * O modal existe para inverter isso — mostrar o que vai junto ANTES. Estes
 * testes cobrem a parte que não pode regredir: que a informação chega antes da
 * decisão, e que a decisão não fica disponível antes da informação.
 */

const { hooks, mostrar } = vi.hoisted(() => ({
  hooks: {
    excluir: vi.fn(),
    vinculos: vi.fn(),
    verificar: vi.fn(),
  },
  mostrar: vi.fn(),
}));

vi.mock("@/hooks/consultas", () => ({
  useExcluirCanal: () => hooks.excluir(),
  useVinculosCanal: (id: string | null) => hooks.vinculos(id),
  useVerificarCanal: () => hooks.verificar(),
  useCriarCanal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReconectarCanal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  contarContatosDoCanal: vi.fn(),
}));

vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ mostrar }) }));

import { ListaCanais } from "./lista-canais";

function canal(patch: Partial<Canal> = {}): Canal {
  return {
    id: "canal-1",
    nome: "Comercial",
    numero: "5548991237324",
    status: "conectado",
    tipoConexao: "qrcode",
    instanciaEvolution: "disparoy_comercial_abc",
    limiteDiario: null,
    estagioAquecimento: 1,
    enviadasHoje: 0,
    solicitadoEm: "2026-01-01T00:00:00.000Z",
    conectadoEm: "2026-01-01T00:00:00.000Z",
    fotoUrl: null,
    ...patch,
  } as Canal;
}

/** Exclusão que resolve, no formato que o componente espera do React Query. */
function exclusaoOk() {
  const mutateAsync = vi.fn().mockResolvedValue(undefined);
  hooks.excluir.mockReturnValue({ mutateAsync, isPending: false, variables: undefined });
  return mutateAsync;
}

function comVinculos(campanhas: { id: string; nome: string; status: string }[], isLoading = false) {
  hooks.vinculos.mockReturnValue({ data: { campanhas }, isLoading });
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.verificar.mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  exclusaoOk();
  comVinculos([]);
});

async function abrirExclusao(nome = "Comercial") {
  await userEvent.click(screen.getByRole("button", { name: `Excluir canal ${nome}` }));
}

describe("ListaCanais — exclusão de canal", () => {
  it("o botão de excluir é rotulado com o nome do canal", () => {
    render(<ListaCanais canais={[canal()]} />);
    expect(screen.getByRole("button", { name: "Excluir canal Comercial" })).toBeInTheDocument();
  });

  it("avisa que a instância some da Evolution e que não dá para desfazer", async () => {
    render(<ListaCanais canais={[canal()]} />);
    await abrirExclusao();
    expect(screen.getByText(/removida da Evolution/i)).toBeInTheDocument();
  });

  it("não deixa confirmar enquanto as dependências não carregaram", async () => {
    // Confirmar antes de a lista chegar é confirmar sem a informação que o
    // modal existe para dar. É a regra do `disabled={vinculos.isLoading}`.
    comVinculos([], true);
    render(<ListaCanais canais={[canal()]} />);
    await abrirExclusao();

    expect(screen.getByRole("button", { name: /Excluir mesmo assim/i })).toBeDisabled();
    expect(screen.getByText(/Conferindo dependências/i)).toBeInTheDocument();
  });

  it("lista as campanhas presas ao canal antes de confirmar", async () => {
    comVinculos([
      { id: "c1", nome: "Black Friday", status: "em_andamento" },
      { id: "c2", nome: "Natal", status: "rascunho" },
    ]);
    render(<ListaCanais canais={[canal()]} />);
    await abrirExclusao();

    expect(screen.getByText("Black Friday")).toBeInTheDocument();
    expect(screen.getByText("Natal")).toBeInTheDocument();
  });

  it("destaca quantas campanhas AINDA VÃO DISPARAR — é o que muda a decisão", async () => {
    // Duas presas, só uma ainda dispara. É a diferença entre "some um vínculo
    // velho" e "uma campanha viva perde o canal por onde sairia".
    comVinculos([
      { id: "c1", nome: "Black Friday", status: "em_andamento" },
      { id: "c2", nome: "Campanha velha", status: "concluida" },
    ]);
    render(<ListaCanais canais={[canal()]} />);
    await abrirExclusao();

    expect(screen.getByText(/1 ainda vai disparar/i)).toBeInTheDocument();
  });

  it("conta pausada_por_canal como campanha que ainda vai disparar", async () => {
    // Ela está parada JUSTAMENTE porque o canal caiu. Excluir o canal é o que
    // a impede de voltar — tratá-la como inativa esconderia isso do operador.
    comVinculos([{ id: "c1", nome: "Retomada", status: "pausada_por_canal" }]);
    render(<ListaCanais canais={[canal()]} />);
    await abrirExclusao();

    expect(screen.getByText(/1 ainda vai disparar/i)).toBeInTheDocument();
  });

  it("diz explicitamente quando nada depende do canal", async () => {
    render(<ListaCanais canais={[canal()]} />);
    await abrirExclusao();
    expect(screen.getByText(/Nenhuma campanha usa este canal/i)).toBeInTheDocument();
  });

  it("excluir de verdade só acontece depois do clique em confirmar", async () => {
    const mutateAsync = exclusaoOk();
    render(<ListaCanais canais={[canal()]} />);

    await abrirExclusao();
    expect(mutateAsync).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /Excluir mesmo assim/i }));
    expect(mutateAsync).toHaveBeenCalledWith({ id: "canal-1", forcar: true });
  });

  it("cancelar fecha sem excluir nada", async () => {
    const mutateAsync = exclusaoOk();
    render(<ListaCanais canais={[canal()]} />);

    await abrirExclusao();
    await userEvent.click(screen.getByRole("button", { name: /^Cancelar$/i }));

    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("falha ao excluir vira aviso na tela, não silêncio", async () => {
    const mutateAsync = vi.fn().mockRejectedValue(new Error("canal em uso"));
    hooks.excluir.mockReturnValue({ mutateAsync, isPending: false, variables: undefined });
    render(<ListaCanais canais={[canal()]} />);

    await abrirExclusao();
    await userEvent.click(screen.getByRole("button", { name: /Excluir mesmo assim/i }));

    expect(mostrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "erro", descricao: "canal em uso" }),
    );
  });

  it("sucesso confirma ao operador qual canal saiu", async () => {
    render(<ListaCanais canais={[canal()]} />);
    await abrirExclusao();
    await userEvent.click(screen.getByRole("button", { name: /Excluir mesmo assim/i }));

    expect(mostrar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: "info", descricao: "Comercial" }),
    );
  });
});

describe("ListaCanais — lista", () => {
  it("sem canais, oferece conectar em vez de mostrar tabela vazia", () => {
    render(<ListaCanais canais={[]} />);
    expect(screen.getByText(/Nenhum canal conectado/i)).toBeInTheDocument();
  });

  it("o canal sem número pareado não inventa um", () => {
    render(<ListaCanais canais={[canal({ numero: null, status: "aguardando_qr" })]} />);
    expect(screen.getByText("Comercial")).toBeInTheDocument();
  });
});
