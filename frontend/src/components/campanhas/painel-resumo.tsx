
import {
  BadgeCheck,
  CircleAlert,
  CircleCheck,
  Clock,
  QrCode,
  Rocket,
  Save,
  Wallet,
} from "lucide-react";
import { Botao } from "@/components/ui/botao";
import type { Canal } from "@disparoy/dominio";
import { cn, formatarDataHora, formatarNumero } from "@/lib/formato";
import type { EstadoCampanha, VereditoEtapas } from "@/hooks/use-formulario-campanha";

/**
 * Painel lateral fixo: o que será disparado, quanto custa e o que ainda falta.
 *
 * O aviso de custo é a informação mais fácil de errar na plataforma — canal por
 * QR Code não tem tarifa por mensagem, canal oficial tem tarifa por conversa —
 * então ele fica sempre visível, não escondido numa etapa.
 */
export function PainelResumo({
  estado,
  veredito,
  canais,
  enviando,
  aoDisparar,
  aoSalvarRascunho,
}: {
  estado: EstadoCampanha;
  veredito: VereditoEtapas;
  canais: Canal[];
  enviando: "disparo" | "rascunho" | null;
  aoDisparar: () => void;
  aoSalvarRascunho: () => void;
}) {
  const selecionados = canais.filter((c) => estado.canaisIds.includes(c.id));
  const oficiais = selecionados.filter((c) => c.tipoConexao === "api_oficial");
  const porQr = selecionados.filter((c) => c.tipoConexao === "qrcode");

  // O dia 1 É o início da campanha: a data dele é o `agendadaPara` que a API
  // recebe, e `null` nele significa envio imediato.
  const inicio = estado.dias[0].agendadaPara;

  const mensagensPorContato = estado.sequencia.length;
  const totalMensagens = veredito.contatosElegiveis * mensagensPorContato;
  const tarifadas = oficiais.length > 0 ? veredito.contatosElegiveis : 0;

  // A API oficial recusa texto livre para iniciar conversa. Não bloqueamos o
  // disparo — os canais por QR Code na mesma campanha continuam válidos — mas
  // o operador precisa saber antes, não descobrir pela taxa de falha.
  const passosSemTemplate = estado.sequencia.filter((m) => !m.templateId).length;
  const avisoTemplateOficial = oficiais.length > 0 && passosSemTemplate > 0;

  return (
    <aside className="lg:sticky lg:top-20">
      <div className="rounded-card border border-borda bg-superficie">
        <div className="border-b border-borda px-5 py-4">
          <h2 className="text-sm font-semibold text-tinta">Resumo do disparo</h2>
          <p className="mt-1 truncate text-xs text-tinta-3">
            {estado.nome.trim() || "Campanha sem nome"}
          </p>
        </div>

        <dl className="divide-y divide-borda">
          <Linha rotulo="Canais" valor={formatarNumero(selecionados.length)} />
          <Linha rotulo="Mensagens por contato" valor={formatarNumero(mensagensPorContato)} />
          <Linha
            rotulo="Contatos elegíveis"
            valor={formatarNumero(veredito.contatosElegiveis)}
            tom={veredito.contatosElegiveis > 0 ? "bom" : "neutro"}
          />
          {veredito.contatosBloqueados > 0 ? (
            <Linha
              rotulo="Bloqueados por LGPD"
              valor={formatarNumero(veredito.contatosBloqueados)}
              tom="aviso"
            />
          ) : null}
          <Linha rotulo="Total de mensagens" valor={formatarNumero(totalMensagens)} destaque />
          <Linha
            rotulo="Envio"
            valor={
              inicio ? formatarDataHora(new Date(inicio).toISOString()) : "Imediato"
            }
            icone={inicio ? <Clock className="size-3.5" /> : undefined}
          />
          {/*
            Só aparece quando há mais de um dia: numa campanha comum a linha
            seria sempre "1 dia", que não informa nada e ocupa espaço num painel
            que o operador lê de relance antes de disparar.
          */}
          {estado.dias.length > 1 ? (
            <Linha
              rotulo="Dividida em"
              valor={`${estado.dias.length} dias`}
              icone={<Clock className="size-3.5" />}
            />
          ) : null}
        </dl>

        {selecionados.length > 0 ? (
          <div className="border-t border-borda px-5 py-4">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-tinta-2">
              <Wallet aria-hidden className="size-3.5" />
              Custo estimado
            </h3>

            <ul className="mt-2.5 flex flex-col gap-2">
              {porQr.length > 0 ? (
                <li className="flex items-start gap-2 text-xs text-tinta-3">
                  <QrCode aria-hidden className="mt-0.5 size-3.5 shrink-0 text-bom" />
                  <span>
                    <span className="text-tinta-2">
                      {porQr.length} {porQr.length === 1 ? "canal" : "canais"} via QR Code
                    </span>{" "}
                    — sem tarifa por mensagem cobrada pela Meta.
                  </span>
                </li>
              ) : null}

              {oficiais.length > 0 ? (
                <li className="flex items-start gap-2 text-xs text-tinta-3">
                  <BadgeCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-aviso" />
                  <span>
                    <span className="text-tinta-2">
                      {oficiais.length} {oficiais.length === 1 ? "canal" : "canais"} via API Oficial
                    </span>{" "}
                    — a Meta cobra por conversa iniciada:{" "}
                    <span className="tabular text-aviso">
                      até {formatarNumero(tarifadas)} conversas
                    </span>
                    .
                  </span>
                </li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <div className="border-t border-borda px-5 py-4">
          <h3 className="text-xs font-medium text-tinta-2">
            {veredito.prontaParaDisparo ? "Tudo pronto" : "Pendências"}
          </h3>

          <ul className="mt-2.5 flex flex-col gap-1.5">
            {veredito.prontaParaDisparo ? (
              <li className="flex items-start gap-2 text-xs text-bom">
                <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0" />
                A campanha pode ser disparada.
              </li>
            ) : (
              veredito.pendencias.map((p) => (
                <li key={p} className="flex items-start gap-2 text-xs text-aviso">
                  <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                  {p}
                </li>
              ))
            )}

            {avisoTemplateOficial ? (
              <li className="flex items-start gap-2 text-xs text-serio">
                <CircleAlert aria-hidden className="mt-px size-3.5 shrink-0" />
                {passosSemTemplate === estado.sequencia.length
                  ? "A sequência é toda de texto livre"
                  : `${passosSemTemplate} de ${estado.sequencia.length} mensagens são texto livre`}
                : os canais de API Oficial só entregam templates aprovados e vão recusar esses
                passos. Os canais por QR Code enviam normalmente.
              </li>
            ) : null}

            {estado.validarNumeros && veredito.contatosElegiveis > 0 ? (
              <li className="mt-1 flex items-start gap-2 text-xs text-tinta-3">
                <CircleCheck aria-hidden className="mt-px size-3.5 shrink-0" />
                Os números serão checados no WhatsApp antes do envio.
              </li>
            ) : null}
          </ul>
        </div>

        <div className="flex flex-col gap-2 border-t border-borda px-5 py-4">
          <Botao
            variante="primario"
            tamanho="lg"
            className="justify-center"
            disabled={!veredito.prontaParaDisparo || enviando !== null}
            carregando={enviando === "disparo"}
            onClick={aoDisparar}
          >
            {enviando === "disparo" ? null : <Rocket aria-hidden className="size-4" />}
            {inicio ? "Agendar disparo" : "Disparar agora"}
          </Botao>

          <Botao
            variante="secundario"
            className="justify-center"
            disabled={enviando !== null}
            carregando={enviando === "rascunho"}
            onClick={aoSalvarRascunho}
          >
            {enviando === "rascunho" ? null : <Save aria-hidden className="size-4" />}
            Salvar rascunho
          </Botao>
        </div>
      </div>
    </aside>
  );
}

function Linha({
  rotulo,
  valor,
  tom = "neutro",
  destaque = false,
  icone,
}: {
  rotulo: string;
  valor: string;
  tom?: "neutro" | "bom" | "aviso";
  destaque?: boolean;
  icone?: React.ReactNode;
}) {
  const cores = { neutro: "text-tinta", bom: "text-bom", aviso: "text-aviso" };
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-2.5">
      <dt className="text-xs text-tinta-3">{rotulo}</dt>
      <dd
        className={cn(
          "tabular flex items-center gap-1.5 text-xs",
          cores[tom],
          destaque && "font-semibold",
        )}
      >
        {icone}
        {valor}
      </dd>
    </div>
  );
}
