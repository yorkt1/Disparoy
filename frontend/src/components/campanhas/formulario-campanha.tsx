
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Plus, Shuffle, Trash2, Zap } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo, CaixaSelecao } from "@/components/ui/campos";
import { Etapa, type EstadoEtapa } from "@/components/ui/etapa";
import { useToast } from "@/components/ui/toast";
import { LIMITES, duracaoEstimadaSegundos, contatosQueCabemNoDia, fechaNoDia } from "@disparoy/dominio";

import type { Canal, IntervaloAleatorio, Spintax } from "@disparoy/dominio";
import { cn, formatarNumero } from "@/lib/formato";
import { ErroApi } from "@/lib/api";
import { useCriarCampanha } from "@/hooks/consultas";
import {
  cadenciaDosDias,
  contatosPorDia,
  HORA_PADRAO_DO_DIA,
  paraValorLocal,
  proximoDiaDeDisparo,
  publicoAchatado,
  useFormularioCampanha,
  type AcaoCampanha,
  type DiaDeDisparo,
} from "@/hooks/use-formulario-campanha";
import { EditorMensagem } from "./editor-mensagem";
import { SeletorPublico } from "./seletor-publico";
import { PainelResumo } from "./painel-resumo";
import { PreviaConversa } from "./previa-conversa";
import { SeletorCanais } from "./seletor-canais";
import { ControleIntervalo } from "./controle-intervalo";

export function FormularioCampanha({
  canais,
  variacoesIniciais,
}: {
  canais: Canal[];
  variacoesIniciais: Spintax[];
}) {
  const { estado, despachar, veredito } = useFormularioCampanha(canais);
  const [variacoes, setVariacoes] = React.useState(variacoesIniciais);
  const [enviando, setEnviando] = React.useState<"disparo" | "rascunho" | null>(null);
  const { mostrar } = useToast();
  const navegar = useNavigate();
  const criacao = useCriarCampanha();

  async function enviar(acao: "disparar" | "rascunho") {
    setEnviando(acao === "disparar" ? "disparo" : "rascunho");
    try {
      const { campanha } = await criacao.mutateAsync({
        nome: estado.nome.trim(),
        canaisIds: estado.canaisIds,
        sequencia: estado.sequencia,
        intervaloEntreContatos: estado.intervaloEntreContatos,
        intervaloEntreMensagens: estado.intervaloEntreMensagens,
        cadenciaAutomatica: estado.cadenciaAutomatica,
        validarNumeros: estado.validarNumeros,
        // Os dias vão achatados num público só, cada contato carregando o seu
        // `liberarEm` — é a forma que a API e o banco entendem.
        publico: publicoAchatado(estado.dias),
        // O <input datetime-local> devolve hora local; a API só aceita ISO com
        // fuso, senão um agendamento das 9h viraria 9h UTC (6h em Brasília).
        agendadaPara: estado.dias[0].agendadaPara
          ? new Date(estado.dias[0].agendadaPara).toISOString()
          : null,
        acao,
      });

      mostrar({
        tipo: "sucesso",
        titulo: acao === "disparar" ? "Campanha na fila" : "Rascunho salvo",
        descricao:
          acao === "disparar"
            ? `${formatarNumero(veredito.contatosElegiveis)} contatos enfileirados para o worker.`
            : "Você pode retomar a edição quando quiser.",
      });
      navegar(`/campanhas/${campanha.id}`);
    } catch (e) {
      mostrar({
        tipo: "erro",
        titulo: "Falha ao salvar",
        descricao:
          e instanceof ErroApi
            ? (e.primeiroCampo ?? e.message)
            : e instanceof Error
              ? e.message
              : "Erro inesperado.",
      });
    } finally {
      setEnviando(null);
    }
  }

  const marcar = (ok: boolean, tocado: boolean): EstadoEtapa =>
    ok ? "preenchida" : tocado ? "erro" : "pendente";

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-4">
        {/* ---------------------------------------------------------------- */}
        <Etapa
          numero={1}
          titulo="Nome da campanha"
          descricao="Só você vê este nome — use algo que identifique a lista e a oferta."
          estado={marcar(veredito.nome, estado.nome.length > 0)}
        >
          <Campo
            value={estado.nome}
            onChange={(e) => despachar({ tipo: "nome", valor: e.target.value })}
            placeholder="Nome interno para identificar esta campanha"
            maxCaracteres={LIMITES.maxCaracteresNomeCampanha}
            aria-label="Nome da campanha"
            required
          />
        </Etapa>

        {/* ---------------------------------------------------------------- */}
        <Etapa
          numero={2}
          titulo="Canais de envio"
          descricao="Escolha um ou mais números conectados."
          estado={marcar(veredito.canais, false)}
          resumo={
            estado.canaisIds.length > 0
              ? `${estado.canaisIds.length} ${estado.canaisIds.length === 1 ? "canal" : "canais"}`
              : undefined
          }
        >
          <SeletorCanais
            canais={canais}
            selecionados={estado.canaisIds}
            aoAlternar={(id) => despachar({ tipo: "alternarCanal", id })}
          />
        </Etapa>

        {/* ---------------------------------------------------------------- */}
        <Etapa
          numero={3}
          titulo="Sequência de mensagens"
          descricao={`Até ${LIMITES.maxMensagensPorContato} mensagens por contato, enviadas na ordem abaixo.`}
          estado={marcar(veredito.sequencia, true)}
          resumo={`${estado.sequencia.length}/${LIMITES.maxMensagensPorContato}`}
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex flex-col gap-3">
              <p className="rounded-lg border border-borda-forte bg-superficie-2 px-3.5 py-3 text-xs leading-relaxed text-tinta-3">
                <Shuffle aria-hidden className="mr-1.5 -mt-0.5 inline size-3.5 text-marca-tenue" />
                Mensagem idêntica em volume é o sinal mais forte de disparo automático. Crie uma
                lista de opções salva e insira com o botão{" "}
                <strong className="text-tinta-2">Variação</strong> — ela aparece no texto como{" "}
                <code className="text-tinta-2">{"{{*nome*}}"}</code> e cada contato recebe uma das
                opções, sorteada no envio. A mesma variação serve para outras campanhas.
              </p>

              <ul className="flex flex-col gap-3">
                {estado.sequencia.map((mensagem, i) => (
                  <EditorMensagem
                    key={mensagem.id}
                    mensagem={mensagem}
                    indice={i}
                    total={estado.sequencia.length}
                    variacoes={variacoes}
                    aoAtualizar={(campos) =>
                      despachar({ tipo: "atualizarMensagem", id: mensagem.id, campos })
                    }
                    aoRemover={() => despachar({ tipo: "removerMensagem", id: mensagem.id })}
                    aoMover={(direcao) =>
                      despachar({ tipo: "moverMensagem", id: mensagem.id, direcao })
                    }
                    aoMudarVariacoes={setVariacoes}
                  />
                ))}
              </ul>

              <Botao
                variante="secundario"
                onClick={() => despachar({ tipo: "adicionarMensagem" })}
                disabled={estado.sequencia.length >= LIMITES.maxMensagensPorContato}
                className="justify-center"
              >
                <Plus aria-hidden className="size-4" />
                Adicionar mensagem à sequência
              </Botao>

              <div className="grid gap-3 sm:grid-cols-2">
                <ControleIntervalo
                  titulo="Intervalo entre contatos"
                  descricao="Sorteado a cada contato da fila."
                  valor={estado.intervaloEntreContatos}
                  aoMudar={(valor) => despachar({ tipo: "intervaloContatos", valor })}
                  sugestao={cadenciaDosDias(estado.dias)}
                  seguindoSugestao={estado.cadenciaAutomatica}
                  aoMudarAutomatico={(valor) => despachar({ tipo: "cadenciaAutomatica", valor })}
                />
                <ControleIntervalo
                  titulo="Intervalo entre mensagens"
                  descricao="Sorteado entre os passos do mesmo contato."
                  valor={estado.intervaloEntreMensagens}
                  aoMudar={(valor) => despachar({ tipo: "intervaloMensagens", valor })}
                />
              </div>

              <CaixaSelecao
                rotulo="Validar números no WhatsApp antes de disparar"
                descricao="Descarta números que não existem no WhatsApp. Deixa o início do disparo mais lento, mas protege a reputação do canal."
                checked={estado.validarNumeros}
                onChange={(e) => despachar({ tipo: "validarNumeros", valor: e.target.checked })}
              />
            </div>

            {/*
              O 1º contato do público entra na prévia, e não um exemplo
              inventado: é o que faz "Olá {{1}}" aparecer como "Olá Maria" ou
              — se o mapeamento estiver errado — continuar `{{1}}` na tela do
              operador, ANTES de sair para a lista inteira. A prévia já
              prometia isso no rótulo ("importe contatos para preencher as
              variáveis") e nunca recebia contato nenhum.
            */}
            <PreviaConversa
              sequencia={estado.sequencia}
              variacoes={variacoes}
              contatoExemplo={estado.dias[0].publico[0]}
            />
          </div>
        </Etapa>

        {/* ----------------------------------------------------------------
          Quem recebe e quando eram duas etapas, e viraram uma.

          Enquanto a campanha era de um disparo só, "o público" e "a data" eram
          perguntas independentes. Com a semana dividida em dias, cada planilha
          TEM uma data e cada data TEM uma planilha — separá-las obrigaria o
          operador a montar a mesma lista de dias em dois lugares e a mantê-los
          casados de cabeça.
        ------------------------------------------------------------------- */}
        <Etapa
          numero={4}
          titulo="Quando e para quem"
          descricao="Por planilha ou colando os números. Os contatos ficam só nesta campanha."
          estado={marcar(
            veredito.contatos && veredito.agendamento,
            veredito.contatosElegiveis > 0,
          )}
          resumo={
            veredito.contatosElegiveis > 0
              ? `${formatarNumero(veredito.contatosElegiveis)} contatos` +
                (estado.dias.length > 1 ? ` em ${estado.dias.length} dias` : "")
              : undefined
          }
        >
          <AgendamentoEnvio
            dias={estado.dias}
            faixa={estado.intervaloEntreContatos}
            despachar={despachar}
          />
        </Etapa>
      </div>

      <PainelResumo
        estado={estado}
        veredito={veredito}
        canais={canais}
        enviando={enviando}
        aoDisparar={() => enviar("disparar")}
        aoSalvarRascunho={() => enviar("rascunho")}
      />
    </div>
  );
}

/**
 * Quando a campanha sai, e com que planilha em cada dia.
 *
 * "Enviar agora" é um dia sem data. "Agendar" abre a lista, e é aí que a
 * campanha pode cobrir a semana: um bloco por dia, com data e planilha lado a
 * lado, e um botão que acrescenta o próximo dia já datado.
 *
 * Existir num lugar só é o ponto. A alternativa — escolher as datas aqui e as
 * planilhas noutra etapa — deixaria o operador casando lista com dia de
 * cabeça, e o erro que isso produz (planilha da sexta no bloco da terça) não
 * aparece em lugar nenhum até as mensagens saírem.
 */
function AgendamentoEnvio({
  dias,
  faixa,
  despachar,
}: {
  dias: DiaDeDisparo[];
  faixa: IntervaloAleatorio;
  despachar: React.Dispatch<AcaoCampanha>;
}) {
  const agendado = dias[0].agendadaPara !== null;
  const minimo = React.useMemo(() => paraValorLocal(new Date(Date.now() + 5 * 60_000)), []);
  const porDia = contatosPorDia(dias);

  /*
   * "Dia" só enquanto cada lote é mesmo um dia diferente.
   *
   * Com dois lotes no mesmo dia, chamar o segundo de "Dia 2" seria mentira na
   * tela — e mentira do tipo que faz o operador procurar um erro que não
   * existe.
   */
  const datasDistintas = new Set(dias.map((d) => d.agendadaPara?.slice(0, 10))).size;
  const rotulo = datasDistintas === dias.length ? "Dia" : "Lote";

  /** Primeira data possível: 10h do próximo dia que não seja domingo. */
  function primeiraData(): string {
    const d = proximoDiaDeDisparo(new Date());
    d.setHours(HORA_PADRAO_DO_DIA, 0, 0, 0);
    return paraValorLocal(d);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <OpcaoEnvio
          selecionada={!agendado}
          onClick={() => despachar({ tipo: "agendamento", valor: null })}
          icone={<Zap className="size-4" />}
          titulo="Enviar agora"
          descricao="A fila começa assim que você confirmar."
        />
        <OpcaoEnvio
          selecionada={agendado}
          onClick={() =>
            despachar({ tipo: "agendamento", valor: dias[0].agendadaPara ?? primeiraData() })
          }
          icone={<CalendarClock className="size-4" />}
          titulo="Agendar"
          descricao="Escolha o dia, ou divida a lista pela semana."
        />
      </div>

      <ul className="flex flex-col gap-3">
        {dias.map((dia, i) => (
          <BlocoDoDia
            key={dia.id}
            dia={dia}
            indice={i}
            contatos={porDia[i]}
            faixa={faixa}
            agendado={agendado}
            minimo={minimo}
            podeRemover={dias.length > 1}
            rotulo={rotulo}
            despachar={despachar}
          />
        ))}
      </ul>

      {agendado ? (
        <div className="flex flex-wrap items-center gap-2">
          <Botao
            tamanho="sm"
            variante="secundario"
            onClick={() => despachar({ tipo: "adicionarDia" })}
            // Trinta lotes é o teto do schema. Chegar nele é sinal de que a
            // lista deveria ser outra campanha, não mais um lote nesta.
            disabled={dias.length >= 30}
          >
            <Plus aria-hidden className="size-3.5" />
            Próximo dia
          </Botao>

          {/*
            Dois lotes no mesmo dia.

            Existe porque sem ele a única saída era reescrever a data inteira
            do lote novo à mão, e num `datetime-local` isso é chato o bastante
            para parecer impossível. É também o caminho de quem só quer TESTAR
            — duas levas com minutos de diferença, sem esperar até amanhã.
          */}
          <Botao
            tamanho="sm"
            variante="fantasma"
            onClick={() => despachar({ tipo: "adicionarDia", mesmoDia: true })}
            disabled={dias.length >= 30}
          >
            <Plus aria-hidden className="size-3.5" />
            Mesmo dia
          </Botao>

          {dias.length > 1 ? (
            <span className="text-xs text-tinta-3">
              Cada lote começa no horário marcado. Domingo é pulado.
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Um dia: a data, a planilha dele e quanto tempo essa leva leva. */
function BlocoDoDia({
  dia,
  indice,
  contatos,
  faixa,
  agendado,
  minimo,
  podeRemover,
  rotulo,
  despachar,
}: {
  dia: DiaDeDisparo;
  indice: number;
  contatos: number;
  faixa: IntervaloAleatorio;
  agendado: boolean;
  minimo: string;
  podeRemover: boolean;
  rotulo: string;
  despachar: React.Dispatch<AcaoCampanha>;
}) {
  const horas = duracaoEstimadaSegundos(contatos, faixa) / 3600;
  const cabe = fechaNoDia(contatos, faixa);

  return (
    <li className="rounded-lg border border-borda-forte bg-superficie-2 p-3.5">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-tinta">
          {agendado ? `${rotulo} ${indice + 1}` : "Contatos"}
        </span>

        {agendado ? (
          <Campo
            type="datetime-local"
            aria-label={`Data e hora do dia ${indice + 1}`}
            value={dia.agendadaPara ?? ""}
            min={minimo}
            onChange={(e) =>
              indice === 0
                ? despachar({ tipo: "agendamento", valor: e.target.value || null })
                : despachar({ tipo: "dataDoDia", id: dia.id, valor: e.target.value || null })
            }
            className="max-w-56"
          />
        ) : null}

        {contatos > 0 ? (
          <span className="tabular text-xs text-tinta-3">
            {formatarNumero(contatos)} contatos ·{" "}
            {horas < 1 ? `≈${Math.round(horas * 60)} min` : `≈${horas.toFixed(1)} h`}
          </span>
        ) : null}

        {podeRemover && indice > 0 ? (
          <Botao
            tamanho="icone"
            variante="fantasma"
            onClick={() => despachar({ tipo: "removerDia", id: dia.id })}
            aria-label={`Remover dia ${indice + 1}`}
            className="ml-auto hover:bg-critico/15 hover:text-critico"
          >
            <Trash2 aria-hidden className="size-3.5" />
          </Botao>
        ) : null}
      </div>

      <SeletorPublico
        publico={dia.publico}
        aoMudar={(contatos) => despachar({ tipo: "publicoDoDia", id: dia.id, contatos })}
      />

      {/*
        O aviso que evita o erro caro.

        A 90–240 s por contato, um dia comporta algo entre 200 e 350 pessoas —
        não mil. Sem este número na tela, o operador divide 3 mil contatos em
        seis dias de 500, nenhum dia fecha, as sobras se empilham, e ele só
        descobre na quarta-feira. Dizer QUANTOS cabem torna o aviso acionável:
        "não fecha no dia" sozinho não diz o que fazer.
      */}
      {contatos > 0 && !cabe ? (
        <p className="mt-2 text-xs text-aviso">
          Essa leva leva ≈{horas.toFixed(0)} h e não fecha no dia — o resto escorre para o
          seguinte. Nesse ritmo cabem ~{formatarNumero(contatosQueCabemNoDia(faixa))} contatos por
          dia.
        </p>
      ) : null}
    </li>
  );
}

function OpcaoEnvio({
  selecionada,
  onClick,
  icone,
  titulo,
  descricao,
}: {
  selecionada: boolean;
  onClick: () => void;
  icone: React.ReactNode;
  titulo: string;
  descricao: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selecionada}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors",
        selecionada
          ? "border-marca bg-marca/8"
          : "border-borda-forte bg-superficie-2 hover:border-borda-hover",
      )}
    >
      <span aria-hidden className={cn("mt-0.5", selecionada ? "text-marca-tenue" : "text-tinta-3")}>
        {icone}
      </span>
      <span>
        <span className="block text-sm font-medium text-tinta">{titulo}</span>
        <span className="mt-0.5 block text-xs text-tinta-3">{descricao}</span>
      </span>
    </button>
  );
}
