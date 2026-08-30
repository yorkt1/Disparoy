
import * as React from "react";
import { ArrowLeft, Check, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { AreaTexto, Campo, MensagemErro } from "@/components/ui/campos";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import type { Spintax } from "@disparoy/dominio";
import { slugify } from "@/lib/formato";
import { ErroApi } from "@/lib/api";
import { useExcluirSpintax, useGerarVariacoes, useSalvarSpintax } from "@/hooks/consultas";

/** Tetos do `spintaxEntradaSchema`, conferidos aqui só para dar aviso antes do 400. */
const MIN_OPCOES = 2;
const MAX_OPCOES = 50;
const MAX_CARACTERES_OPCAO = 1000;

/**
 * Slug aplicado a cada tecla no campo Nome: "Guilherme atraso p1" vira
 * "guilherme_atraso_p1" à medida que se digita.
 *
 * Difere do `slugify` final num ponto de propósito: mantém o `_` do fim. O
 * `slugify` o remove, e cortá-lo a cada tecla engoliria o espaço recém-digitado
 * antes da próxima palavra — o `_` separador nunca chegaria a aparecer.
 */
function slugDigitando(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+/, "");
}

/**
 * Variações (spintax): listar, criar, editar e inserir no texto.
 *
 * Uma variação é um conjunto de textos equivalentes; na hora do envio um deles
 * é sorteado por contato. No corpo da mensagem entra como {{*nome*}}.
 *
 * Vive num modal com duas telas — lista e formulário — porque a variação é
 * reutilizável entre campanhas: quem abre daqui quase sempre quer escolher uma
 * que já existe, e só às vezes criar outra.
 */
export function ModalVariacoes({
  aberto,
  aoFechar,
  variacoes,
  aoMudar,
  aoSelecionar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  variacoes: Spintax[];
  aoMudar: (lista: Spintax[]) => void;
  /**
   * Insere {{*nome*}} na mensagem que abriu o modal.
   *
   * Ausente quando o modal é aberto pela página de Spintax: ali não existe
   * mensagem em que inserir, e o botão "Selecionar" some.
   */
  aoSelecionar?: (nome: string) => void;
}) {
  const [vista, setVista] = React.useState<"lista" | "formulario">("lista");
  const [nome, setNome] = React.useState("");
  const [opcoes, setOpcoes] = React.useState<string[]>(["", ""]);
  /** Preenchido no lápis: o nome vira chave fixa e o salvar substitui a lista. */
  const [editando, setEditando] = React.useState<Spintax | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);
  const [tentouSalvar, setTentouSalvar] = React.useState(false);

  const { mostrar } = useToast();
  const gravacao = useSalvarSpintax();
  const exclusao = useExcluirSpintax();
  const geracao = useGerarVariacoes();

  const slug = slugify(nome);
  const preenchidas = opcoes.map((o) => o.trim()).filter(Boolean);

  function abrirCriacao() {
    setEditando(null);
    setNome("");
    setOpcoes(["", ""]);
    setErro(null);
    setTentouSalvar(false);
    setVista("formulario");
  }

  function abrirEdicao(item: Spintax) {
    setEditando(item);
    setNome(item.nome);
    setOpcoes([...item.opcoes]);
    setErro(null);
    setTentouSalvar(false);
    setVista("formulario");
  }

  function voltar() {
    setVista("lista");
    setErro(null);
  }

  function fechar() {
    aoFechar();
    // A próxima abertura começa na lista, não no formulário meio preenchido
    // de quem desistiu — mas só depois do fecho animar, para a troca de tela
    // não piscar por cima do modal saindo.
    setTimeout(() => setVista("lista"), 150);
  }

  async function salvar() {
    setTentouSalvar(true);

    if (slug.length < 2) {
      setErro("Dê um nome à variação (mínimo 2 caracteres).");
      return;
    }
    if (preenchidas.length < MIN_OPCOES) {
      setErro(`Adicione ao menos ${MIN_OPCOES} opções.`);
      return;
    }

    setErro(null);
    try {
      const { spintax: salva } = await gravacao.mutateAsync({ nome: slug, opcoes: preenchidas });
      // Salvar com um nome existente substitui a lista, então a antiga sai daqui.
      aoMudar([...variacoes.filter((v) => v.nome !== salva.nome), salva]);
      mostrar({
        tipo: "sucesso",
        titulo: editando ? "Variação atualizada" : "Variação salva",
        descricao: `{{*${salva.nome}*}} · ${salva.opcoes.length} opções`,
      });
      voltar();
    } catch (e) {
      setErro(
        e instanceof ErroApi
          ? (e.primeiroCampo ?? e.message)
          : "Não foi possível salvar a variação.",
      );
    }
  }

  /**
   * Reescreve a Opção 1 nas outras opções.
   *
   * O que era copiar o texto no ChatGPT, colar o prompt e trazer as respostas
   * de volta à mão. O resultado é **acrescentado**, nunca substitui: quem já
   * escreveu duas opções à mão não as perde por clicar aqui.
   */
  async function gerar() {
    const original = opcoes[0]?.trim() ?? "";
    if (original.length < 10) {
      setErro("Escreva o texto original na Opção 1 — é dele que saem as variações.");
      return;
    }

    setErro(null);
    try {
      const { variacoes } = await geracao.mutateAsync({ texto: original, quantidade: 5 });
      const jaEscritas = opcoes.map((o) => o.trim()).filter(Boolean);
      // A primeira da resposta é o próprio original, que já está na lista.
      const novas = variacoes
        .slice(1)
        .filter((v) => !jaEscritas.some((e) => e.toLowerCase() === v.toLowerCase()));

      setOpcoes([...jaEscritas, ...novas].slice(0, MAX_OPCOES));
      mostrar({
        tipo: "sucesso",
        titulo: `${novas.length} ${novas.length === 1 ? "variação gerada" : "variações geradas"}`,
        descricao: "Confira e edite antes de salvar — o texto sai como está.",
      });
    } catch (e) {
      setErro(
        e instanceof ErroApi
          ? (e.primeiroCampo ?? e.message)
          : "Não foi possível gerar as variações.",
      );
    }
  }

  async function excluir(item: Spintax) {
    try {
      await exclusao.mutateAsync(item.id);
      aoMudar(variacoes.filter((v) => v.id !== item.id));
      mostrar({ tipo: "info", titulo: `Variação "${item.nome}" excluída` });
    } catch {
      mostrar({ tipo: "erro", titulo: "Não foi possível excluir a variação." });
    }
  }

  function selecionar(item: Spintax) {
    aoSelecionar?.(item.nome);
    fechar();
  }

  const naLista = vista === "lista";

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      aoConfirmar={salvar}
      confirmando={gravacao.isPending}
      titulo={naLista ? "Variações" : editando ? `Editar {{*${editando.nome}*}}` : "Nova variação"}
      descricao={
        naLista
          ? "Cada contato recebe uma das opções, sorteada no envio. A mesma variação serve para outras campanhas."
          : "Escreva formas diferentes de dizer a mesma coisa — uma por campo."
      }
      rodape={
        naLista ? (
          <Botao variante="fantasma" onClick={fechar}>
            Fechar
          </Botao>
        ) : (
          <>
            <Botao variante="fantasma" onClick={voltar}>
              <ArrowLeft aria-hidden className="size-4" />
              Voltar
            </Botao>
            <Botao variante="primario" onClick={salvar} carregando={gravacao.isPending}>
              <Check aria-hidden className="size-4" />
              Salvar variação
            </Botao>
          </>
        )
      }
    >
      {naLista ? (
        <ListaVariacoes
          variacoes={variacoes}
          aoCriar={abrirCriacao}
          aoEditar={abrirEdicao}
          aoExcluir={excluir}
          aoSelecionar={aoSelecionar ? selecionar : undefined}
          excluindo={exclusao.isPending}
        />
      ) : (
        <FormularioVariacao
          nome={nome}
          slug={slug}
          opcoes={opcoes}
          editando={editando}
          erro={erro}
          avisarMinimo={tentouSalvar && preenchidas.length < MIN_OPCOES}
          gerando={geracao.isPending}
          aoMudarNome={setNome}
          aoMudarOpcoes={setOpcoes}
          aoGerar={gerar}
        />
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function ListaVariacoes({
  variacoes,
  aoCriar,
  aoEditar,
  aoExcluir,
  aoSelecionar,
  excluindo,
}: {
  variacoes: Spintax[];
  aoCriar: () => void;
  aoEditar: (v: Spintax) => void;
  aoExcluir: (v: Spintax) => void;
  aoSelecionar?: (v: Spintax) => void;
  excluindo: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Botao variante="primario" onClick={aoCriar} className="justify-center">
        <Plus aria-hidden className="size-4" />
        Nova variação
      </Botao>

      {variacoes.length === 0 ? (
        <p className="py-4 text-center text-xs text-tinta-3">
          Nenhuma variação ainda. Elas evitam que todos os contatos recebam exatamente o mesmo
          texto — que é o sinal mais forte de disparo automático.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {variacoes.map((v) => (
            <li
              key={v.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-borda-forte bg-superficie-2 px-3.5 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-baseline gap-2">
                  <code className="text-sm text-tinta">{`{{*${v.nome}*}}`}</code>
                  <span className="tabular shrink-0 text-xs text-tinta-3">
                    {v.opcoes.length} {v.opcoes.length === 1 ? "opção" : "opções"}
                  </span>
                </p>
                {/* Prévia do conteúdo: o nome sozinho não lembra o que tem dentro. */}
                <p className="mt-0.5 truncate text-xs text-tinta-3" title={v.opcoes.join("\n")}>
                  {v.opcoes.join(" · ")}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Botao
                  tamanho="icone"
                  variante="fantasma"
                  onClick={() => aoEditar(v)}
                  aria-label={`Editar variação ${v.nome}`}
                >
                  <Pencil aria-hidden className="size-3.5" />
                </Botao>
                <Botao
                  tamanho="icone"
                  variante="fantasma"
                  onClick={() => aoExcluir(v)}
                  disabled={excluindo}
                  aria-label={`Excluir variação ${v.nome}`}
                  className="hover:bg-critico/15 hover:text-critico"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </Botao>
                {aoSelecionar && (
                  <Botao tamanho="sm" variante="primario" onClick={() => aoSelecionar(v)}>
                    <Check aria-hidden className="size-3.5" />
                    Selecionar
                  </Botao>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function FormularioVariacao({
  nome,
  slug,
  opcoes,
  editando,
  erro,
  avisarMinimo,
  gerando,
  aoMudarNome,
  aoMudarOpcoes,
  aoGerar,
}: {
  nome: string;
  slug: string;
  opcoes: string[];
  editando: Spintax | null;
  erro: string | null;
  avisarMinimo: boolean;
  gerando: boolean;
  aoMudarNome: (v: string) => void;
  aoMudarOpcoes: (v: string[]) => void;
  aoGerar: () => void;
}) {
  const preenchidas = opcoes.filter((o) => o.trim()).length;
  const original = opcoes[0]?.trim() ?? "";

  return (
    <div className="flex flex-col gap-4">
      <Campo
        rotulo="Nome"
        value={nome}
        onChange={(e) => aoMudarNome(slugDigitando(e.target.value))}
        placeholder="ex: saudacao_inicial"
        disabled={editando !== null}
        dica={
          editando
            ? "O nome é a chave usada no texto das mensagens, então não muda na edição. Para renomear, crie outra e exclua esta."
            : slug
              ? `Só letras minúsculas, números e underscore, sem espaços — vira {{*${slug}*}}`
              : "Só letras minúsculas, números e underscore, sem espaços."
        }
        required
      />

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <span className="block text-xs font-medium text-tinta-2">Opções</span>
          <span className="tabular text-xs text-tinta-3">
            {preenchidas}/{MAX_OPCOES}
          </span>
        </div>

        <ul className="flex flex-col gap-2">
          {opcoes.map((opcao, i) => (
            // Índice como chave: a lista é reordenável só por remoção, e o campo
            // não guarda estado próprio — o valor mora todo no array acima.
            // eslint-disable-next-line react/no-array-index-key
            <li key={i} className="flex items-start gap-2">
              {/* O wrapper leva o flex-1: o `className` da AreaTexto pousa no
                  <textarea>, que já é w-full dentro do próprio wrapper.
                  AreaTexto (não Campo) para o texto da variação aparecer
                  inteiro — cresce em altura em vez de cortar numa linha. */}
              <div className="min-w-0 flex-1">
                <AreaTexto
                  autoAjuste
                  rows={1}
                  value={opcao}
                  onChange={(e) =>
                    aoMudarOpcoes(opcoes.map((o, j) => (j === i ? e.target.value : o)))
                  }
                  placeholder={`Opção ${i + 1}`}
                  aria-label={`Opção ${i + 1}`}
                  maxLength={MAX_CARACTERES_OPCAO}
                />
              </div>
              <Botao
                tamanho="icone"
                variante="fantasma"
                onClick={() => aoMudarOpcoes(opcoes.filter((_, j) => j !== i))}
                // Duas é o mínimo aceito; deixar remover até sobrar uma só
                // renderizaria um formulário que não tem como ser salvo.
                disabled={opcoes.length <= MIN_OPCOES}
                aria-label={`Remover opção ${i + 1}`}
                className="hover:bg-critico/15 hover:text-critico"
              >
                <Trash2 aria-hidden className="size-3.5" />
              </Botao>
            </li>
          ))}
        </ul>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Botao
            tamanho="sm"
            variante="secundario"
            onClick={() => aoMudarOpcoes([...opcoes, ""])}
            disabled={opcoes.length >= MAX_OPCOES}
          >
            <Plus aria-hidden className="size-3.5" />
            Adicionar opção
          </Botao>

          <Botao
            tamanho="sm"
            variante="secundario"
            onClick={aoGerar}
            carregando={gerando}
            disabled={original.length < 10 || opcoes.length >= MAX_OPCOES}
            title="Reescreve a Opção 1 em outras 4, mantendo o mesmo sentido"
          >
            {gerando ? null : <Sparkles aria-hidden className="size-3.5" />}
            {gerando ? "Gerando…" : "Gerar 5 variações"}
          </Botao>
        </div>

        {avisarMinimo ? (
          <MensagemErro>Adicione ao menos {MIN_OPCOES} opções.</MensagemErro>
        ) : (
          <p className="mt-2 text-xs text-tinta-3">
            {original.length < 10
              ? `Escreva o texto original na Opção 1 — dele saem as outras. Mínimo de ${MIN_OPCOES} opções.`
              : "Gerar reescreve a Opção 1 mantendo o mesmo sentido, e acrescenta às que já existem — nada é substituído."}
          </p>
        )}
      </div>

      <MensagemErro>{erro}</MensagemErro>
    </div>
  );
}
