/// <reference types="vite/client" />

/** Variáveis de ambiente do frontend. Só o prefixo VITE_ chega ao navegador. */
interface ImportMetaEnv {
  /** Ausente em desenvolvimento: o Vite faz proxy de /api. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
