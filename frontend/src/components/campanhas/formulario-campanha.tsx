
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Plus, Shuffle, Zap } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo, CaixaSelecao } from "@/components/ui/campos";
import { Etapa, type EstadoEtapa } from "@/components/ui/etapa";
import { useToast } from "@/components/ui/toast";
import { LIMITES } from "@disparoy/dominio";

import type { Canal, Spintax } from "@disparoy/dominio";
import { cn, formatarNumero } from "@/lib/formato";
import { ErroApi } from "@/lib/api";
import { useCriarCampanha } from "@/hooks/consultas";
import { useFormularioCampanha } from "@/hooks/use-formulario-campanha";
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
        validarNumeros: estado.validarNumeros,
        publico: estado.publico,
        // O <input datetime-local> devolve hora local; a API só aceita ISO com
        // fuso, senão um agendamento das 9h viraria 9h UTC (6h em Brasília).
        agendadaPara: estado.agendadaPara ? new Date(estado.agendadaPara).toISOString() : null,
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

            <PreviaConversa sequencia={estado.sequencia} variacoes={variacoes} />
          </div>
        </Etapa>

        {/* ---------------------------------------------------------------- */}
        <Etapa
          numero={4}
          titulo="Quem vai receber"
          descricao="Por planilha ou colando os números. Eles ficam só nesta campanha."
          estado={marcar(veredito.contatos, estado.publico.length > 0)}
          resumo={
            estado.publico.length > 0
              ? `${formatarNumero(veredito.contatosElegiveis)} contatos`
              : undefined
          }
        >
          <SeletorPublico
            publico={estado.publico}
            aoMudar={(contatos) => despachar({ tipo: "publico", contatos })}
          />
        </Etapa>

        {/* ---------------------------------------------------------------- */}
        <Etapa
          numero={5}
          titulo="Quando enviar"
          estado={veredito.agendamento ? "preenchida" : "erro"}
          resumo={estado.agendadaPara ? "Agendado" : "Envio imediato"}
        >
          <AgendamentoEnvio
            valor={estado.agendadaPara}
            aoMudar={(valor) => despachar({ tipo: "agendamento", valor })}
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

function AgendamentoEnvio({
  valor,
  aoMudar,
}: {
  valor: string | null;
  aoMudar: (v: string | null) => void;
}) {
  const agendado = valor !== null;
  const minimo = React.useMemo(() => paraValorLocal(new Date(Date.now() + 5 * 60_000)), []);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <OpcaoEnvio
          selecionada={!agendado}
          onClick={() => aoMudar(null)}
          icone={<Zap className="size-4" />}
          titulo="Enviar agora"
          descricao="A fila começa assim que você confirmar."
        />
        <OpcaoEnvio
          selecionada={agendado}
          onClick={() => aoMudar(valor ?? paraValorLocal(new Date(Date.now() + 3600_000)))}
          icone={<CalendarClock className="size-4" />}
          titulo="Agendar"
          descricao="Escolha data e hora do início."
        />
      </div>

      {agendado ? (
        <Campo
          type="datetime-local"
          rotulo="Início do disparo"
          value={valor ?? ""}
          min={minimo}
          onChange={(e) => aoMudar(e.target.value || null)}
          className="max-w-64"
        />
      ) : null}
    </div>
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

/** Data no formato aceito por <input type="datetime-local"> (hora local). */
function paraValorLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
