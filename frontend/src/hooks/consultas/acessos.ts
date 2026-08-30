import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Papel, Usuario } from "@disparoy/dominio";
import { api } from "@/lib/api";
import { entrarComoOutro } from "@/lib/sessao";
import { chaves, useInvalidar } from "./nucleo";

export function useUsuarios(habilitado = true) {
  return useQuery({
    queryKey: chaves.usuarios,
    queryFn: () => api.get<{ usuarios: Usuario[] }>("/usuarios").then((r) => r.usuarios),
    enabled: habilitado,
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

/**
 * Entra no painel COMO outra pessoa, sem a senha dela.
 *
 * Troca a sessão do navegador e limpa o cache inteiro: as consultas em memória
 * são as do admin, e mantê-las mostraria os canais e as campanhas dele dentro
 * da conta do cliente por alguns segundos — exatamente o vazamento visual que
 * esta ferramenta existe para investigar.
 *
 * Não invalida seletivamente por isso: aqui não é "um dado mudou", é "outra
 * pessoa está usando o painel".
 */
export function usePersonificar() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ token: string; expiraEm: string; usuario: Usuario }>(
        `/sessao/personificar/${id}`,
        {},
      ),
    onSuccess: (r) => {
      entrarComoOutro({ token: r.token, expiraEm: r.expiraEm });
      cliente.clear();
    },
  });
}

/**
 * Apaga o acesso de vez. Só a conta de administração; a API recusa o resto.
 *
 * Invalida `empresas` junto porque a tela de Empresas mostra quantos acessos
 * cada uma tem — sem isso a contagem fica um a mais até a próxima recarga, e
 * quem acabou de excluir acha que a exclusão não funcionou.
 */
export function useExcluirUsuario() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/usuarios/${id}`),
    onSuccess: () => invalidar("usuarios", "empresas"),
  });
}

// --------------------------------------------------------------------------
