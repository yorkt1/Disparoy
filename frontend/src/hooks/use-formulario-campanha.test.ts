import { describe, expect, it } from "vitest";
import { LIMITES, type Canal } from "@disparoy/dominio";
import {
  avaliarEtapas,
  contatosPorDia,
  estadoInicial,
  proximoDiaDeDisparo,
  publicoAchatado,
  reducer,
  type ContatoPublico,
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
    dias: [dia(null, [contato("+5548991237324", "Maria")])],
    ...patch,
  };
}

function contato(telefone: string, nome = "Alguém"): ContatoPublico {
  return { telefone, nome, variaveis: {} };
}

function dia(agendadaPara: string | null, publico: ContatoPublico[] = []) {
  return { id: `d-${agendadaPara ?? "1"}-${publico.length}`, agendadaPara, publico };
}

/** Data local no formato do input, daqui a N dias, às 10h. */
function daquiADias(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  d.setHours(10, 0, 0, 0);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00`;
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
  const inicial = estadoValido();
  const idDoDia1 = inicial.dias[0].id;

  it("deduplica por telefone antes de o operador ver o número", () => {
    // Deduplicar só no banco faria a tela prometer 1000 destinatários e o
    // relatório entregar 700, depois do disparo.
    const depois = reducer(inicial, {
      tipo: "publicoDoDia",
      id: idDoDia1,
      contatos: [
        contato("+5548991237324", "Maria"),
        contato("+5548991237324", "Maria de novo"),
        contato("+5548991237325", "João"),
      ],
    });
    expect(depois.dias[0].publico).toHaveLength(2);
  });

  it("mantém o primeiro de cada telefone repetido", () => {
    const depois = reducer(inicial, {
      tipo: "publicoDoDia",
      id: idDoDia1,
      contatos: [contato("+5548991237324", "Primeira"), contato("+5548991237324", "Segunda")],
    });
    expect(depois.dias[0].publico[0].nome).toBe("Primeira");
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
    const v = avaliarEtapas(estadoValido({ dias: [dia(null, [])] }));
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
    const v = avaliarEtapas(estadoValido({ dias: [dia(ontem, [contato("+5548991237324")])] }));
    expect(v.prontaParaDisparo).toBe(false);
    expect(v.pendencias.join(" ")).toMatch(/já passou/i);
  });

  it("agendamento no futuro passa", () => {
    const amanha = new Date(Date.now() + 86_400_000).toISOString();
    expect(
      avaliarEtapas(estadoValido({ dias: [dia(amanha, [contato("+5548991237324")])] }))
        .prontaParaDisparo,
    ).toBe(true);
  });

  it("sem agendamento é envio imediato, não pendência", () => {
    expect(avaliarEtapas(estadoValido({ dias: [dia(null, [contato("+55489912373")])] })).agendamento).toBe(
      true,
    );
  });

  it("junta TODAS as pendências, não só a primeira", () => {
    // O painel lateral lista o que falta. Parar na primeira faria o operador
    // corrigir, clicar, descobrir a segunda, e repetir.
    const v = avaliarEtapas(estadoValido({ nome: "", canaisIds: [], dias: [dia(null, [])] }));
    expect(v.pendencias.length).toBeGreaterThanOrEqual(3);
  });
});

/**
 * A campanha dividida pela semana.
 *
 * O que se protege aqui é o calendário: clicar em "adicionar dia" cinco vezes
 * tem de dar cinco dias seguidos, sem domingo e sem repetir data. Errar isso
 * não produz erro nenhum — produz duas planilhas saindo no mesmo dia, ou uma
 * saindo num domingo, e ninguém descobre antes das mensagens.
 */
describe("dias de disparo", () => {
  it("pula domingo ao avançar", () => {
    // 05/09/2026 é um sábado; o próximo dia de disparo é a segunda.
    const sabado = new Date(2026, 8, 5, 10, 0, 0, 0);
    expect(sabado.getDay()).toBe(6);

    const seguinte = proximoDiaDeDisparo(sabado);
    expect(seguinte.getDay()).toBe(1);
    expect(seguinte.getDate()).toBe(7);
  });

  it("sábado continua valendo — só domingo sai", () => {
    const sexta = new Date(2026, 8, 4, 10, 0, 0, 0);
    expect(proximoDiaDeDisparo(sexta).getDay()).toBe(6);
  });

  it("vira o mês sem conta de calendário", () => {
    // 30/09/2026 é quarta; o dia seguinte é 1º de outubro.
    const fimDoMes = new Date(2026, 8, 30, 10, 0, 0, 0);
    const seguinte = proximoDiaDeDisparo(fimDoMes);
    expect(seguinte.getMonth()).toBe(9);
    expect(seguinte.getDate()).toBe(1);
  });

  it("cada clique acrescenta UM dia, sem repetir data", () => {
    // O bug que isto pega: partir de "hoje" em vez do último dia faria o
    // segundo clique devolver a mesma data do primeiro.
    let estado = estadoValido({ dias: [dia(daquiADias(1), [contato("+5548991237324")])] });
    for (let i = 0; i < 4; i += 1) estado = reducer(estado, { tipo: "adicionarDia" });

    expect(estado.dias).toHaveLength(5);
    const datas = estado.dias.map((d) => d.agendadaPara);
    expect(new Set(datas).size).toBe(5);

    // Estritamente crescentes, e nenhuma num domingo.
    for (let i = 1; i < datas.length; i += 1) {
      expect(new Date(datas[i]!).getTime()).toBeGreaterThan(new Date(datas[i - 1]!).getTime());
      expect(new Date(datas[i]!).getDay()).not.toBe(0);
    }
  });

  it("o dia novo herda o horário do anterior", () => {
    const comHora = daquiADias(1).replace("T10:00", "T14:30");
    const estado = reducer(estadoValido({ dias: [dia(comHora, [contato("+551199999999")])] }), {
      tipo: "adicionarDia",
    });
    expect(estado.dias[1].agendadaPara).toContain("T14:30");
  });

  it("voltar para envio imediato colapsa num dia só", () => {
    // Guardar os dias escondidos faria as planilhas de todos eles saírem
    // juntas no disparo imediato.
    let estado = estadoValido({ dias: [dia(daquiADias(1), [contato("+5548991237324")])] });
    estado = reducer(estado, { tipo: "adicionarDia" });
    expect(estado.dias).toHaveLength(2);

    estado = reducer(estado, { tipo: "agendamento", valor: null });
    expect(estado.dias).toHaveLength(1);
    expect(estado.dias[0].agendadaPara).toBeNull();
  });

  it("o dia 1 não pode ser removido — ele é a campanha", () => {
    const estado = estadoValido();
    expect(reducer(estado, { tipo: "removerDia", id: estado.dias[0].id }).dias).toHaveLength(1);
  });
});

describe("público espalhado pelos dias", () => {
  it("o mesmo telefone em dois dias recebe uma vez só, no mais cedo", () => {
    // Receber duas vezes é o que faz o contato denunciar o número.
    const dias = [
      dia(daquiADias(1), [contato("+5548991237324", "Maria")]),
      dia(daquiADias(2), [contato("+5548991237324", "Maria de novo"), contato("+5511999999999")]),
    ];

    const achatado = publicoAchatado(dias);
    expect(achatado).toHaveLength(2);
    expect(achatado[0].nome).toBe("Maria");
    // Do dia 1: quem manda nele é o `agendadaPara` da campanha.
    expect(achatado[0].liberarEm).toBeNull();
    expect(contatosPorDia(dias)).toEqual([1, 1]);
  });

  it("os dias 2 em diante carregam liberarEm em ISO", () => {
    const dias = [
      dia(daquiADias(1), [contato("+551111111111")]),
      dia(daquiADias(2), [contato("+552222222222")]),
    ];
    expect(publicoAchatado(dias)[1].liberarEm).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("dia sem contato barra o disparo", () => {
    // Quase sempre é planilha que ficou faltando, e o operador só descobriria
    // no dia em que nada saiu.
    const v = avaliarEtapas(
      estadoValido({
        dias: [dia(daquiADias(1), [contato("+551111111111")]), dia(daquiADias(2), [])],
      }),
    );
    expect(v.prontaParaDisparo).toBe(false);
    expect(v.pendencias.join(" ")).toMatch(/dia 2/i);
  });

  it("dia fora de ordem barra", () => {
    // As duas levas viram uma só, na data mais antiga — uma campanha "de dois
    // dias" saindo inteira numa tarde.
    const v = avaliarEtapas(
      estadoValido({
        dias: [
          dia(daquiADias(3), [contato("+551111111111")]),
          dia(daquiADias(2), [contato("+552222222222")]),
        ],
      }),
    );
    expect(v.prontaParaDisparo).toBe(false);
    expect(v.pendencias.join(" ")).toMatch(/depois do anterior/i);
  });

  it("conta o total somando os dias", () => {
    const v = avaliarEtapas(
      estadoValido({
        dias: [
          dia(daquiADias(1), [contato("+551111111111")]),
          dia(daquiADias(2), [contato("+552222222222")]),
        ],
      }),
    );
    expect(v.contatosElegiveis).toBe(2);
    expect(v.prontaParaDisparo).toBe(true);
  });
});

describe("cadência automática", () => {
  const muitos = Array.from({ length: 1500 }, (_, i) =>
    contato(`+5548${String(i).padStart(9, "0")}`),
  );

  it("a faixa acompanha o tamanho da leva", () => {
    const estado = estadoValido();
    const depois = reducer(estado, {
      tipo: "publicoDoDia",
      id: estado.dias[0].id,
      contatos: muitos,
    });
    expect(depois.intervaloEntreContatos).toEqual({ minSegundos: 210, maxSegundos: 240 });
  });

  it("escrever à mão desliga o automático", () => {
    // Os dois ligados fariam o número recém-digitado ser sobrescrito no
    // próximo carregamento de planilha.
    const depois = reducer(estadoValido(), {
      tipo: "intervaloContatos",
      valor: { minSegundos: 15, maxSegundos: 45 },
    });
    expect(depois.cadenciaAutomatica).toBe(false);
    expect(depois.intervaloEntreContatos).toEqual({ minSegundos: 15, maxSegundos: 45 });
  });

  it("no manual, mexer no público não mexe na faixa", () => {
    const estado = estadoValido({
      cadenciaAutomatica: false,
      intervaloEntreContatos: { minSegundos: 15, maxSegundos: 45 },
    });
    const depois = reducer(estado, {
      tipo: "publicoDoDia",
      id: estado.dias[0].id,
      contatos: [contato("+551111111111"), contato("+552222222222")],
    });
    expect(depois.intervaloEntreContatos).toEqual({ minSegundos: 15, maxSegundos: 45 });
  });

  it("religar recalcula na hora", () => {
    const estado = estadoValido({
      cadenciaAutomatica: false,
      intervaloEntreContatos: { minSegundos: 15, maxSegundos: 45 },
    });
    const depois = reducer(estado, { tipo: "cadenciaAutomatica", valor: true });
    expect(depois.intervaloEntreContatos.minSegundos).toBeGreaterThanOrEqual(90);
  });

  it("dimensiona pelo MAIOR dia, não pela média", () => {
    // O dia mais pesado é o de maior risco para o número; a média o deixaria
    // andando rápido demais.
    let depois = reducer(estadoValido(), { tipo: "agendamento", valor: daquiADias(1) });
    depois = reducer(depois, { tipo: "adicionarDia" });
    depois = reducer(depois, { tipo: "publicoDoDia", id: depois.dias[1].id, contatos: muitos });

    expect(depois.intervaloEntreContatos).toEqual({ minSegundos: 210, maxSegundos: 240 });
  });
});
