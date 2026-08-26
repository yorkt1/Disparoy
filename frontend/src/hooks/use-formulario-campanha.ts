import * as React from "react";
import {
  INTERVALO_PADRAO_ENTRE_CONTATOS,
  INTERVALO_PADRAO_ENTRE_MENSAGENS,
  LIMITES,
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
  validarNumeros: boolean;
  /**
   * O público da campanha, vindo de planilha ou colagem.
   *
   * Substituiu `listaId`: não há mais cadastro de contatos, então a lista de
   * destino nasce e morre com a campanha. O telefone já chega normalizado em
   * E.164 pelo domínio.
   */
  publico: ContatoPublico[];
  /** Valor cru do <input type="datetime-local">; null = envio imediato. */
  agendadaPara: string | null;
}

export interface ContatoPublico {
  telefone: string;
  nome: string;
  variaveis: Record<string, string>;
}

export type AcaoCampanha =
  | { tipo: "nome"; valor: string }
  | { tipo: "alternarCanal"; id: string }
  | { tipo: "adicionarMensagem" }
  | { tipo: "removerMensagem"; id: string }
  | { tipo: "moverMensagem"; id: string; direcao: -1 | 1 }
  | { tipo: "atualizarMensagem"; id: string; campos: Partial<MensagemSequencia> }
  | { tipo: "intervaloContatos"; valor: IntervaloAleatorio }
  | { tipo: "intervaloMensagens"; valor: IntervaloAleatorio }
  | { tipo: "validarNumeros"; valor: boolean }
  | { tipo: "publico"; contatos: ContatoPublico[] }
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
    intervaloEntreContatos: { ...INTERVALO_PADRAO_ENTRE_CONTATOS },
    intervaloEntreMensagens: { ...INTERVALO_PADRAO_ENTRE_MENSAGENS },
    validarNumeros: true,
    publico: [],
    agendadaPara: null,
  };
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
      return { ...estado, intervaloEntreContatos: acao.valor };

    case "intervaloMensagens":
      return { ...estado, intervaloEntreMensagens: acao.valor };

    case "validarNumeros":
      return { ...estado, validarNumeros: acao.valor };

    case "publico": {
      // Deduplica por telefone aqui, e não só no banco: o operador precisa ver
      // o número REAL de destinatários antes de disparar, não descobrir depois
      // que 300 das 1000 linhas da planilha eram repetidas.
      const vistos = new Set<string>();
      return {
        ...estado,
        publico: acao.contatos.filter((c) => {
          if (vistos.has(c.telefone)) return false;
          vistos.add(c.telefone);
          return true;
        }),
      };
    }

    case "agendamento":
      return { ...estado, agendadaPara: acao.valor };

    default:
      return estado;
  }
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
  const contatosElegiveis = estado.publico.length;

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

  const agendamentoNoFuturo =
    !estado.agendadaPara || new Date(estado.agendadaPara).getTime() > Date.now();

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
  }
  if (!agendamentoNoFuturo) pendencias.push("A data de agendamento já passou.");

  return {
    nome,
    canais,
    sequencia,
    contatos,
    agendamento: agendamentoNoFuturo,
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
