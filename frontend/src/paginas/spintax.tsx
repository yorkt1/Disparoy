import * as React from "react";
import { Shuffle } from "lucide-react";
import { CabecalhoPagina, Card, EstadoVazio } from "@/components/ui/primitivos";
import { Botao } from "@/components/ui/botao";
import { Carregando, ErroCarregamento } from "@/components/ui/estados";
import { ModalVariacoes } from "@/components/campanhas/gerenciador-spintax";
import { useSpintax } from "@/hooks/consultas";
import type { Spintax } from "@disparoy/dominio";

/**
 * Variações de texto, fora do fluxo de criação de campanha.
 *
 * Elas são reutilizáveis entre campanhas, então precisam de um lugar próprio —
 * antes só dava para chegar nelas abrindo uma campanha nova, o que obrigava a
 * começar um rascunho só para editar um texto.
 *
 * Reaproveita o `ModalVariacoes` do editor: é a mesma lista, com as mesmas
 * ações. Sem `aoSelecionar`, porque aqui não há mensagem em que inserir.
 */
export function PaginaSpintax() {
  const consulta = useSpintax();
  const [aberto, setAberto] = React.useState(false);
  const [variacoes, setVariacoes] = React.useState<Spintax[]>([]);

  // A lista local acompanha o servidor, e o modal a atualiza sem refetch.
  React.useEffect(() => {
    if (consulta.data) setVariacoes(consulta.data);
  }, [consulta.data]);

  return (
    <>
      <CabecalhoPagina
        titulo="Spintax"
        descricao="Formas diferentes de dizer a mesma coisa. Cada contato recebe uma, sorteada no envio — texto idêntico para todo mundo é o sinal mais forte de disparo automático."
        acao={
          <Botao variante="primario" onClick={() => setAberto(true)}>
            <Shuffle aria-hidden className="size-4" />
            Gerenciar variações
          </Botao>
        }
      />

      {consulta.isLoading && <Carregando rotulo="Carregando variações…" />}
      {consulta.error && (
        <ErroCarregamento erro={consulta.error} aoTentarNovamente={() => void consulta.refetch()} />
      )}

      {consulta.data && (
        <Card>
          {variacoes.length === 0 ? (
            <EstadoVazio
              icone={<Shuffle className="size-7" />}
              titulo="Nenhuma variação ainda"
              descricao="Crie uma e use como {{*nome*}} no texto da campanha."
              acao={
                <Botao variante="primario" onClick={() => setAberto(true)}>
                  Criar variação
                </Botao>
              }
            />
          ) : (
            <ul className="divide-y divide-borda">
              {variacoes.map((v) => (
                <li key={v.id} className="px-5 py-3.5">
                  <p className="flex items-baseline gap-2">
                    <code className="text-sm text-tinta">{`{{*${v.nome}*}}`}</code>
                    <span className="tabular text-xs text-tinta-3">
                      {v.opcoes.length} {v.opcoes.length === 1 ? "opção" : "opções"}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-tinta-3" title={v.opcoes.join("\n")}>
                    {v.opcoes.join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <ModalVariacoes
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        variacoes={variacoes}
        aoMudar={setVariacoes}
        // Fora de uma campanha não há texto em que inserir a variação; o modal
        // esconde o botão "Selecionar" quando isto não é passado.
        aoSelecionar={undefined}
      />
    </>
  );
}
