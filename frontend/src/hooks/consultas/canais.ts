import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Canal,
  MembroCanal,
  MetodoPareamento,
  PermissaoCanal,
  StatusCampanha,
} from "@disparoy/dominio";
import { api } from "@/lib/api";
import { chaves, useInvalidar } from "./nucleo";

// Canais, contatos, listas
// --------------------------------------------------------------------------

export function useCanais() {
  return useQuery({
    queryKey: chaves.canais,
    queryFn: () => api.get<{ canais: Canal[] }>("/canais").then((r) => r.canais),
    refetchInterval: 20_000,
  });
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
    onSuccess: () => invalidar("canais", "campanhas", "metricas", "avisos"),
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
      /*
       * `aviso` chega quando o ajuste valeu só localmente.
       *
       * Desconectar um canal de QR encerra a sessão na Evolution antes de mudar
       * o status aqui. Quando a Evolution recusa, o status muda mesmo assim — e
       * o número continua pareado lá. Quem ligar este hook numa tela PRECISA
       * exibir este campo: sem ele, o painel afirma "desconectado" com uma
       * convicção que não tem, e o operador entrega o chip achando que a sessão
       * caiu.
       */
      return api.patch<{ canal: Canal; aviso?: string }>(`/canais/${id}`, corpo);
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
    // Mesma razão de `useCriarCanal`: o canal excluído sumiria da lista de
    // Canais e continuaria contando como conectado na tela de Empresas.
    onSuccess: () => invalidar("canais", "empresas"),
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
    // `empresas` junto: a administração lista os canais de cada cliente, e sem
    // isto a empresa continuava "sem canal" depois de o cliente conectar um.
    onSuccess: () => invalidar("canais", "empresas"),
  });
}

export function useReconectarCanal() {
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: {
      id: string;
      metodoPareamento: MetodoPareamento;
      numeroPareamento?: string;
      /**
       * Confirma derrubar uma sessão que ainda está de pé.
       *
       * A API pergunta ao gateway antes de reconectar e devolve 409 quando o
       * canal está mesmo conectado — reiniciar a instância ali não conserta
       * nada e corta a campanha que estiver enviando por ele. O 409 termina em
       * "Confirme para prosseguir", e ESTE campo é a confirmação.
       *
       * Sem ele o campo não existia no front, e a tela mostrava um pedido de
       * confirmação que não tinha como ser confirmado: o operador lia
       * "Confirme para prosseguir" e não havia botão nenhum. Quem manda é
       * `ModalReconectarCanal`, depois de mostrar o que vai ser derrubado.
       */
      forcar?: boolean;
    }) => {
      const { id, ...corpo } = v;
      return api.post<Pareamento>(`/canais/${id}/reconectar`, corpo);
    },
    onSuccess: () => invalidar("canais", "campanhas", "metricas", "avisos"),
  });
}

// --------------------------------------------------------------------------
// Compartilhamento do canal com a equipe
// --------------------------------------------------------------------------

/**
 * Quem opera este canal além de quem o conectou.
 *
 * As três rotas de membros existiam na API desde sempre e nenhuma tela as
 * chamava. Passou a doer quando conectar canal deixou de ser ato
 * administrativo: o operador cria o canal dele, vira `owner` sozinho, e
 * nenhum colega enxerga o número — sem caminho nenhum para compartilhar.
 *
 * `habilitado` porque a consulta só faz sentido com um canal escolhido; o
 * modal monta antes de haver um.
 */
export function useMembrosCanal(canalId: string | null) {
  return useQuery({
    queryKey: ["canal-membros", canalId],
    queryFn: () => api.get<{ membros: MembroCanal[] }>(`/canais/${canalId}/membros`),
    select: (r) => r.membros,
    enabled: canalId !== null,
  });
}

export function useDefinirMembro() {
  const cliente = useQueryClient();
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { canalId: string; perfilId: string; permissao: PermissaoCanal }) =>
      api.post<{ vinculado: string }>(`/canais/${v.canalId}/membros`, {
        perfilId: v.perfilId,
        permissao: v.permissao,
      }),
    onSuccess: (_r, v) => {
      void cliente.invalidateQueries({ queryKey: ["canal-membros", v.canalId] });
      // `canais` junto: quem ganhou acesso passa a ver o canal na lista dele,
      // e quem compartilhou não tem por que recarregar a página para conferir.
      invalidar("canais");
    },
  });
}

export function useRemoverMembro() {
  const cliente = useQueryClient();
  const invalidar = useInvalidar();
  return useMutation({
    mutationFn: (v: { canalId: string; perfilId: string }) =>
      api.delete<{ removido: string }>(`/canais/${v.canalId}/membros/${v.perfilId}`),
    onSuccess: (_r, v) => {
      void cliente.invalidateQueries({ queryKey: ["canal-membros", v.canalId] });
      invalidar("canais");
    },
  });
}
