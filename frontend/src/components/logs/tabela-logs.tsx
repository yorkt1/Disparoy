
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw, ScrollText } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Modal } from "@/components/ui/modal";
import { Badge, EstadoVazio, type TomBadge } from "@/components/ui/primitivos";
import { Tabela, FiltroSelecao, type Coluna } from "@/components/ui/tabela";
import type { AcaoLog, LogAuditoria, TipoEntidade } from "@disparoy/dominio";
import { formatarDataHora } from "@/lib/formato";

/** Rótulo legível e tom de cada ação registrada. */
const ACOES: Record<AcaoLog, { texto: string; tom: TomBadge }> = {
  "campanha.criada": { texto: "Campanha criada", tom: "neutro" },
  "campanha.iniciada": { texto: "Campanha iniciada", tom: "marca" },
  "campanha.pausada": { texto: "Campanha pausada", tom: "aviso" },
  "campanha.concluida": { texto: "Campanha concluída", tom: "bom" },
  "campanha.abandonada": { texto: "Campanha abandonada", tom: "critico" },
  // "não saiu no horário" e não "expirou": o que o operador precisa saber é
  // que nenhuma mensagem foi enviada, não o nome interno do mecanismo.
  "campanha.agendamento_expirado": { texto: "Agendamento não saiu no horário", tom: "critico" },
  "campanha.rascunho_salvo": { texto: "Rascunho salvo", tom: "neutro" },
  "campanha.editada": { texto: "Campanha editada", tom: "aviso" },
  // "aviso" e não "neutro": a cópia leva o público inteiro do original —
  // telefone e variáveis de gente real mudando de campanha sem ninguém
  // reimportar planilha. É o mesmo peso de `contatos.extraidos`.
  "campanha.duplicada": { texto: "Campanha duplicada", tom: "aviso" },
  "campanha.excluida": { texto: "Campanha excluída", tom: "critico" },
  // "aviso" e não "neutro": é o mesmo tom de `contatos.extraidos`, porque é o
  // mesmo fato — dado pessoal saiu do sistema em planilha.
  "campanha.relatorio_exportado": { texto: "Relatório exportado", tom: "aviso" },
  "midia.upload": { texto: "Upload de mídia", tom: "neutro" },
  "spintax.criado": { texto: "Spintax criado", tom: "neutro" },
  "spintax.excluido": { texto: "Spintax excluído", tom: "critico" },
  "canal.onboarding": { texto: "Onboarding de canal", tom: "marca" },
  "canal.conectado": { texto: "Canal conectado", tom: "bom" },
  "canal.desconectado": { texto: "Canal desconectado", tom: "aviso" },
  "canal.excluido": { texto: "Canal excluído", tom: "critico" },
  "template.criado": { texto: "Template criado", tom: "neutro" },
  "template.sincronizado": { texto: "Templates sincronizados", tom: "marca" },
  "contatos.importados": { texto: "Contatos importados", tom: "neutro" },
  "contatos.extraidos": { texto: "Agenda extraída", tom: "aviso" },
  "contato.opt_in": { texto: "Consentimento registrado", tom: "bom" },
  "contato.opt_out": { texto: "Pedido de saída", tom: "critico" },
  "contato.excluido": { texto: "Contato excluído", tom: "critico" },
  "lista.criada": { texto: "Lista criada", tom: "neutro" },
  "lista.excluida": { texto: "Lista excluída", tom: "critico" },
  "sessao.iniciada": { texto: "Login", tom: "neutro" },
  "empresa.criada": { texto: "Empresa criada", tom: "marca" },
  "usuario.criado": { texto: "Acesso criado", tom: "marca" },
  "usuario.papel_alterado": { texto: "Papel alterado", tom: "aviso" },
  "usuario.senha_redefinida": { texto: "Senha redefinida", tom: "aviso" },
  "usuario.senha_alterada": { texto: "Senha alterada pelo próprio", tom: "neutro" },
  "usuario.desativado": { texto: "Acesso desativado", tom: "critico" },
  "usuario.reativado": { texto: "Acesso reativado", tom: "bom" },
};

const ENTIDADES: Record<TipoEntidade, string> = {
  campanha: "Campanha",
  canal: "Canal",
  template: "Template",
  spintax: "Spintax",
  midia: "Mídia",
  contato: "Contato",
  lista: "Lista",
  usuario: "Usuário",
  empresa: "Empresa",
};

export function TabelaLogs({ logs }: { logs: LogAuditoria[] }) {
  const [entidade, setEntidade] = React.useState("todas");
  const [detalhe, setDetalhe] = React.useState<LogAuditoria | null>(null);
  const [atualizando, setAtualizando] = React.useState(false);
  const cliente = useQueryClient();

  const filtrados = logs.filter((l) => entidade === "todas" || l.tipoEntidade === entidade);

  /**
   * Refaz a consulta de logs. `invalidateQueries` devolve uma promessa que só
   * resolve quando a busca termina, então o botão fica em carregamento pelo
   * tempo real da requisição — sem timer arbitrário.
   */
  async function atualizar() {
    setAtualizando(true);
    try {
      await cliente.invalidateQueries({ queryKey: ["logs"] });
    } finally {
      setAtualizando(false);
    }
  }

  const colunas: Coluna<LogAuditoria>[] = [
    {
      chave: "data",
      titulo: "Data/hora",
      celula: (l) => (
        <span className="tabular whitespace-nowrap text-tinta-2">
          {formatarDataHora(l.ocorridoEm)}
        </span>
      ),
    },
    {
      chave: "usuario",
      titulo: "Usuário",
      celula: (l) => <span className="text-tinta-2">{l.usuarioNome}</span>,
    },
    {
      chave: "acao",
      titulo: "Ação",
      celula: (l) => {
        const a = ACOES[l.acao] ?? { texto: l.acao, tom: "neutro" as TomBadge };
        return <Badge tom={a.tom}>{a.texto}</Badge>;
      },
    },
    {
      chave: "entidade",
      titulo: "Entidade",
      celula: (l) => (
        <div className="max-w-64">
          <p className="text-xs text-tinta-3">{ENTIDADES[l.tipoEntidade]}</p>
          <p className="truncate text-sm text-tinta-2">{l.entidadeRotulo}</p>
        </div>
      ),
    },
    {
      chave: "ip",
      titulo: "IP de origem",
      celula: (l) => <span className="tabular text-tinta-3">{l.ip}</span>,
    },
    {
      chave: "detalhes",
      titulo: "Detalhes",
      alinhamento: "direita",
      celula: (l) => (
        <button
          type="button"
          onClick={() => setDetalhe(l)}
          className="inline-flex items-center gap-1 text-xs text-marca-tenue hover:underline"
        >
          Ver detalhes
          <ExternalLink aria-hidden className="size-3" />
        </button>
      ),
    },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-tinta">Logs</h1>
          <p className="mt-1 text-sm text-tinta-3">
            Trilha de auditoria de tudo que acontece na conta.
          </p>
        </div>
        <Botao onClick={atualizar} carregando={atualizando}>
          {atualizando ? null : <RefreshCw aria-hidden className="size-4" />}
          Atualizar
        </Botao>
      </div>

      <div className="overflow-hidden rounded-card border border-borda bg-superficie">
        {logs.length === 0 ? (
          <EstadoVazio
            icone={<ScrollText className="size-7" />}
            titulo="Nenhum evento registrado"
            descricao="As ações da conta aparecem aqui automaticamente."
          />
        ) : (
          <Tabela
            colunas={colunas}
            itens={filtrados}
            chaveDe={(l) => l.id}
            porPagina={15}
            buscaPlaceholder="Buscar por entidade, usuário ou IP…"
            textoBusca={(l) => `${l.entidadeRotulo} ${l.usuarioNome} ${l.ip} ${ACOES[l.acao]?.texto ?? l.acao}`}
            vazio="Nenhum evento com esse filtro."
            filtros={
              <FiltroSelecao
                rotulo="Entidade"
                valor={entidade}
                aoMudar={setEntidade}
                opcoes={[
                  { valor: "todas", texto: "Todas" },
                  ...Object.entries(ENTIDADES).map(([valor, texto]) => ({ valor, texto })),
                ]}
              />
            }
          />
        )}
      </div>

      <Modal
        aberto={detalhe !== null}
        aoFechar={() => setDetalhe(null)}
        titulo={detalhe ? (ACOES[detalhe.acao]?.texto ?? detalhe.acao) : ""}
        descricao={detalhe ? formatarDataHora(detalhe.ocorridoEm) : undefined}
        rodape={
          <Botao variante="secundario" onClick={() => setDetalhe(null)}>
            Fechar
          </Botao>
        }
      >
        {detalhe ? (
          <dl className="flex flex-col gap-3 text-sm">
            <ParDetalhe rotulo="Evento" valor={detalhe.id} mono />
            <ParDetalhe rotulo="Usuário" valor={`${detalhe.usuarioNome} (${detalhe.usuarioId})`} />
            <ParDetalhe rotulo="Tipo de entidade" valor={ENTIDADES[detalhe.tipoEntidade]} />
            <ParDetalhe rotulo="Entidade" valor={detalhe.entidadeRotulo} />
            {detalhe.entidadeId ? (
              <ParDetalhe rotulo="ID da entidade" valor={detalhe.entidadeId} mono />
            ) : null}
            <ParDetalhe rotulo="IP de origem" valor={detalhe.ip} mono />

            {Object.keys(detalhe.detalhes).length > 0 ? (
              <div>
                <dt className="text-xs text-tinta-3">Dados adicionais</dt>
                <dd className="mt-1.5">
                  <pre className="overflow-x-auto rounded-lg border border-borda-forte bg-superficie-2 p-3 text-xs text-tinta-2">
                    {JSON.stringify(detalhe.detalhes, null, 2)}
                  </pre>
                </dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </Modal>
    </>
  );
}

function ParDetalhe({ rotulo, valor, mono }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs text-tinta-3">{rotulo}</dt>
      <dd className={mono ? "tabular text-xs text-tinta-2" : "text-sm text-tinta-2"}>{valor}</dd>
    </div>
  );
}
