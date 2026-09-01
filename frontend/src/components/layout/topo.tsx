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
import { apresentarCanal, type Papel } from "@disparoy/dominio";
import { cn } from "@/lib/formato";
import { MenuPerfil, type PerfilSessao } from "./menu-perfil";
import { useAvisos, useCanais, useSessao } from "@/hooks/consultas";

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
  const sinais = useSinaisDaNavegacao();

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-borda bg-plano/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 sm:px-6">
        {/*
          Logo e ações ganham `flex-1` iguais para o menu ficar centrado de
          verdade na barra. Sem isso o menu começava colado no logo e a barra
          inteira pendia para a esquerda, com um vazio grande no meio.
        */}
        <div className="flex min-w-0 flex-1 items-center">
          <Link to="/dashboard" className="flex shrink-0 items-center gap-2">
            <span
              aria-hidden
              className="flex size-7 items-center justify-center rounded-lg bg-marca text-white"
            >
              <BarChart3 className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight text-tinta">DisparoY</span>
          </Link>
        </div>

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
                <SinaisDoItem href={item.href} sinais={sinais} />
              </Link>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
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
                <SinaisDoItem href={item.href} sinais={sinais} />
              </Link>
            );
          })}
        </nav>
      ) : null}
    </header>
  );
}

interface SinaisNav {
  /** Canais cuja sessão caiu — o cliente precisa reconectar. */
  canaisCaidos: number;
  /** O processo de disparo não dá sinal de vida: nada sai. */
  disparoParado: boolean;
  /** Avisos não lidos que NÃO são de canal — esses têm item próprio. */
  avisosNaoLidos: number;
}

/**
 * Os sinais vermelhos da barra, e a qual item cada um pertence.
 *
 * A regra é: o sinal aparece onde se RESOLVE o problema, não onde ele é
 * registrado. Canal caído se resolve em Canais, lendo o QR de novo — apontar
 * para Diagnóstico mandava o operador a uma tela onde ele só podia ler que o
 * canal caiu, e depois navegar até Canais mesmo assim.
 *
 * Por isso os avisos de categoria `canal` saem da contagem de Diagnóstico: o
 * mesmo fato aceso em dois lugares faz o operador conferir os dois toda vez
 * para descobrir que era um só.
 *
 * O de canal vem do estado AO VIVO dos canais, não do aviso: assim ele se apaga
 * sozinho quando a sessão volta, sem depender de alguém marcar como lido.
 */
function useSinaisDaNavegacao(): SinaisNav {
  // Fica no topo de propósito: quando um canal cai, o disparo tem janela de
  // minutos. Um aviso escondido numa tela que ninguém abre chega tarde.
  const canais = useCanais();
  const avisos = useAvisos(false);

  // Mesma query `/eu` que o layout já mantém viva de 20 em 20 segundos: o ponto
  // aparece e some sozinho quando o worker cai e volta, sem depender de F5.
  const disparoParado = useSessao().data?.disparo.ativo === false;

  return {
    // `apresentarCanal` e não `canal.status` cru: o status gravado é cache do
    // webhook, e é ele que produz um canal "conectado" que nunca pareou.
    canaisCaidos: (canais.data ?? []).filter((c) => apresentarCanal(c).status === "desconectado")
      .length,
    disparoParado,
    avisosNaoLidos: (avisos.data ?? []).filter((a) => a.categoria !== "canal").length,
  };
}

function SinaisDoItem({ href, sinais }: { href: string; sinais: SinaisNav }) {
  if (href === "/canais") {
    return sinais.canaisCaidos > 0 ? (
      <Contador
        valor={sinais.canaisCaidos}
        rotulo={`${sinais.canaisCaidos} ${
          sinais.canaisCaidos === 1 ? "canal desconectado" : "canais desconectados"
        }`}
      />
    ) : null;
  }

  if (href !== "/diagnostico") return null;

  /*
   * São dois sinais vermelhos lado a lado, e significam coisas diferentes: o
   * ponto pulsa e o contador não. Vem primeiro porque é o mais grave — enquanto
   * ele estiver lá, NENHUMA campanha sai; aviso não lido é passado, não
   * presente.
   *
   * O ponto substitui a faixa que ficava acima de toda tela. Ela dizia tudo o
   * que precisava, mas aparecia em cima de qualquer coisa que o operador fosse
   * fazer e virava paisagem em uma semana — alerta permanente deixa de ser
   * lido. O texto completo (desde quando, o que acontece com as campanhas) fica
   * na tela de diagnóstico, a um clique daqui.
   */
  return (
    <>
      {sinais.disparoParado && (
        <span
          role="img"
          aria-label="Disparo parado"
          title="Nenhuma campanha está sendo enviada"
          className="ml-0.5 size-2 shrink-0 animate-pulse rounded-full bg-critico motion-reduce:animate-none"
        />
      )}
      {sinais.avisosNaoLidos > 0 && (
        <Contador
          valor={sinais.avisosNaoLidos}
          rotulo={`${sinais.avisosNaoLidos} avisos não lidos`}
        />
      )}
    </>
  );
}

function Contador({ valor, rotulo }: { valor: number; rotulo: string }) {
  return (
    <span
      aria-label={rotulo}
      title={rotulo}
      className="ml-0.5 min-w-4 rounded-full bg-critico px-1 text-center text-[11px] font-medium text-white"
    >
      {valor > 9 ? "9+" : valor}
    </span>
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
