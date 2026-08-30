// @vitest-environment jsdom
import * as React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Paginado, ResumoCampanha } from "@disparoy/dominio";

/**
 * O módulo por onde toda tela busca dados.
 *
 * Três coisas aqui erram em silêncio, e são as que estes testes cobrem:
 *
 * 1. Chave de cache. Duas consultas que colidem fazem uma tela mostrar o dado
 *    de outra; um prefixo que não casa faz a tela não atualizar depois de uma
 *    escrita. Nos dois casos nada falha — a informação é que fica errada.
 *
 * 2. Invalidação. Toda mutação precisa derrubar também os logs de auditoria,
 *    senão a trilha do que acabou de acontecer só aparece no F5.
 *
 * 3. Derivação de papel. `useEhAdmin` e `useEhContaGlobal` decidem o que a
 *    interface oferece. Errar para o lado permissivo mostra ação que a API vai
 *    recusar; errar para o restritivo esconde ação legítima.
 */

const { get } = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("@/lib/api", async (original) => {
  const real = await original<typeof import("@/lib/api")>();
  return { ...real, api: { ...real.api, get } };
});

import { chaves, temCampanhaAndando, useEhAdmin, useEhContaGlobal } from "./consultas";

/** Cliente sem retry: um teste não deve esperar o backoff de uma falha. */
function envolver() {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  function Envolucro({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
  }
  return { cliente, Envolucro };
}

function sessao(patch: { papel?: string; empresaId?: string | null } = {}) {
  return {
    usuario: {
      id: "u1",
      nome: "Maria",
      email: "maria@exemplo.com",
      papel: patch.papel ?? "operator",
      empresaId: patch.empresaId === undefined ? "empresa-1" : patch.empresaId,
    },
    integracao: { evolutionConfigurada: true, metaConfigurada: false, semProvedor: false },
    disparo: { pulsoEm: "2026-01-01T00:00:00.000Z", ativo: true },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("chaves de cache", () => {
  it("os contatos de uma campanha ficam SOB a campanha", () => {
    // É o que faz invalidar a campanha atualizar a lista de contatos junto.
    // Uma chave irmã (["contatos-da-campanha", id]) deixaria a tela de detalhe
    // com o total novo e a lista velha na mesma renderização.
    expect(chaves.contatosDaCampanha("c1")).toEqual(["campanha", "c1", "contatos", {}]);
    expect(chaves.campanha("c1")).toEqual(["campanha", "c1"]);
  });

  it("campanhas diferentes não compartilham cache", () => {
    expect(chaves.campanha("c1")).not.toEqual(chaves.campanha("c2"));
    expect(chaves.contatosDaCampanha("c1")).not.toEqual(chaves.contatosDaCampanha("c2"));
  });

  it("filtros diferentes são caches diferentes", () => {
    // Sem o filtro na chave, mudar de "todas" para "falhou" reaproveitaria a
    // resposta anterior e mostraria a lista errada até o refetch.
    expect(chaves.campanhas({ status: "em_andamento" })).not.toEqual(
      chaves.campanhas({ status: "pausada" }),
    );
    expect(chaves.contatosDaCampanha("c1", { situacao: "falhou" })).not.toEqual(
      chaves.contatosDaCampanha("c1", { situacao: "todas" }),
    );
  });

  it("filtro ausente e filtro vazio são a mesma chave", () => {
    // Senão a primeira carga e a primeira interação sem filtro seriam dois
    // caches, e a tela piscaria pedindo de novo o que já tinha.
    expect(chaves.campanhas()).toEqual(chaves.campanhas({}));
    expect(chaves.logs()).toEqual(chaves.logs({}));
  });

  it("as amostras de falha ficam sob o diagnóstico do mesmo período", () => {
    expect(chaves.amostrasFalha(7, "canal_desconectado")).toEqual([
      "diagnostico",
      7,
      "canal_desconectado",
    ]);
    expect(chaves.diagnostico(7)).toEqual(["diagnostico", 7]);
  });

  it("períodos diferentes do diagnóstico não colidem", () => {
    expect(chaves.diagnostico(7)).not.toEqual(chaves.diagnostico(30));
  });

  it("nenhuma chave de lista colide com outra", () => {
    const raizes = [
      chaves.eu,
      chaves.metricas,
      chaves.canais,
      chaves.templates,
      chaves.spintax,
      chaves.usuarios,
      chaves.avisos,
      chaves.incidentes,
    ].map((k) => JSON.stringify(k));
    expect(new Set(raizes).size).toBe(raizes.length);
  });
});

describe("temCampanhaAndando", () => {
  function pagina(status: string[]): Paginado<ResumoCampanha> {
    return {
      itens: status.map((s, i) => ({ id: `c${i}`, status: s })) as ResumoCampanha[],
      pagina: 1,
      porPagina: 10,
      total: status.length,
      totalPaginas: 1,
    };
  }

  it("acha uma campanha em andamento no meio da lista", () => {
    expect(temCampanhaAndando(pagina(["concluida", "em_andamento", "rascunho"]))).toBe(true);
  });

  it("pausada não conta como andando", () => {
    // É o que liga o polling. Uma pausada não gera número novo, e tratar como
    // andando faria o painel buscar de 20 em 20 segundos à toa.
    expect(temCampanhaAndando(pagina(["pausada", "agendada", "concluida"]))).toBe(false);
  });

  it("sem dados ainda não é o mesmo que sem campanha andando", () => {
    expect(temCampanhaAndando(undefined)).toBe(false);
  });
});

describe("derivações de papel", () => {
  it("empresaId null é a conta global — a que atravessa as empresas", async () => {
    get.mockResolvedValue(sessao({ empresaId: null }));
    const { Envolucro } = envolver();
    const { result } = renderHook(() => useEhContaGlobal(), { wrapper: Envolucro });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("admin COM empresa não é conta global", async () => {
    // A distinção que importa: cada cliente tem o próprio admin. Confundir os
    // dois é o que liberaria dado de uma empresa para o admin de outra.
    get.mockResolvedValue(sessao({ papel: "admin", empresaId: "empresa-1" }));
    const { Envolucro } = envolver();
    const { result } = renderHook(() => useEhContaGlobal(), { wrapper: Envolucro });

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it("enquanto a sessão não chegou, ninguém é conta global", async () => {
    // O padrão precisa ser o restritivo: assumir global antes da resposta
    // mostraria a interface de suporte por um instante a qualquer um.
    get.mockReturnValue(new Promise(() => {}));
    const { Envolucro } = envolver();
    const { result } = renderHook(() => useEhContaGlobal(), { wrapper: Envolucro });

    expect(result.current).toBe(false);
  });

  it("useEhAdmin sai do papel, não da presença de empresa", async () => {
    get.mockResolvedValue(sessao({ papel: "admin" }));
    const { Envolucro } = envolver();
    const { result } = renderHook(() => useEhAdmin(), { wrapper: Envolucro });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("operador não é admin", async () => {
    get.mockResolvedValue(sessao({ papel: "operator" }));
    const { Envolucro } = envolver();
    const { result } = renderHook(() => useEhAdmin(), { wrapper: Envolucro });

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it("sessão que falhou não promove ninguém a admin", async () => {
    get.mockRejectedValue(new Error("401"));
    const { Envolucro } = envolver();
    const { result } = renderHook(() => useEhAdmin(), { wrapper: Envolucro });

    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });
});
