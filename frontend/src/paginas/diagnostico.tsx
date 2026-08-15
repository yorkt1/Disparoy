import * as React from "react";
import { Copy, ListFilter, ScanSearch, X } from "lucide-react";
import type { AmostraFalha, ResumoFalha } from "@disparoy/dominio";
import {
  ehCodigoConhecido,
  explicar,
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
import { useToast } from "@/components/ui/toast";
import { useAmostrasFalha, useDiagnostico } from "@/hooks/consultas";
import { formatarDataHora, formatarNumero } from "@/lib/formato";

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

export function PaginaDiagnostico() {
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
      <CabecalhoPagina
        titulo="Diagnóstico de falhas"
        descricao="O que o gateway respondeu, agrupado. É daqui que sai a próxima regra de classificação."
        acao={
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
        }
      />

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
  const preocupante = pct >= 10;

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
          valor={`${(100 - pct).toFixed(0)}%`}
          tom={preocupante ? "critico" : "bom"}
        />
        <p className="min-w-56 flex-1 text-xs text-tinta-3">
          {preocupante
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
