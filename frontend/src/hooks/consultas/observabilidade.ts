import { useQuery } from "@tanstack/react-query";
import type { AmostraFalha, Diagnostico, LogAuditoria, Paginado } from "@disparoy/dominio";
import { api } from "@/lib/api";
import { chaves } from "./nucleo";

/** Logs de auditoria e diagnóstico de falhas — o que se olha depois do fato. */

export function useLogs(filtros: { porPagina?: number; tipoEntidade?: string } = {}) {
  const p = new URLSearchParams();
  p.set("porPagina", String(filtros.porPagina ?? 100));
  if (filtros.tipoEntidade && filtros.tipoEntidade !== "todas") {
    p.set("tipoEntidade", filtros.tipoEntidade);
  }

  return useQuery({
    queryKey: chaves.logs(filtros),
    queryFn: () => api.get<Paginado<LogAuditoria>>(`/logs?${p}`),
  });
}

// --------------------------------------------------------------------------

// Diagnóstico
//
// Sem `refetchInterval`, ao contrário dos avisos: aqui não se acompanha nada ao
// vivo, se estuda o acumulado. A tela é aberta para decidir se uma regra de
// classificação precisa mudar, e esse número não muda de trinta em trinta
// segundos. O `staleTime` alto é o que deixa alternar entre janelas de tempo
// sem refazer a agregação no banco a cada clique.
// --------------------------------------------------------------------------

export function useDiagnostico(dias: number) {
  return useQuery({
    queryKey: chaves.diagnostico(dias),
    queryFn: () => api.get<Diagnostico>(`/diagnostico?dias=${dias}`),
    staleTime: 120_000,
  });
}

/** Amostras de um código só. `enabled` porque só carrega quando a linha abre. */
export function useAmostrasFalha(dias: number, codigo: string | null) {
  return useQuery({
    queryKey: chaves.amostrasFalha(dias, codigo ?? ""),
    queryFn: () =>
      api.get<AmostraFalha[]>(
        `/diagnostico/amostras?dias=${dias}&codigo=${encodeURIComponent(codigo ?? "")}`,
      ),
    enabled: codigo !== null,
    staleTime: 120_000,
  });
}
