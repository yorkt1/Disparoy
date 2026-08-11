import { limparSessao, tokenAtual } from "./sessao";

/**
 * Cliente HTTP da API.
 *
 * Anexa o token da sessão em toda chamada e normaliza os erros: a API sempre
 * responde `{ erro, erros? }`, então o front nunca precisa adivinhar formato.
 */

const BASE = import.meta.env.VITE_API_URL ?? "/api";

export class ErroApi extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Erros por campo, quando a falha veio da validação. */
    readonly campos?: Record<string, string>,
  ) {
    super(message);
    this.name = "ErroApi";
  }

  /** Primeira mensagem de campo, útil para exibir num formulário. */
  get primeiroCampo(): string | null {
    const valores = Object.values(this.campos ?? {});
    return valores[0] ?? null;
  }
}

interface OpcoesRequisicao extends Omit<RequestInit, "body"> {
  corpo?: unknown;
  /** Envia FormData em vez de JSON (upload de planilha). */
  formulario?: FormData;
}

export async function chamarApi<T>(caminho: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  const { corpo, formulario, headers, ...resto } = opcoes;
  const token = tokenAtual();

  const cabecalhos: Record<string, string> = {
    ...(headers as Record<string, string>),
  };
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  // FormData define o próprio Content-Type com o boundary; forçar quebra o upload.
  if (corpo !== undefined && !formulario) cabecalhos["Content-Type"] = "application/json";

  const resposta = await fetch(`${BASE}${caminho}`, {
    ...resto,
    headers: cabecalhos,
    body: formulario ?? (corpo !== undefined ? JSON.stringify(corpo) : undefined),
  });

  if (resposta.status === 204) return undefined as T;

  const texto = await resposta.text();
  let dados: unknown = null;
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch {
      // Resposta não-JSON (proxy fora do ar, HTML de erro): não deixa o
      // JSON.parse estourar sem contexto — vira um ErroApi legível.
      if (!resposta.ok) {
        throw new ErroApi(`Resposta inesperada do servidor (${resposta.status}).`, resposta.status);
      }
      return undefined as T;
    }
  }

  if (!resposta.ok) {
    // 401 com token no bolso é sessão morta (expirada, perfil excluído,
    // JWT_SECRET trocado). Limpar aqui faz o provider redirecionar para o
    // login em vez de deixar a tela repetindo a chamada.
    if (resposta.status === 401 && token) limparSessao();

    const c = dados as { erro?: string; erros?: Record<string, string> } | null;
    throw new ErroApi(c?.erro ?? `Erro ${resposta.status}.`, resposta.status, c?.erros);
  }

  return dados as T;
}

export const api = {
  get: <T>(caminho: string) => chamarApi<T>(caminho),
  post: <T>(caminho: string, corpo?: unknown) => chamarApi<T>(caminho, { method: "POST", corpo }),
  patch: <T>(caminho: string, corpo?: unknown) => chamarApi<T>(caminho, { method: "PATCH", corpo }),
  delete: <T>(caminho: string) => chamarApi<T>(caminho, { method: "DELETE" }),
  upload: <T>(caminho: string, formulario: FormData) =>
    chamarApi<T>(caminho, { method: "POST", formulario }),
};
