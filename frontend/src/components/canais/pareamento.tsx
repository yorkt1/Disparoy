import * as React from "react";
import { CheckCircle2, Download, KeyRound, QrCode, RefreshCw, TimerOff } from "lucide-react";
import type { Canal, MetodoPareamento } from "@disparoy/dominio";
import { Botao } from "@/components/ui/botao";
import type { Pareamento } from "@/hooks/consultas";
import { cn, formatarTelefone } from "@/lib/formato";

/**
 * Revela o conteúdo com altura animada.
 *
 * `grid-rows-[0fr] → [1fr]` em vez de `max-height`: com max-height é preciso
 * chutar um valor maior que o conteúdo, e o chute sempre erra — ou corta o
 * texto, ou deixa a animação lenta no começo por causa do espaço que não
 * existe. O grid anima até a altura real, qualquer que seja ela.
 *
 * `invisible` no final fecha um detalhe de acessibilidade: sem ele o conteúdo
 * escondido continua focável pelo Tab, e o operador tabularia para dentro de
 * um campo que não está na tela.
 */
export function Revelar({ visivel, children }: { visivel: boolean; children: React.ReactNode }) {
  return (
    <div
      aria-hidden={!visivel}
      className={cn(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
        visivel ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className={cn("min-h-0 overflow-hidden", !visivel && "invisible")}>{children}</div>
    </div>
  );
}

/**
 * Escolha entre ler o QR e digitar um código.
 *
 * Existem porque resolvem situações diferentes, não porque uma é melhor: o QR
 * exige DUAS telas — o painel mostrando e o celular lendo. Quem abre o painel
 * no próprio celular, ou opera um número que está com outra pessoa, não tem
 * como usá-lo. Aí o código de 8 dígitos é o único caminho.
 */
export function EscolhaMetodo({
  metodo,
  aoMudar,
}: {
  metodo: MetodoPareamento;
  aoMudar: (m: MetodoPareamento) => void;
}) {
  const opcoes = [
    {
      valor: "qrcode" as const,
      icone: <QrCode className="size-4" />,
      titulo: "QR Code",
      descricao: "Leia com a câmera. Precisa de uma segunda tela.",
    },
    {
      valor: "codigo" as const,
      icone: <KeyRound className="size-4" />,
      titulo: "Código de 8 dígitos",
      descricao: "Digite no próprio celular. Precisa do número.",
    },
  ];

  return (
    <fieldset>
      <legend className="mb-1.5 block text-xs font-medium text-tinta-2">Como vai parear</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {opcoes.map((o) => {
          const ativo = metodo === o.valor;
          return (
            <button
              key={o.valor}
              type="button"
              onClick={() => aoMudar(o.valor)}
              aria-pressed={ativo}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                ativo
                  ? "border-marca bg-marca/10"
                  : "border-borda-forte bg-superficie-2 hover:bg-superficie-3",
              )}
            >
              <span
                className={cn(
                  "flex items-center gap-2 text-sm font-medium",
                  ativo ? "text-marca-tenue" : "text-tinta",
                )}
              >
                {o.icone}
                {o.titulo}
              </span>
              <span className="mt-1 block text-xs text-tinta-3">{o.descricao}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Confirmação do pareamento.
 *
 * Aparece sozinha assim que o gateway confirma — sem o operador clicar em nada.
 * Antes, o QR sumia da tela sem dizer se tinha funcionado, e a única forma de
 * saber era voltar para a lista e esperar.
 */
export function PareamentoConcluido({
  canal,
  aoBaixarContatos,
  baixando,
}: {
  canal: Canal;
  aoBaixarContatos: () => void;
  baixando: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-bom/15 text-bom">
        <CheckCircle2 aria-hidden className="size-6" />
      </span>
      <div>
        <p className="text-sm font-medium text-tinta">Conexão bem-sucedida</p>
        <p className="mt-1 text-sm text-tinta-2">
          {canal.numero
            ? `${canal.nome} está conectado com o número ${formatarTelefone(canal.numero)}.`
            : `${canal.nome} está conectado.`}
        </p>
      </div>

      {/*
        O download mora aqui porque é aqui que ele acontece na prática: a
        agenda se extrai uma vez, logo depois de conectar. Deixar só na lista
        obrigava a fechar o modal e caçar o botão na linha certa.

        Quando este botão aparece, a busca já começou em segundo plano — o
        clique costuma pegar a agenda pronta no servidor.
      */}
      <Botao variante="secundario" onClick={aoBaixarContatos} carregando={baixando}>
        {!baixando && <Download aria-hidden className="size-4" />}
        Baixar contatos
      </Botao>

      <p className="max-w-sm text-xs text-tinta-3">
        Já dá para disparar por ele. Se o aparelho for desconectado no WhatsApp, o painel avisa e
        o botão Conectar volta a aparecer.
      </p>
    </div>
  );
}

/**
 * Segundos restantes até o pareamento expirar. `0` = expirou.
 *
 * O QR vale ~1 minuto e o código alguns minutos. Sem contagem, a pessoa ficava
 * olhando um código morto sem saber — escaneava, não acontecia nada, e a
 * conclusão natural era que o sistema estava quebrado.
 */
function useTempoRestante(expiraEm: string | null): number {
  const calcular = React.useCallback(
    () => (expiraEm ? Math.max(0, Math.ceil((new Date(expiraEm).getTime() - Date.now()) / 1000)) : 0),
    [expiraEm],
  );
  const [restante, setRestante] = React.useState(calcular);

  React.useEffect(() => {
    setRestante(calcular());
    const t = setInterval(() => setRestante(calcular()), 1000);
    return () => clearInterval(t);
  }, [calcular]);

  return restante;
}

/** "1:05" — o formato que se lê de relance num contador. */
function comoRelogio(segundos: number): string {
  return `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, "0")}`;
}

/** O QR ou o código, conforme o que a Evolution devolveu. */
export function PainelPareamento({
  sessao,
  aoGerarNovo,
  gerando,
}: {
  sessao: Pareamento;
  aoGerarNovo: () => void;
  gerando: boolean;
}) {
  const restante = useTempoRestante(sessao.expiraEm);

  /*
   * Expirado: o código sai da tela.
   *
   * Deixá-lo visível com um aviso ao lado convidaria a tentar de novo com algo
   * que já não funciona. Some, e no lugar fica o único caminho que resolve.
   */
  if ((sessao.qr || sessao.codigo) && restante === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-aviso/15 text-aviso">
          <TimerOff aria-hidden className="size-6" />
        </span>
        <div>
          <p className="text-sm font-medium text-tinta">
            {sessao.codigo ? "O código expirou" : "O QR Code expirou"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-tinta-2">
            {sessao.codigo
              ? "Códigos de pareamento valem por poucos minutos. Gere outro para continuar."
              : "O QR Code do WhatsApp vale cerca de um minuto. Gere outro para continuar."}
          </p>
        </div>
        <Botao variante="primario" onClick={aoGerarNovo} carregando={gerando}>
          {!gerando && <RefreshCw aria-hidden className="size-4" />}
          Gerar {sessao.codigo ? "novo código" : "novo QR Code"}
        </Botao>
      </div>
    );
  }

  return <ConteudoPareamento sessao={sessao} restante={restante} />;
}

/** Contador discreto: vira aviso nos últimos 15 segundos. */
function Contador({ restante }: { restante: number }) {
  const acabando = restante <= 15;
  return (
    <p className={cn("tabular text-xs", acabando ? "text-aviso" : "text-tinta-3")}>
      {acabando ? "Expira em" : "Válido por"} {comoRelogio(restante)}
    </p>
  );
}

function ConteudoPareamento({ sessao, restante }: { sessao: Pareamento; restante: number }) {
  if (sessao.codigo) {
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        {/* Espaçado e monoespaçado: é para ser LIDO em voz alta e digitado em
            outro aparelho, muitas vezes por outra pessoa ao telefone. */}
        <p className="rounded-xl bg-superficie-3 px-6 py-4 font-mono text-3xl tracking-[0.3em] text-tinta">
          {sessao.codigo}
        </p>
        <ol className="max-w-sm list-decimal space-y-1 pl-5 text-xs text-tinta-2">
          <li>No celular, abra o WhatsApp.</li>
          <li>
            Toque em <strong className="text-tinta">Aparelhos conectados</strong> →{" "}
            <strong className="text-tinta">Conectar um aparelho</strong>.
          </li>
          <li>
            Escolha <strong className="text-tinta">Conectar com número de telefone</strong> e digite
            o código acima.
          </li>
        </ol>
        {/* O contador substitui "vale por poucos minutos": o número exato tira
            a dúvida de quem está com o celular na mão. */}
        <Contador restante={restante} />
      </div>
    );
  }

  if (sessao.qr) {
    return (
      <div className="flex flex-col items-center gap-3 py-2">
        <img
          src={sessao.qr}
          alt="QR Code para parear o número no WhatsApp"
          width={220}
          height={220}
          className="rounded-lg bg-white p-2"
        />
        <Contador restante={restante} />
      </div>
    );
  }

  // Canal criado, pareamento não. `aviso` explica o porquê — e sem esta tela o
  // operador ficaria olhando um modal vazio sem saber o que deu errado.
  return (
    <div className="rounded-xl border border-aviso/35 bg-aviso/10 p-4">
      <p className="text-sm font-medium text-tinta">O canal foi criado, mas o pareamento não abriu</p>
      <p className="mt-1 text-sm text-tinta-2">
        {sessao.aviso ?? "O gateway não respondeu com QR Code nem com código."}
      </p>
      <p className="mt-1 text-xs text-tinta-3">Tente de novo pelo botão Conectar na lista.</p>
    </div>
  );
}
