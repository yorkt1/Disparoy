import { CabecalhoPagina } from "@/components/ui/primitivos";
import { Carregando, ErroCarregamento } from "@/components/ui/estados";
import { TabelaLogs } from "@/components/logs/tabela-logs";
import { useLogs } from "@/hooks/consultas";

export function PaginaLogs() {
  const logs = useLogs({ porPagina: 100 });

  if (logs.isLoading) {
    return (
      <>
        <CabecalhoPagina titulo="Logs" />
        <Carregando />
      </>
    );
  }

  if (logs.error) {
    return (
      <>
        <CabecalhoPagina titulo="Logs" />
        <ErroCarregamento erro={logs.error} aoTentarNovamente={() => void logs.refetch()} />
      </>
    );
  }

  return <TabelaLogs logs={logs.data?.itens ?? []} />;
}
