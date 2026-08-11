
import * as React from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Botao } from "./botao";
import { cn, formatarNumero } from "@/lib/formato";

/**
 * Tabela genérica com filtro, busca e paginação no cliente.
 *
 * Deliberadamente sem estado global: recebe os itens já carregados e cuida só
 * de recorte e apresentação. Listagens grandes trocam `itens` por uma página
 * vinda do servidor e passam `paginacaoExterna`.
 */

export interface Coluna<T> {
  chave: string;
  titulo: string;
  /** Alinhamento do conteúdo; números vão à direita. */
  alinhamento?: "esquerda" | "direita" | "centro";
  larguraClasse?: string;
  celula: (item: T) => React.ReactNode;
}

export interface PropsTabela<T> {
  colunas: Coluna<T>[];
  itens: T[];
  chaveDe: (item: T) => string;
  porPagina?: number;
  vazio?: React.ReactNode;
  /** Texto do placeholder; ausente desliga o campo de busca. */
  buscaPlaceholder?: string;
  /** Texto pesquisável de cada item. */
  textoBusca?: (item: T) => string;
  filtros?: React.ReactNode;
  className?: string;
}

const ALINHAMENTO = {
  esquerda: "text-left",
  direita: "text-right",
  centro: "text-center",
} as const;

export function Tabela<T>({
  colunas,
  itens,
  chaveDe,
  porPagina = 10,
  vazio,
  buscaPlaceholder,
  textoBusca,
  filtros,
  className,
}: PropsTabela<T>) {
  const [busca, setBusca] = React.useState("");
  const [pagina, setPagina] = React.useState(1);

  const filtrados = React.useMemo(() => {
    if (!busca.trim() || !textoBusca) return itens;
    const alvo = busca.trim().toLocaleLowerCase("pt-BR");
    return itens.filter((i) => textoBusca(i).toLocaleLowerCase("pt-BR").includes(alvo));
  }, [itens, busca, textoBusca]);

  const totalPaginas = Math.max(Math.ceil(filtrados.length / porPagina), 1);
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * porPagina, paginaAtual * porPagina);

  // Um filtro novo pode deixar a página atual fora do intervalo.
  React.useEffect(() => setPagina(1), [busca, itens]);

  const temCabecalhoFerramentas = Boolean(buscaPlaceholder) || Boolean(filtros);

  return (
    <div className={className}>
      {temCabecalhoFerramentas ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-borda px-5 py-3">
          {buscaPlaceholder ? (
            <div className="relative min-w-56 flex-1">
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tinta-3"
              />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder={buscaPlaceholder}
                aria-label={buscaPlaceholder}
                className="h-9 w-full rounded-lg border border-borda-forte bg-superficie-2 pr-3 pl-9 text-sm text-tinta placeholder:text-tinta-3 focus:border-marca focus:outline-none"
              />
            </div>
          ) : null}
          {filtros}
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-borda">
              {colunas.map((c) => (
                <th
                  key={c.chave}
                  scope="col"
                  className={cn(
                    "px-5 py-3 text-xs font-medium whitespace-nowrap text-tinta-3",
                    ALINHAMENTO[c.alinhamento ?? "esquerda"],
                    c.larguraClasse,
                  )}
                >
                  {c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((item) => (
              <tr
                key={chaveDe(item)}
                className="border-b border-borda/60 transition-colors last:border-0 hover:bg-superficie-2"
              >
                {colunas.map((c) => (
                  <td
                    key={c.chave}
                    className={cn("px-5 py-3.5 align-middle", ALINHAMENTO[c.alinhamento ?? "esquerda"])}
                  >
                    {c.celula(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {visiveis.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-tinta-3">
            {vazio ?? "Nenhum registro encontrado."}
          </div>
        ) : null}
      </div>

      {filtrados.length > porPagina ? (
        <Paginacao
          pagina={paginaAtual}
          totalPaginas={totalPaginas}
          total={filtrados.length}
          porPagina={porPagina}
          aoMudar={setPagina}
        />
      ) : null}
    </div>
  );
}

export function Paginacao({
  pagina,
  totalPaginas,
  total,
  porPagina,
  aoMudar,
}: {
  pagina: number;
  totalPaginas: number;
  total: number;
  porPagina: number;
  aoMudar: (p: number) => void;
}) {
  const inicio = (pagina - 1) * porPagina + 1;
  const fim = Math.min(pagina * porPagina, total);

  return (
    <nav
      aria-label="Paginação"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-borda px-5 py-3"
    >
      <p className="tabular text-xs text-tinta-3">
        {formatarNumero(inicio)}–{formatarNumero(fim)} de {formatarNumero(total)}
      </p>
      <div className="flex items-center gap-1.5">
        <Botao
          tamanho="sm"
          variante="fantasma"
          disabled={pagina <= 1}
          onClick={() => aoMudar(pagina - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft aria-hidden className="size-4" />
          Anterior
        </Botao>
        <span className="tabular px-2 text-xs text-tinta-2">
          {pagina} / {totalPaginas}
        </span>
        <Botao
          tamanho="sm"
          variante="fantasma"
          disabled={pagina >= totalPaginas}
          onClick={() => aoMudar(pagina + 1)}
          aria-label="Próxima página"
        >
          Próxima
          <ChevronRight aria-hidden className="size-4" />
        </Botao>
      </div>
    </nav>
  );
}

/** Select compacto usado na barra de filtros das tabelas. */
export function FiltroSelecao({
  rotulo,
  valor,
  opcoes,
  aoMudar,
}: {
  rotulo: string;
  valor: string;
  opcoes: { valor: string; texto: string }[];
  aoMudar: (v: string) => void;
}) {
  const id = React.useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs whitespace-nowrap text-tinta-3">
        {rotulo}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        className="h-9 cursor-pointer rounded-lg border border-borda-forte bg-superficie-2 px-2.5 text-sm text-tinta focus:border-marca focus:outline-none"
      >
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.texto}
          </option>
        ))}
      </select>
    </div>
  );
}
