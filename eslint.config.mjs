// ============================================================================
// Lint do monorepo — uma config só para `shared/` e `frontend/`.
//
// Os dois workspaces compartilham as mesmas regras porque `shared/` é copiado
// byte a byte para o repositório do backend: divergir o lint aqui produziria
// arquivos que passam de um lado e falham do outro.
// ============================================================================
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import globals from "globals";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**", "**/*.mjs"] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      // Parâmetro/variável iniciado por `_` é descarte intencional — o padrão
      // usado no repositório para argumento que a assinatura exige e o corpo
      // não usa.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      /**
       * `any` é erro, não aviso.
       *
       * O painel inteiro é tipado a partir de `@disparoy/dominio`, e um `any`
       * solto apaga justamente a checagem que garante que front e backend
       * concordam sobre o formato da resposta da API.
       */
      "@typescript-eslint/no-explicit-any": "error",
    },
  },

  {
    files: ["frontend/src/**/*.{ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "jsx-a11y": jsxA11y,
    },
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],

      /**
       * Só esta regra do `eslint-plugin-react` — o `recommended` dele repete o
       * que o TypeScript já garante (props faltando, tipo errado) e ligaria
       * dezenas de avisos sem valor num projeto tipado.
       *
       * Índice como key faz o React reaproveitar o nó errado quando a lista é
       * reordenada ou tem item removido do meio: o estado do campo (texto
       * digitado, foco) fica no vizinho. Acontece nas opções do spintax, que
       * são exatamente uma lista editável e reordenável.
       */
      "react/no-array-index-key": "warn",

      /**
       * O painel nunca fala com o Supabase nem com a Evolution — só com a API,
       * via `lib/api.ts`. É isso que mantém a `SUPABASE_SERVICE_ROLE_KEY` e a
       * chave da Evolution fora do navegador.
       *
       * Sem esta regra, a barreira existe só no CLAUDE.md, e um `npm install
       * @supabase/supabase-js` seguido de um import passa despercebido na
       * revisão.
       */
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@supabase/*", "*evolution*"],
              message:
                "O painel só fala com a API, via lib/api.ts. Credencial de Supabase/Evolution não pode chegar ao navegador.",
            },
          ],
        },
      ],
    },
  },

  /*
   * `frontend/public/` é servido como está, fora do bundle e fora do TypeScript.
   * Precisa de config própria por dois motivos: os globais do navegador não
   * chegam aqui pela regra de `**\/*.{ts,tsx}`, e o `catch` vazio é o padrão
   * certo quando o `localStorage` lança em aba anônima.
   */
  {
    files: ["frontend/public/**/*.js"],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
    rules: { "no-empty": "off" },
  },

  // Testes encenam entradas malformadas de propósito; exigir tipagem exata
  // neles obrigaria a duplicar os tipos do domínio só para descrever o que é
  // inválido.
  {
    files: ["**/*.test.{ts,tsx}", "**/vitest.setup.ts"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
);
