import * as React from "react";
import {
  INTERVALO_PADRAO_ENTRE_CONTATOS,
  INTERVALO_PADRAO_ENTRE_MENSAGENS,
  LIMITES,
} from "@disparoy/dominio";
import type { Canal, IntervaloAleatorio, Lista, MensagemSequencia } from "@disparoy/dominio";
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
  /** Lista de contatos alvo — os contatos vivem fora da campanha. */
  listaId: string | null;
  /** Valor cru do <input type="datetime-local">; null = envio imediato. */
  agendadaPara: string | null;
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
  | { tipo: "lista"; id: string | null }
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
    listaId: null,
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

    case "lista":
      return { ...estado, listaId: acao.id };

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
  /** Quantos da lista escolhida podem legalmente receber. */
  contatosElegiveis: number;
  /** Quantos estão na lista mas não podem receber. */
  contatosBloqueados: number;
}

export function avaliarEtapas(estado: EstadoCampanha, listas: Lista[]): VereditoEtapas {
  const lista = listas.find((l) => l.id === estado.listaId);
  const contatosElegiveis = lista?.totalElegiveis ?? 0;
  const contatosBloqueados = lista ? lista.totalContatos - lista.totalElegiveis : 0;

  const nome = estado.nome.trim().length >= 3;
  const canais = estado.canaisIds.length > 0;
  const sequencia = estado.sequencia.every((m) =>
    m.tipo === "midia" ? Boolean(m.midia) : m.corpo.trim().length > 0,
  );
  const contatos = Boolean(estado.listaId) && contatosElegiveis > 0;

  const agendamentoNoFuturo =
    !estado.agendadaPara || new Date(estado.agendadaPara).getTime() > Date.now();

  const pendencias: string[] = [];
  if (!nome) pendencias.push("Dê um nome à campanha (mínimo 3 caracteres).");
  if (!canais) pendencias.push("Selecione ao menos um canal.");
  if (!sequencia) pendencias.push("Há mensagens vazias na sequência.");
  if (!estado.listaId) pendencias.push("Escolha a lista de contatos.");
  else if (contatosElegiveis === 0) {
    pendencias.push("Nenhum contato da lista pode receber mensagem.");
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
    contatosBloqueados,
  };
}

export function useFormularioCampanha(listas: Lista[], canais: Canal[] = []) {
  // Inicialização preguiçosa: `canais` só é lido na montagem, e o formulário só
  // monta com os canais já carregados. Marcar depois, por efeito, sobrescreveria
  // uma desmarcação deliberada do operador.
  const [estado, despachar] = React.useReducer(reducer, canais, estadoInicial);
  const veredito = React.useMemo(() => avaliarEtapas(estado, listas), [estado, listas]);
  return { estado, despachar, veredito };
}
