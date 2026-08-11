import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Usuario } from "@disparoy/dominio";
import { api } from "@/lib/api";
import { EVENTO_SESSAO, gravarSessao, limparSessao, lerSessao } from "@/lib/sessao";

interface RespostaLogin {
  token: string;
  expiraEm: string;
  usuario: Usuario;
}

interface ContextoAuth {
  autenticado: boolean;
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
 * O provider escuta `EVENTO_SESSAO` para reagir a duas coisas que acontecem
 * fora dele: o 401 que limpa o token no meio de uma chamada, e o logout feito
 * em outra aba.
 */
export function ProvedorAuth({ children }: { children: React.ReactNode }) {
  const [autenticado, setAutenticado] = React.useState(() => lerSessao() !== null);
  const cliente = useQueryClient();

  React.useEffect(() => {
    const sincronizar = () => setAutenticado(lerSessao() !== null);
    window.addEventListener(EVENTO_SESSAO, sincronizar);
    // `storage` só dispara em OUTRAS abas — é o que propaga o logout.
    window.addEventListener("storage", sincronizar);
    return () => {
      window.removeEventListener(EVENTO_SESSAO, sincronizar);
      window.removeEventListener("storage", sincronizar);
    };
  }, []);

  const valor = React.useMemo<ContextoAuth>(
    () => ({
      autenticado,
      entrar: async (email, senha) => {
        const r = await api.post<RespostaLogin>("/sessao", { email, senha });
        gravarSessao({ token: r.token, expiraEm: r.expiraEm });
        // O cache pode ter respostas do usuário anterior; limpar evita mostrar
        // o painel de quem acabou de sair enquanto o /eu novo não chega.
        cliente.clear();
      },
      sair: () => {
        limparSessao();
        cliente.clear();
      },
    }),
    [autenticado, cliente],
  );

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
