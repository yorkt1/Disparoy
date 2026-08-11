import * as React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, TriangleAlert, Upload, Users } from "lucide-react";
import type { Lista } from "@disparoy/dominio";
import { cn, formatarNumero } from "@/lib/formato";
import { Botao } from "@/components/ui/botao";
import { Modal } from "@/components/ui/modal";
import { EstadoVazio } from "@/components/ui/primitivos";
import { ImportadorContatos } from "@/components/contatos/importador-contatos";

/**
 * Etapa 4 — escolha da lista de contatos.
 *
 * O número em destaque é o de contatos ELEGÍVEIS, não o total: é ele que
 * determina quantas mensagens sairão. Uma lista de 5.000 pessoas em que 4.000
 * não deram consentimento é uma lista de 1.000 para efeito de campanha, e a
 * tela precisa dizer isso antes do disparo, não depois.
 *
 * A importação acontece AQUI, sem sair do formulário. Mandar o operador para
 * outra tela no meio da etapa 4 custava a campanha inteira: o wizard não
 * guarda rascunho, então voltar significava recomeçar da etapa 1.
 */
export function SeletorLista({
  listas,
  selecionada,
  aoSelecionar,
}: {
  listas: Lista[];
  selecionada: string | null;
  aoSelecionar: (id: string | null) => void;
}) {
  const [importando, setImportando] = React.useState(false);

  /**
   * A lista recém-criada já entra selecionada.
   *
   * `useListas` é query e a importação invalida a chave, então ela aparece na
   * grade sozinha; selecionar por id aqui evita o operador importar 3.000
   * contatos e ainda ter que procurar a lista na tela.
   */
  function concluir(listaId: string | null) {
    setImportando(false);
    if (listaId) aoSelecionar(listaId);
  }

  const botaoImportar = (
    <Botao variante="primario" onClick={() => setImportando(true)}>
      <Upload aria-hidden className="size-4" />
      Importar planilha
    </Botao>
  );

  return (
    <fieldset>
      <legend className="sr-only">Lista de contatos</legend>

      {listas.length === 0 ? (
        <EstadoVazio
          icone={<Users className="size-7" />}
          titulo="Nenhuma lista de contatos"
          descricao="Importe uma planilha com nome e número — ela vira uma lista e já fica selecionada."
          acao={
            <div className="flex flex-wrap items-center justify-center gap-2">
              {botaoImportar}
              <Link
                to="/contatos"
                className="rounded-lg px-4 py-2 text-sm text-tinta-2 hover:text-tinta"
              >
                Ir para Contatos
              </Link>
            </div>
          }
        />
      ) : (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {listas.map((lista) => {
              const marcada = selecionada === lista.id;
              const bloqueados = lista.totalContatos - lista.totalElegiveis;
              const vazia = lista.totalElegiveis === 0;

              return (
                <label
                  key={lista.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors",
                    marcada
                      ? "border-marca bg-marca/8"
                      : "border-borda-forte bg-superficie-2 hover:border-[#4a4a46]",
                    vazia && "opacity-60",
                  )}
                >
                  <input
                    type="radio"
                    name="lista-campanha"
                    checked={marcada}
                    onChange={() => aoSelecionar(lista.id)}
                    className="mt-0.5 size-4 shrink-0 cursor-pointer accent-marca"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-tinta">
                      {lista.nome}
                    </span>

                    <span className="tabular mt-1.5 flex items-center gap-1.5 text-xs">
                      <ShieldCheck
                        aria-hidden
                        className={cn("size-3.5", vazia ? "text-tinta-3" : "text-bom")}
                      />
                      <span className={vazia ? "text-tinta-3" : "text-bom"}>
                        {formatarNumero(lista.totalElegiveis)}
                      </span>
                      <span className="text-tinta-3">
                        {lista.totalElegiveis === 1 ? "contato pode" : "contatos podem"} receber
                      </span>
                    </span>

                    {bloqueados > 0 ? (
                      <span className="tabular mt-1 flex items-center gap-1.5 text-xs text-aviso">
                        <TriangleAlert aria-hidden className="size-3.5" />
                        {formatarNumero(bloqueados)} sem consentimento ou com pedido de saída
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-3">
            <Botao variante="secundario" tamanho="sm" onClick={() => setImportando(true)}>
              <Upload aria-hidden className="size-3.5" />
              Importar outra planilha
            </Botao>
          </div>
        </>
      )}

      <p className="mt-3 text-xs text-tinta-3">
        Contatos sem consentimento registrado ou que pediram para sair são excluídos
        automaticamente do disparo — a filtragem acontece no banco, no momento em que a campanha é
        criada.
      </p>

      <Modal
        aberto={importando}
        aoFechar={() => setImportando(false)}
        titulo="Importar contatos"
        descricao="Planilha com nome e número. O consentimento é obrigatório antes de importar."
        largura="lg"
      >
        <ImportadorContatos aoConcluir={concluir} />
      </Modal>
    </fieldset>
  );
}
