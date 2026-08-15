# Disparoy — painel

Frontend do Disparoy, plataforma de disparo de WhatsApp. A API e o worker vivem
em `Disparoy-Backend` (repositório separado).

## Idioma

Código, nomes de arquivo, rotas e comentários em **português**. `campanhas`,
`canais`, `paginas/`, `seletor-canais.tsx`. Não traduza para inglês — o domínio
é falado em português com o cliente, e vocabulário misto obriga a traduzir de
cabeça toda vez que se lê um bug report.

Arquivos em `kebab-case`, um componente por arquivo.

## Estrutura

```
shared/            @disparoy/dominio — regras puras, compartilhadas com o backend
frontend/src/
  paginas/         uma por rota
  components/      agrupados por domínio (campanhas/, canais/, contatos/)
  components/ui/   primitivos sem domínio (botao, campos, modal, tabela)
  hooks/           consultas.ts concentra o React Query
  lib/api.ts       cliente HTTP: anexa o JWT e normaliza erro
  auth/            contexto de sessão
```

**`shared/` é duplicado byte a byte no repositório do backend.** Ao mexer nele,
copie para `../Disparoy-Backend/shared/src/` e confirme com `diff -rq`. Um
`shared` divergente entre os dois lados produz bug que só aparece em produção.

## Regras que não se quebram

**O painel nunca fala com o Supabase nem com a Evolution.** Só com a API, via
`lib/api.ts`. É isso que mantém a `SUPABASE_SERVICE_ROLE_KEY` e a chave da
Evolution fora do navegador. Não existe anon key aqui, e o `.env.example` diz
isso explicitamente.

**Erro se apresenta pela categoria, nunca pelo texto.** Toda falha vinda da API
carrega `erro_categoria` (`canal`, `destinatario`, `infra`, `configuracao`,
`conteudo`, `limite`). A cor, o selo e a ação da tela saem da categoria — nunca
de comparar a string do erro. `origemDe(categoria)` em `@disparoy/dominio` dá o
rótulo pronto.

A distinção que mais importa: `canal` significa "o WhatsApp do cliente caiu,
reconecte" e `infra` significa "o problema é nosso, não faça nada". Se essas
duas aparecerem iguais na tela, o operador vai concluir que o sistema quebrou.

**Cor sempre por variável CSS**, nunca hex literal — o painel tem modo escuro.

**Estado de servidor é React Query**, em `hooks/consultas.ts`. Não duplique em
`useState`.

## Comentários

Comentário explica **por que**, nunca o quê. O padrão do repositório é registrar
a decisão e o que aconteceria sem ela. Comentário que parafraseia a linha
seguinte é ruído.

## Verificação

```bash
npm run typecheck
npm test
```

## Deploy

Vercel, direto do `main`. `VITE_API_URL` aponta para a API no Render; em
desenvolvimento o Vite faz proxy de `/api` para `localhost:3333`.

O `vercel.json` carrega os cabeçalhos de segurança (CSP, HSTS,
`Permissions-Policy`). Ao adicionar origem externa, ajuste a CSP junto.
