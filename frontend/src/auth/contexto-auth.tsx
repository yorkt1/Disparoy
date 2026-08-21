import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Usuario } from "@disparoy/dominio";
import { api } from "@/lib/api";
import {
  EVENTO_SESSAO,
  gravarSessao,
  limparSessao,
  lerSessao,
  msAteVencer,
  type MotivoFim,
} from "@/lib/sessao";

interface RespostaLogin {
  token: string;
  expiraEm: string;
  usuario: Usuario;
}

interface ContextoAuth {
  autenticado: boolean;
  /** Por que a sessão anterior acabou. `null` = ninguém entrou ainda nesta aba. */
  motivoFim: MotivoFim | null;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => void;
}

const Ctx = React.createContext<ContextoAuth | null>(null);

export function useAuth(): ContextoAuth {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <ProvedorAuth>.");
  return ctx;
}

/**
 * Sessão própria: token emitido pela API, guardado no navegador.
 *
 * Não há estado de "carregando": o token vem do `localStorage` de forma
 * síncrona, então a primeira renderização já sabe se há sessão. O que era
 * assíncrono antes era a ida ao Supabase Auth.
 *
 * O provider escuta `EVENTO_SESSAO` para reagir a três coisas que acontecem
 * fora dele: o 401 que limpa o token no meio de uma chamada, o logout feito em
 * outra aba, e a expiração descoberta numa leitura de rotina.
 */
export function ProvedorAuth({ children }: { children: React.ReactNode }) {
  const [autenticado, setAutenticado] = React.useState(() => lerSessao() !== null);
  const [motivoFim, setMotivoFim] = React.useState<MotivoFim | null>(null);
  const cliente = useQueryClient();

  React.useEffect(() => {
    const sincronizar = (e: Event) => {
      const motivo = (e as CustomEvent<{ motivo?: MotivoFim }>).detail?.motivo ?? null;
      const temSessao = lerSessao() !== null;
      setAutenticado(temSessao);

      if (temSessao) {
        setMotivoFim(null);
        return;
      }

      setMotivoFim(motivo);
      /*
       * O cache morre junto com a sessão, seja qual for o motivo.
       *
       * Ele guarda campanhas, contatos e o `/eu` de quem estava logado. Limpar
       * só no login seguinte deixava esses dados vivos em memória durante todo
       * o tempo em que a tela de login ficasse aberta — e, num computador
       * compartilhado, a próxima pessoa via o painel da anterior por um quadro
       * antes do refetch.
       */
      cliente.clear();
    };

    window.addEventListener(EVENTO_SESSAO, sincronizar);
    // `storage` só dispara em OUTRAS abas — é o que propaga o logout.
    window.addEventListener("storage", sincronizar);
    return () => {
      window.removeEventListener(EVENTO_SESSAO, sincronizar);
      window.removeEventListener("storage", sincronizar);
    };
  }, [cliente]);

  /**
   * Derruba a sessão no instante em que o token vence.
   *
   * Antes a expiração só era notada quando alguma chamada saía: uma aba aberta
   * desde a manhã continuava exibindo o painel inteiro — números, botão de
   * disparar, tudo — e o primeiro clique da tarde caía num erro. Agendar a
   * saída faz a tela contar a verdade sem esperar o próximo clique.
   */
  React.useEffect(() => {
    if (!autenticado) return;

    const encerrarSeVenceu = (): boolean => {
      const restante = msAteVencer();
      if (restante > 0) return false;
      limparSessao("expirou");
      return true;
    };

    if (encerrarSeVenceu()) return;

    const cronometro = setTimeout(encerrarSeVenceu, msAteVencer());

    /*
     * Máquina suspensa não faz `setTimeout` avançar de forma confiável, e este
     * espera até 12 h. Reconferir ao voltar para a aba garante que o painel de
     * um notebook que dormiu a noite inteira já abra no login, e não depois de
     * um clique que falha.
     */
    const reconferir = () => {
      if (document.visibilityState === "visible") encerrarSeVenceu();
    };
    document.addEventListener("visibilitychange", reconferir);
    window.addEventListener("focus", reconferir);

    return () => {
      clearTimeout(cronometro);
      document.removeEventListener("visibilitychange", reconferir);
      window.removeEventListener("focus", reconferir);
    };
  }, [autenticado]);

  const valor = React.useMemo<ContextoAuth>(
    () => ({
      autenticado,
      motivoFim,
      entrar: async (email, senha) => {
        const r = await api.post<RespostaLogin>("/sessao", { email, senha });
        gravarSessao({ token: r.token, expiraEm: r.expiraEm });
        // O cache pode ter respostas do usuário anterior; limpar evita mostrar
        // o painel de quem acabou de sair enquanto o /eu novo não chega.
        cliente.clear();
      },
      sair: () => {
        limparSessao("saiu");
      },
    }),
    [autenticado, motivoFim, cliente],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
