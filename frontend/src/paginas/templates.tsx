import { CabecalhoPagina } from "@/components/ui/primitivos";
import { Carregando, ErroCarregamento } from "@/components/ui/estados";
import { ListaTemplates } from "@/components/templates/lista-templates";
import { useTemplates } from "@/hooks/consultas";

export function PaginaTemplates() {
  const templates = useTemplates();

  if (templates.isLoading) {
    return (
      <>
        <CabecalhoPagina titulo="Templates" />
        <Carregando />
      </>
    );
  }

  if (templates.error) {
    return (
      <>
        <CabecalhoPagina titulo="Templates" />
        <ErroCarregamento erro={templates.error} aoTentarNovamente={() => void templates.refetch()} />
      </>
    );
  }

  return <ListaTemplates templates={templates.data ?? []} />;
}
