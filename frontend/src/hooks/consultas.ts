/**
 * Ponto único de entrada das consultas — re-exporta os módulos por domínio.
 *
 * O arquivo tinha 695 linhas com sete domínios dentro. Dividi-lo trocando os
 * imports das 27 telas que o consomem seria churn sem ganho: o caminho
 * `@/hooks/consultas` continua valendo, e quem for mexer em canais abre
 * `consultas/canais.ts` em vez de rolar por um arquivo inteiro.
 *
 * Reexportação explícita, e não `export *`: um nome duplicado entre dois
 * domínios falha aqui, na hora, em vez de o bundler escolher um em silêncio.
 */
export {
  chaves,
  useSaudeApi,
  useSessao,
  useEhAdmin,
  useEhContaGlobal,
  useMetricas,
  type EstadoIntegracao,
  type EstadoDisparo,
  type Sessao,
  type EstadoSaudeApi,
} from "./consultas/nucleo";

export {
  useCampanhas,
  useCampanha,
  useContatosDaCampanha,
  temCampanhaAndando,
  useCriarCampanha,
  useEditarCampanha,
  useDuplicarCampanha,
  useExcluirCampanha,
  useAlterarExecucao,
} from "./consultas/campanhas";

export {
  useCanais,
  useVerificarCanal,
  contarContatosDoCanal,
  useVinculosCanal,
  useAjustarCanal,
  useExcluirCanal,
  useCriarCanal,
  useReconectarCanal,
  type Pareamento,
} from "./consultas/canais";

export {
  useTemplates,
  useSincronizarTemplates,
  useCriarTemplate,
  useSpintax,
  useSalvarSpintax,
  useGerarVariacoes,
  useExcluirSpintax,
} from "./consultas/conteudo";

export {
  useUsuarios,
  useTrocarSenha,
  useEmpresas,
  useCriarEmpresa,
  useCriarUsuario,
  useAjustarUsuario,
  useExcluirUsuario,
  usePersonificar,
  type EmpresaResumo,
} from "./consultas/acessos";

export {
  useAvisos,
  useContagemAvisos,
  useIncidentesAbertos,
  useMarcarAvisoLido,
  useMarcarTodosAvisosLidos,
  useArquivarAviso,
} from "./consultas/avisos";

export { useLogs, useDiagnostico, useAmostrasFalha } from "./consultas/observabilidade";
