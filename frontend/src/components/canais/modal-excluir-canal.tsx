import type { Canal } from "@disparoy/dominio";
import { Trash2 } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Modal } from "@/components/ui/modal";
import { SeloCampanha } from "@/components/campanhas/selo-status";
import { useVinculosCanal } from "@/hooks/consultas";

/**
 * Confirmação de exclusão que mostra o que vai junto.
 *
 * A API recusava excluir canal usado em campanha e mandava "desconecte em vez
 * de excluir" — o canal ficava na lista para sempre, sem saída pelo produto, e
 * o operador só descobria o problema DEPOIS de clicar.
 *
 * Agora a verificação vem antes: as campanhas vinculadas são carregadas ao
 * abrir e listadas, com as ativas em destaque. Excluir passa a ser possível, e
 * informado.
 */
export function ModalExcluirCanal({
  canal,
  excluindo,
  aoFechar,
  aoConfirmar,
}: {
  canal: Canal | null;
  excluindo: boolean;
  aoFechar: () => void;
  aoConfirmar: (c: Canal) => void;
}) {
  const vinculos = useVinculosCanal(canal?.id ?? null);
  const campanhas = vinculos.data?.campanhas ?? [];
  const ativas = campanhas.filter((c) =>
    ["em_andamento", "agendada", "pausada_por_canal"].includes(c.status),
  );

  return (
    <Modal
      aberto={canal !== null}
      aoFechar={aoFechar}
      titulo={`Excluir ${canal?.nome ?? "canal"}?`}
      descricao="A instância também é removida da Evolution. Não dá para desfazer."
      rodape={
        <>
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao
            variante="perigo"
            carregando={excluindo}
            // Só habilita depois de saber o que está em jogo: confirmar antes
            // de a lista carregar é confirmar sem a informação que o modal
            // existe para dar.
            disabled={vinculos.isLoading}
            onClick={() => canal && aoConfirmar(canal)}
          >
            <Trash2 aria-hidden className="size-4" />
            Excluir mesmo assim
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {vinculos.isLoading && <p className="text-sm text-tinta-3">Conferindo dependências…</p>}

        {!vinculos.isLoading && campanhas.length === 0 && (
          <p className="text-sm text-tinta-2">
            Nenhuma campanha usa este canal. A exclusão não afeta mais nada.
          </p>
        )}

        {campanhas.length > 0 && (
          <>
            <p className="text-sm text-tinta-2">
              {campanhas.length} campanha{campanhas.length === 1 ? "" : "s"} usa
              {campanhas.length === 1 ? "" : "m"} este canal
              {ativas.length > 0 && (
                <>
                  {" — "}
                  <strong className="text-critico">
                    {ativas.length} ainda {ativas.length === 1 ? "vai disparar" : "vão disparar"}
                  </strong>
                </>
              )}
              .
            </p>

            <ul className="max-h-52 overflow-y-auto rounded-lg border border-borda bg-superficie-2 p-2">
              {campanhas.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-2 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-sm text-tinta">{c.nome}</span>
                  <SeloCampanha status={c.status} />
                </li>
              ))}
            </ul>

            <p className="text-xs text-tinta-3">
              Elas continuam existindo e o histórico do que já foi enviado é preservado — some
              apenas o vínculo com este canal. Campanha que ainda não disparou precisará de outro
              canal para sair.
            </p>
          </>
        )}
      </div>
    </Modal>
  );
}
