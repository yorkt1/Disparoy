import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
