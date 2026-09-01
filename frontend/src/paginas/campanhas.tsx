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

  return (
    <>
      <CabecalhoPagina
        titulo="Campanhas"
        descricao={campanhas.data ? descreverTotal(campanhas.data) : undefined}
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
          <TabelaUltimasCampanhas
            campanhas={campanhas.data?.itens ?? []}
            canais={canais.data ?? []}
            porPagina={12}
            comBusca
          />
        </Card>
      )}
    </>
  );
}

/**
 * O cabeçalho não pode prometer mais do que a tabela tem.
 *
 * A tela carrega um bloco de 100 e pagina no cliente, mas o total vem do
 * servidor: com 120 campanhas o título dizia "120 no total" e o rodapé da
 * tabela dizia "de 100" — e buscar uma campanha antiga respondia "Nenhuma
 * campanha com esse nome", que é falso. Hoje não morde porque são poucas;
 * mordia em silêncio assim que crescesse.
 *
 * Dizer o recorte é o conserto honesto que cabe aqui. O conserto completo é
 * busca no servidor, e isso exige um parâmetro novo em `GET /campanhas` — que
 * mora no outro repositório.
 */
function descreverTotal(dados: { total: number; itens: unknown[] }): string {
  const total = formatarNumero(dados.total);
  if (dados.total <= dados.itens.length) return `${total} campanhas no total`;
  return `${total} campanhas no total · mostrando as ${formatarNumero(dados.itens.length)} mais recentes`;
}
