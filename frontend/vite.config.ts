import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],

  /**
   * Testes no mesmo arquivo do Vite, e não num `vitest.config.ts` separado: um
   * arquivo próprio SUBSTITUI este em vez de somar, e os testes perderiam o
   * alias `@` — que é como metade do `src/` importa. O erro apareceria como
   * "cannot find module", longe da causa.
   */
  test: {
    /*
     * `node`, não `jsdom`: os testes daqui cobrem lógica pura — normalização de
     * erro da API, montagem da URL base, expiração de sessão. O pouco de
     * navegador que elas tocam (`localStorage`, `window`) é encenado em
     * `vitest.setup.ts`. Trazer o jsdom só faz sentido junto com o primeiro
     * teste que renderiza componente de verdade.
     */
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],

    // Desfaz `vi.stubEnv` antes de CADA teste. `VITE_API_URL` é lida uma vez,
    // no topo de `lib/api.ts`: um valor que sobra de um teste vaza para o
    // seguinte pelo módulo já avaliado, e a falha aparece no arquivo errado.
    unstubEnvs: true,
    restoreMocks: true,
  },

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        /**
         * Bibliotecas em chunks próprios.
         *
         * Elas mudam a cada poucos meses, enquanto o código da aplicação muda
         * todo dia: separadas, um deploy invalida só o chunk da aplicação e o
         * navegador reaproveita o resto do cache.
         */
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          dados: ["@tanstack/react-query"],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Evita CORS e cookies de origem cruzada no desenvolvimento: o front chama
    // /api e o Vite repassa para o Nest.
    proxy: {
      "/api": {
        target: "http://localhost:3333",
        changeOrigin: true,
      },
    },
  },
});
