import { AlertTriangle, Loader2 } from "lucide-react";
import { Botao } from "./botao";
import { Card } from "./primitivos";

/**
 * Estados de carregamento e erro das telas.
 *
 * Num SPA os dados chegam depois da tela, então cada página precisa dizer o
 * que está acontecendo — coisa que o Server Component resolvia sozinho.
 */

export function Carregando({ rotulo = "Carregando…" }: { rotulo?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-20 text-tinta-3">
      <Loader2 aria-hidden className="size-5 animate-spin" />
      <span className="text-sm">{rotulo}</span>
    </div>
  );
}

export function ErroCarregamento({
  erro,
  aoTentarNovamente,
}: {
  erro: unknown;
  aoTentarNovamente?: () => void;
}) {
  const mensagem = erro instanceof Error ? erro.message : "Não foi possível carregar os dados.";

  return (
    <Card className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <AlertTriangle aria-hidden className="size-6 text-critico" />
      <div>
        <p className="text-sm font-medium text-tinta">Algo deu errado</p>
        <p className="mt-1 text-xs text-tinta-3">{mensagem}</p>
      </div>
      {aoTentarNovamente ? (
        <Botao variante="secundario" tamanho="sm" onClick={aoTentarNovamente}>
          Tentar novamente
        </Botao>
      ) : null}
    </Card>
  );
}

/** Bloco cinza no formato aproximado do conteúdo que vai chegar. */
export function Esqueleto({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-superficie-2 ${className ?? ""}`} />;
}
