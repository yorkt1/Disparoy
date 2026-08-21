import * as React from "react";
import { Navigate } from "react-router-dom";
import { BarChart3, Clock } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo, MensagemErro } from "@/components/ui/campos";
import { useAuth } from "@/auth/contexto-auth";
import type { MotivoFim } from "@/lib/sessao";
import { ErroApi } from "@/lib/api";

/**
 * Só entrar — não existe criar conta.
 *
 * Sistema interno: o administrador cadastra cada acesso já com a senha, em
 * Usuários e acessos. Deixar um "criar conta" aqui abriria o painel para
 * qualquer um que alcançasse a URL.
 */
export function PaginaEntrar() {
  const { autenticado, entrar, motivoFim } = useAuth();
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const [enviando, setEnviando] = React.useState(false);

  if (autenticado) return <Navigate to="/dashboard" replace />;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setErro(null);

    try {
      await entrar(email, senha);
    } catch (e) {
      // A API responde a mesma mensagem para e-mail errado, senha errada e
      // acesso desativado — de propósito, para não confirmar quem existe.
      const mensagem =
        e instanceof ErroApi
          ? (e.primeiroCampo ?? e.message)
          : e instanceof Error
            ? e.message
            : "Não foi possível entrar.";
      setErro(mensagem);
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span
            aria-hidden
            className="flex size-9 items-center justify-center rounded-xl bg-marca text-white"
          >
            <BarChart3 className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight text-tinta">DisparoY</span>
        </div>

        <AvisoSessaoEncerrada motivo={motivoFim} />

        <div className="rounded-card border border-borda bg-superficie p-6">
          <h1 className="text-base font-semibold text-tinta">Entrar na sua conta</h1>
          <p className="mt-1 text-xs text-tinta-3">Use o e-mail e a senha cadastrados.</p>

          <form onSubmit={enviar} className="mt-5 flex flex-col gap-4">
            <Campo
              rotulo="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
            <Campo
              rotulo="Senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
            />

            <MensagemErro>{erro}</MensagemErro>

            <Botao
              type="submit"
              variante="primario"
              tamanho="lg"
              className="justify-center"
              carregando={enviando}
            >
              Entrar
            </Botao>
          </form>

          <p className="mt-4 text-center text-xs text-tinta-3">
            Acesso criado pelo administrador. Esqueceu a senha? Peça a ele para redefinir.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Por que a pessoa está vendo esta tela sem ter clicado em Sair.
 *
 * O token vale 12 h e vence no meio do trabalho. Sem esta faixa, o painel
 * simplesmente virava a tela de login: da cadeira de quem estava acompanhando
 * uma campanha, isso é indistinguível de o sistema ter caído e derrubado tudo.
 * A frase sobre o disparo continuar é a parte que importa — a sessão é do
 * navegador, o envio é do worker, e nada para porque alguém deslogou.
 */
function AvisoSessaoEncerrada({ motivo }: { motivo: MotivoFim | null }) {
  if (motivo !== "expirou" && motivo !== "recusada") return null;

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-2.5 rounded-card border border-aviso/35 bg-aviso/10 px-4 py-3"
    >
      <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-aviso" />
      <div>
        <p className="text-sm font-medium text-tinta">
          {motivo === "expirou" ? "Sua sessão expirou" : "Seu acesso foi recusado"}
        </p>
        <p className="mt-0.5 text-xs text-tinta-2">
          {motivo === "expirou"
            ? "O acesso vale 12 horas. Entre de novo para continuar."
            : "O servidor não aceitou mais este acesso. Entre de novo; se repetir, peça ao administrador para conferir seu cadastro."}{" "}
          As campanhas em andamento não param por causa disto — quem envia é o servidor.
        </p>
      </div>
    </div>
  );
}
