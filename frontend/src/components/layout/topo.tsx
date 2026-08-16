import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3,
  LayoutDashboard,
  Menu,
  ScanSearch,
  Send,
  Shuffle,
  Smartphone,
  X,
} from "lucide-react";
import { cn } from "@/lib/formato";
import type { Papel } from "@disparoy/dominio";
import { MenuPerfil, type PerfilSessao } from "./menu-perfil";
import { useContagemAvisos } from "@/hooks/consultas";

interface ItemNav {
  href: string;
  rotulo: string;
  icone: typeof LayoutDashboard;
  /** Item visível só para administradores. */
  somenteAdmin?: boolean;
}

/*
 * Contatos saiu: não existe mais cadastro — o público entra na campanha.
 *
 * Avisos e Logs viraram abas de Diagnóstico. Eram três telas respondendo à
 * mesma pergunta em recortes diferentes ("o que quebrou?"), e obrigavam o
 * operador a montar a visão geral de cabeça, pulando entre elas.
 *
 * Templates continua existindo em `/templates`, fora do menu: só serve à API
 * Oficial da Meta, e todo o uso hoje é Evolution com texto livre.
 */
const NAVEGACAO: ItemNav[] = [
  { href: "/dashboard", rotulo: "Dashboard", icone: LayoutDashboard },
  { href: "/campanhas", rotulo: "Campanhas", icone: Send },
  { href: "/spintax", rotulo: "Spintax", icone: Shuffle },
  { href: "/canais", rotulo: "Canais", icone: Smartphone },
  { href: "/diagnostico", rotulo: "Diagnóstico", icone: ScanSearch },
];

export function Topo({ usuario }: { usuario: PerfilSessao }) {
  const pathname = useLocation().pathname;
  const [menuAberto, setMenuAberto] = React.useState(false);

  const ativo = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const visiveis = NAVEGACAO.filter((i) => !i.somenteAdmin || usuario.papel === "admin");

  // Fica no topo de propósito: quando um canal cai, o disparo tem janela de
  // minutos. Um aviso escondido numa tela que ninguém abre chega tarde.
  const contagem = useContagemAvisos();
  const naoLidos = contagem.data?.total ?? 0;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-borda bg-plano/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        <Link to="/dashboard" className="flex shrink-0 items-center gap-2">
          <span
            aria-hidden
            className="flex size-7 items-center justify-center rounded-lg bg-marca text-white"
          >
            <BarChart3 className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight text-tinta">DisparoY</span>
        </Link>

        <nav aria-label="Navegação principal" className="hidden items-center gap-0.5 lg:flex">
          {visiveis.map((item) => {
            const Icone = item.icone;
            const selecionado = ativo(item.href);
            return (
              <Link
                key={item.href}
                to={item.href}
                aria-current={selecionado ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  selecionado
                    ? "bg-superficie-3 font-medium text-tinta"
                    : "text-tinta-2 hover:bg-superficie-2 hover:text-tinta",
                )}
              >
                <Icone aria-hidden className="size-4" />
                {item.rotulo}
                {item.href === "/diagnostico" && naoLidos > 0 && (
                  <span
                    aria-label={`${naoLidos} avisos não lidos`}
                    className="ml-0.5 min-w-4 rounded-full bg-critico px-1 text-center text-[11px] font-medium text-white"
                  >
                    {naoLidos > 9 ? "9+" : naoLidos}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <SeloPapel papel={usuario.papel} />
          <MenuPerfil usuario={usuario} />
          <button
            type="button"
            onClick={() => setMenuAberto((v) => !v)}
            aria-expanded={menuAberto}
            aria-controls="nav-mobile"
            aria-label={menuAberto ? "Fechar navegação" : "Abrir navegação"}
            className="rounded-lg p-2 text-tinta-2 hover:bg-superficie-2 hover:text-tinta lg:hidden"
          >
            {menuAberto ? (
              <X aria-hidden className="size-5" />
            ) : (
              <Menu aria-hidden className="size-5" />
            )}
          </button>
        </div>
      </div>

      {menuAberto ? (
        <nav
          id="nav-mobile"
          aria-label="Navegação principal (compacta)"
          className="border-t border-borda bg-plano px-4 py-2 lg:hidden"
        >
          {visiveis.map((item) => {
            const Icone = item.icone;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMenuAberto(false)}
                aria-current={ativo(item.href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm",
                  ativo(item.href)
                    ? "bg-superficie-3 font-medium text-tinta"
                    : "text-tinta-2 hover:bg-superficie-2",
                )}
              >
                <Icone aria-hidden className="size-4" />
                {item.rotulo}
                {item.href === "/diagnostico" && naoLidos > 0 && (
                  <span
                    aria-label={`${naoLidos} avisos não lidos`}
                    className="ml-0.5 min-w-4 rounded-full bg-critico px-1 text-center text-[11px] font-medium text-white"
                  >
                    {naoLidos > 9 ? "9+" : naoLidos}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}

/**
 * Papel do usuário no lugar onde antes ficava o plano.
 *
 * Não há planos: o sistema é interno e billing está fora do escopo. O que
 * importa saber de relance é o nível de acesso, porque ele muda o que a tela
 * mostra e o que o botão faz.
 */
function SeloPapel({ papel }: { papel: Papel }) {
  const admin = papel === "admin";
  return (
    <span
      className={cn(
        "hidden rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset sm:inline-flex",
        admin
          ? "bg-marca/10 text-marca-tenue ring-marca/30"
          : "bg-superficie-3 text-tinta-2 ring-borda-forte",
      )}
    >
      {admin ? "Administrador" : "Operador"}
    </span>
  );
}
