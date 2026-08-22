import * as React from "react";
import { Bell, BellOff, CheckCheck, Copy, ListFilter, ScanSearch, ScrollText, X } from "lucide-react";
import type { AmostraFalha, CategoriaFalha, ResumoFalha } from "@disparoy/dominio";
import {
  ehCodigoConhecido,
  explicar,
  nivelDaCobertura,
  ORIGENS,
  semClassificacao,
  totalDeFalhas,
  totalSemClassificacao,
} from "@disparoy/dominio";
import {
  Badge,
  CabecalhoPagina,
  Card,
  CardCabecalho,
  CardCorpo,
  EstadoVazio,
  Separador,
} from "@/components/ui/primitivos";
import { Botao } from "@/components/ui/botao";
import { Carregando, ErroCarregamento } from "@/components/ui/estados";
import { Tabela, type Coluna } from "@/components/ui/tabela";
import { SeloOrigem } from "@/components/avisos/selo-origem";
import { CartaoAviso } from "@/components/avisos/cartao-aviso";
import { FaixaDisparoParado } from "@/components/avisos/faixa-disparo-parado";
import { TabelaLogs } from "@/components/logs/tabela-logs";
import { useToast } from "@/components/ui/toast";
import {
  useAmostrasFalha,
  useAvisos,
  useContagemAvisos,
  useDiagnostico,
  useEhAdmin,
  useLogs,
  useMarcarTodosAvisosLidos,
  useSessao,
} from "@/hooks/consultas";
import { formatarDataHora, formatarNumero } from "@/lib/formato";

const CATEGORIAS = Object.keys(ORIGENS) as CategoriaFalha[];

/**
 * Diagnóstico de falhas.
 *
 * A tela de Avisos responde "o que está quebrado agora"; esta responde "o que
 * vem quebrando, e o sistema soube dizer o que era". São perguntas diferentes e
 * públicos diferentes — por isso são telas separadas, e esta é só de admin.
 *
 * O produto real aqui é a coluna de texto bruto do gateway. A Evolution não
 * publica catálogo de erro e muda as mensagens entre versões: a regra em
 * `classificarEvolution` só pode ser escrita depois de ver o que o gateway
 * está de fato respondendo. Sem esta tela, esse texto existia no banco e não
 * era lido por ninguém.
 */

const JANELAS = [
  { dias: 7, rotulo: "7 dias" },
  { dias: 30, rotulo: "30 dias" },
  { dias: 90, rotulo: "90 dias" },
];

type Aba = "avisos" | "falhas" | "auditoria";

/**
 * Uma tela para "o que está acontecendo".
 *
 * Avisos, Falhas e Auditoria eram três telas no menu respondendo à mesma
 * pergunta em recortes diferentes — o que quebrou agora, o que vem quebrando, e
 * quem mexeu em quê. Separadas, obrigavam o operador a montar a visão geral de
 * cabeça, pulando entre elas e perdendo a relação de causa entre as três.
 *
 * A ordem das abas é a da urgência: o que exige ação, o que exige análise, o
 * que exige investigação.
 */
export function PaginaDiagnostico() {
  const [aba, setAba] = React.useState<Aba>("avisos");
  const contagem = useContagemAvisos();
  const naoLidos = contagem.data?.total ?? 0;
  const admin = useEhAdmin();
  // Mesma query de `/eu` que o layout já mantém viva; o react-query serve do
  // cache, então abrir esta tela não custa uma requisição a mais.
  const disparo = useSessao().data?.disparo;

  return (
    <div>
      {disparo && !disparo.ativo && <FaixaDisparoParado pulsoEm={disparo.pulsoEm} />}
      <CabecalhoPagina
        titulo="Diagnóstico"
        descricao="O que está quebrado agora, o que vem quebrando, e quem mexeu em quê."
      />

      <div className="mb-5 flex flex-wrap gap-1.5" role="tablist" aria-label="Seções">
        <BotaoAba ativa={aba === "avisos"} onClick={() => setAba("avisos")} contador={naoLidos}>
          <Bell aria-hidden className="size-4" />
          Avisos
        </BotaoAba>
        <BotaoAba ativa={aba === "falhas"} onClick={() => setAba("falhas")}>
          <ScanSearch aria-hidden className="size-4" />
          Falhas
        </BotaoAba>
        {/* Auditoria traz IP e metadados de importação — material de
            investigação, e por isso continua restrita a administradores. */}
        {admin && (
          <BotaoAba ativa={aba === "auditoria"} onClick={() => setAba("auditoria")}>
            <ScrollText aria-hidden className="size-4" />
            Auditoria
          </BotaoAba>
        )}
      </div>

      {aba === "avisos" && <SecaoAvisos />}
      {aba === "falhas" && <SecaoFalhas />}
      {aba === "auditoria" && admin && <SecaoAuditoria />}
    </div>
  );
}

function BotaoAba({
  ativa,
  onClick,
  contador,
  children,
}: {
  ativa: boolean;
  onClick: () => void;
  contador?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={ativa}
      onClick={onClick}
      className={[
        "flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm transition-colors",
        ativa
          ? "bg-superficie-3 font-medium text-tinta"
          : "text-tinta-2 hover:bg-superficie-2 hover:text-tinta",
      ].join(" ")}
    >
      {children}
      {contador !== undefined && contador > 0 && (
        <span className="min-w-4 rounded-full bg-critico px-1 text-center text-[11px] font-medium text-white">
          {contador > 9 ? "9+" : contador}
        </span>
      )}
    </button>
  );
}

function SecaoFalhas() {
  const [dias, setDias] = React.useState(7);
  const [codigoAberto, setCodigoAberto] = React.useState<string | null>(null);

  const consulta = useDiagnostico(dias);
  const amostrasDoCodigo = useAmostrasFalha(dias, codigoAberto);

  const falhas = consulta.data?.falhas ?? [];
  const total = totalDeFalhas(falhas);
  const naoClassificadas = totalSemClassificacao(falhas);

  // Trocar de janela com uma linha aberta mostraria contagens de 7 dias sob um
  // cabeçalho de 90. Fechar é mais honesto que recarregar por baixo.
  function trocarJanela(novo: number) {
    setDias(novo);
    setCodigoAberto(null);
  }

  const amostras = codigoAberto ? (amostrasDoCodigo.data ?? []) : (consulta.data?.amostras ?? []);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-tinta-3">
          O que o gateway respondeu, agrupado. É daqui que sai a próxima regra de classificação.
        </p>
        <div className="flex gap-1.5" role="group" aria-label="Janela de tempo">
          {JANELAS.map((j) => (
            <Botao
              key={j.dias}
              variante={dias === j.dias ? "primario" : "fantasma"}
              tamanho="sm"
              onClick={() => trocarJanela(j.dias)}
            >
              {j.rotulo}
            </Botao>
          ))}
        </div>
      </div>

      {consulta.isLoading && <Carregando rotulo="Agregando falhas…" />}
      {consulta.error && (
        <ErroCarregamento erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      )}

      {consulta.data && total === 0 && (
        <Card>
          <EstadoVazio
            icone={<ScanSearch className="size-6" />}
            titulo="Nenhuma falha na janela"
            descricao={`Nenhum envio falhou nos últimos ${dias} dias. Não há o que classificar.`}
          />
        </Card>
      )}

      {consulta.data && total > 0 && (
        <div className="space-y-5">
          <PainelCobertura total={total} naoClassificadas={naoClassificadas} dias={dias} />

          <Card>
            <CardCabecalho
              titulo="Falhas por código"
              descricao="Clique em um código para ver os textos originais que o geraram."
            />
            <Separador />
            <CardCorpo className="pt-4">
              <TabelaCodigos
                falhas={falhas}
                total={total}
                codigoAberto={codigoAberto}
                aoAbrir={setCodigoAberto}
              />
            </CardCorpo>
          </Card>

          <PainelAmostras
            amostras={amostras}
            codigoAberto={codigoAberto}
            carregando={codigoAberto !== null && amostrasDoCodigo.isLoading}
            aoLimpar={() => setCodigoAberto(null)}
          />
        </div>
      )}
    </div>
  );
}

/**
 * A caixa de avisos, agora como aba.
 *
 * O filtro é por CATEGORIA, não por texto: é a pergunta que o operador
 * realmente tem — "isso é problema meu ou de vocês?" — em um clique.
 */
function SecaoAvisos() {
  const [incluirLidos, setIncluirLidos] = React.useState(true);
  const [filtro, setFiltro] = React.useState<CategoriaFalha | "todas">("todas");

  const consulta = useAvisos(incluirLidos);
  const marcarTodos = useMarcarTodosAvisosLidos();

  const avisos = (consulta.data ?? []).filter((a) => filtro === "todas" || a.categoria === filtro);
  const naoLidos = (consulta.data ?? []).filter((a) => a.lidaEm === null).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["todas", ...CATEGORIAS] as const).map((c) => (
          <FiltroChip key={c} ativo={filtro === c} onClick={() => setFiltro(c)}>
            {c === "todas" ? "Todas" : ORIGENS[c].rotulo}
          </FiltroChip>
        ))}
        <div className="ml-auto flex gap-2">
          <Botao variante="fantasma" tamanho="sm" onClick={() => setIncluirLidos((v) => !v)}>
            {incluirLidos ? "Só não lidos" : "Mostrar lidos"}
          </Botao>
          {naoLidos > 0 && (
            <Botao
              tamanho="sm"
              onClick={() => marcarTodos.mutate()}
              carregando={marcarTodos.isPending}
            >
              <CheckCheck className="size-4" />
              Marcar todos como lidos
            </Botao>
          )}
        </div>
      </div>

      {consulta.isLoading && <Carregando rotulo="Carregando avisos…" />}
      {consulta.error && (
        <ErroCarregamento erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      )}

      {!consulta.isLoading && !consulta.error && avisos.length === 0 && (
        <Card>
          <EstadoVazio
            icone={<BellOff className="size-6" />}
            titulo="Nada por aqui"
            descricao="Quando um canal cair ou uma campanha parar, o aviso aparece nesta aba."
          />
        </Card>
      )}

      <div className="space-y-3">
        {avisos.map((a) => (
          <CartaoAviso key={a.id} aviso={a} />
        ))}
      </div>
    </div>
  );
}

function FiltroChip({
  ativo,
  onClick,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
        ativo
          ? "bg-marca/12 text-marca-tenue ring-marca/30"
          : "bg-superficie-2 text-tinta-2 ring-borda-forte hover:bg-superficie-3",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/** Trilha de auditoria: ação humana, imutável. Restrita a administradores. */
function SecaoAuditoria() {
  const logs = useLogs({ porPagina: 100 });

  if (logs.isLoading) return <Carregando rotulo="Carregando auditoria…" />;
  if (logs.error) {
    return <ErroCarregamento erro={logs.error} aoTentarNovamente={() => void logs.refetch()} />;
  }
  return <TabelaLogs logs={logs.data?.itens ?? []} />;
}

/**
 * Cobertura da classificação.
 *
 * É o número que decide se vale mexer nas regras hoje. Cinco desconhecidas em
 * mil é o ruído normal de um gateway não oficial; quatrocentas em mil querem
 * dizer que uma regra parou de casar depois de uma atualização da Evolution —
 * e, sem esta linha, isso passaria despercebido porque cada falha individual
 * continua tendo uma explicação de aparência plausível na tela do operador.
 */
function PainelCobertura({
  total,
  naoClassificadas,
  dias,
}: {
  total: number;
  naoClassificadas: number;
  dias: number;
}) {
  const pct = total === 0 ? 0 : (naoClassificadas / total) * 100;
  const nivel = nivelDaCobertura(total, naoClassificadas);
  const preocupante = nivel === "atencao";
  const amostraPequena = nivel === "amostra_pequena";

  return (
    <Card>
      <CardCorpo className="flex flex-wrap items-center gap-x-8 gap-y-4 px-5 py-4">
        <Metrica rotulo={`Falhas em ${dias} dias`} valor={formatarNumero(total)} />
        <Metrica
          rotulo="Sem classificação"
          valor={formatarNumero(naoClassificadas)}
          tom={preocupante ? "critico" : undefined}
        />
        <Metrica
          rotulo="Cobertura da taxonomia"
          // Sem tom com amostra pequena: verde ou vermelho aqui seriam os dois
          // uma afirmação, e com poucas falhas não há afirmação a fazer.
          valor={amostraPequena ? "—" : `${(100 - pct).toFixed(0)}%`}
          tom={amostraPequena ? undefined : preocupante ? "critico" : "bom"}
        />
        <p className="min-w-56 flex-1 text-xs text-tinta-3">
          {amostraPequena
            ? `Poucas falhas na janela (${formatarNumero(total)}) para a proporção significar alguma coisa. Os textos abaixo continuam valendo um olhar.`
            : preocupante
              ? "Uma fatia grande das falhas não casou com nenhuma regra. Vale ler os textos abaixo e escrever a regra que falta em falhas.ts."
              : "A maior parte das falhas está sendo reconhecida pelas regras atuais."}
        </p>
      </CardCorpo>
    </Card>
  );
}

function Metrica({
  rotulo,
  valor,
  tom,
}: {
  rotulo: string;
  valor: string;
  tom?: "critico" | "bom";
}) {
  const cor = tom === "critico" ? "text-critico" : tom === "bom" ? "text-bom" : "text-tinta";
  return (
    <div>
      <p className="text-xs text-tinta-3">{rotulo}</p>
      <p className={`tabular mt-0.5 text-xl font-semibold ${cor}`}>{valor}</p>
    </div>
  );
}

function TabelaCodigos({
  falhas,
  total,
  codigoAberto,
  aoAbrir,
}: {
  falhas: ResumoFalha[];
  total: number;
  codigoAberto: string | null;
  aoAbrir: (codigo: string | null) => void;
}) {
  const colunas: Coluna<ResumoFalha>[] = [
    {
      chave: "codigo",
      titulo: "Código",
      celula: (f) => (
        <button
          type="button"
          onClick={() => aoAbrir(codigoAberto === f.codigo ? null : f.codigo)}
          className="text-left"
        >
          <span
            className={`font-mono text-xs ${
              codigoAberto === f.codigo ? "text-marca-tenue" : "text-tinta"
            } underline decoration-borda-forte underline-offset-4 hover:decoration-tinta-2`}
          >
            {f.codigo}
          </span>
          <span className="mt-0.5 block text-xs text-tinta-3">{descricaoDoCodigo(f.codigo)}</span>
        </button>
      ),
    },
    {
      chave: "origem",
      titulo: "Origem",
      celula: (f) =>
        f.categoria ? (
          <SeloOrigem categoria={f.categoria} />
        ) : (
          <Badge tom="neutro">Sem categoria</Badge>
        ),
    },
    {
      chave: "total",
      titulo: "Ocorrências",
      alinhamento: "direita",
      celula: (f) => (
        <div>
          <span className="tabular text-tinta">{formatarNumero(f.total)}</span>
          <span className="tabular mt-0.5 block text-xs text-tinta-3">
            {((f.total / total) * 100).toFixed(1)}%
          </span>
        </div>
      ),
    },
    {
      chave: "alcance",
      titulo: "Alcance",
      alinhamento: "direita",
      /*
       * Canais e campanhas na mesma célula porque a leitura é comparativa: um
       * código em muitos canais é o gateway ou a regra; o mesmo código num
       * canal só é o aparelho daquele cliente. Separado em duas colunas, esse
       * contraste some.
       */
      celula: (f) => (
        <span className="tabular text-xs text-tinta-2">
          {formatarNumero(f.canais)} {f.canais === 1 ? "canal" : "canais"} ·{" "}
          {formatarNumero(f.campanhas)} {f.campanhas === 1 ? "campanha" : "campanhas"}
        </span>
      ),
    },
    {
      chave: "ultima",
      titulo: "Última",
      alinhamento: "direita",
      celula: (f) => (
        <span className="tabular text-xs text-tinta-2">{formatarDataHora(f.ultimaEm)}</span>
      ),
    },
  ];

  return (
    <Tabela
      colunas={colunas}
      itens={falhas}
      /*
       * A categoria entra na chave porque o agrupamento no banco é por código E
       * categoria: um código gravado antes da coluna existir aparece com
       * categoria nula ao lado das ocorrências novas do mesmo código. São duas
       * linhas legítimas — com a chave só no código, o React reusaria a
       * primeira e a segunda sumiria da tela.
       */
      chaveDe={(f) => `${f.codigo}::${f.categoria ?? "sem-categoria"}`}
      porPagina={15}
      buscaPlaceholder="Buscar código…"
      textoBusca={(f) => `${f.codigo} ${f.categoria ?? ""}`}
    />
  );
}

/**
 * O texto do gateway, agrupado por padrão.
 *
 * `padrao` já vem com número e id substituídos por marcador — sem isso cada
 * falha viraria um grupo de tamanho 1, porque a Evolution devolve o telefone do
 * destinatário dentro da mensagem. O `exemplo` fica intacto ao lado porque é
 * ele, e não o padrão normalizado, que serve para escrever o regex novo.
 */
function PainelAmostras({
  amostras,
  codigoAberto,
  carregando,
  aoLimpar,
}: {
  amostras: AmostraFalha[];
  codigoAberto: string | null;
  carregando: boolean;
  aoLimpar: () => void;
}) {
  return (
    <Card>
      <CardCabecalho
        titulo={
          codigoAberto ? (
            <span className="flex items-center gap-2">
              Textos de <code className="font-mono text-xs text-marca-tenue">{codigoAberto}</code>
            </span>
          ) : (
            "Textos originais mais frequentes"
          )
        }
        descricao="Como o gateway respondeu, sem tradução. Números e ids foram trocados por marcador para agrupar."
        acao={
          codigoAberto ? (
            <Botao variante="fantasma" tamanho="sm" onClick={aoLimpar}>
              <X className="size-4" />
              Ver todos
            </Botao>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-tinta-3">
              <ListFilter className="size-3.5" aria-hidden />
              Todos os códigos
            </span>
          )
        }
      />
      <Separador />
      <CardCorpo className="pt-4">
        {carregando && <Carregando rotulo="Carregando textos…" />}
        {!carregando && amostras.length === 0 && (
          <EstadoVazio
            titulo="Nenhum texto guardado"
            descricao="As falhas desta janela não trouxeram mensagem do gateway."
          />
        )}
        <div className="space-y-3">
          {!carregando &&
            amostras.map((a) => (
              <LinhaAmostra
                key={`${a.codigo}::${a.categoria ?? "sem-categoria"}::${a.padrao}`}
                amostra={a}
              />
            ))}
        </div>
      </CardCorpo>
    </Card>
  );
}

function LinhaAmostra({ amostra }: { amostra: AmostraFalha }) {
  const { mostrar } = useToast();
  const sem = semClassificacao(amostra.codigo);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(amostra.exemplo);
      mostrar({ tipo: "info", titulo: "Texto copiado" });
    } catch {
      // `navigator.clipboard` exige contexto seguro: em HTTP puro a promessa
      // rejeita, e sem este aviso o clique pareceria não ter feito nada.
      mostrar({
        tipo: "erro",
        titulo: "Não foi possível copiar",
        descricao: "O navegador bloqueou o acesso à área de transferência.",
      });
    }
  }

  return (
    <div
      className={`rounded-xl border p-3.5 ${
        sem ? "border-aviso/35 bg-aviso/8" : "border-borda bg-superficie-2"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-xs text-tinta-2">{amostra.codigo}</code>
        {amostra.categoria ? <SeloOrigem categoria={amostra.categoria} /> : null}
        <span className="tabular ml-auto text-xs text-tinta-3">
          {formatarNumero(amostra.total)}× · última {formatarDataHora(amostra.ultimaEm)}
        </span>
      </div>

      <p className="mt-2 font-mono text-xs break-words text-tinta">{amostra.padrao}</p>

      {amostra.exemplo !== amostra.padrao && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-tinta-3 hover:text-tinta-2">
            Ver uma ocorrência intacta
          </summary>
          <div className="mt-2 flex items-start gap-2">
            <p className="min-w-0 flex-1 rounded-lg bg-superficie-3 p-2.5 font-mono text-xs break-words text-tinta-2">
              {amostra.exemplo}
            </p>
            <Botao variante="fantasma" tamanho="sm" onClick={() => void copiar()}>
              <Copy className="size-3.5" />
              Copiar
            </Botao>
          </div>
        </details>
      )}

      {sem && (
        <p className="mt-2 text-xs text-aviso">
          Este texto não casou com nenhuma regra. É candidato a virar uma linha nova em{" "}
          <code className="font-mono">classificarEvolution</code>.
        </p>
      )}
    </div>
  );
}

/**
 * A frase do operador, reaproveitada como descrição do código.
 *
 * Sem os placeholders resolvidos ela fica com "{canal}" no meio, então
 * `explicar` é chamado com o contexto vazio — a frase genérica é exatamente o
 * que descreve o código em abstrato.
 */
function descricaoDoCodigo(codigo: string): string {
  if (codigo === "nao_registrado") return "Falha anterior à taxonomia; sem código gravado.";
  if (!ehCodigoConhecido(codigo)) return "Código desconhecido por esta versão do painel.";
  return explicar(codigo, { canal: "o canal", detalhe: "—" });
}
