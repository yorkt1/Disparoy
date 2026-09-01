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
 * O `intervalo` vem pronto de quem chama, e não de um booleano `aoVivo`, por
 * causa do bug que isto conserta: `aoVivo` era `status === "em_andamento"`, e
 * a atualização automática MORRIA no instante em que o disparo terminava.
 * Só que resposta e recibo de leitura chegam depois — o disparo leva minutos,
 * a conversa leva horas. A única tela em que dá para ver resposta chegando
 * ficava congelada exatamente quando começava a chegar, e quem lia a mensagem
 * no celular via o painel continuar dizendo "não lido" até recarregar a página
 * na mão.
 */
export function useContatosDaCampanha(
  id: string,
  filtros: { pagina?: number; situacao?: string; busca?: string } = {},
  intervalo: number | false = false,
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
    refetchInterval: intervalo,
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
