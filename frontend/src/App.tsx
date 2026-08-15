import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { PainelLayout } from "@/components/layout/painel-layout";
import { Carregando } from "@/components/ui/estados";
import { PaginaEntrar } from "@/paginas/entrar";

/**
 * Telas carregadas sob demanda.
 *
 * Sem isto tudo vira um bundle só: quem abre a tela de login baixaria o wizard
 * de campanha e o importador de contatos junto, sem usar nenhum dos dois.
 *
 * `entrar` fica estático de propósito — é a primeira tela de quem não tem
 * sessão, e um spinner extra ali seria puro atrito.
 */
const PaginaDashboard = lazy(() =>
  import("@/paginas/dashboard").then((m) => ({ default: m.PaginaDashboard })),
);
const PaginaCampanhas = lazy(() =>
  import("@/paginas/campanhas").then((m) => ({ default: m.PaginaCampanhas })),
);
const PaginaNovaCampanha = lazy(() =>
  import("@/paginas/campanha-nova").then((m) => ({ default: m.PaginaNovaCampanha })),
);
const PaginaDetalheCampanha = lazy(() =>
  import("@/paginas/campanha-detalhe").then((m) => ({ default: m.PaginaDetalheCampanha })),
);
const PaginaContatos = lazy(() =>
  import("@/paginas/contatos").then((m) => ({ default: m.PaginaContatos })),
);
const PaginaTemplates = lazy(() =>
  import("@/paginas/templates").then((m) => ({ default: m.PaginaTemplates })),
);
const PaginaCanais = lazy(() =>
  import("@/paginas/canais").then((m) => ({ default: m.PaginaCanais })),
);
const PaginaAvisos = lazy(() =>
  import("@/paginas/avisos").then((m) => ({ default: m.PaginaAvisos })),
);
const PaginaDiagnostico = lazy(() =>
  import("@/paginas/diagnostico").then((m) => ({ default: m.PaginaDiagnostico })),
);
const PaginaLogs = lazy(() => import("@/paginas/logs").then((m) => ({ default: m.PaginaLogs })));
const PaginaPerfil = lazy(() =>
  import("@/paginas/perfil").then((m) => ({ default: m.PaginaPerfil })),
);
const PaginaConfiguracoes = lazy(() =>
  import("@/paginas/configuracoes").then((m) => ({ default: m.PaginaConfiguracoes })),
);
const PaginaNaoEncontrada = lazy(() =>
  import("@/paginas/nao-encontrada").then((m) => ({ default: m.PaginaNaoEncontrada })),
);

export function App() {
  return (
    <Suspense fallback={<Carregando />}>
      <Routes>
        <Route path="/entrar" element={<PaginaEntrar />} />

        <Route element={<PainelLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<PaginaDashboard />} />
          <Route path="/campanhas" element={<PaginaCampanhas />} />
          <Route path="/campanhas/nova" element={<PaginaNovaCampanha />} />
          <Route path="/campanhas/:id" element={<PaginaDetalheCampanha />} />
          <Route path="/contatos" element={<PaginaContatos />} />
          <Route path="/templates" element={<PaginaTemplates />} />
          <Route path="/canais" element={<PaginaCanais />} />
          <Route path="/avisos" element={<PaginaAvisos />} />
          <Route path="/diagnostico" element={<PaginaDiagnostico />} />
          <Route path="/logs" element={<PaginaLogs />} />
          {/* O menu de perfil já linkava para cá; sem esta rota o link caía
              no 404. É também onde se troca a própria senha. */}
          <Route path="/perfil" element={<PaginaPerfil />} />
          <Route path="/configuracoes" element={<PaginaConfiguracoes />} />
        </Route>

        <Route path="*" element={<PaginaNaoEncontrada />} />
      </Routes>
    </Suspense>
  );
}
