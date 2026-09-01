import * as React from "react";
import {
  INTERVALO_PADRAO_ENTRE_MENSAGENS,
  LIMITES,
  intervaloSugerido,
} from "@disparoy/dominio";
import type { Canal, IntervaloAleatorio, MensagemSequencia } from "@disparoy/dominio";
import { gerarId } from "@/lib/formato";

/**
 * Estado do formulário de campanha.
 *
 * As cinco etapas ficam todas na mesma tela, então não há "passo atual": o que
 * existe é um estado único e, para cada etapa, um veredito de preenchimento
 * que alimenta o marcador numerado e o painel de resumo.
 */

export interface EstadoCampanha {
  nome: string;
  canaisIds: string[];
  sequencia: MensagemSequencia[];
  intervaloEntreContatos: IntervaloAleatorio;
  intervaloEntreMensagens: IntervaloAleatorio;
  /**
   * A faixa entre contatos é calculada pelo tamanho da leva, não digitada.
   *
   * Padrão ligado: a 90–240 s fixos de antes, uma leva de 40 pessoas era
   * tratada com a mesma desconfiança de uma de 3 mil. Quem precisa de controle
   * fino desliga e escreve os números — testar com 2 contatos a 90 s são três
   * minutos parado só para ver se a mensagem saiu certa.
   */
  cadenciaAutomatica: boolean;
  validarNumeros: boolean;
  /**
   * Os dias do disparo. SEMPRE ao menos um.
   *
   * Substituiu o par `publico` + `agendadaPara`: uma campanha passou a poder
   * cobrir a semana, com uma planilha por dia. O dia 1 é a própria campanha —
   * a data dele é o `agendadaPara` que a API recebe, e `null` nele significa
   * "enviar agora". Os demais viram `liberarEm` nos contatos.
   *
   * Um array e não um `publico` solto mais uma lista de datas: com duas
   * estruturas casadas por índice, o dia errado num contato é a mensagem
   * saindo na terça para quem estava marcado para sexta.
   */
  dias: DiaDeDisparo[];
}

export interface DiaDeDisparo {
  id: string;
  /** Valor cru do <input type="datetime-local">; null só no dia 1, em envio imediato. */
  agendadaPara: string | null;
  /**
   * O público daquele dia, vindo de planilha ou colagem.
   *
   * Substituiu `listaId`: não há mais cadastro de contatos, então a lista de
   * destino nasce e morre com a campanha. O telefone já chega normalizado em
   * E.164 pelo domínio.
   */
  publico: ContatoPublico[];
}

export interface ContatoPublico {
  telefone: string;
  nome: string;
  variaveis: Record<string, string>;
}

/**
 * Hora em que um dia de disparo começa, quando ninguém escolheu outra.
 *
 * 10h é o pedido do operador, e tem lógica: cedo o bastante para a leva do dia
 * caber antes da noite, tarde o bastante para não chegar antes de a pessoa
 * abrir o WhatsApp.
 */
export const HORA_PADRAO_DO_DIA = 10;

export type AcaoCampanha =
  | { tipo: "nome"; valor: string }
  | { tipo: "alternarCanal"; id: string }
  | { tipo: "adicionarMensagem" }
  | { tipo: "removerMensagem"; id: string }
  | { tipo: "moverMensagem"; id: string; direcao: -1 | 1 }
  | { tipo: "atualizarMensagem"; id: string; campos: Partial<MensagemSequencia> }
  | { tipo: "intervaloContatos"; valor: IntervaloAleatorio }
  | { tipo: "intervaloMensagens"; valor: IntervaloAleatorio }
  | { tipo: "cadenciaAutomatica"; valor: boolean }
  | { tipo: "validarNumeros"; valor: boolean }
  | { tipo: "publicoDoDia"; id: string; contatos: ContatoPublico[] }
  | { tipo: "dataDoDia"; id: string; valor: string | null }
  | { tipo: "adicionarDia"; mesmoDia?: boolean }
  | { tipo: "removerDia"; id: string }
  | { tipo: "agendamento"; valor: string | null };

/**
 * Com um único canal conectado não há escolha a fazer: ele já nasce marcado.
 * Com dois ou mais, nenhum vem marcado — qual número usar é decisão do
 * operador, e um padrão silencioso mandaria a campanha pelo número errado.
 */
export function estadoInicial(canais: Canal[] = []): EstadoCampanha {
  return {
    nome: "",
    canaisIds: canais.length === 1 ? [canais[0].id] : [],
    sequencia: [{ id: gerarId("msg"), tipo: "texto", corpo: "" }],
    // Público vazio ainda: a faixa nasce no piso e sobe conforme a planilha
    // entra. `cadenciaAutomatica` liga por padrão — ver o campo.
    intervaloEntreContatos: intervaloSugerido(0),
    intervaloEntreMensagens: { ...INTERVALO_PADRAO_ENTRE_MENSAGENS },
    cadenciaAutomatica: true,
    validarNumeros: true,
    dias: [diaVazio(null)],
  };
}

function diaVazio(agendadaPara: string | null): DiaDeDisparo {
  return { id: gerarId("dia"), agendadaPara, publico: [] };
}

/** Data no formato do <input type="datetime-local"> (hora local, sem fuso). */
export function paraValorLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * O próximo dia de disparo depois deste — pulando domingo.
 *
 * Domingo fica de fora por decisão do operador: promoção que chega no domingo
 * é a que mais rende pedido de saída. Sábado continua valendo, então uma
 * semana de campanha tem seis dias, não cinco.
 *
 * `setDate` com valor acima do fim do mês vira o mês sozinho — 31/12 + 1 dá
 * 01/01 do ano seguinte, sem nenhuma conta de calendário aqui.
 */
export function proximoDiaDeDisparo(base: Date): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + 1);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  return d;
}

/**
 * O público inteiro da campanha, achatado e sem repetido, com o dia de cada um.
 *
 * Deduplica ENTRE os dias, e não só dentro de cada um: o mesmo número na
 * planilha de segunda e na de quinta receberia duas vezes, e mensagem repetida
 * em disparo é o que faz o contato denunciar o número. Vence a ocorrência mais
 * antiga — receber mais cedo é o desfecho seguro, e é a mesma regra que o
 * `distinct on` da `popular_publico_da_campanha` aplica do lado do banco.
 *
 * O dia 1 sai com `liberarEm: null` porque quem manda nele é o `agendadaPara`
 * da campanha; duplicar a data nos dois lugares seria criar a chance de eles
 * discordarem.
 */
export function publicoAchatado(
  dias: DiaDeDisparo[],
): (ContatoPublico & { liberarEm: string | null })[] {
  const vistos = new Set<string>();
  const saida: (ContatoPublico & { liberarEm: string | null })[] = [];

  dias.forEach((dia, indice) => {
    for (const contato of dia.publico) {
      if (vistos.has(contato.telefone)) continue;
      vistos.add(contato.telefone);
      saida.push({
        ...contato,
        liberarEm:
          indice === 0 || !dia.agendadaPara
            ? null
            : new Date(dia.agendadaPara).toISOString(),
      });
    }
  });

  return saida;
}

/** Quantos contatos cada dia realmente dispara, já descontado o repetido. */
export function contatosPorDia(dias: DiaDeDisparo[]): number[] {
  const vistos = new Set<string>();
  return dias.map((dia) => {
    let quantos = 0;
    for (const c of dia.publico) {
      if (vistos.has(c.telefone)) continue;
      vistos.add(c.telefone);
      quantos += 1;
    }
    return quantos;
  });
}

/**
 * A faixa que a campanha inteira usa, tirada do MAIOR dia.
 *
 * A campanha guarda um intervalo só, mas os dias podem ter tamanhos bem
 * diferentes. Usar o maior é o lado seguro: dimensionar pela média deixaria o
 * dia mais pesado — justamente o de maior risco para o número — andando rápido
 * demais. O custo é os dias menores irem mais devagar do que precisariam, que
 * não machuca ninguém.
 */
export function cadenciaDosDias(dias: DiaDeDisparo[]): IntervaloAleatorio {
  return intervaloSugerido(Math.max(0, ...contatosPorDia(dias)));
}

function mover<T>(lista: T[], de: number, para: number): T[] {
  if (para < 0 || para >= lista.length) return lista;
  const copia = [...lista];
  const [item] = copia.splice(de, 1);
  copia.splice(para, 0, item);
  return copia;
}

export function reducer(estado: EstadoCampanha, acao: AcaoCampanha): EstadoCampanha {
  switch (acao.tipo) {
    case "nome":
      return { ...estado, nome: acao.valor.slice(0, LIMITES.maxCaracteresNomeCampanha) };

    case "alternarCanal":
      return {
        ...estado,
        canaisIds: estado.canaisIds.includes(acao.id)
          ? estado.canaisIds.filter((id) => id !== acao.id)
          : [...estado.canaisIds, acao.id],
      };

    case "adicionarMensagem":
      if (estado.sequencia.length >= LIMITES.maxMensagensPorContato) return estado;
      return {
        ...estado,
        sequencia: [...estado.sequencia, { id: gerarId("msg"), tipo: "texto", corpo: "" }],
      };

    case "removerMensagem":
      // A sequência nunca fica vazia: sem passo nenhum não há o que disparar.
      if (estado.sequencia.length <= 1) return estado;
      return { ...estado, sequencia: estado.sequencia.filter((m) => m.id !== acao.id) };

    case "moverMensagem": {
      const i = estado.sequencia.findIndex((m) => m.id === acao.id);
      if (i < 0) return estado;
      return { ...estado, sequencia: mover(estado.sequencia, i, i + acao.direcao) };
    }

    case "atualizarMensagem":
      return {
        ...estado,
        sequencia: estado.sequencia.map((m) => (m.id === acao.id ? { ...m, ...acao.campos } : m)),
      };

    case "intervaloContatos":
      // Escrever à mão desliga o automático: os dois juntos fariam o número
      // recém-digitado ser sobrescrito no próximo carregamento de planilha.
      return { ...estado, intervaloEntreContatos: acao.valor, cadenciaAutomatica: false };

    case "intervaloMensagens":
      return { ...estado, intervaloEntreMensagens: acao.valor };

    case "cadenciaAutomatica":
      return {
        ...estado,
        cadenciaAutomatica: acao.valor,
        // Religar recalcula na hora, senão a tela seguiria mostrando a faixa
        // digitada com o rótulo "automático" em cima dela.
        intervaloEntreContatos: acao.valor
          ? cadenciaDosDias(estado.dias)
          : estado.intervaloEntreContatos,
      };

    case "validarNumeros":
      return { ...estado, validarNumeros: acao.valor };

    case "publicoDoDia": {
      // Deduplica por telefone aqui, e não só no banco: o operador precisa ver
      // o número REAL de destinatários antes de disparar, não descobrir depois
      // que 300 das 1000 linhas da planilha eram repetidas.
      const vistos = new Set<string>();
      const limpo = acao.contatos.filter((c) => {
        if (vistos.has(c.telefone)) return false;
        vistos.add(c.telefone);
        return true;
      });

      const dias = estado.dias.map((d) => (d.id === acao.id ? { ...d, publico: limpo } : d));
      return { ...estado, dias, ...recalcularCadencia(estado, dias) };
    }

    case "dataDoDia": {
      const dias = estado.dias.map((d) =>
        d.id === acao.id ? { ...d, agendadaPara: acao.valor } : d,
      );
      return { ...estado, dias };
    }

    case "adicionarDia": {
      const ultimo = estado.dias[estado.dias.length - 1];
      /*
       * A data do novo lote sai do último, não de hoje.
       *
       * Clicar cinco vezes precisa dar cinco datas seguidas. Partindo de hoje, o
       * segundo clique devolveria a mesma data do primeiro e o operador
       * montaria a semana inteira em cima de um dia só, sem nada na tela
       * dizendo isso — os dois campos mostrariam a mesma data, que é fácil de
       * ler como "ainda não atualizou".
       */
      const base = ultimo?.agendadaPara ? new Date(ultimo.agendadaPara) : comHoraPadrao(new Date());
      /*
       * Dois lotes no MESMO dia, algumas horas depois.
       *
       * Sem isto, a única forma de ter duas levas no mesmo dia era editar a
       * data inteira do lote novo à mão — e num `datetime-local` trocar a data
       * mantendo a hora é chato o bastante para a pessoa concluir que não dá.
       * Foi o que aconteceu com "20:30 e 20:40 na mesma campanha": o estado
       * sempre aceitou, a tela é que não oferecia caminho.
       *
       * Uma hora de distância é só o ponto de partida; a hora continua
       * editável, que é o campo fácil de mexer.
       */
      const proxima = acao.mesmoDia
        ? new Date(base.getTime() + 60 * 60 * 1000)
        : proximoDiaDeDisparo(base);

      const dias = [...estado.dias, diaVazio(paraValorLocal(proxima))];
      return { ...estado, dias, ...recalcularCadencia(estado, dias) };
    }

    case "removerDia": {
      // O dia 1 é a própria campanha: sem ele não há o que disparar, e a data
      // dele é o `agendadaPara` que a API recebe.
      if (estado.dias.length <= 1) return estado;
      const dias = estado.dias.filter((d) => d.id !== acao.id);
      if (dias.length === estado.dias.length) return estado;
      return { ...estado, dias, ...recalcularCadencia(estado, dias) };
    }

    case "agendamento": {
      /*
       * Voltar para "enviar agora" colapsa a campanha num dia só.
       *
       * Dias 2 em diante só existem com data, e a campanha imediata não tem
       * nenhuma. Guardá-los escondidos seria pior: o operador desmarcaria o
       * agendamento, dispararia, e as planilhas dos outros dias sairiam todas
       * juntas na mesma hora.
       */
      const dias =
        acao.valor === null
          ? [{ ...estado.dias[0], agendadaPara: null }]
          : estado.dias.map((d, i) => (i === 0 ? { ...d, agendadaPara: acao.valor } : d));
      return { ...estado, dias, ...recalcularCadencia(estado, dias) };
    }

    default:
      return estado;
  }
}

/** No automático, a faixa acompanha os dias; no manual, não se mexe nela. */
function recalcularCadencia(
  estado: EstadoCampanha,
  dias: DiaDeDisparo[],
): Partial<EstadoCampanha> {
  return estado.cadenciaAutomatica ? { intervaloEntreContatos: cadenciaDosDias(dias) } : {};
}

/** A mesma data, na hora em que um dia de disparo começa por padrão. */
function comHoraPadrao(d: Date): Date {
  const saida = new Date(d);
  saida.setHours(HORA_PADRAO_DO_DIA, 0, 0, 0);
  return saida;
}

export interface VereditoEtapas {
  nome: boolean;
  canais: boolean;
  sequencia: boolean;
  contatos: boolean;
  agendamento: boolean;
  /** Pendências mostradas no painel lateral antes de liberar o disparo. */
  pendencias: string[];
  prontaParaDisparo: boolean;
  /**
   * Quantos vão receber.
   *
   * É o tamanho do público informado. Quem pediu para sair só é descontado no
   * banco, na hora de materializar — o painel não guarda mais essa lista, e
   * fingir que sabe o número exato aqui seria mentir por antecipação.
   */
  contatosElegiveis: number;
  /** Repetidos que a colagem/planilha trazia e foram descartados. */
  contatosBloqueados: number;
}

export function avaliarEtapas(estado: EstadoCampanha): VereditoEtapas {
  const porDia = contatosPorDia(estado.dias);
  const contatosElegiveis = porDia.reduce((s, n) => s + n, 0);

  const nome = estado.nome.trim().length >= 3;
  const canais = estado.canaisIds.length > 0;
  const intervaloContatosValido =
    Number.isInteger(estado.intervaloEntreContatos.minSegundos) &&
    Number.isInteger(estado.intervaloEntreContatos.maxSegundos) &&
    estado.intervaloEntreContatos.minSegundos >= 0 &&
    estado.intervaloEntreContatos.maxSegundos >= estado.intervaloEntreContatos.minSegundos;
  const intervaloMensagensValido =
    Number.isInteger(estado.intervaloEntreMensagens.minSegundos) &&
    Number.isInteger(estado.intervaloEntreMensagens.maxSegundos) &&
    estado.intervaloEntreMensagens.minSegundos >= 0 &&
    estado.intervaloEntreMensagens.maxSegundos >= estado.intervaloEntreMensagens.minSegundos;
  const sequencia = estado.sequencia.every((m) =>
    m.tipo === "midia" ? Boolean(m.midia) : m.corpo.trim().length > 0,
  );
  const contatos = contatosElegiveis > 0;

  /*
   * Toda data preenchida tem de estar no futuro — não só a do dia 1.
   *
   * Dia vencido não dá erro em lugar nenhum do disparo: o contato apenas cai
   * na primeira leva. Quem montou a semana veria o dia 4 sair na segunda,
   * junto de tudo, sem nada explicando. É a mesma recusa que `agendadaPara`
   * já fazia, estendida aos dias que passaram a existir.
   */
  const datas = estado.dias.map((d) => d.agendadaPara);
  const agendamentoNoFuturo = datas.every((d) => !d || new Date(d).getTime() > Date.now());

  /*
   * Os dias precisam andar para frente.
   *
   * Editar a data do dia 2 para antes da do dia 1 é fácil de fazer sem
   * perceber, e o resultado não é erro nenhum: as duas levas viram uma só, na
   * data mais antiga. Uma campanha "de três dias" que sai inteira numa
   * tarde é exatamente o que a divisão existe para evitar.
   */
  const emOrdem = estado.dias.every((dia, i) => {
    if (i === 0 || !dia.agendadaPara) return true;
    const anterior = estado.dias[i - 1].agendadaPara;
    return !anterior || new Date(dia.agendadaPara).getTime() > new Date(anterior).getTime();
  });

  const diaVazio = porDia.some((n) => n === 0);

  const pendencias: string[] = [];
  if (!nome) pendencias.push("Dê um nome à campanha (mínimo 3 caracteres).");
  if (!canais) pendencias.push("Selecione ao menos um canal.");
  if (!intervaloContatosValido) {
    pendencias.push("Corrija o intervalo entre contatos: o máximo deve ser maior ou igual ao mínimo.");
  }
  if (!intervaloMensagensValido) {
    pendencias.push("Corrija o intervalo entre mensagens: o máximo deve ser maior ou igual ao mínimo.");
  }
  if (!sequencia) pendencias.push("Há mensagens vazias na sequência.");
  if (contatosElegiveis === 0) {
    pendencias.push("Adicione os contatos por planilha ou colando os números.");
  } else if (diaVazio) {
    // Dia sem ninguém não quebra o disparo, mas quase sempre é planilha que
    // ficou faltando — e o operador só descobriria no dia em que nada saiu.
    pendencias.push(
      `O dia ${porDia.findIndex((n) => n === 0) + 1} está sem contatos: carregue a planilha dele ou remova o dia.`,
    );
  }
  if (!agendamentoNoFuturo) pendencias.push("A data de agendamento já passou.");
  if (!emOrdem) pendencias.push("Cada dia precisa vir depois do anterior.");

  return {
    nome,
    canais,
    sequencia,
    contatos: contatos && !diaVazio,
    agendamento: agendamentoNoFuturo && emOrdem,
    pendencias,
    prontaParaDisparo: pendencias.length === 0,
    contatosElegiveis,
    contatosBloqueados: 0,
  };
}

export function useFormularioCampanha(canais: Canal[] = []) {
  // Inicialização preguiçosa: `canais` só é lido na montagem, e o formulário só
  // monta com os canais já carregados. Marcar depois, por efeito, sobrescreveria
  // uma desmarcação deliberada do operador.
  const [estado, despachar] = React.useReducer(reducer, canais, estadoInicial);
  const veredito = React.useMemo(() => avaliarEtapas(estado), [estado]);
  return { estado, despachar, veredito };
}
