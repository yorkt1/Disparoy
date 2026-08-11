import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./estilos.css";
import { App } from "./App";
import { ProvedorAuth } from "./auth/contexto-auth";
import { ProvedorToast } from "./components/ui/toast";
import { ErroApi } from "./lib/api";

const cliente = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      // 4xx não se resolve repetindo: 401 é sessão expirada, 403 é falta de
      // permissão. Insistir só atrasa o redirecionamento ou a mensagem.
      retry: (tentativas, erro) => {
        if (erro instanceof ErroApi && erro.status >= 400 && erro.status < 500) return false;
        return tentativas < 2;
      },
    },
  },
});

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("Elemento #raiz não encontrado no index.html.");

// O frontend não precisa mais de credencial nenhuma: toda autenticação passa
// pela API. Se ela estiver fora do ar, o PainelLayout é quem explica.
createRoot(raiz).render(
  <StrictMode>
    <QueryClientProvider client={cliente}>
      <BrowserRouter>
        <ProvedorAuth>
          <ProvedorToast>
            <App />
          </ProvedorToast>
        </ProvedorAuth>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
