import * as React from "react";
import { ClipboardList, Download, FileSpreadsheet, TriangleAlert } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, MensagemErro, Selecao } from "@/components/ui/campos";
import { Dropzone } from "@/components/ui/dropzone";
import { useToast } from "@/components/ui/toast";
import {
  EXTENSOES_PLANILHA,
  LIMITES,
  detectarColunaNome,
  montarContatos,
  montarContatosColados,
  type ContatoImportado,
} from "@disparoy/dominio";
import { cn, formatarNumero, formatarTelefone } from "@/lib/formato";
import { api, ErroApi } from "@/lib/api";
import { useImportarContatos, useListas } from "@/hooks/consultas";

interface PlanilhaCarregada {
  colunas: string[];
  colunaTelefone: string;
  linhas: Record<string, string>[];
  totalLinhas: number;
  truncada: boolean;
  nomeArquivo: string;
  tamanho: number;
}

/**
 * Importação de contatos: arrastar uma planilha ou digitar os números.
 *
 * A tela não pergunta a base legal. A API continua exigindo o bloco
 * `consentimento` — é ele que grava `opt_in: true`, sem o qual a função
 * `popular_contatos_da_campanha` nunca inclui o contato num disparo —, então a
 * importação envia o registro fixo de CONSENTIMENTO_PADRAO. O registro passa a
 * dizer "importação manual", e não mais como cada lista de fato consentiu.
 */
const CONSENTIMENTO_PADRAO = {
  origem: "importacao_manual",
  confirmacao: true,
} as const;

export function ImportadorContatos({
  aoConcluir,
}: {
  /** Recebe o id da lista de destino, para quem importa já querendo usá-la. */
  aoConcluir?: (listaId: string | null) => void;
}) {
  const [aba, setAba] = React.useState<"planilha" | "manual">("planilha");
  const [planilha, setPlanilha] = React.useState<PlanilhaCarregada | null>(null);
  const [colunaTelefone, setColunaTelefone] = React.useState("");
  const [colunaNome, setColunaNome] = React.useState("");
  const [mapeamento, setMapeamento] = React.useState<Record<string, string>>({});
  const [colado, setColado] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);

  const [destino, setDestino] = React.useState("");
  const [novaLista, setNovaLista] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);

  const { mostrar } = useToast();
  const listas = useListas();
  const importacao = useImportarContatos();

  /** Contatos derivados da entrada atual — recalculados sem novo upload. */
  const resultado = React.useMemo(() => {
    if (aba === "manual") return montarContatosColados(colado);
    if (!planilha || !colunaTelefone) return null;
    return montarContatos(planilha.linhas, colunaTelefone, { colunaNome, mapeamento });
  }, [aba, colado, planilha, colunaTelefone, colunaNome, mapeamento]);

  const validos = resultado?.contatos.filter((c) => c.valido) ?? [];
  const invalidos = resultado?.contatos.filter((c) => !c.valido) ?? [];

  const podeImportar = validos.length > 0 && !importacao.isPending;

  async function enviarArquivo(arquivo: File) {
    setEnviando(true);
    setErro(null);
    try {
      const formulario = new FormData();
      formulario.append("arquivo", arquivo);
      const corpo = await api.upload<Omit<PlanilhaCarregada, "nomeArquivo" | "tamanho">>(
        "/contatos/ler-planilha",
        formulario,
      );

      const carregada = { ...corpo, nomeArquivo: arquivo.name, tamanho: arquivo.size };
      setPlanilha(carregada);
      setColunaTelefone(carregada.colunaTelefone);
      setColunaNome(detectarColunaNome(carregada.colunas, carregada.colunaTelefone));
      setMapeamento({});

      if (carregada.truncada) {
        mostrar({
          tipo: "aviso",
          titulo: "Planilha truncada",
          descricao: `Lidas as primeiras ${formatarNumero(LIMITES.maxContatosPorImportacao)} linhas de ${formatarNumero(carregada.totalLinhas)}.`,
        });
      }
    } catch (e) {
      mostrar({
        tipo: "erro",
        titulo: "Falha ao ler a planilha",
        descricao: e instanceof Error ? e.message : "Erro inesperado.",
      });
    } finally {
      setEnviando(false);
    }
  }

  async function importar() {
    setErro(null);
    try {
      const r = await importacao.mutateAsync({
        contatos: validos as ContatoImportado[],
        consentimento: { ...CONSENTIMENTO_PADRAO, obtidoEm: new Date().toISOString() },
        listaId: destino || undefined,
        novaLista: destino ? undefined : novaLista || undefined,
        tags: [],
      });

      mostrar({
        tipo: "sucesso",
        titulo: "Contatos importados",
        descricao:
          `${r.importados} novos · ${r.atualizados} atualizados` +
          (r.ignorados > 0 ? ` · ${r.ignorados} ignorados por já terem pedido saída` : ""),
      });
      limpar();
      aoConcluir?.(r.listaId);
    } catch (e) {
      setErro(e instanceof ErroApi ? (e.primeiroCampo ?? e.message) : "Erro inesperado.");
    }
  }

  function limpar() {
    setPlanilha(null);
    setColunaTelefone("");
    setColunaNome("");
    setMapeamento({});
    setColado("");
  }

  const seletor =
    "h-8 w-full cursor-pointer rounded-lg border border-borda-forte bg-superficie px-2 text-xs text-tinta focus:border-marca focus:outline-none";

  return (
    <div className="flex flex-col gap-4">
      {/* --- origem dos dados --- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg ring-1 ring-borda-forte ring-inset">
          {(
            [
              { id: "planilha", texto: "Planilha", icone: FileSpreadsheet },
              { id: "manual", texto: "Colar números", icone: ClipboardList },
            ] as const
          ).map((t) => {
            const Icone = t.icone;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setAba(t.id)}
                aria-pressed={aba === t.id}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs transition-colors",
                  aba === t.id
                    ? "bg-marca text-white"
                    : "bg-superficie-3 text-tinta-2 hover:text-tinta",
                )}
              >
                <Icone aria-hidden className="size-3.5" />
                {t.texto}
              </button>
            );
          })}
        </div>

        <a
          href="/api/contatos/modelo"
          download
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-tinta-2 transition-colors hover:bg-superficie-3 hover:text-tinta"
        >
          <Download aria-hidden className="size-3.5" />
          Baixar modelo
        </a>
      </div>

      {aba === "planilha" ? (
        <Dropzone
          extensoes={EXTENSOES_PLANILHA}
          maxBytes={LIMITES.maxBytesPlanilha}
          carregando={enviando}
          aoSelecionar={enviarArquivo}
          aoRemover={limpar}
          arquivoAtual={planilha ? { nome: planilha.nomeArquivo, tamanho: planilha.tamanho } : null}
          descricao={`Colunas nome e numero · XLS, XLSX ou CSV · até ${LIMITES.maxBytesPlanilha / 1024 / 1024} MB · máx. ${formatarNumero(LIMITES.maxContatosPorImportacao)} linhas`}
        />
      ) : (
        <AreaTexto
          rotulo="Números"
          value={colado}
          onChange={(e) => setColado(e.target.value)}
          rows={6}
          placeholder={"11900000000\n(11) 90000-0000\n+55 11 90000-0000"}
          dica="Um por linha, ou separados por vírgula/ponto e vírgula."
        />
      )}

      {/* --- mapeamento --- */}
      {planilha && aba === "planilha" ? (
        <div className="rounded-lg border border-borda-forte bg-superficie-2 p-3.5">
          <h3 className="text-xs font-medium text-tinta">Mapeamento de colunas</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-xs text-tinta-2">Telefone</span>
              <select
                value={colunaTelefone}
                onChange={(e) => setColunaTelefone(e.target.value)}
                className={seletor}
              >
                {planilha.colunas.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs text-tinta-2">Nome</span>
              <select
                value={colunaNome}
                onChange={(e) => setColunaNome(e.target.value)}
                className={seletor}
              >
                <option value="">— sem nome —</option>
                {planilha.colunas
                  .filter((c) => c !== colunaTelefone)
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </label>

            {["1", "2", "3"].map((variavel) => (
              <label key={variavel} className="block">
                <span className="mb-1.5 block text-xs text-tinta-2">
                  Variável <code className="text-marca-tenue">{`{{${variavel}}}`}</code>
                </span>
                <select
                  value={mapeamento[variavel] ?? ""}
                  onChange={(e) =>
                    setMapeamento((m) => ({ ...m, [variavel]: e.target.value }))
                  }
                  className={seletor}
                >
                  <option value="">— não preencher —</option>
                  {planilha.colunas
                    .filter((c) => c !== colunaTelefone)
                    .map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      {/* --- resumo --- */}
      {resultado && resultado.contatos.length > 0 ? (
        <ResumoImportacao validos={validos} invalidos={invalidos} duplicados={resultado.duplicados} />
      ) : null}

      {/* --- destino --- */}
      {validos.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Selecao
            rotulo="Adicionar a uma lista existente"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
          >
            <option value="">— criar nova lista —</option>
            {(listas.data ?? []).map((l) => (
              <option key={l.id} value={l.id}>
                {l.nome} ({formatarNumero(l.totalElegiveis)} elegíveis)
              </option>
            ))}
          </Selecao>

          {!destino ? (
            <Campo
              rotulo="Nome da nova lista"
              value={novaLista}
              onChange={(e) => setNovaLista(e.target.value)}
              placeholder="Como você vai identificar esta lista"
              dica="Deixe em branco para importar sem vincular a nenhuma lista."
            />
          ) : null}
        </div>
      ) : null}

      <MensagemErro>{erro}</MensagemErro>

      {validos.length > 0 ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-tinta-3">
            {formatarNumero(validos.length)} contatos prontos para importar.
          </p>
          <Botao
            variante="primario"
            disabled={!podeImportar}
            carregando={importacao.isPending}
            onClick={importar}
          >
            Importar contatos
          </Botao>
        </div>
      ) : null}
    </div>
  );
}

function ResumoImportacao({
  validos,
  invalidos,
  duplicados,
}: {
  validos: ContatoImportado[];
  invalidos: ContatoImportado[];
  duplicados: number;
}) {
  const [verInvalidos, setVerInvalidos] = React.useState(false);

  return (
    <div className="rounded-lg border border-borda-forte bg-superficie-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-3.5 py-3">
        <span className="text-xs text-tinta-2">
          <span className="tabular font-medium text-bom">{formatarNumero(validos.length)}</span>{" "}
          números válidos
        </span>
        {duplicados > 0 ? (
          <span className="tabular text-xs text-tinta-3">
            {formatarNumero(duplicados)} duplicados descartados
          </span>
        ) : null}
        {invalidos.length > 0 ? (
          <button
            type="button"
            onClick={() => setVerInvalidos((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-aviso hover:underline"
          >
            <TriangleAlert aria-hidden className="size-3.5" />
            <span className="tabular font-medium">{formatarNumero(invalidos.length)}</span> inválidos
            — {verInvalidos ? "ocultar" : "ver"}
          </button>
        ) : null}
      </div>

      {verInvalidos ? (
        <ul className="max-h-40 overflow-y-auto border-t border-borda px-3.5 py-2.5 text-xs">
          {invalidos.slice(0, 100).map((c, i) => (
            <li key={`${c.telefoneOriginal}-${i}`} className="flex justify-between gap-4 py-1">
              <span className="tabular truncate text-tinta-2">
                {c.telefoneOriginal || "(vazio)"}
              </span>
              <span className="shrink-0 text-tinta-3">{c.motivoInvalido}</span>
            </li>
          ))}
          {invalidos.length > 100 ? (
            <li className="py-1 text-tinta-3">
              …e mais {formatarNumero(invalidos.length - 100)} linhas.
            </li>
          ) : null}
        </ul>
      ) : null}

      {validos.length > 0 ? (
        <div className="border-t border-borda px-3.5 py-2.5">
          <p className="text-xs text-tinta-3">
            Primeiros:{" "}
            <span className="tabular text-tinta-2">
              {validos
                .slice(0, 3)
                .map((c) => formatarTelefone(c.telefone))
                .join(" · ")}
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
