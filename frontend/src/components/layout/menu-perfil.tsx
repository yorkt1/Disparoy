import * as React from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LogOut, Moon, Settings, ShieldCheck, Sun, UserRound } from "lucide-react";
import { ROTULO_PAPEL, type Papel } from "@disparoy/dominio";
import { cn } from "@/lib/formato";
import { useAuth } from "@/auth/contexto-auth";
import { useTema } from "@/hooks/use-tema";
import { definirTema } from "@/lib/tema";

export interface PerfilSessao {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? "") + (partes.at(-1)?.[0] ?? "")).toUpperCase();
}

export function MenuPerfil({ usuario }: { usuario: PerfilSessao }) {
  const [aberto, setAberto] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { sair } = useAuth();
  const tema = useTema();

  // Fecha ao clicar fora ou apertar Esc — o menu não tem overlay próprio.
  React.useEffect(() => {
    if (!aberto) return;
    function aoClicar(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setAberto(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        className={cn(
          "flex items-center gap-2 rounded-full py-1 pr-2 pl-1 transition-colors",
          aberto ? "bg-superficie-3" : "hover:bg-superficie-2",
        )}
      >
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-full bg-marca-suave text-[11px] font-semibold text-white"
        >
          {iniciais(usuario.nome)}
        </span>
        <span className="hidden text-sm text-tinta-2 lg:block">{usuario.nome.split(" ")[0]}</span>
        <ChevronDown
          aria-hidden
          className={cn("size-4 text-tinta-3 transition-transform", aberto && "rotate-180")}
        />
        <span className="sr-only">Abrir menu de perfil</span>
      </button>

      {aberto ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-64 overflow-hidden rounded-card border border-borda bg-superficie shadow-2xl"
        >
          <div className="border-b border-borda px-4 py-3.5">
            <p className="truncate text-sm font-medium text-tinta">{usuario.nome}</p>
            <p className="truncate text-xs text-tinta-3">{usuario.email}</p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-tinta-3">
              <ShieldCheck aria-hidden className="size-3.5" />
              {ROTULO_PAPEL[usuario.papel]}
            </p>
          </div>

          <div className="py-1">
            <Link
              to="/perfil"
              role="menuitem"
              onClick={() => setAberto(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-tinta-2 hover:bg-superficie-2 hover:text-tinta"
            >
              <UserRound aria-hidden className="size-4" />
              Meu perfil
            </Link>
            {/*
              Aberto a todo mundo, e não só a admin como antes: a tela deixou de
              ser só "Usuários e acessos" e passou a ter a escolha de tema, que
              é de cada pessoa. Ela continua mostrando os acessos apenas para
              quem administra.
            */}
            <Link
              to="/configuracoes"
              role="menuitem"
              onClick={() => setAberto(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-tinta-2 hover:bg-superficie-2 hover:text-tinta"
            >
              <Settings aria-hidden className="size-4" />
              Configurações
            </Link>

            {/*
              Atalho do tema, além do card em Configurações.

              Não é duplicação à toa: a escolha não é "configurar uma vez", é um
              gesto que se repete quando a luz da sala muda. Dois cliques e uma
              troca de tela para isso é atrito suficiente para a pessoa
              simplesmente não trocar.

              O menu NÃO fecha ao clicar — quem experimenta tema quer ver o
              antes e o depois sem reabrir o menu a cada vez.
            */}
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={tema === "escuro"}
              onClick={() => definirTema(tema === "escuro" ? "claro" : "escuro")}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-tinta-2 hover:bg-superficie-2 hover:text-tinta"
            >
              {tema === "escuro" ? (
                <Sun aria-hidden className="size-4" />
              ) : (
                <Moon aria-hidden className="size-4" />
              )}
              {tema === "escuro" ? "Tema claro" : "Tema escuro"}
            </button>
          </div>

          <div className="border-t border-borda py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => void sair()}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-critico hover:bg-critico/10"
            >
              <LogOut aria-hidden className="size-4" />
              Sair da conta
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
