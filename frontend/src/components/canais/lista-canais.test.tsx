// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Canal } from "@disparoy/dominio";
import { ErroApi } from "@/lib/api";

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
    reconectar: vi.fn(),
    incidentes: vi.fn(),
  },
  mostrar: vi.fn(),
}));

vi.mock("@/hooks/consultas", () => ({
  useExcluirCanal: () => hooks.excluir(),
  useVinculosCanal: (id: string | null) => hooks.vinculos(id),
  useVerificarCanal: () => hooks.verificar(),
  useCriarCanal: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useReconectarCanal: () => hooks.reconectar(),
  useIncidentesAbertos: () => hooks.incidentes(),
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

/** Sem incidente aberto — o estado normal de quase todo canal. */
function semIncidentes() {
  hooks.incidentes.mockReturnValue({ data: [] });
}

/** Exclusão que resolve, no formato que o componente espera do React Query. */
function exclusaoOk() {
  const mutateAsync = vi.fn().mockResolvedValue(undefined);
  hooks.excluir.mockReturnValue({ mutateAsync, isPending: false, variables: undefined });
  return mutateAsync;
}

/** Reconexão que devolve uma sessão de pareamento por QR. */
function reconexaoOk() {
  const mutateAsync = vi.fn().mockResolvedValue({ qrCode: "data:image/png;base64,x" });
  hooks.reconectar.mockReturnValue({ mutateAsync, isPending: false });
  return mutateAsync;
}

/** Reconexão que rejeita — usado para o 409 e para erro de verdade. */
function reconexaoQueFalha(erro: unknown, depois?: unknown) {
  const mutateAsync = vi.fn().mockRejectedValueOnce(erro);
  if (depois !== undefined) mutateAsync.mockResolvedValueOnce(depois);
  hooks.reconectar.mockReturnValue({ mutateAsync, isPending: false });
  return mutateAsync;
}

function comVinculos(campanhas: { id: string; nome: string; status: string }[], isLoading = false) {
  hooks.vinculos.mockReturnValue({ data: { campanhas }, isLoading });
}

beforeEach(() => {
  vi.clearAllMocks();
  hooks.verificar.mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  semIncidentes();
  exclusaoOk();
  reconexaoOk();
  comVinculos([]);
});

async function abrirExclusao(nome = "Comercial") {
  await userEvent.click(screen.getByRole("button", { name: `Excluir canal ${nome}` }));
}

/** Abre o modal de reconexão e pede o QR — o caminho mais curto até a sessão. */
async function pedirQr() {
  await userEvent.click(screen.getByRole("button", { name: /^Conectar$/i }));
  await userEvent.click(screen.getByRole("button", { name: /Gerar QR Code/i }));
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

/**
 * Reconexão.
 *
 * Duas regras aqui nasceram de defeito real, e são as que estes testes
 * protegem:
 *
 * 1. O painel NÃO derruba a sessão de ninguém. Desconectar é ato do dono, no
 *    aparelho dele. O botão antigo chamava `PATCH { status }`, que só GRAVAVA
 *    o estado sem tocar na sessão — era o caminho mais curto para o painel
 *    mentir sobre o canal.
 *
 * 2. O 409 da API é PERGUNTA, não erro. Ele significa "a sessão está viva,
 *    confirma que quer derrubar?". Quando a resposta caía no mesmo estado que
 *    os erros, ela ia parar no `MensagemErro` e o botão de confirmar deixava
 *    de existir: a pessoa lia "Confirme para prosseguir" e fechava, sem ter o
 *    que clicar.
 */
describe("ListaCanais — reconexão", () => {
  const caido = (patch: Partial<Canal> = {}) => canal({ status: "desconectado", ...patch });

  it("canal conectado não oferece Conectar — o painel não derruba sessão de ninguém", () => {
    render(<ListaCanais canais={[canal({ status: "conectado" })]} />);
    expect(screen.queryByRole("button", { name: /^Conectar$/i })).not.toBeInTheDocument();
  });

  it("canal caído oferece o caminho de volta", () => {
    render(<ListaCanais canais={[caido()]} />);
    expect(screen.getByRole("button", { name: /^Conectar$/i })).toBeInTheDocument();
  });

  it("pareamento por código recusa número inválido sem chamar a API", async () => {
    const mutateAsync = reconexaoOk();
    render(<ListaCanais canais={[caido({ numero: null })]} />);

    await userEvent.click(screen.getByRole("button", { name: /^Conectar$/i }));
    await userEvent.click(screen.getByRole("button", { name: /Código de 8 dígitos/i }));
    await userEvent.click(screen.getByRole("button", { name: /Gerar código/i }));

    expect(mutateAsync).not.toHaveBeenCalled();
    expect(screen.getByText(/com DDD/i)).toBeInTheDocument();
  });

  it("pareamento por QR não pede número", async () => {
    const mutateAsync = reconexaoOk();
    render(<ListaCanais canais={[caido({ numero: null })]} />);
    await pedirQr();

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: "canal-1", metodoPareamento: "qrcode" }),
    );
  });

  it("a primeira tentativa NÃO manda forcar", async () => {
    // `forcar: false` explícito daria no mesmo no servidor, mas apagaria a
    // distinção entre "ainda não perguntei" e "perguntei e a pessoa disse não"
    // para quem for ler o payload investigando um disparo cortado no meio.
    const mutateAsync = reconexaoOk();
    render(<ListaCanais canais={[caido()]} />);
    await pedirQr();

    expect(mutateAsync.mock.calls[0][0]).not.toHaveProperty("forcar");
  });

  it("409 é PERGUNTA, não erro: oferece derrubar em vez de virar beco sem saída", async () => {
    reconexaoQueFalha(new ErroApi("A sessão está ativa. Confirme para prosseguir.", 409));
    render(<ListaCanais canais={[caido()]} />);
    await pedirQr();

    expect(screen.getByRole("button", { name: /Derrubar e reconectar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Manter conectado/i })).toBeInTheDocument();
  });

  it("o aviso do 409 é o texto da API, não uma segunda versão escrita no front", async () => {
    // Quem sabe o que vai ser derrubado é o servidor — ele perguntou ao
    // gateway. Uma frase própria aqui divergiria no primeiro ajuste e
    // explicaria uma consequência diferente da que vai acontecer.
    reconexaoQueFalha(new ErroApi("Sessao viva desde ontem.", 409));
    render(<ListaCanais canais={[caido()]} />);
    await pedirQr();

    expect(screen.getByText("Sessao viva desde ontem.")).toBeInTheDocument();
  });

  it("confirmar o 409 reenvia com forcar", async () => {
    const mutateAsync = reconexaoQueFalha(new ErroApi("Confirme para prosseguir.", 409), {
      qrCode: "data:image/png;base64,x",
    });
    render(<ListaCanais canais={[caido()]} />);
    await pedirQr();
    await userEvent.click(screen.getByRole("button", { name: /Derrubar e reconectar/i }));

    expect(mutateAsync).toHaveBeenCalledTimes(2);
    expect(mutateAsync.mock.calls[1][0]).toMatchObject({ forcar: true });
  });

  it("manter conectado sai sem derrubar nada", async () => {
    const mutateAsync = reconexaoQueFalha(new ErroApi("Confirme para prosseguir.", 409));
    render(<ListaCanais canais={[caido()]} />);
    await pedirQr();
    await userEvent.click(screen.getByRole("button", { name: /Manter conectado/i }));

    // Uma chamada só: a que recebeu o 409. Nada foi derrubado.
    expect(mutateAsync).toHaveBeenCalledTimes(1);
  });

  it("erro que não é 409 continua sendo erro", async () => {
    reconexaoQueFalha(new ErroApi("Gateway fora do ar.", 502));
    render(<ListaCanais canais={[caido()]} />);
    await pedirQr();

    expect(screen.getByText("Gateway fora do ar.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Derrubar e reconectar/i }),
    ).not.toBeInTheDocument();
  });
});

/**
 * O canal que se contradiz: `status: "conectado"` gravado, mas sem número.
 *
 * É o estado real que apareceu em produção — o operador leu o QR, a
 * confirmação demorou, ele fechou o modal, e o webhook gravou `conectado` sem
 * o número, que só chega quando o pareamento termina.
 *
 * O selo já dizia a verdade ("marcado como conectado, mas o pareamento nunca
 * foi concluído"), porque lê `apresentarCanal()`. As AÇÕES liam `c.status`
 * cru, e a linha se contradizia: oferecia "Contatos" e escondia "Conectar",
 * deixando o canal sem saída pelo produto — só restava excluir e criar outro.
 */
describe("ListaCanais — canal marcado como conectado que nunca pareou", () => {
  const contraditorio = canal({ status: "conectado", numero: null });

  it("oferece Conectar, que é o caminho de volta", () => {
    render(<ListaCanais canais={[contraditorio]} />);
    // Âncoras no nome: "Conectar canal", do cabeçalho, também casaria.
    expect(screen.getByRole("button", { name: /^Conectar$/ })).toBeInTheDocument();
  });

  it("não oferece Contatos, que baixaria uma agenda vazia", () => {
    // Sem sessão a Evolution devolve lista vazia, e o operador concluiria que
    // a agenda do número está vazia em vez de que o canal não conectou.
    render(<ListaCanais canais={[contraditorio]} />);
    expect(screen.queryByRole("button", { name: /Contatos/i })).not.toBeInTheDocument();
  });

  it("o canal realmente conectado continua oferecendo Contatos", () => {
    render(<ListaCanais canais={[canal()]} />);
    expect(screen.getByRole("button", { name: /Contatos/i })).toBeInTheDocument();
  });
});

/**
 * O motivo aparece na linha do canal, e não só no Diagnóstico.
 *
 * Um número já usado por outro canal faz o pareamento concluir sem gravar o
 * número. O selo passa a dizer "Aguardando QR" — verdade, e que não explica
 * nada. Sem o motivo aqui, o operador relê o QR indefinidamente, porque a
 * explicação está numa tela que ele não tem motivo para abrir.
 */
describe("ListaCanais — motivo do incidente na linha", () => {
  const MOTIVO = 'Este WhatsApp já está no canal "Comercial".';

  function comIncidente(canalId: string) {
    hooks.incidentes.mockReturnValue({
      data: [{ id: 1, canalId, detalhe: MOTIVO, titulo: "Número já conectado em outro canal" }],
    });
  }

  it("mostra o motivo do incidente aberto do canal", () => {
    comIncidente("canal-1");
    render(<ListaCanais canais={[canal({ status: "conectado", numero: null })]} />);
    expect(screen.getByText(MOTIVO)).toBeInTheDocument();
  });

  it("não mostra o motivo de um incidente de OUTRO canal", () => {
    // O incidente é de outro canal: mostrá-lo aqui atribuiria a este canal um
    // problema que não é dele — pior que não mostrar nada.
    comIncidente("canal-outro");
    render(<ListaCanais canais={[canal({ status: "conectado", numero: null })]} />);
    expect(screen.queryByText(MOTIVO)).not.toBeInTheDocument();
  });

  it("canal sem incidente não ganha texto nenhum", () => {
    render(<ListaCanais canais={[canal()]} />);
    expect(screen.queryByText(MOTIVO)).not.toBeInTheDocument();
  });
});
