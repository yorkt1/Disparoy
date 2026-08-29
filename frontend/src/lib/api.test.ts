import { beforeEach, describe, expect, it, vi } from "vitest";

const CHAVE_SESSAO = "disparoy.sessao";

interface Chamada {
  url: string;
  init: RequestInit;
}

/** Registra as chamadas sem deixar nenhuma request sair de verdade. */
function espionarFetch(responder: () => Response): Chamada[] {
  const chamadas: Chamada[] = [];
  vi.stubGlobal("fetch", async (url: unknown, init: RequestInit = {}) => {
    chamadas.push({ url: String(url), init });
    return Promise.resolve(responder());
  });
  return chamadas;
}

function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function comSessaoValida(token = "token-de-teste"): void {
  localStorage.setItem(
    CHAVE_SESSAO,
    JSON.stringify({ token, expiraEm: new Date(Date.now() + 3_600_000).toISOString() }),
  );
}

/**
 * `lib/api.ts` calcula a URL base UMA vez, no topo do módulo. Reimportar sem
 * resetar traria a base congelada do teste anterior, e os casos de
 * `VITE_API_URL` passariam a depender da ordem em que rodam.
 */
async function carregarApi() {
  vi.resetModules();
  return import("./api");
}

beforeEach(() => {
  vi.resetModules();
});

describe("chamarApi", () => {
  it("anexa o token da sessão", async () => {
    comSessaoValida("abc123");
    const chamadas = espionarFetch(() => respostaJson({ ok: true }));
    const { api } = await carregarApi();

    await api.get("/campanhas");

    expect(chamadas[0].url).toBe("/api/campanhas");
    const cabecalhos = chamadas[0].init.headers as Record<string, string>;
    expect(cabecalhos.Authorization).toBe("Bearer abc123");
  });

  it("não manda Authorization quando não há sessão", async () => {
    const chamadas = espionarFetch(() => respostaJson({ ok: true }));
    const { api } = await carregarApi();

    await api.get("/campanhas");

    const cabecalhos = chamadas[0].init.headers as Record<string, string>;
    expect(cabecalhos.Authorization).toBeUndefined();
  });

  /**
   * O `Content-Type` do FormData carrega o boundary, gerado pelo navegador.
   * Definir `multipart/form-data` à mão apaga o boundary e o backend recebe um
   * corpo que não consegue separar — o upload de planilha falha com erro de
   * parsing, longe daqui.
   */
  it("não define Content-Type no upload", async () => {
    const chamadas = espionarFetch(() => respostaJson({ ok: true }));
    const { api } = await carregarApi();

    await api.upload("/contatos/importar", new FormData());

    const cabecalhos = chamadas[0].init.headers as Record<string, string>;
    expect(cabecalhos["Content-Type"]).toBeUndefined();
  });

  it("define Content-Type JSON quando há corpo", async () => {
    const chamadas = espionarFetch(() => respostaJson({ ok: true }));
    const { api } = await carregarApi();

    await api.post("/campanhas", { nome: "Teste" });

    const cabecalhos = chamadas[0].init.headers as Record<string, string>;
    expect(cabecalhos["Content-Type"]).toBe("application/json");
    expect(chamadas[0].init.body).toBe(JSON.stringify({ nome: "Teste" }));
  });

  it("204 devolve undefined sem tentar ler corpo", async () => {
    espionarFetch(() => new Response(null, { status: 204 }));
    const { api } = await carregarApi();

    await expect(api.delete("/campanhas/1")).resolves.toBeUndefined();
  });

  /**
   * 401 é sessão morta. Limpar aqui é o que acorda o provider e interrompe o
   * polling do React Query — sem isso a tela segue exibindo o painel logado,
   * batendo em rota autenticada, até alguém navegar.
   */
  it("401 derruba a sessão local", async () => {
    comSessaoValida();
    espionarFetch(() => respostaJson({ erro: "Sessão expirada." }, 401));
    const { api, ErroApi } = await carregarApi();

    await expect(api.get("/campanhas")).rejects.toBeInstanceOf(ErroApi);
    expect(localStorage.getItem(CHAVE_SESSAO)).toBeNull();
  });

  it("preserva a sessão em erro que não seja 401", async () => {
    comSessaoValida();
    espionarFetch(() => respostaJson({ erro: "Sem permissão." }, 403));
    const { api } = await carregarApi();

    await expect(api.get("/campanhas")).rejects.toThrow("Sem permissão.");
    expect(localStorage.getItem(CHAVE_SESSAO)).not.toBeNull();
  });

  /**
   * Proxy fora do ar devolve HTML. Sem este caminho o `JSON.parse` estoura com
   * "Unexpected token <", que não diz nada sobre o que aconteceu.
   */
  it("resposta não-JSON com erro vira ErroApi legível", async () => {
    espionarFetch(() => new Response("<html>502 Bad Gateway</html>", { status: 502 }));
    const { api, ErroApi } = await carregarApi();

    const erro = await api.get("/campanhas").catch((e: unknown) => e);

    expect(erro).toBeInstanceOf(ErroApi);
    expect((erro as InstanceType<typeof ErroApi>).status).toBe(502);
    expect((erro as Error).message).toContain("502");
  });

  it("erros por campo chegam em primeiroCampo", async () => {
    espionarFetch(() =>
      respostaJson({ erro: "Dados inválidos.", erros: { nome: "Obrigatório." } }, 400),
    );
    const { api, ErroApi } = await carregarApi();

    const erro = (await api
      .post("/campanhas", {})
      .catch((e: unknown) => e)) as InstanceType<typeof ErroApi>;

    expect(erro.campos).toEqual({ nome: "Obrigatório." });
    expect(erro.primeiroCampo).toBe("Obrigatório.");
  });

  it("erro sem corpo ainda carrega o status", async () => {
    espionarFetch(() => new Response(null, { status: 500 }));
    const { api, ErroApi } = await carregarApi();

    const erro = (await api.get("/x").catch((e: unknown) => e)) as InstanceType<typeof ErroApi>;

    expect(erro.status).toBe(500);
    expect(erro.message).toBe("Erro 500.");
  });
});

/**
 * O caso real: `VITE_API_URL` foi salva na Vercel com o nome colado no valor.
 * O Vite grava isso no bundle sem falhar em lugar nenhum, o valor vira caminho
 * relativo, e o `POST /sessao` foi parar no host estático — que respondeu 405.
 */
describe("URL base da API", () => {
  async function urlChamada(): Promise<string> {
    const chamadas = espionarFetch(() => respostaJson({}));
    const { api } = await carregarApi();
    await api.get("/sessao");
    return chamadas[0].url;
  }

  it("sem VITE_API_URL usa /api", async () => {
    vi.stubEnv("VITE_API_URL", "");
    expect(await urlChamada()).toBe("/api/sessao");
  });

  it("acrescenta /api à URL absoluta", async () => {
    vi.stubEnv("VITE_API_URL", "https://disparoy-backend.onrender.com");
    expect(await urlChamada()).toBe("https://disparoy-backend.onrender.com/api/sessao");
  });

  it("não duplica /api nem mantém barra final", async () => {
    vi.stubEnv("VITE_API_URL", "https://disparoy-backend.onrender.com/api/");
    expect(await urlChamada()).toBe("https://disparoy-backend.onrender.com/api/sessao");
  });

  it("valor inválido cai em /api e denuncia no console", async () => {
    const console_ = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("VITE_API_URL", "VITE_API_URL=https://disparoy-backend.onrender.com/api");

    expect(await urlChamada()).toBe("/api/sessao");
    expect(console_).toHaveBeenCalledOnce();
  });
});
