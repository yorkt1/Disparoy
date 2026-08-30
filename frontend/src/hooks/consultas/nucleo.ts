import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MetricasDashboard, Papel } from "@disparoy/dominio";
import { api } from "@/lib/api";

/**
 * O núcleo do acesso a dados: chaves de cache, sessão e invalidação.
 *
 * As chaves moram aqui, e não em cada domínio, porque colisão entre elas é o
 * defeito que ninguém vê — duas consultas com a mesma chave fazem uma tela
 * mostrar o dado de outra, e um prefixo que não casa faz a tela não atualizar
 * depois de uma escrita. Juntas num lugar só, dá para conferir a tabela inteira
 * de uma vez.
 */

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
  contatosDaCampanha: (id: string, f?: unknown) => ["campanha", id, "contatos", f ?? {}] as const,
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

export interface EstadoSaudeApi {
  ok: boolean;
  banco: "ok" | "indisponivel";
}

export function useSaudeApi() {
  return useQuery({
    queryKey: ["saude-api"],
    queryFn: () => api.get<EstadoSaudeApi>("/saude"),
    staleTime: 20_000,
    refetchInterval: 20_000,
    retry: false,
  });
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
    refetchInterval: 20_000,
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
export const INTERVALO_AO_VIVO = 20_000;

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

// Mutações
// --------------------------------------------------------------------------

/** Invalida as chaves afetadas. Logs entram sempre: toda ação gera auditoria. */
export function useInvalidar() {
  const cliente = useQueryClient();
  return (...prefixos: string[]) => {
    for (const p of [...prefixos, "logs"]) {
      void cliente.invalidateQueries({ queryKey: [p] });
    }
  };
}
