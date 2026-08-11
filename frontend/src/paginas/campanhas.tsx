import { Plus } from "lucide-react";
import { BotaoLink } from "@/components/ui/botao";
import { CabecalhoPagina, Card } from "@/components/ui/primitivos";
import { Carregando, ErroCarregamento } from "@/components/ui/estados";
import { TabelaUltimasCampanhas } from "@/components/dashboard/tabela-ultimas-campanhas";
import { useCampanhas, useCanais } from "@/hooks/consultas";
import { formatarNumero } from "@/lib/formato";

export function PaginaCampanhas() {
  // Paginação e busca acontecem na tabela, no cliente; a API entrega o bloco.
  const campanhas = useCampanhas({ porPagina: 100 });
  const canais = useCanais();

  const rotuloCanais = new Map((canais.data ?? []).map((c) => [c.id, c.nome]));
  const linhas = (campanhas.data?.itens ?? []).map((c) => ({
    ...c,
    canaisRotulo:
      c.canaisIds.length === 1
        ? (rotuloCanais.get(c.canaisIds[0]) ?? "—")
        : `${c.canaisIds.length} canais`,
  }));

  return (
    <>
      <CabecalhoPagina
        titulo="Campanhas"
        descricao={
          campanhas.data ? `${formatarNumero(campanhas.data.total)} campanhas no total` : undefined
        }
        acao={
          <BotaoLink to="/campanhas/nova" variante="primario">
            <Plus aria-hidden className="size-4" />
            Nova Campanha
          </BotaoLink>
        }
      />

      {campanhas.isLoading ? (
        <Carregando />
      ) : campanhas.error ? (
        <ErroCarregamento erro={campanhas.error} aoTentarNovamente={() => void campanhas.refetch()} />
      ) : (
        <Card className="overflow-hidden">
          <TabelaUltimasCampanhas campanhas={linhas} porPagina={12} comBusca />
        </Card>
      )}
    </>
  );
}
