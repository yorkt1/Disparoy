
import * as React from "react";
import { FileText, Plus, RefreshCw } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo, AreaTexto, Selecao, MensagemErro } from "@/components/ui/campos";
import { Modal } from "@/components/ui/modal";
import { EstadoVazio } from "@/components/ui/primitivos";
import { Tabela, FiltroSelecao, type Coluna } from "@/components/ui/tabela";
import { useToast } from "@/components/ui/toast";
import { ROTULO_CATEGORIA, SeloTemplate } from "@/components/campanhas/selo-status";
import type { CategoriaTemplate, Template } from "@disparoy/dominio";
import { formatarData, slugify } from "@/lib/formato";
import { mensagemDe } from "@/lib/api";
import { useCriarTemplate, useSincronizarTemplates } from "@/hooks/consultas";

export function ListaTemplates({ templates }: { templates: Template[] }) {
  const [categoria, setCategoria] = React.useState("todas");
  const [status, setStatus] = React.useState("todos");
  const [criando, setCriando] = React.useState(false);
  const { mostrar } = useToast();
  const sincronizacao = useSincronizarTemplates();

  const filtrados = templates.filter(
    (t) =>
      (categoria === "todas" || t.categoria === categoria) &&
      (status === "todos" || t.status === status),
  );

  async function sincronizar() {
    try {
      const r = await sincronizacao.mutateAsync();
      mostrar({
        tipo: "sucesso",
        titulo: "Templates sincronizados",
        descricao: `${r.importados} importados · ${r.atualizados} atualizados.`,
      });
    } catch (e) {
      mostrar({
        tipo: "erro",
        titulo: "Não foi possível sincronizar",
        descricao: mensagemDe(e, "Erro inesperado."),
      });
    }
  }

  const colunas: Coluna<Template>[] = [
    {
      chave: "nome",
      titulo: "Template",
      celula: (t) => (
        <div className="max-w-md">
          <code className="text-sm font-medium text-tinta">{t.nome}</code>
          <p className="mt-1 line-clamp-2 text-xs text-tinta-3">{t.corpo}</p>
        </div>
      ),
    },
    {
      chave: "categoria",
      titulo: "Categoria",
      celula: (t) => <span className="text-tinta-2">{ROTULO_CATEGORIA[t.categoria]}</span>,
    },
    {
      chave: "idioma",
      titulo: "Idioma",
      celula: (t) => <span className="tabular text-tinta-3">{t.idioma}</span>,
    },
    {
      chave: "variaveis",
      titulo: "Variáveis",
      alinhamento: "direita",
      celula: (t) => <span className="tabular text-tinta-2">{t.variaveis}</span>,
    },
    { chave: "status", titulo: "Status", celula: (t) => <SeloTemplate status={t.status} /> },
    {
      chave: "atualizado",
      titulo: "Atualizado",
      alinhamento: "direita",
      celula: (t) => (
        <span className="tabular whitespace-nowrap text-tinta-3">{formatarData(t.atualizadoEm)}</span>
      ),
    },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-tinta">Templates</h1>
          <p className="mt-1 text-sm text-tinta-3">
            Modelos aprovados pela Meta para envio pela WhatsApp Business API oficial.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Botao onClick={sincronizar} carregando={sincronizacao.isPending}>
            {sincronizacao.isPending ? null : <RefreshCw aria-hidden className="size-4" />}
            Sincronizar
          </Botao>
          <Botao variante="primario" onClick={() => setCriando(true)}>
            <Plus aria-hidden className="size-4" />
            Novo template
          </Botao>
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-borda bg-superficie">
        {templates.length === 0 ? (
          <EstadoVazio
            icone={<FileText className="size-7" />}
            titulo="Nenhum template ainda"
            descricao="Crie um template ou sincronize os que já existem na sua conta Meta."
          />
        ) : (
          <Tabela
            colunas={colunas}
            itens={filtrados}
            chaveDe={(t) => t.id}
            porPagina={10}
            buscaPlaceholder="Buscar por nome ou conteúdo…"
            textoBusca={(t) => `${t.nome} ${t.corpo}`}
            vazio="Nenhum template com esses filtros."
            filtros={
              <>
                <FiltroSelecao
                  rotulo="Categoria"
                  valor={categoria}
                  aoMudar={setCategoria}
                  opcoes={[
                    { valor: "todas", texto: "Todas" },
                    { valor: "marketing", texto: "Marketing" },
                    { valor: "utilidade", texto: "Utilidade" },
                    { valor: "autenticacao", texto: "Autenticação" },
                  ]}
                />
                <FiltroSelecao
                  rotulo="Status"
                  valor={status}
                  aoMudar={setStatus}
                  opcoes={[
                    { valor: "todos", texto: "Todos" },
                    { valor: "aprovado", texto: "Aprovado" },
                    { valor: "pendente", texto: "Em análise" },
                    { valor: "rejeitado", texto: "Rejeitado" },
                    { valor: "pausado", texto: "Pausado" },
                  ]}
                />
              </>
            }
          />
        )}
      </div>

      <ModalNovoTemplate aberto={criando} aoFechar={() => setCriando(false)} />
    </>
  );
}

function ModalNovoTemplate({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const [nome, setNome] = React.useState("");
  const [categoria, setCategoria] = React.useState<CategoriaTemplate>("marketing");
  const [corpo, setCorpo] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const { mostrar } = useToast();
  const criacao = useCriarTemplate();

  function fechar() {
    aoFechar();
    setNome("");
    setCorpo("");
    setErro(null);
  }

  async function salvar() {
    setErro(null);
    try {
      await criacao.mutateAsync({ nome: slugify(nome), categoria, idioma: "pt_BR", corpo });
      mostrar({
        tipo: "sucesso",
        titulo: "Template enviado para análise",
        descricao: "A Meta costuma responder em até 24h.",
      });
      fechar();
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível criar o template."));
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      aoConfirmar={salvar}
      confirmando={criacao.isPending}
      titulo="Novo template"
      descricao="Templates passam por aprovação da Meta antes de poderem ser usados."
      rodape={
        <>
          <Botao variante="fantasma" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" onClick={salvar} carregando={criacao.isPending}>
            Enviar para aprovação
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo
          rotulo="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="nome_do_template"
          dica={nome ? `Será registrado como "${slugify(nome)}"` : "Minúsculas e underline, padrão da Meta."}
          required
        />
        <Selecao
          rotulo="Categoria"
          value={categoria}
          onChange={(e) => setCategoria(e.target.value as CategoriaTemplate)}
        >
          <option value="marketing">Marketing</option>
          <option value="utilidade">Utilidade</option>
          <option value="autenticacao">Autenticação</option>
        </Selecao>
        <AreaTexto
          rotulo="Corpo da mensagem"
          value={corpo}
          onChange={(e) => setCorpo(e.target.value)}
          rows={5}
          maxCaracteres={1024}
          placeholder="Escreva o corpo usando {{1}}, {{2}}… para os parâmetros."
          dica="Use {{1}}, {{2}}… para os parâmetros variáveis."
          required
        />
        <MensagemErro>{erro}</MensagemErro>
      </div>
    </Modal>
  );
}
