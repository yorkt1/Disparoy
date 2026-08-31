import * as React from "react";
import { Trash2, UserPlus } from "lucide-react";
import type { Canal, Usuario } from "@disparoy/dominio";
import { Botao } from "@/components/ui/botao";
import { MensagemErro, Selecao } from "@/components/ui/campos";
import { Modal } from "@/components/ui/modal";
import { Carregando } from "@/components/ui/estados";
import { useToast } from "@/components/ui/toast";
import { mensagemDe } from "@/lib/api";
import {
  useDefinirMembro,
  useMembrosCanal,
  useRemoverMembro,
  useUsuarios,
} from "@/hooks/consultas";

/**
 * Quem mais pode operar este número.
 *
 * A API tinha as três rotas de membros desde sempre e nenhuma tela as
 * chamava — dava para compartilhar um canal por `curl` e por mais nada. Ficou
 * urgente quando conectar canal deixou de ser ato administrativo: o operador
 * conecta o próprio número, vira dono sozinho, e nenhum colega enxerga aquele
 * canal para usar numa campanha.
 *
 * A tela é do ADMIN da empresa, e não do dono do canal. Não é preferência: a
 * lista de pessoas vem de `GET /usuarios`, que é restrita a administrador.
 * Abrir a lista de colegas para todo operador só para caber um seletor aqui
 * seria criar uma superfície de dado pessoal que ninguém pediu — e o admin da
 * empresa é justamente quem sabe quem trabalha com o quê.
 */
export function ModalCompartilharCanal({
  canal,
  aoFechar,
}: {
  canal: Canal | null;
  aoFechar: () => void;
}) {
  const [perfilId, setPerfilId] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const { mostrar } = useToast();

  const membros = useMembrosCanal(canal?.id ?? null);
  const usuarios = useUsuarios();
  const definir = useDefinirMembro();
  const remover = useRemoverMembro();

  function fechar() {
    aoFechar();
    setPerfilId("");
    setErro(null);
  }

  /*
   * Quem ainda não está no canal, e ativo.
   *
   * Oferecer quem já é membro faria o seletor "adicionar" virar um jeito
   * silencioso de rebaixar alguém — o upsert do backend sobrescreveria a
   * permissão existente sem nada na tela dizendo isso.
   */
  const jaNoCanal = new Set((membros.data ?? []).map((m) => m.perfilId));
  const disponiveis = (usuarios.data ?? []).filter((u) => u.ativo && !jaNoCanal.has(u.id));

  async function adicionar() {
    if (!canal || !perfilId) return;
    setErro(null);
    try {
      await definir.mutateAsync({ canalId: canal.id, perfilId, permissao: "operator" });
      setPerfilId("");
      mostrar({ tipo: "sucesso", titulo: "Acesso concedido", descricao: canal.nome });
    } catch (e) {
      // A API recusa perfil de outra empresa e canal fora do alcance; a
      // mensagem dela diz qual dos dois foi.
      setErro(mensagemDe(e, "Não foi possível conceder o acesso."));
    }
  }

  async function tirar(perfil: string, nome: string) {
    if (!canal) return;
    setErro(null);
    try {
      await remover.mutateAsync({ canalId: canal.id, perfilId: perfil });
      mostrar({ tipo: "info", titulo: "Acesso removido", descricao: nome });
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível remover o acesso."));
    }
  }

  return (
    <Modal
      aberto={canal !== null}
      aoFechar={fechar}
      titulo={`Quem opera ${canal?.nome ?? "este canal"}`}
      descricao="Quem estiver aqui vê o canal na lista e pode usá-lo nas campanhas dele."
      largura="sm"
      rodape={
        <Botao variante="primario" onClick={fechar}>
          Concluir
        </Botao>
      }
    >
      <div className="flex flex-col gap-4">
        {membros.isLoading ? (
          <Carregando rotulo="Carregando acessos…" />
        ) : (
          <ul className="flex flex-col gap-2">
            {(membros.data ?? []).map((m) => (
              <li
                key={m.perfilId}
                className="flex items-center justify-between gap-3 rounded-lg border border-borda bg-superficie-2 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-tinta">{m.nome}</p>
                  <p className="text-xs text-tinta-3">
                    {m.permissao === "owner" ? "Conectou este número" : "Opera o canal"}
                  </p>
                </div>
                {/*
                  O dono não sai por aqui.

                  Remover quem conectou o aparelho deixaria o canal sem
                  ninguém responsável por ele, e é o dono quem pode excluí-lo.
                  Para trocar de dono, o caminho é excluir o canal e reconectar
                  — que é o que de fato acontece no mundo real.
                */}
                {m.permissao !== "owner" ? (
                  <Botao
                    tamanho="icone"
                    variante="fantasma"
                    aria-label={`Remover o acesso de ${m.nome}`}
                    disabled={remover.isPending}
                    onClick={() => void tirar(m.perfilId, m.nome)}
                    className="hover:bg-critico/15 hover:text-critico"
                  >
                    <Trash2 aria-hidden className="size-3.5" />
                  </Botao>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-end gap-2">
          <Selecao
            rotulo="Dar acesso a"
            value={perfilId}
            onChange={(e) => setPerfilId(e.target.value)}
            disabled={disponiveis.length === 0}
          >
            <option value="">
              {disponiveis.length === 0 ? "Todo mundo já tem acesso" : "Escolha uma pessoa…"}
            </option>
            {disponiveis.map((u: Usuario) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </Selecao>
          <Botao
            variante="secundario"
            onClick={() => void adicionar()}
            carregando={definir.isPending}
            disabled={!perfilId}
            className="shrink-0"
          >
            {!definir.isPending ? <UserPlus aria-hidden className="size-4" /> : null}
            Dar acesso
          </Botao>
        </div>

        <MensagemErro>{erro}</MensagemErro>
      </div>
    </Modal>
  );
}
