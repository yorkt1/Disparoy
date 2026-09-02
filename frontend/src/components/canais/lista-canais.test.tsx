// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
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
    ehAdmin: vi.fn(),
    ehContaGlobal: vi.fn(),
    empresas: vi.fn(),
    membros: vi.fn(),
    definirMembro: vi.fn(),
    removerMembro: vi.fn(),
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
  useEhAdmin: () => hooks.ehAdmin(),
  useEhContaGlobal: () => hooks.ehContaGlobal(),
  useEmpresas: (habilitado?: boolean) => hooks.empresas(habilitado),
  useMembrosCanal: (id: string | null) => hooks.membros(id),
  useDefinirMembro: () => hooks.definirMembro(),
  useRemoverMembro: () => hooks.removerMembro(),
  useUsuarios: () => ({ data: [] }),
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

/**
 * Operador, que é o caso mais restrito.
 *
 * O padrão dos testes é o acesso SEM privilégio: assim, um botão que aparecer
 * onde não devia quebra alguma coisa aqui em vez de passar despercebido.
 */
function comoOperador() {
  hooks.ehAdmin.mockReturnValue(false);
  hooks.ehContaGlobal.mockReturnValue(false);
  hooks.empresas.mockReturnValue({ data: undefined });
  hooks.membros.mockReturnValue({ data: [], isLoading: false });
  hooks.definirMembro.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  hooks.removerMembro.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
}

/**
 * A conta de administração, com duas empresas e um canal em cada.
 *
 * É o único acesso que vê canais de empresas diferentes na mesma lista — e
 * portanto o único para o qual a coluna "Conta" faz sentido.
 */
function comoContaGlobal() {
  hooks.ehAdmin.mockReturnValue(true);
  hooks.ehContaGlobal.mockReturnValue(true);
  hooks.empresas.mockReturnValue({
    data: [
      {
        id: "empresa-a",
        nome: "Empreende Brazil",
        ativa: true,
        criadaEm: "2026-01-01T00:00:00.000Z",
        acessos: 1,
        canais: [canal()],
      },
      {
        id: "empresa-b",
        nome: "Mollina Doces",
        ativa: true,
        criadaEm: "2026-01-01T00:00:00.000Z",
        acessos: 1,
        canais: [canal({ id: "canal-2", nome: "Suporte", numero: "5548999998888" })],
      },
    ],
  });
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
  /*
   * `mutateAsync` PRECISA devolver promessa.
   *
   * `useVerificacaoAutomatica` faz `verificar.current(id).catch(...)` — com um
   * `vi.fn()` cru, que devolve `undefined`, isso virava quatro
   * `UnhandledRejection` por execução. Os testes passavam e a suíte saía com
   * código 1, o que deixava o passo de testes do CI vermelho sem nenhum teste
   * vermelho para explicar.
   */
  hooks.verificar.mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false,
  });
  semIncidentes();
  comoOperador();
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

/**
 * Compartilhar o canal com a equipe.
 *
 * As rotas existiam na API e nenhuma tela as chamava. Ficou urgente quando
 * conectar canal deixou de ser ato administrativo: o operador conecta o
 * próprio número, vira dono sozinho, e nenhum colega enxerga aquele canal para
 * usar numa campanha.
 */
describe("ListaCanais — acessos do canal", () => {
  function botaoAcessos() {
    return screen.queryByRole("button", { name: /^Acessos$/ });
  }

  it("operador não vê o botão de acessos", () => {
    // Não é escolha de produto: o seletor de pessoas vem de `GET /usuarios`,
    // que a API restringe a administrador. Mostrar o botão daria um modal sem
    // ninguém para escolher.
    render(<ListaCanais canais={[canal()]} />);
    expect(botaoAcessos()).toBeNull();
  });

  it("admin vê o botão", () => {
    hooks.ehAdmin.mockReturnValue(true);
    render(<ListaCanais canais={[canal()]} />);
    expect(botaoAcessos()).not.toBeNull();
  });

  it("o dono do canal não pode ser removido", async () => {
    // Tirar quem conectou o aparelho deixaria o canal sem responsável — e é o
    // dono quem pode excluí-lo. Para trocar de dono, exclui e reconecta.
    hooks.ehAdmin.mockReturnValue(true);
    hooks.membros.mockReturnValue({
      data: [
        { canalId: "canal-1", perfilId: "p1", nome: "Dona do número", permissao: "owner" },
        { canalId: "canal-1", perfilId: "p2", nome: "Colega", permissao: "operator" },
      ],
      isLoading: false,
    });

    render(<ListaCanais canais={[canal()]} />);
    await userEvent.click(botaoAcessos()!);

    expect(screen.queryByRole("button", { name: /Remover o acesso de Dona do número/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Remover o acesso de Colega/ }),
    ).toBeInTheDocument();
  });
});

/**
 * De quem é cada canal.
 *
 * A conta de administração vê os canais de TODAS as empresas na mesma lista, e
 * até aqui a lista não dizia de quem era nenhum — descobrir a qual cliente um
 * número pertencia exigia entrar na conta dele. O risco que estes testes
 * guardam não é a coluna sumir: é ela aparecer com o nome errado, que é pior
 * do que não aparecer.
 */
describe("ListaCanais — a conta dona do canal", () => {
  it("a conta de administração vê a empresa de cada canal", () => {
    comoContaGlobal();
    render(<ListaCanais canais={[canal(), canal({ id: "canal-2", nome: "Suporte" })]} />);

    // Dentro da TABELA, e não da tela: o filtro por conta repete os mesmos
    // nomes nas opções do `select`, e um `getByText` solto passaria mesmo com
    // a coluna vazia.
    const tabela = within(screen.getByRole("table"));
    expect(screen.getByRole("columnheader", { name: "Conta" })).toBeInTheDocument();
    expect(tabela.getByText("Empreende Brazil")).toBeInTheDocument();
    expect(tabela.getByText("Mollina Doces")).toBeInTheDocument();
  });

  it("quem pertence a uma empresa não ganha a coluna", () => {
    // Para o admin DE UMA empresa todo canal é dela: a coluna seria uma
    // constante repetida em toda linha, e a consulta a `/empresas` que a
    // alimenta devolveria 400 para ele.
    render(<ListaCanais canais={[canal()]} />);
    expect(screen.queryByRole("columnheader", { name: "Conta" })).toBeNull();
  });

  it("não chuta empresa para canal que ainda não está na lista", () => {
    // Acontece entre criar o canal e `/empresas` atualizar. Escrever o nome de
    // um cliente ao lado do número de outro é exatamente o erro que a coluna
    // existe para evitar — o traço admite o que não se sabe.
    comoContaGlobal();
    render(<ListaCanais canais={[canal({ id: "canal-recem-criado", nome: "Novo" })]} />);

    const tabela = within(screen.getByRole("table"));
    expect(tabela.queryByText("Empreende Brazil")).toBeNull();
    expect(tabela.getByText("—")).toBeInTheDocument();
  });

  it("o filtro por conta recorta a lista", async () => {
    comoContaGlobal();
    render(<ListaCanais canais={[canal(), canal({ id: "canal-2", nome: "Suporte" })]} />);

    await userEvent.selectOptions(screen.getByLabelText("Conta"), "empresa-b");

    expect(screen.getByText("Suporte")).toBeInTheDocument();
    expect(screen.queryByText("Comercial")).toBeNull();
  });

  it("buscar pelo nome do cliente acha o canal dele", async () => {
    // O placeholder promete busca "por nome, número ou empresa" desde antes de
    // a empresa existir no texto pesquisável — prometia e não entregava.
    comoContaGlobal();
    render(<ListaCanais canais={[canal(), canal({ id: "canal-2", nome: "Suporte" })]} />);

    await userEvent.type(screen.getByRole("searchbox"), "Mollina");

    expect(screen.getByText("Suporte")).toBeInTheDocument();
    expect(screen.queryByText("Comercial")).toBeNull();
  });
});
