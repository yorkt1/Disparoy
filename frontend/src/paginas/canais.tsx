import { CabecalhoPagina } from "@/components/ui/primitivos";
import { Carregando, ErroCarregamento } from "@/components/ui/estados";
import { ListaCanais } from "@/components/canais/lista-canais";
import { useCanais } from "@/hooks/consultas";

export function PaginaCanais() {
  const canais = useCanais();

  if (canais.isLoading) {
    return (
      <>
        <CabecalhoPagina titulo="Canais" />
        <Carregando />
      </>
    );
  }

  if (canais.error) {
    return (
      <>
        <CabecalhoPagina titulo="Canais" />
        <ErroCarregamento erro={canais.error} aoTentarNovamente={() => void canais.refetch()} />
      </>
    );
  }

  return <ListaCanais canais={canais.data ?? []} />;
}
