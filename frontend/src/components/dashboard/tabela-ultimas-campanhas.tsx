
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Tabela, type Coluna } from "@/components/ui/tabela";
import { BarraProgresso } from "@/components/ui/primitivos";
import { SeloCampanha } from "@/components/campanhas/selo-status";
import type { ResumoCampanha } from "@disparoy/dominio";
import { formatarData, formatarNumero } from "@/lib/formato";

export interface LinhaCampanha extends ResumoCampanha {
  canaisRotulo: string;
}

export function TabelaUltimasCampanhas({
  campanhas,
  porPagina = 6,
  comBusca = false,
}: {
  campanhas: LinhaCampanha[];
  porPagina?: number;
  comBusca?: boolean;
}) {
  const colunas: Coluna<LinhaCampanha>[] = [
    {
      chave: "nome",
      titulo: "Campanha",
      celula: (c) => (
        <Link
          to={`/campanhas/${c.id}`}
          className="group inline-flex max-w-72 items-center gap-1.5 font-medium text-tinta hover:text-marca-tenue"
        >
          <span className="truncate">{c.nome}</span>
          <ArrowUpRight
            aria-hidden
            className="size-3.5 shrink-0 text-tinta-3 transition-colors group-hover:text-marca-tenue"
          />
        </Link>
      ),
    },
    {
      chave: "canal",
      titulo: "Canal",
      celula: (c) => <span className="text-tinta-2">{c.canaisRotulo}</span>,
    },
    {
      chave: "template",
      titulo: "Template",
      celula: (c) =>
        c.templatePrincipal ? (
          <code className="rounded bg-superficie-3 px-1.5 py-0.5 text-xs text-tinta-2">
            {c.templatePrincipal}
          </code>
        ) : (
          <span className="text-tinta-3">Texto livre</span>
        ),
    },
    {
      chave: "contatos",
      titulo: "Contatos",
      alinhamento: "direita",
      celula: (c) => (
        <span className="tabular text-tinta-2">{formatarNumero(c.metricas.total)}</span>
      ),
    },
    {
      chave: "status",
      titulo: "Status",
      celula: (c) => <SeloCampanha status={c.status} />,
    },
    {
      chave: "progresso",
      titulo: "Progresso",
      larguraClasse: "w-44",
      celula: (c) => (
        <BarraProgresso
          valor={c.progresso}
          rotulo={`Progresso de ${c.nome}`}
          tom={c.status === "falhou" ? "critico" : c.status === "pausada" ? "aviso" : "marca"}
        />
      ),
    },
    {
      chave: "data",
      titulo: "Data",
      alinhamento: "direita",
      celula: (c) => (
        <span className="tabular whitespace-nowrap text-tinta-3">
          {formatarData(c.iniciadaEm ?? c.agendadaPara ?? c.criadaEm)}
        </span>
      ),
    },
  ];

  return (
    <Tabela
      colunas={colunas}
      itens={campanhas}
      chaveDe={(c) => c.id}
      porPagina={porPagina}
      buscaPlaceholder={comBusca ? "Buscar campanha pelo nome…" : undefined}
      textoBusca={comBusca ? (c) => `${c.nome} ${c.canaisRotulo}` : undefined}
      vazio="Nenhuma campanha ainda. Crie a primeira em “Nova Campanha”."
    />
  );
}
