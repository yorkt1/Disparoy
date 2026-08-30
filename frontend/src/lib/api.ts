import { limparSessao, tokenAtual } from "./sessao";

/**
 * Cliente HTTP da API.
 *
 * Anexa o token da sessão em toda chamada e normaliza os erros: a API sempre
 * responde `{ erro, erros? }`, então o front nunca precisa adivinhar formato.
 */

/**
 * Sem `VITE_API_URL` o painel usa `/api`, que o `vercel.json` encaminha para a
 * API no Render e o proxy do Vite encaminha para o backend local. A variável só
 * existe para apontar o dev local direto para produção.
 *
 * Quando existe, precisa ser URL absoluta ou caminho iniciado por `/`. Valor
 * fora disso é descartado: o Vite grava o valor dentro do bundle no build, e um
 * valor inválido não falha em lugar nenhum — vira caminho relativo e o `fetch`
 * sai para a origem do próprio painel. Foi o que aconteceu quando a variável
 * foi salva na Vercel com o nome colado no valor
 * (`VITE_API_URL=https://disparoy-backend.onrender.com/api`): o `POST /sessao`
 * foi parar no host estático da Vercel, que respondeu 405 — status que não diz
 * nada sobre configuração e custou horas para ser lido como tal. Cair no `/api`
 * mantém o login de pé e deixa o motivo no console de quem for arrumar.
 */
const BASE_PADRAO = "/api";

function baseDaApi(): string {
  const bruto = import.meta.env.VITE_API_URL?.trim();
  if (!bruto) return BASE_PADRAO;

  if (!/^https?:\/\//i.test(bruto) && !bruto.startsWith("/")) {
    console.error(
      `VITE_API_URL inválida: ${JSON.stringify(bruto)}. ` +
        `Esperava URL absoluta (https://…) ou caminho iniciado por "/". ` +
        `Usando ${BASE_PADRAO}.`,
    );
    return BASE_PADRAO;
  }

  const semBarraFinal = bruto.replace(/\/+$/, "");
  if (!semBarraFinal) return BASE_PADRAO;
  if (semBarraFinal.endsWith("/api")) return semBarraFinal;

  return `${semBarraFinal}/api`;
}

const BASE = baseDaApi();

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

/**
 * Mensagem de erro legível, preferindo o texto que a API mandou.
 *
 * Mora aqui, junto de `ErroApi`, porque a ordem de preferência é conhecimento
 * sobre o formato de erro da API: erro de campo primeiro (é o que diz O QUE
 * corrigir), depois a mensagem geral, e o padrão só quando nem Error é. Estava
 * copiada em quatro telas, e cópia de regra é como as quatro deixam de
 * concordar sem ninguém decidir isso.
 */
export function mensagemDe(e: unknown, padrao: string): string {
  if (e instanceof ErroApi) return e.primeiroCampo ?? e.message;
  return e instanceof Error ? e.message : padrao;
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
    // 401 é sessão morta (expirada, perfil excluído, JWT_SECRET trocado).
    // Mesmo sem token, a sessão pode ter expirado entre a renderização e esta
    // chamada; limpar aqui acorda o provider e interrompe o polling.
    if (resposta.status === 401) limparSessao();

    const c = dados as { erro?: string; erros?: Record<string, string> } | null;
    throw new ErroApi(c?.erro ?? `Erro ${resposta.status}.`, resposta.status, c?.erros);
  }

  return dados as T;
}

/**
 * Baixa um arquivo de uma rota autenticada.
 *
 * Um `<a download>` não serve: o navegador não manda o header Authorization
 * numa navegação, e a rota responderia 401. Por isso o arquivo é buscado por
 * fetch, virado em blob e entregue por um link sintético.
 *
 * Devolve o que veio em `X-Total-Contatos` quando existir — o corpo é binário
 * e não tem onde carregar essa contagem.
 */
export async function baixarArquivo(
  caminho: string,
  nomePadrao: string,
): Promise<{ total: number | null }> {
  const token = tokenAtual();
  const resposta = await fetch(`${BASE}${caminho}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!resposta.ok) {
    if (resposta.status === 401 && token) limparSessao();
    // O erro vem em JSON mesmo numa rota que normalmente devolve binário.
    let mensagem = `Erro ${resposta.status}.`;
    let campos: Record<string, string> | undefined;
    try {
      const c = (await resposta.json()) as { erro?: string; erros?: Record<string, string> };
      mensagem = c?.erro ?? mensagem;
      campos = c?.erros;
    } catch {
      /* resposta sem corpo legível: fica a mensagem genérica */
    }
    throw new ErroApi(mensagem, resposta.status, campos);
  }

  const blob = await resposta.blob();
  const nome = nomeDoCabecalho(resposta.headers.get("Content-Disposition")) ?? nomePadrao;
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Sem o revoke o blob fica na memória da aba até ela fechar — e uma agenda
  // grande baixada algumas vezes não é pouca coisa.
  URL.revokeObjectURL(url);

  const total = resposta.headers.get("X-Total-Contatos");
  return { total: total === null ? null : Number(total) };
}

/** `attachment; filename="contatos-gui.xlsx"` -> `contatos-gui.xlsx` */
function nomeDoCabecalho(cabecalho: string | null): string | null {
  const m = /filename="?([^";]+)"?/i.exec(cabecalho ?? "");
  return m?.[1]?.trim() || null;
}

export const api = {
  get: <T>(caminho: string) => chamarApi<T>(caminho),
  post: <T>(caminho: string, corpo?: unknown) => chamarApi<T>(caminho, { method: "POST", corpo }),
  patch: <T>(caminho: string, corpo?: unknown) => chamarApi<T>(caminho, { method: "PATCH", corpo }),
  delete: <T>(caminho: string) => chamarApi<T>(caminho, { method: "DELETE" }),
  upload: <T>(caminho: string, formulario: FormData) =>
    chamarApi<T>(caminho, { method: "POST", formulario }),
};
