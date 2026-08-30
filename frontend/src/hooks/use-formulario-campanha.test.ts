import { describe, expect, it } from "vitest";
import { LIMITES, type Canal } from "@disparoy/dominio";
import {
  avaliarEtapas,
  estadoInicial,
  reducer,
  type EstadoCampanha,
} from "./use-formulario-campanha";

/**
 * O guardião do disparo.
 *
 * `avaliarEtapas` é o que decide se uma campanha pode sair, e o reducer é o que
 * monta o estado que ela julga. Os dois são função pura — testados aqui sem
 * jsdom, que é o ambiente do resto deste arquivo de configuração.
 *
 * O que se protege: nada dispara pela metade. Campanha sem canal, sem
 * destinatário, com mensagem vazia ou com data que já passou tem de ficar
 * barrada ANTES do clique, com a pendência escrita na tela — não virar erro da
 * API depois que o operador já achou que enviou.
 */

function canal(id: string): Canal {
  return {
    id,
    nome: `Canal ${id}`,
    numero: "5548991237324",
    status: "conectado",
    tipoConexao: "qrcode",
  } as Canal;
}

/** Um estado que passa em tudo — cada teste estraga só o que quer provar. */
function estadoValido(patch: Partial<EstadoCampanha> = {}): EstadoCampanha {
  return {
    ...estadoInicial([canal("c1")]),
    nome: "Black Friday",
    sequencia: [{ id: "m1", tipo: "texto", corpo: "Oi" }],
    publico: [{ telefone: "+5548991237324", nome: "Maria", variaveis: {} }],
    ...patch,
  };
}

describe("estadoInicial", () => {
  it("com um canal só, ele já vem marcado — não há escolha a fazer", () => {
    expect(estadoInicial([canal("c1")]).canaisIds).toEqual(["c1"]);
  });

  it("com dois canais, nenhum vem marcado", () => {
    // Um padrão silencioso mandaria a campanha pelo número errado, e o
    // operador só descobriria depois de disparar.
    expect(estadoInicial([canal("c1"), canal("c2")]).canaisIds).toEqual([]);
  });

  it("nasce com um passo de texto — a sequência nunca é vazia", () => {
    const inicial = estadoInicial([]);
    expect(inicial.sequencia).toHaveLength(1);
    expect(inicial.sequencia[0].tipo).toBe("texto");
  });
});

describe("reducer — sequência", () => {
  it("a última mensagem não pode ser removida", () => {
    // Sem passo nenhum não há o que disparar.
    const antes = estadoValido();
    const depois = reducer(antes, { tipo: "removerMensagem", id: "m1" });
    expect(depois.sequencia).toHaveLength(1);
  });

  it("com duas, remover funciona", () => {
    const antes = estadoValido({
      sequencia: [
        { id: "m1", tipo: "texto", corpo: "a" },
        { id: "m2", tipo: "texto", corpo: "b" },
      ],
    });
    expect(reducer(antes, { tipo: "removerMensagem", id: "m1" }).sequencia).toHaveLength(1);
  });

  it("não passa do teto de mensagens por contato", () => {
    const cheia = Array.from({ length: LIMITES.maxMensagensPorContato }, (_, i) => ({
      id: `m${i}`,
      tipo: "texto" as const,
      corpo: "x",
    }));
    const depois = reducer(estadoValido({ sequencia: cheia }), { tipo: "adicionarMensagem" });
    expect(depois.sequencia).toHaveLength(LIMITES.maxMensagensPorContato);
  });

  it("mover para fora das bordas não embaralha a lista", () => {
    const antes = estadoValido({
      sequencia: [
        { id: "m1", tipo: "texto", corpo: "a" },
        { id: "m2", tipo: "texto", corpo: "b" },
      ],
    });
    const paraCima = reducer(antes, { tipo: "moverMensagem", id: "m1", direcao: -1 });
    expect(paraCima.sequencia.map((m) => m.id)).toEqual(["m1", "m2"]);
  });

  it("mover troca a ordem de verdade", () => {
    const antes = estadoValido({
      sequencia: [
        { id: "m1", tipo: "texto", corpo: "a" },
        { id: "m2", tipo: "texto", corpo: "b" },
      ],
    });
    const depois = reducer(antes, { tipo: "moverMensagem", id: "m1", direcao: 1 });
    expect(depois.sequencia.map((m) => m.id)).toEqual(["m2", "m1"]);
  });
});

describe("reducer — público", () => {
  it("deduplica por telefone antes de o operador ver o número", () => {
    // Deduplicar só no banco faria a tela prometer 1000 destinatários e o
    // relatório entregar 700, depois do disparo.
    const depois = reducer(estadoValido(), {
      tipo: "publico",
      contatos: [
        { telefone: "+5548991237324", nome: "Maria", variaveis: {} },
        { telefone: "+5548991237324", nome: "Maria de novo", variaveis: {} },
        { telefone: "+5548991237325", nome: "João", variaveis: {} },
      ],
    });
    expect(depois.publico).toHaveLength(2);
  });

  it("mantém o primeiro de cada telefone repetido", () => {
    const depois = reducer(estadoValido(), {
      tipo: "publico",
      contatos: [
        { telefone: "+5548991237324", nome: "Primeira", variaveis: {} },
        { telefone: "+5548991237324", nome: "Segunda", variaveis: {} },
      ],
    });
    expect(depois.publico[0].nome).toBe("Primeira");
  });
});

describe("reducer — nome e canais", () => {
  it("o nome é cortado no limite, não recusado depois pela API", () => {
    const longo = "x".repeat(LIMITES.maxCaracteresNomeCampanha + 50);
    const depois = reducer(estadoValido(), { tipo: "nome", valor: longo });
    expect(depois.nome).toHaveLength(LIMITES.maxCaracteresNomeCampanha);
  });

  it("alternar canal marca e desmarca", () => {
    const marcado = reducer(estadoValido({ canaisIds: [] }), {
      tipo: "alternarCanal",
      id: "c1",
    });
    expect(marcado.canaisIds).toEqual(["c1"]);
    expect(reducer(marcado, { tipo: "alternarCanal", id: "c1" }).canaisIds).toEqual([]);
  });
});

describe("avaliarEtapas — o que barra o disparo", () => {
  it("um estado completo está pronto", () => {
    const v = avaliarEtapas(estadoValido());
    expect(v.prontaParaDisparo).toBe(true);
    expect(v.pendencias).toEqual([]);
  });

  it("nome curto barra", () => {
    const v = avaliarEtapas(estadoValido({ nome: "ab" }));
    expect(v.prontaParaDisparo).toBe(false);
    expect(v.pendencias.join(" ")).toMatch(/nome/i);
  });

  it("sem canal barra", () => {
    const v = avaliarEtapas(estadoValido({ canaisIds: [] }));
    expect(v.prontaParaDisparo).toBe(false);
    expect(v.pendencias.join(" ")).toMatch(/canal/i);
  });

  it("sem destinatário barra — é o que impede disparar para ninguém", () => {
    const v = avaliarEtapas(estadoValido({ publico: [] }));
    expect(v.prontaParaDisparo).toBe(false);
    expect(v.contatosElegiveis).toBe(0);
  });

  it("mensagem de texto vazia barra", () => {
    const v = avaliarEtapas(
      estadoValido({ sequencia: [{ id: "m1", tipo: "texto", corpo: "   " }] }),
    );
    expect(v.prontaParaDisparo).toBe(false);
    expect(v.pendencias.join(" ")).toMatch(/vazias/i);
  });

  it("passo de mídia sem arquivo barra", () => {
    // Corpo preenchido não salva um passo de mídia: o que falta é o anexo.
    const v = avaliarEtapas(
      estadoValido({ sequencia: [{ id: "m1", tipo: "midia", corpo: "legenda" }] }),
    );
    expect(v.prontaParaDisparo).toBe(false);
  });

  it("passo de mídia com arquivo passa, mesmo sem legenda", () => {
    const v = avaliarEtapas(
      estadoValido({
        sequencia: [
          {
            id: "m1",
            tipo: "midia",
            corpo: "",
            midia: { tipo: "imagem", url: "https://x/y.jpg", nomeArquivo: "y.jpg" },
          },
        ],
      }),
    );
    expect(v.prontaParaDisparo).toBe(true);
  });

  it("intervalo com máximo menor que o mínimo barra", () => {
    const v = avaliarEtapas(
      estadoValido({ intervaloEntreContatos: { minSegundos: 60, maxSegundos: 30 } }),
    );
    expect(v.prontaParaDisparo).toBe(false);
    expect(v.pendencias.join(" ")).toMatch(/intervalo entre contatos/i);
  });

  it("intervalo negativo barra", () => {
    const v = avaliarEtapas(
      estadoValido({ intervaloEntreMensagens: { minSegundos: -5, maxSegundos: 10 } }),
    );
    expect(v.prontaParaDisparo).toBe(false);
  });

  it("intervalo quebrado barra — segundo fracionário não é intervalo", () => {
    const v = avaliarEtapas(
      estadoValido({ intervaloEntreContatos: { minSegundos: 1.5, maxSegundos: 10 } }),
    );
    expect(v.prontaParaDisparo).toBe(false);
  });

  it("agendamento no passado barra", () => {
    const ontem = new Date(Date.now() - 86_400_000).toISOString();
    const v = avaliarEtapas(estadoValido({ agendadaPara: ontem }));
    expect(v.prontaParaDisparo).toBe(false);
    expect(v.pendencias.join(" ")).toMatch(/já passou/i);
  });

  it("agendamento no futuro passa", () => {
    const amanha = new Date(Date.now() + 86_400_000).toISOString();
    expect(avaliarEtapas(estadoValido({ agendadaPara: amanha })).prontaParaDisparo).toBe(true);
  });

  it("sem agendamento é envio imediato, não pendência", () => {
    expect(avaliarEtapas(estadoValido({ agendadaPara: null })).agendamento).toBe(true);
  });

  it("junta TODAS as pendências, não só a primeira", () => {
    // O painel lateral lista o que falta. Parar na primeira faria o operador
    // corrigir, clicar, descobrir a segunda, e repetir.
    const v = avaliarEtapas(estadoValido({ nome: "", canaisIds: [], publico: [] }));
    expect(v.pendencias.length).toBeGreaterThanOrEqual(3);
  });
});
