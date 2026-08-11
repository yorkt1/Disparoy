import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Campanha,
  Canal,
  Contato,
  ContatoDaCampanha,
  Lista,
  LogAuditoria,
  MetricasDashboard,
  Paginado,
  Papel,
  ResumoCampanha,
  Spintax,
  Template,
  Usuario,
} from "@disparoy/dominio";
import { api } from "@/lib/api";

/**
 * Camada de dados do SPA.
 *
 * Cada escrita invalida as chaves que ela realmente afeta — mais cirúrgico do
 * que recarregar a página inteira, e é o que mantém o painel coerente depois
 * de importar contatos ou pausar uma campanha.
 */

export const chaves = {
  eu: ["eu"] as const,
  metricas: ["metricas"] as const,
  campanhas: (f?: unknown) => ["campanhas", f ?? {}] as const,
  campanha: (id: string) => ["campanha", id] as const,
  canais: ["canais"] as const,
  contatos: (f?: unknown) => ["contatos", f ?? {}] as const,
  listas: ["listas"] as const,
  templates: ["templates"] as const,
  spintax: ["spintax"] as const,
  usuarios: ["usuarios"] as const,
  logs: (f?: unknown) => ["logs", f ?? {}] as const,
};

export interface EstadoIntegracao {
  evolutionConfigurada: boolean;
  metaConfigurada: boolean;
  semProvedor: boolean;
}

export interface Sessao {
  usuario: { id: string; nome: string; email: string; papel: Papel };
  integracao: EstadoIntegracao;
}

export function useSessao(habilitado = true) {
  return useQuery({
    queryKey: chaves.eu,
    queryFn: () => api.get<Sessao>("/eu"),
    staleTime: 60_000,
    // Sem sessão a chamada só renderia 401. Quem decide é o PainelLayout.
    enabled: habilitado,
  });
}

export function useEhAdmin(): boolean {
  return useSessao().data?.usuario.papel === "admin";
}

export function useMetricas() {
  return useQuery({
    queryKey: chaves.metricas,
    queryFn: () => api.get<MetricasDashboard>("/campanhas/metricas"),
    staleTime: 15_000,
  });
}

// --------------------------------------------------------------------------
// Campanhas
// --------------------------------------------------------------------------

export function useCampanhas(filtros: { porPagina?: number; status?: string } = {}) {
  const p = new URLSearchParams();
  if (filtros.porPagina) p.set("porPagina", String(filtros.porPagina));
  if (filtros.status && filtros.status !== "todas") p.set("status", filtros.status);

  return useQuery({
    queryKey: chaves.campanhas(filtros),
    queryFn: () => api.get<Paginado<ResumoCampanha>>(`/campanhas?${p}`),
  });
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
// Canais, contatos, listas
// --------------------------------------------------------------------------

export function useCanais() {
  return useQuery({
    queryKey: chaves.canais,
    queryFn: () => api.get<{ canais: Canal[] }>("/canais").then((r) => r.canais),
  });
}

export interface FiltroContatos {
  pagina?: number;
  porPagina?: number;
  busca?: string;
  situacao?: "todos" | "elegiveis" | "sem_opt_in" | "opt_out";
}

export function useContatos(filtros: FiltroContatos = {}) {
  const p = new URLSearchParams();
  p.set("pagina", String(filtros.pagina ?? 1));
  p.set("porPagina", String(filtros.porPagina ?? 25));
  if (filtros.busca) p.set("busca", filtros.busca);
  if (filtros.situacao && filtros.situacao !== "todos") p.set("situacao", filtros.situacao);

  return useQuery({
    queryKey: chaves.contatos(filtros),
    queryFn: () => api.get<Paginado<Contato>>(`/contatos?${p}`),
  });
}

export function useListas() {
  return useQuery({
    queryKey: chaves.listas,
    queryFn: () => api.get<{ listas: Lista[] }>("/listas").then((r) => r.listas),
  });
}

export function useTemplates() {
  return useQuery({
    queryKey: chaves.templates,
    queryFn: () => api.get<{ templates: Template[] }>("/templates").then((r) => r.templates),
  });
}

export function useSpintax() {
  return useQuery({
    queryKey: chaves.spintax,
    queryFn: () => api.get<{ spintax: Spintax[] }>("/spintax").then((r) => r.spintax),
  });
}

export function useUsuarios(habilitado = true) {
  return useQuery({
    queryKey: chaves.usuarios,
    queryFn: () => api.get<{ usuarios: Usuario[] }>("/usuarios").then((r) => r.usuarios),
    enabled: habilitado,
  });
}

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
// Mutações
// --------------------------------------------------------------------------

/** Invalida as chaves afetadas. Logs entram sempre: toda ação gera auditoria. */
function useInvalidar() {
  const cliente = useQueryClient();
  return (...prefixos: string[]) => {
    for (const p of [...prefixos, "logs"]) {
      void cliente.invalidateQueries({ queryKey: [p] });
    }
  };
}

export function useAjustarCanal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: {
      id: string;
      status?: "conectado" | "desconectado";
      limiteDiario?: number;
      estagioAquecimento?: number;
    }) => {
      const { id, ...corpo } = v;
      return api.patch<{ canal: Canal }>(`/canais/${id}`, corpo);
    },
    onSuccess: () => invalidar("canais"),
  });
}

export function useExcluirCanal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ excluido: string }>(`/canais/${id}`),
    onSuccess: () => invalidar("canais"),
  });
}

export function useCriarCanal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (dados: { nome: string; limiteDiario: number; estagioAquecimento: number }) =>
      api.post<{ canal: Canal; qr: string | null; expiraEm: string | null; aviso?: string }>(
        "/canais",
        dados,
      ),
    onSuccess: () => invalidar("canais"),
  });
}

export function useReconectarCanal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ qr: string; expiraEm: string }>(`/canais/${id}/reconectar`),
    onSuccess: () => invalidar("canais"),
  });
}

export interface EntradaImportacao {
  contatos: unknown[];
  consentimento: { origem: string; obtidoEm: string; confirmacao: true };
  listaId?: string;
  novaLista?: string;
  tags: string[];
}

export function useImportarContatos() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (dados: EntradaImportacao) =>
      api.post<{ importados: number; atualizados: number; ignorados: number; listaId: string | null }>(
        "/contatos/importar",
        dados,
      ),
    onSuccess: () => invalidar("contatos", "listas", "metricas"),
  });
}

export function useRegistrarOptOut() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, motivo }: { id: string; motivo: string }) =>
      api.post<{ registrado: boolean }>(`/contatos/${id}/opt-out`, { motivo }),
    onSuccess: () => invalidar("contatos", "listas", "metricas"),
  });
}

export function useExcluirContato() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ excluido: string }>(`/contatos/${id}`),
    onSuccess: () => invalidar("contatos", "listas", "metricas"),
  });
}

export function useCriarLista() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (dados: { nome: string; descricao: string | null }) =>
      api.post<{ lista: Lista }>("/listas", dados),
    onSuccess: () => invalidar("listas"),
  });
}

export function useExcluirLista() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ excluido: string }>(`/listas/${id}`),
    onSuccess: () => invalidar("listas"),
  });
}

export function useSincronizarTemplates() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: () =>
      api.post<{ importados: number; atualizados: number; total: number }>(
        "/templates/sincronizar",
      ),
    onSuccess: () => invalidar("templates"),
  });
}

export function useCriarTemplate() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (dados: { nome: string; categoria: string; idioma: string; corpo: string }) =>
      api.post<{ template: Template }>("/templates", dados),
    onSuccess: () => invalidar("templates"),
  });
}

export function useSalvarSpintax() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (dados: { nome: string; opcoes: string[] }) =>
      api.post<{ spintax: Spintax }>("/spintax", dados),
    onSuccess: () => invalidar("spintax"),
  });
}

/** Só gera; nada é salvo até o operador conferir e clicar em salvar. */
export function useGerarVariacoes() {
  return useMutation({
    mutationFn: (dados: { texto: string; quantidade: number }) =>
      api.post<{ variacoes: string[] }>("/spintax/gerar", dados),
  });
}

export function useExcluirSpintax() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ excluido: string }>(`/spintax/${id}`),
    onSuccess: () => invalidar("spintax"),
  });
}

export function useCriarCampanha() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (dados: unknown) => api.post<{ campanha: ResumoCampanha }>("/campanhas", dados),
    onSuccess: () => invalidar("campanhas", "metricas"),
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

/** Sem convite por e-mail: o admin já define a senha do novo acesso. */
export function useCriarUsuario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (dados: { nome: string; email: string; senha: string; papel: Papel }) =>
      api.post<{ usuario: Usuario }>("/usuarios", dados),
    onSuccess: () => invalidar("usuarios"),
  });
}

export function useAjustarUsuario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: ({ id, ...corpo }: { id: string; papel?: Papel; ativo?: boolean; senha?: string }) =>
      api.patch<{ usuario: Usuario }>(`/usuarios/${id}`, corpo),
    onSuccess: () => invalidar("usuarios"),
  });
}
