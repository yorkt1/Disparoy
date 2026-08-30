import { useMutation, useQuery } from "@tanstack/react-query";
import type { Papel, Usuario } from "@disparoy/dominio";
import { api } from "@/lib/api";
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

// --------------------------------------------------------------------------
