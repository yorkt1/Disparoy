import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AmostraFalha,
  Aviso,
  Campanha,
  Canal,
  ContatoDaCampanha,
  Diagnostico,
  Incidente,
  LogAuditoria,
  MetodoPareamento,
  MetricasDashboard,
  Paginado,
  Papel,
  ResumoCampanha,
  Spintax,
  StatusCampanha,
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
  avisos: ["avisos"] as const,
  incidentes: ["incidentes"] as const,
  diagnostico: (dias: number) => ["diagnostico", dias] as const,
  amostrasFalha: (dias: number, codigo: string) => ["diagnostico", dias, codigo] as const,
};

export interface EstadoIntegracao {
  evolutionConfigurada: boolean;
  metaConfigurada: boolean;
  semProvedor: boolean;
}

/**
 * Sinal de vida do worker de disparo.
 *
 * `ativo: false` significa que nenhuma campanha está saindo — foi assim por
 * dias sem nada na tela dizer isso. `pulsoEm` nulo é "nunca bateu": worker que
 * jamais subiu, e não worker que parou agora.
 */
export interface EstadoDisparo {
  pulsoEm: string | null;
  ativo: boolean;
}

export interface Sessao {
  usuario: {
    id: string;
    nome: string;
    email: string;
    papel: Papel;
    /** `null` = conta de administração do sistema, que atravessa as empresas. */
    empresaId: string | null;
  };
  integracao: EstadoIntegracao;
  disparo: EstadoDisparo;
}

/**
 * É a conta que administra o SISTEMA (cria empresas e acessos)?
 *
 * Diferente de `useEhAdmin`: cada empresa cliente tem o próprio administrador,
 * e ele administra a empresa dele. Só quem não pertence a empresa nenhuma
 * administra o sistema.
 */
export function useEhContaGlobal(): boolean {
  const sessao = useSessao();
  return sessao.data?.usuario.empresaId === null;
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

/**
 * Quanto tempo entre atualizações automáticas enquanto há campanha rodando.
 *
 * Casado com o worker: os contadores de entrega são agregados por uma rotina
 * que roda de minuto em minuto, então buscar mais rápido que isso é tráfego
 * sem informação nova. 20 s deixa o número aparecer em no máximo ~80 s do
 * evento real, que é o que se espera de um painel de acompanhamento.
 */
const INTERVALO_AO_VIVO = 20_000;

/**
 * Métricas do dashboard.
 *
 * `aoVivo` vem de fora porque a resposta não diz se há campanha rodando — quem
 * sabe disso é a lista de campanhas, que o dashboard já carrega. Preferi isso a
 * adicionar um campo na rota de métricas: o tipo `MetricasDashboard` mora no
 * pacote compartilhado, que está DUPLICADO nos dois repositórios, então cada
 * campo novo lá vira dois arquivos para manter em sincronia.
 */
export function useMetricas(aoVivo = false) {
  return useQuery({
    queryKey: chaves.metricas,
    queryFn: () => api.get<MetricasDashboard>("/campanhas/metricas"),
    staleTime: 15_000,
    /**
     * Sem isto o dashboard ficava parado: o operador via a campanha saindo no
     * WhatsApp e os números congelados, e concluía que o disparo tinha travado.
     * Fora do disparo, buscar de 20 em 20 s seria tráfego à toa — a aba deste
     * painel costuma passar o dia aberta.
     */
    refetchInterval: aoVivo ? INTERVALO_AO_VIVO : false,
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
// Canais, contatos, listas
// --------------------------------------------------------------------------

export function useCanais() {
  return useQuery({
    queryKey: chaves.canais,
    queryFn: () => api.get<{ canais: Canal[] }>("/canais").then((r) => r.canais),
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

/**
 * Pergunta ao gateway o estado real da sessão, agora.
 *
 * `confirmado: false` quer dizer que o gateway não respondeu — e nesse caso
 * nada foi gravado. A tela precisa dizer "não consegui perguntar", nunca
 * "desconectado": um é problema nosso, o outro manda o cliente correr atrás de
 * um QR Code que está funcionando.
 */
export function useVerificarCanal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ canal: Canal; confirmado: boolean }>(`/canais/${id}/verificar`),
    onSuccess: () => invalidar("canais"),
  });
}

/**
 * Quantos contatos a agenda do canal tem agora.
 *
 * Consultado em laço logo após o pareamento: o WhatsApp sincroniza a agenda
 * com o gateway aos poucos, e nos primeiros segundos ela vem vazia.
 */
export function contarContatosDoCanal(id: string) {
  return api.get<{ total: number }>(`/canais/${id}/contatos/contagem`);
}

/** Campanhas que dependem do canal — perguntado antes de confirmar a exclusão. */
export function useVinculosCanal(id: string | null) {
  return useQuery({
    queryKey: ["canal-vinculos", id],
    queryFn: () =>
      api.get<{ campanhas: { id: string; nome: string; status: StatusCampanha }[] }>(
        `/canais/${id}/vinculos`,
      ),
    enabled: id !== null,
  });
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
    /**
     * `forcar` desvincula as campanhas junto.
     *
     * Antes a API recusava e mandava "desconecte em vez de excluir" — o canal
     * ficava para sempre na lista sem saída pelo produto. Agora a tela pergunta
     * antes, mostrando quais campanhas dependem dele.
     */
    mutationFn: (v: { id: string; forcar?: boolean }) =>
      api.delete<{ excluido: string }>(`/canais/${v.id}${v.forcar ? "?forcar=true" : ""}`),
    onSuccess: () => invalidar("canais"),
  });
}

/** O que a API devolve ao abrir um pareamento, seja na criação ou na reconexão. */
export interface Pareamento {
  metodo: MetodoPareamento;
  /** Preenchido no método `qrcode`. */
  qr: string | null;
  /** Código de 8 dígitos, preenchido no método `codigo`. */
  codigo: string | null;
  expiraEm: string | null;
  aviso?: string;
}

export function useCriarCanal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (dados: {
      nome: string;
      /** `null` = sem teto diário, que virou o padrão. */
      limiteDiario: number | null;
      estagioAquecimento: number;
      metodoPareamento: MetodoPareamento;
      /** Só no método `codigo`: o celular que vai parear. */
      numeroPareamento?: string;
    }) => api.post<Pareamento & { canal: Canal }>("/canais", dados),
    onSuccess: () => invalidar("canais"),
  });
}

export function useReconectarCanal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: {
      id: string;
      metodoPareamento: MetodoPareamento;
      numeroPareamento?: string;
      /** Confirma derrubar uma sessão viva; sem isto a API responde 409. */
      forcar?: boolean;
    }) => {
      const { id, ...corpo } = v;
      return api.post<Pareamento>(`/canais/${id}/reconectar`, corpo);
    },
    onSuccess: () => invalidar("canais"),
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

/**
 * Troca da própria senha.
 *
 * Não invalida cache nenhum: nada do que está na tela depende da senha, e
 * `/eu` continua devolvendo exatamente os mesmos dados.
 */
export function useTrocarSenha() {
  return useMutation({
    mutationFn: (dados: { senhaAtual: string; novaSenha: string }) =>
      api.patch<void>("/sessao/senha", dados),
  });
}

/** Sem convite por e-mail: o admin já define a senha do novo acesso. */
/**
 * Empresas do sistema — só a conta de administração enxerga.
 *
 * `habilitado` porque a rota devolve 400 para quem pertence a uma empresa: a
 * tela só a consulta quando o acesso é global.
 */
export interface EmpresaResumo {
  id: string;
  nome: string;
  ativa: boolean;
  criadaEm: string;
  acessos: number;
  canais: number;
}

export function useEmpresas(habilitado = true) {
  return useQuery({
    queryKey: ["empresas"],
    queryFn: () => api.get<{ empresas: EmpresaResumo[] }>("/empresas").then((r) => r.empresas),
    enabled: habilitado,
  });
}

export function useCriarEmpresa() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (nome: string) => api.post<{ empresa: EmpresaResumo }>("/empresas", { nome }),
    onSuccess: () => invalidar("empresas", "usuarios"),
  });
}

export function useCriarUsuario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (dados: {
      nome: string;
      email: string;
      senha: string;
      papel: Papel;
      /** A empresa do acesso. Só a conta global escolhe; `null` cria outra global. */
      empresaId?: string | null;
    }) => api.post<{ usuario: Usuario }>("/usuarios", dados),
    onSuccess: () => invalidar("usuarios", "empresas"),
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

// --------------------------------------------------------------------------
// Avisos
//
// A caixa é por perfil e o backend filtra pelo token — não existe parâmetro de
// usuário aqui de propósito. `refetchInterval` de 30 s porque o disparo tem
// janela curta: descobrir só na próxima navegação que o canal caiu seria
// descobrir tarde demais.
// --------------------------------------------------------------------------

export function useAvisos(incluirLidos = false) {
  return useQuery({
    queryKey: [...chaves.avisos, incluirLidos],
    queryFn: () => api.get<Aviso[]>(`/avisos?incluirLidos=${incluirLidos}`),
    refetchInterval: 30_000,
  });
}

/** Só o número do sininho: leve o bastante para viver no topo de toda tela. */
export function useContagemAvisos() {
  return useQuery({
    queryKey: [...chaves.avisos, "contagem"],
    queryFn: () => api.get<{ total: number }>("/avisos/contagem"),
    refetchInterval: 30_000,
  });
}

export function useIncidentesAbertos() {
  return useQuery({
    queryKey: chaves.incidentes,
    queryFn: () => api.get<Incidente[]>("/avisos/incidentes"),
    refetchInterval: 30_000,
  });
}

export function useMarcarAvisoLido() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: number) => api.post<{ ok: true }>(`/avisos/${id}/lido`),
    onSuccess: () => invalidar("avisos"),
  });
}

export function useMarcarTodosAvisosLidos() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: () => api.post<{ ok: true }>("/avisos/lidos"),
    onSuccess: () => invalidar("avisos"),
  });
}

export function useArquivarAviso() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: number) => api.post<{ ok: true }>(`/avisos/${id}/arquivar`),
    onSuccess: () => invalidar("avisos", "incidentes"),
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
