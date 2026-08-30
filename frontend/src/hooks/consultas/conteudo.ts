import { useMutation, useQuery } from "@tanstack/react-query";
import type { Spintax, Template } from "@disparoy/dominio";
import { api } from "@/lib/api";
import { chaves, useInvalidar } from "./nucleo";

/** Templates aprovados da Meta e variações de spintax — o conteúdo reutilizável. */

export function useTemplates() {
  return useQuery({
    queryKey: chaves.templates,
    queryFn: () => api.get<{ templates: Template[] }>("/templates").then((r) => r.templates),
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

export function useSpintax() {
  return useQuery({
    queryKey: chaves.spintax,
    queryFn: () => api.get<{ spintax: Spintax[] }>("/spintax").then((r) => r.spintax),
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
