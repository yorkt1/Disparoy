import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./estilos.css";
import { App } from "./App";
import { ProvedorAuth } from "./auth/contexto-auth";
import { ProvedorToast } from "./components/ui/toast";
import { LimiteErro } from "./components/ui/limite-erro";
import { ErroApi } from "./lib/api";
import { vigiarVersaoNova } from "./lib/versao";

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

/*
 * Antes de montar nada: uma aba aberta durante um deploy pede chunks que não
 * existem mais, e o Vite avisa por evento antes de o erro chegar ao React.
 * Recarregar ali resolve sem ninguém ver tela de erro.
 */
vigiarVersaoNova();

const raiz = document.getElementById("raiz");
if (!raiz) throw new Error("Elemento #raiz não encontrado no index.html.");

// O frontend não precisa mais de credencial nenhuma: toda autenticação passa
// pela API. Se ela estiver fora do ar, o PainelLayout é quem explica.
// O `LimiteErro` mais externo é a rede final: pega o que quebrar nos próprios
// provedores ou no roteador, onde o boundary de dentro do painel não alcança.
// Sem ele, esses casos ainda dariam tela branca.
createRoot(raiz).render(
  <StrictMode>
    <LimiteErro>
      <QueryClientProvider client={cliente}>
        <BrowserRouter>
          <ProvedorAuth>
            <ProvedorToast>
              <App />
            </ProvedorToast>
          </ProvedorAuth>
        </BrowserRouter>
      </QueryClientProvider>
    </LimiteErro>
  </StrictMode>,
);
