import { AlertTriangle, Ban, Info, ServerCog, Smartphone, Gauge } from "lucide-react";
import type { CategoriaFalha } from "@disparoy/dominio";
import { origemDe } from "@disparoy/dominio";
import { Badge, type TomBadge } from "@/components/ui/primitivos";

/**
 * Selo que nomeia a ORIGEM da falha.
 *
 * É a peça central da tela de erro. Antes dele, "o WhatsApp do cliente
 * desconectou" e "nosso servidor caiu" apareciam como o mesmo texto genérico, e
 * o operador só conseguia concluir a única coisa que os dados permitiam: que o
 * sistema tinha quebrado.
 *
 * O rótulo vem de `origemDe(categoria)` no domínio compartilhado — nunca de
 * comparar a string do erro, que muda a cada versão da Evolution.
 */

const TOM: Record<ReturnType<typeof origemDe>["tom"], TomBadge> = {
  perigo: "critico",
  atencao: "aviso",
  informacao: "marca",
  neutro: "neutro",
};

const ICONE: Record<CategoriaFalha, React.ReactNode> = {
  canal: <Smartphone className="size-3.5" />,
  destinatario: <AlertTriangle className="size-3.5" />,
  infra: <ServerCog className="size-3.5" />,
  configuracao: <Info className="size-3.5" />,
  conteudo: <Ban className="size-3.5" />,
  limite: <Gauge className="size-3.5" />,
};

export function SeloOrigem({ categoria }: { categoria: CategoriaFalha }) {
  const origem = origemDe(categoria);
  return (
    <Badge tom={TOM[origem.tom]} icone={ICONE[categoria]}>
      {origem.rotulo}
    </Badge>
  );
}

/** A frase que diz de quem NÃO é a culpa. Vale mais que o título em si. */
export function AberturaOrigem({ categoria }: { categoria: CategoriaFalha }) {
  return <span className="text-tinta-2">{origemDe(categoria).abertura}</span>;
}
