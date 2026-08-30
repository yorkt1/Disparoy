import { useMutation, useQuery } from "@tanstack/react-query";
import type { Aviso, Incidente } from "@disparoy/dominio";
import { api } from "@/lib/api";
import { chaves, useInvalidar } from "./nucleo";

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
