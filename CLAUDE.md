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
copie para `../Disparoy-Backend/shared/src/` e rode **nos dois repositórios**:

```bash
npm run compartilhado:gravar      # regrava shared/HASH.txt
```

Os dois `HASH.txt` têm de sair idênticos, e ambos vão versionados. O CI de cada
lado roda `compartilhado:verificar` e reprova quando `shared/src` não bate com o
hash — é a única coisa que pega a divergência, porque cada workflow clona um
repositório só e não tem o outro para comparar.

Esquecer de regravar quebra o CI na hora. É de propósito: um `shared` divergente
produz bug que só aparece em produção — normalizar um telefone passa a dar
resultado diferente na API e no painel, os dois compilam e os dois passam nos
testes.

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

**Cor sempre por variável CSS**, nunca hex literal — o painel tem dois temas. O
claro é o padrão e mora no `@theme` de `estilos.css`; o escuro só redefine as
mesmas variáveis em `:root[data-tema="escuro"]`. Hex literal em componente muda
só em um dos dois, e o bug aparece na tela de quem escolheu o outro.

O atributo `data-tema` é escrito por `frontend/public/tema.js`, carregado de
forma bloqueante no `index.html`: fora do bundle porque a CSP traz
`script-src 'self'` sem `unsafe-inline`, e antes do React porque quem escolheu
o escuro veria um lampejo branco a cada abertura. A escolha fica no
`localStorage` — é preferência de aparelho, não da conta.

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

**São DOIS `vercel.json`: o da raiz e o de `frontend/`.** Eles se repetem quase
inteiros (os 3 rewrites e a CSP são iguais nos dois) e diferem só no que depende
do Root Directory configurado no projeto da Vercel — a raiz traz
`outputDirectory: frontend/dist` e `installCommand`, o de `frontend/` traz
`framework: "vite"` e `outputDirectory: "dist"`. **Mexeu num, mexa no outro na
mesma edição.** Corrigir só um não conserta o deploy e dá a impressão de que o
problema era outro: foi assim que sete deploys seguidos falharam pelo mesmo
motivo.

**Nada de comentário em nenhum dos dois.** O schema da Vercel reprova
propriedade extra dentro de `rewrites`/`headers`, e o truque de usar chaves
`"//"` derruba o build inteiro com `should NOT have additional property`. O que
precisar ser explicado sobre o deploy é explicado aqui.

Para conferir antes de empurrar, sem esperar o deploy: baixe
`https://openapi.vercel.sh/vercel.json` e valide as chaves dos dois arquivos
contra `properties.rewrites.items` e `properties.headers.items`, que têm
`additionalProperties: false`.

Os três `rewrites`, em ordem, e o porquê do do meio:

1. `/api/(.*)` → API no Render.
2. `/assets/(.*)` → ele mesmo. **Existe para que asset inexistente dê 404**, em
   vez de cair no `index.html`. Sem ela, a aba aberta durante um deploy pedia um
   chunk já substituído, recebia o HTML do index com status 200, e o navegador
   tentava ler HTML como módulo JavaScript. O erro que chegava era `Failed to
   fetch dynamically imported module`, que não diz nada sobre a causa. Com o
   404, a falha passa a ser o que ela é — e o `vigiarVersaoNova()` do
   `main.tsx` recarrega a página antes de o operador ver qualquer coisa.
3. `/(.*)` → `index.html`, para as rotas do SPA.
