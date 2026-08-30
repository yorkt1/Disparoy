import { useMutation, useQuery } from "@tanstack/react-query";
import type {
  Campanha,
  CampanhaEdicao,
  ContatoDaCampanha,
  Paginado,
  ResumoCampanha,
  ResumoSituacao,
} from "@disparoy/dominio";
import { campanhaEntradaSchema } from "@disparoy/dominio";
import type { CampanhaEntrada } from "@disparoy/dominio";
import { api, ErroApi } from "@/lib/api";
import { chaves, useInvalidar, INTERVALO_AO_VIVO } from "./nucleo";

// Campanhas
// --------------------------------------------------------------------------

/**
 * Os contatos de uma campanha, filtrados por situação.
 *
 * Consulta própria, separada de `useCampanha`: trocar o filtro não pode
 * recarregar métrica, gráfico e sequência da tela inteira — e a tela inteira
 * se atualiza sozinha a cada 20 s enquanto a campanha roda, o que apagaria a
 * página em que o operador estava.
 *
 * `aoVivo` acompanha o mesmo ritmo do resto do painel. É aqui que ele mais
 * importa: durante o disparo esta lista é a única tela em que dá para ver
 * resposta chegando.
 */
export function useContatosDaCampanha(
  id: string,
  filtros: { pagina?: number; situacao?: string; busca?: string } = {},
  aoVivo = false,
) {
  const p = new URLSearchParams();
  if (filtros.pagina && filtros.pagina > 1) p.set("pagina", String(filtros.pagina));
  if (filtros.situacao && filtros.situacao !== "todas") p.set("situacao", filtros.situacao);
  if (filtros.busca) p.set("busca", filtros.busca);

  return useQuery({
    queryKey: chaves.contatosDaCampanha(id, filtros),
    queryFn: () =>
      api.get<Paginado<ContatoDaCampanha> & { resumo: ResumoSituacao }>(
        `/campanhas/${id}/contatos?${p}`,
      ),
    enabled: Boolean(id),
    // Sem isto a lista pisca vazia a cada troca de página: o React Query
    // descarta os dados anteriores enquanto busca a página nova.
    placeholderData: (anterior) => anterior,
    refetchInterval: aoVivo ? INTERVALO_AO_VIVO : false,
  });
}

export function useCampanhas(filtros: { porPagina?: number; status?: string } = {}) {
  const p = new URLSearchParams();
  if (filtros.porPagina) p.set("porPagina", String(filtros.porPagina));
  if (filtros.status && filtros.status !== "todas") p.set("status", filtros.status);

  return useQuery({
    queryKey: chaves.campanhas(filtros),
    queryFn: () => api.get<Paginado<ResumoCampanha>>(`/campanhas?${p}`),
    // Campanha andando muda de status e de contador sozinha. Sem isto a lista
    // só mudava com F5, e "em andamento" ficava na tela depois de concluída.
    refetchInterval: (c) =>
      (c.state.data?.itens ?? []).some((i) => i.status === "em_andamento")
        ? INTERVALO_AO_VIVO
        : false,
  });
}

/** Há campanha rodando entre as carregadas? Liga a atualização automática. */
export function temCampanhaAndando(dados: Paginado<ResumoCampanha> | undefined): boolean {
  return (dados?.itens ?? []).some((c) => c.status === "em_andamento");
}

export function useCampanha(id: string) {
  return useQuery({
    queryKey: chaves.campanha(id),
    queryFn: () => api.get<{ campanha: Campanha; contatos: ContatoDaCampanha[] }>(`/campanhas/${id}`),
    enabled: Boolean(id),
    // Campanha em andamento muda sozinha; a tela acompanha sem F5.
    refetchInterval: (c) => (c.state.data?.campanha.status === "em_andamento" ? 10_000 : false),
  });
}

// --------------------------------------------------------------------------

export function useCriarCampanha() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (dados: CampanhaEntrada) => {
      const resultado = campanhaEntradaSchema.safeParse(dados);
      if (!resultado.success) {
        const campos: Record<string, string> = {};
        for (const erro of resultado.error.issues) {
          const caminho = erro.path.join(".");
          if (caminho && !campos[caminho]) campos[caminho] = erro.message;
        }
        throw new ErroApi(resultado.error.issues[0]?.message ?? "Confira os dados da campanha.", 400, campos);
      }
      return api.post<{ campanha: ResumoCampanha }>("/campanhas", resultado.data);
    },
    onSuccess: () => invalidar("campanhas", "metricas"),
  });
}

export function useEditarCampanha() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, ...dados }: { id: string } & CampanhaEdicao) =>
      api.patch<{ campanha: ResumoCampanha }>(`/campanhas/${id}`, dados),
    onSuccess: (_resposta, variaveis) => {
      invalidar("campanhas", "campanha", "metricas", "avisos");
      void variaveis;
    },
  });
}

/**
 * Copia a campanha inteira — texto, canais, intervalos e público — em rascunho.
 *
 * Invalida `campanhas` e `metricas`, não `campanha`: a original não mudou. A
 * cópia é nova e a tela navega para ela, então não há cache dela para sujar.
 */
export function useDuplicarCampanha() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ campanha: ResumoCampanha }>(`/campanhas/${id}/duplicar`),
    onSuccess: () => invalidar("campanhas", "metricas"),
  });
}

export function useExcluirCampanha() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ excluido: string }>(`/campanhas/${id}`),
    onSuccess: () => invalidar("campanhas", "metricas", "avisos"),
  });
}

export function useAlterarExecucao() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, acao }: { id: string; acao: "pausar" | "retomar" }) =>
      api.post<{ campanha: ResumoCampanha }>(`/campanhas/${id}/${acao}`),
    onSuccess: () => invalidar("campanhas", "campanha", "metricas"),
  });
}
