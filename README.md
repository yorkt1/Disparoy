# DisparoY

Sistema interno de disparo de mensagens via WhatsApp. Painel em tema escuro com
topo fixo: **Dashboard · Campanhas · Contatos · Templates · Canais · Logs**.

Single-tenant: um negócio, vários logins internos (`admin` / `operator`).

## Arquitetura

```
DisparoY/
├── backend/    NestJS — API REST, worker de disparo, webhook da Evolution
├── frontend/   Vite + React — painel administrativo (SPA)
├── shared/     Domínio puro, usado pelos dois (pacote @disparoy/dominio)
└── supabase/   Migrations SQL (schema, RLS, funções)
```

`shared/` não fica dentro de nenhum dos dois porque os dois dependem dele: é
onde moram spintax, normalização de telefone, montagem de contatos e os schemas
Zod. Backend e frontend validam com os **mesmos** schemas — o cliente para dar
feedback rápido, a API porque nada que vem do cliente é confiável.

**Por que backend separado:** o intervalo entre contatos é de 15–45 s, então
uma campanha de 3.000 pessoas leva ~25 horas de execução. Isso não cabe em
request HTTP — precisa de um worker que sobreviva a deploy, restart e falha de
rede. O estado da fila mora no Postgres, não na memória do processo.

## Subindo o projeto

```bash
npm install
```

**1. Supabase.** Crie um projeto e rode as migrations de `supabase/migrations/`
na ordem. O Supabase aqui é só o **banco** — a autenticação é própria, e o
Supabase Auth não é usado.

**2. Evolution API.** Suba em VPS própria (Docker), separada desta API: ela
mantém sessões de WhatsApp de longa duração e consome recursos de forma
diferente. Coloque Nginx + SSL na frente e restrinja o acesso por API key.

**3. API.** Copie `backend/.env.example` para `backend/.env`.

> `DATABASE_URL` precisa de uma conexão de **sessão**: o pg-boss usa
> `LISTEN/NOTIFY` e advisory locks, que não sobrevivem ao modo transaction.
> Servem a conexão **direta** (5432) e o **Session pooler** (5432); o
> **Transaction pooler** (6543) não serve. Errar isso derruba a API no boot,
> com essa mensagem.
>
> Na prática o Session pooler costuma ser a única opção: `db.<ref>.supabase.co`
> só publica registro AAAA, e rede sem rota IPv6 nunca alcança a porta. O
> sintoma é `connect ETIMEDOUT` num endereço `2600:...`, não erro de senha.
> Copie a string em **Connect → Session pooler** (o usuário lá é
> `postgres.<ref>`, não `postgres`).

`JWT_SECRET` (32+ caracteres, `openssl rand -hex 32`) é o segredo com que a API
assina os tokens de login. Trocá-lo derruba todas as sessões abertas.

Preencha também `ADMIN_EMAIL` e `ADMIN_SENHA` (mínimo 6 caracteres, os dois ou
nenhum). A API garante esse administrador no boot — é o único acesso que não
nasce de outro acesso. Dele saem todos os demais, em **Usuários e acessos**.

> Criado **uma vez**. Se a conta já existir, a senha do `.env` é ignorada: senão
> todo restart desfaria em silêncio uma troca de senha feita pela tela. Trocar
> `ADMIN_SENHA` depois não recupera nada — peça a outro admin, ou apague a linha
> em `perfis` e suba a API de novo.

**4. Frontend.** Nada a configurar em desenvolvimento: o painel não guarda
credencial nenhuma, e o Vite faz proxy de `/api` para a porta 3333. Em produção,
`VITE_API_URL` aponta para a URL pública da API.

**5. Rode os três:**

```bash
npm run dev:api      # http://localhost:3333/api
npm run dev:worker   # consome a fila de disparo
npm run dev:web      # http://localhost:5173
```

Sem o worker a interface funciona inteira, mas nenhuma campanha sai da fila.

| Comando | O que faz |
|---|---|
| `npm run build` | Build dos três pacotes |
| `npm test` | 46 testes do domínio (Vitest) |
| `npm run typecheck` | `tsc --noEmit` em todos os workspaces |

## LGPD — o que o sistema impede

Consentimento não é campo opcional; é pré-requisito para o contato existir.

- **Importar exige base legal.** Origem do consentimento, data e confirmação
  explícita. Sem os três, o botão de importar fica bloqueado.
- **O filtro roda no banco**, na função `popular_contatos_da_campanha`. É a
  última barreira antes de a mensagem existir, e nenhum caminho de código a
  contorna — nem um bug no frontend, nem uma chamada direta à API.
- **`opt_out_em` vale mais que `opt_in`.** Quem pediu para sair não volta por
  reimportação: a planilha pode trazer o número de novo, o sistema ignora.
- **Opt-out automático por palavra-chave** (PARAR, SAIR, STOP…) detectado no
  webhook `MESSAGES_UPSERT`. Registrar o opt-out também **limpa a fila** — sem
  isso, mensagens já enfileiradas sairiam depois do pedido de saída.
- **Exclusão definitiva** a pedido do titular. As mensagens já enviadas
  permanecem no histórico como registro de operação, sem vínculo com cadastro.

A detecção de saída exige mensagem curta: `"quero sair da lista"` é opt-out,
mas `"não vou parar de recomendar vocês"` não é — casar palavra solta em frase
longa descadastraria quem estava elogiando.

## O modelo de campanha

Uma campanha é uma **sequência**, não uma mensagem:

| Peça | Por quê |
|---|---|
| Até 10 mensagens em ordem, por contato | Três mensagens curtas lêem como alguém digitando; um bloco único lê como robô |
| Spintax `{{*nome*}}`, sorteado por envio | 4 saudações × 4 urgências = 16 textos distintos. Mensagem idêntica em volume é sinal forte de bloqueio |
| Vários canais, em rodízio | 3.000 num número derruba a conexão; 1.000 em três, não |
| Dois intervalos, ambos sorteados | Entre passos (3–9 s) é ritmo de digitação; entre contatos (15–45 s) é a cadência do disparo. Cadência fixa é assinatura de robô |
| Aquecimento por canal | Teto diário que sobe por estágio; número novo em volume alto é o caminho mais rápido para banimento |

**A planilha é `nome` + `numero`** — o modelo baixável traz só essas duas, que
é o que a maioria das listas tem. Colunas a mais continuam funcionando e viram
variáveis, mas não entram no modelo: quem não precisa delas copiava três
colunas vazias sem saber por quê.

**Mídia sobe do computador** (`POST /api/midia` → bucket público no Supabase
Storage). O tipo sai da extensão, não de um seletor: escolher "vídeo" para um
`.pdf` mandaria um `mediatype` que não bate com o conteúdo, e o WhatsApp só
recusaria na hora do disparo, com a campanha já andando. Os tetos são os da
Meta (imagem 5 MB, vídeo e áudio 16 MB, documento 50 MB), conferidos no
navegador e de novo na API. Quem já hospeda fora ainda pode colar uma URL.

> O bucket é público de propósito: quem baixa o arquivo é o servidor do
> WhatsApp, não o navegador do operador. URL assinada expiraria no meio de uma
> campanha de 25 horas e as últimas mensagens sairiam com mídia quebrada.

Variáveis (`{{1}}`) vêm das colunas da planilha, mapeadas na importação.
Referência não resolvida fica **literal** no texto — na prévia o operador vê o
buraco em vez de um texto bonito que o esconde.

## Como o disparo funciona

Dois jobs no pg-boss, em vez de um laço longo:

| Job | Faz |
|---|---|
| `disparo-campanha` | Planeja: pega os pendentes, distribui em rodízio entre os canais e enfileira um job por contato com o atraso sorteado |
| `disparo-contato` | Consome cota do canal, envia a sequência de **um** contato e termina |

O intervalo vira `startAfter` no banco, não um processo dormindo. Se o worker
cair no meio de uma campanha de 25 horas, outro assume os jobs — e subir mais
instâncias aumenta a vazão, porque o pg-boss distribui por advisory lock.

Estourar o teto diário do canal **adia** o contato em vez de queimar o número:
a campanha continua amanhã.

## Integração com o WhatsApp

| | Evolution API (QR Code) | Meta Cloud API |
|---|---|---|
| Texto livre | sim | não — só templates aprovados |
| Tarifa por conversa | não | sim |
| Valida se o número existe | sim | não |
| Risco | bloqueio pela Meta a qualquer momento | baixo |
| Arquivo | [evolution-provider.ts](backend/src/whatsapp/evolution-provider.ts) | [meta-cloud.ts](backend/src/whatsapp/meta-cloud.ts) |

**Por ora só QR Code.** A Meta Cloud API está fora de escopo: o código do
provedor e a coluna `tipo_conexao` continuam de pé, mas a tela cria sempre um
canal `qrcode` e não pergunta o tipo.

Conectar um canal cria a instância, **registra o webhook** e devolve o QR num
passo só: instância conectada sem webhook envia mensagens e nunca reporta
status — a campanha ficaria presa em "enviada" para sempre.

**Criar um canal pede só o nome.** O número não é digitado porque nunca serviu
para conectar nada — `instance/create` recebe só o nome da instância, e quem
define o número é o aparelho que escaneia o QR. Ele chega no
`CONNECTION_UPDATE`, lido do `ownerJid` que a Evolution reporta, e até lá o
canal aparece como "aguardando pareamento".

> Isso troca um campo que podia mentir por um que não pode. Antes dava para
> cadastrar um número e parear outro: o painel e a trilha de auditoria
> mostrariam o errado para sempre, e nada no sistema comparava os dois.

Sem provedor configurado nada é simulado. O envio falha com o motivo, o
pareamento lança, e a validação de número devolve `verificado: false` — que
significa "não deu para checar", diferente de "não existe".

## Segurança

- **Autenticação própria**, sem provedor externo. `POST /api/sessao` confere
  e-mail e senha contra `perfis` e devolve um JWT HS256 assinado com
  `JWT_SECRET`, validado no `AuthGuard` sem ida à rede.
- **Senha em scrypt** (`node:crypto`, sem dependência nativa), com sal por
  linha e os parâmetros de custo gravados junto ao hash — subir o custo depois
  não invalida as senhas já cadastradas. Comparação em tempo constante.
- **Não existe auto-cadastro.** O admin cria cada login já com a senha e a
  entrega à pessoa. Sem e-mail de recuperação, quem esquece a senha depende de
  um admin redefinir por ele.
- **Login não conta o que existe.** E-mail inexistente, senha errada e acesso
  desativado devolvem a mesma mensagem, e o hash é conferido mesmo quando o
  e-mail não existe — senão o tempo de resposta entregaria quais endereços
  estão cadastrados. Teto próprio de 10 tentativas por minuto.
- **O papel nunca vem do token** — o JWT diz só quem é (`sub`); o papel é lido
  do banco a cada request. Perfil desativado é barrado na hora, sem esperar o
  token expirar.
- **O navegador não recebe credencial nenhuma.** Nem anon key, nem chave de
  banco: o painel só conhece a URL da API. `senha_hash` não está em
  `COLUNAS_PERFIL`, então nenhum endpoint a devolve por descuido.
- **Senha nunca vai para a auditoria.** O log de redefinição grava
  `senhaRedefinida: true`, não o valor.
- **RLS continua ligada** e agora nega tudo para a anon key — `auth.uid()` é
  sempre nulo sem Supabase Auth. Todo acesso passa pela API, que usa a service
  role e filtra por papel; as políticas ficam como rede de segurança para o dia
  em que alguém expuser o PostgREST.
- **Guard global**: abrir uma rota exige `@Publico()` explícito, então esquecer
  o guard não expõe dados por acidente.
- **Webhook com segredo compartilhado**, comparado em tempo constante. Sem o
  segredo configurado o endpoint recusa tudo — mais seguro que aceitar achando
  que está protegido.
- **Rate limiting** global em duas janelas (rajada e varredura lenta).
- **Logs e payloads de webhook** são visíveis só para admin.

## O que ainda falta

- **Tela "Meu perfil"** — o menu do topo já aponta para `/perfil`, a rota não
  existe. É onde o operador trocaria a própria senha sem passar pelo admin.
- **Gestão de membros por canal** na interface (a API já tem os endpoints).
- **O fluxo do worker nunca rodou de ponta a ponta.** O schema já está aplicado
  num Supabase real, mas RLS, disparo e webhook só serão exercitados de verdade
  com a API no ar e um canal conectado. É o primeiro ponto a testar.
- Vale trocar `xlsx@0.18.5` do registry público pelo build do
  [CDN da SheetJS](https://cdn.sheetjs.com), que traz as correções recentes.
