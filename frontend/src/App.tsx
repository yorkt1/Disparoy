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
const PaginaEditarCampanha = lazy(() =>
  import("@/paginas/campanha-editar").then((m) => ({ default: m.PaginaEditarCampanha })),
);
const PaginaTemplates = lazy(() =>
  import("@/paginas/templates").then((m) => ({ default: m.PaginaTemplates })),
);
const PaginaCanais = lazy(() =>
  import("@/paginas/canais").then((m) => ({ default: m.PaginaCanais })),
);
const PaginaDiagnostico = lazy(() =>
  import("@/paginas/diagnostico").then((m) => ({ default: m.PaginaDiagnostico })),
);
const PaginaSpintax = lazy(() =>
  import("@/paginas/spintax").then((m) => ({ default: m.PaginaSpintax })),
);
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
          <Route path="/campanhas/:id/editar" element={<PaginaEditarCampanha />} />
          <Route path="/spintax" element={<PaginaSpintax />} />
          {/* Templates sai do menu mas continua acessível: o backend segue
              íntegro para quando houver canal de API Oficial da Meta. */}
          <Route path="/templates" element={<PaginaTemplates />} />
          <Route path="/canais" element={<PaginaCanais />} />
          <Route path="/diagnostico" element={<PaginaDiagnostico />} />
          {/* Avisos e Logs viraram abas de Diagnóstico. As rotas antigas
              redirecionam: links salvos e favoritos continuam funcionando. */}
          <Route path="/avisos" element={<Navigate to="/diagnostico" replace />} />
          <Route path="/logs" element={<Navigate to="/diagnostico" replace />} />
          <Route path="/contatos" element={<Navigate to="/campanhas/nova" replace />} />
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
