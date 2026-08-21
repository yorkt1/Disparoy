import { CheckCheck, QrCode, X } from "lucide-react";
import type { Aviso } from "@disparoy/dominio";
import { formatarDataHora } from "@disparoy/dominio";
import { Botao, BotaoLink } from "@/components/ui/botao";
import { useArquivarAviso, useMarcarAvisoLido } from "@/hooks/consultas";
import { AberturaOrigem, SeloOrigem } from "./selo-origem";

/**
 * Um aviso na caixa.
 *
 * A ação oferecida depende da CATEGORIA, não do texto: só falha de canal leva a
 * um botão de reconectar, porque só ela é resolvida por alguém escanear um QR.
 * Falha de infra deliberadamente não oferece ação nenhuma — pedir para o
 * operador "tentar de novo" quando o problema é nosso é o pior dos dois mundos.
 */
export function CartaoAviso({ aviso }: { aviso: Aviso }) {
  const marcarLido = useMarcarAvisoLido();
  const arquivar = useArquivarAviso();

  const naoLido = aviso.lidaEm === null;
  const resolvido = aviso.tipo === "resolucao";

  return (
    <article
      className={[
        "rounded-xl border p-4",
        resolvido
          ? "border-borda bg-superficie-2 opacity-75"
          : // `superficie-1` não existe no tema: a classe não gerava nada e o
            // aviso ABERTO — justo o que precisa saltar — ficava sem fundo, mais
            // apagado que o resolvido logo abaixo dele.
            "border-borda-forte bg-superficie",
      ].join(" ")}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {resolvido ? (
          <span className="rounded-full bg-bom/12 px-2.5 py-1 text-xs font-medium text-bom ring-1 ring-bom/30 ring-inset">
            Resolvido
          </span>
        ) : (
          <SeloOrigem categoria={aviso.categoria} />
        )}

        <span className="text-xs text-tinta-3">
          {formatarDataHora(aviso.criadaEm)}
          {aviso.canalNome ? ` · ${aviso.canalNome}` : ""}
        </span>

        {/* `aria-label` num <span> sem papel é ignorado pelo leitor de tela: o
            ponto vermelho existia só para quem enxerga. O texto escondido é o
            que faz "não lido" chegar aos dois. */}
        {naoLido && (
          <span className="ml-auto flex items-center gap-1.5">
            <span className="sr-only">Não lido</span>
            <span aria-hidden className="size-2 rounded-full bg-critico" />
          </span>
        )}
      </div>

      <h3 className="mb-1 text-sm font-medium text-tinta">{aviso.titulo}</h3>

      <p className="text-sm leading-relaxed text-tinta-2">
        {!resolvido && (
          <>
            <AberturaOrigem categoria={aviso.categoria} />{" "}
          </>
        )}
        {aviso.corpo}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!resolvido && aviso.categoria === "canal" && aviso.canalId && (
          <BotaoLink to="/canais" variante="primario" tamanho="sm">
            <QrCode className="size-4" />
            Reconectar
          </BotaoLink>
        )}

        {aviso.campanhaId && (
          <BotaoLink to={`/campanhas/${aviso.campanhaId}`} tamanho="sm">
            Ver campanha
          </BotaoLink>
        )}

        {naoLido && (
          <Botao
            variante="fantasma"
            tamanho="sm"
            onClick={() => marcarLido.mutate(aviso.id)}
            carregando={marcarLido.isPending}
          >
            <CheckCheck className="size-4" />
            Marcar como lido
          </Botao>
        )}

        <Botao
          variante="fantasma"
          tamanho="sm"
          className="ml-auto"
          onClick={() => arquivar.mutate(aviso.id)}
          carregando={arquivar.isPending}
        >
          <X className="size-4" />
          Dispensar
        </Botao>
      </div>
    </article>
  );
}
