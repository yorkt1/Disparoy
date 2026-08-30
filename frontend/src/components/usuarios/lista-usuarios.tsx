import * as React from "react";
import { KeyRound, UserCheck, UserX, Users } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo, MensagemErro, Selecao } from "@/components/ui/campos";
import { Modal } from "@/components/ui/modal";
import { Badge, EstadoVazio } from "@/components/ui/primitivos";
import { Tabela, FiltroSelecao, type Coluna } from "@/components/ui/tabela";
import { useToast } from "@/components/ui/toast";
import { ROTULO_PAPEL, type Papel, type Usuario } from "@disparoy/dominio";
import { formatarData } from "@/lib/formato";
import { mensagemDe } from "@/lib/api";
import { useAjustarUsuario } from "@/hooks/consultas";

/**
 * Senha inicial sugerida.
 *
 * Sem e-mail de convite, quem inventa a senha é o admin — e senha inventada na
 * hora vira "Empresa2024" em toda instalação. O alfabeto evita os pares que se
 * confundem ao ditar por telefone (O/0, l/1/I).
 */
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function gerarSenha(tamanho = 14): string {
  const bytes = new Uint32Array(tamanho);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}

/**
 * Esta tela LISTA acessos; ela não cria mais nenhum.
 *
 * O botão "Novo acesso" que ficava aqui chamava a API sem `empresaId`, e a
 * API herdava a empresa de quem criava. Quando quem criava era a conta de
 * administração — que é global —, não havia empresa para herdar e o acesso
 * nascia global também: o cliente entrava e via canal, campanha e dashboard de
 * TODAS as empresas.
 *
 * A saída não foi acrescentar um seletor de empresa aqui, foi apagar o segundo
 * caminho. Criar acesso mora em Empresas, onde a empresa é escolhida antes do
 * nome — lá o campo não tem como ser esquecido, porque o modal nasce preso a
 * uma empresa. Dois caminhos para a mesma coisa é como um deles fica errado
 * sem ninguém notar.
 */
export function ListaUsuarios({ usuarios, sessaoId }: { usuarios: Usuario[]; sessaoId: string }) {
  const [papelFiltro, setPapelFiltro] = React.useState("todos");
  const [redefinindo, setRedefinindo] = React.useState<Usuario | null>(null);
  const { mostrar } = useToast();

  const ajuste = useAjustarUsuario();
  const emAcao = ajuste.isPending ? ajuste.variables?.id : null;

  const filtrados = usuarios.filter((u) => papelFiltro === "todos" || u.papel === papelFiltro);

  async function alterar(usuario: Usuario, corpo: { papel?: Papel; ativo?: boolean }) {
    try {
      await ajuste.mutateAsync({ id: usuario.id, ...corpo });
      mostrar({
        tipo: "info",
        titulo: corpo.ativo === false ? "Acesso desativado" : "Acesso atualizado",
        descricao: usuario.nome,
      });
    } catch (e) {
      // A API recusa remover o último admin e o auto-rebaixamento; a mensagem
      // dela explica o motivo melhor que um texto genérico.
      mostrar({
        tipo: "erro",
        titulo: "Não foi possível alterar o acesso",
        descricao: mensagemDe(e, "Tente novamente."),
      });
    }
  }

  const colunas: Coluna<Usuario>[] = [
    {
      chave: "nome",
      titulo: "Pessoa",
      celula: (u) => (
        <div>
          <p className="text-sm font-medium text-tinta">
            {u.nome}
            {u.id === sessaoId ? <span className="ml-2 text-xs text-tinta-3">(você)</span> : null}
          </p>
          <p className="text-xs text-tinta-3">{u.email}</p>
        </div>
      ),
    },
    {
      chave: "papel",
      titulo: "Papel",
      celula: (u) => (
        <Selecao
          value={u.papel}
          aria-label={`Papel de ${u.nome}`}
          disabled={emAcao === u.id || u.id === sessaoId}
          onChange={(e) => alterar(u, { papel: e.target.value as Papel })}
          className="h-8 w-40 text-xs"
        >
          <option value="admin">{ROTULO_PAPEL.admin}</option>
          <option value="operator">{ROTULO_PAPEL.operator}</option>
        </Selecao>
      ),
    },
    {
      chave: "status",
      titulo: "Status",
      celula: (u) =>
        u.ativo ? (
          <Badge tom="bom">Ativo</Badge>
        ) : (
          <Badge tom="neutro">Desativado</Badge>
        ),
    },
    {
      chave: "criado",
      titulo: "Criado em",
      alinhamento: "direita",
      celula: (u) => (
        <span className="tabular whitespace-nowrap text-tinta-3">{formatarData(u.criadoEm)}</span>
      ),
    },
    {
      chave: "acoes",
      titulo: "Ações",
      alinhamento: "direita",
      celula: (u) => (
        <div className="flex items-center justify-end gap-1">
          <Botao
            tamanho="sm"
            variante="fantasma"
            disabled={emAcao === u.id}
            onClick={() => setRedefinindo(u)}
          >
            <KeyRound aria-hidden className="size-3.5" />
            Redefinir senha
          </Botao>
          {u.ativo ? (
            <Botao
              tamanho="sm"
              variante="fantasma"
              disabled={emAcao === u.id || u.id === sessaoId}
              onClick={() => alterar(u, { ativo: false })}
              className="hover:bg-critico/15 hover:text-critico"
            >
              <UserX aria-hidden className="size-3.5" />
              Desativar
            </Botao>
          ) : (
            <Botao
              tamanho="sm"
              variante="fantasma"
              disabled={emAcao === u.id}
              onClick={() => alterar(u, { ativo: true })}
            >
              <UserCheck aria-hidden className="size-3.5" />
              Reativar
            </Botao>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-tinta">Usuários e acessos</h1>
          <p className="mt-1 text-sm text-tinta-3">
            Sistema interno: não há cadastro aberto. Todo acesso é criado em Empresas, junto da
            empresa a que ele pertence.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-card border border-borda bg-superficie">
        {usuarios.length === 0 ? (
          <EstadoVazio
            icone={<Users className="size-7" />}
            titulo="Nenhum acesso cadastrado"
            descricao="Crie a empresa em Empresas e, logo depois, o login dela."
          />
        ) : (
          <Tabela
            colunas={colunas}
            itens={filtrados}
            chaveDe={(u) => u.id}
            porPagina={10}
            buscaPlaceholder="Buscar por nome ou e-mail…"
            textoBusca={(u) => `${u.nome} ${u.email}`}
            vazio="Nenhum acesso com esse filtro."
            filtros={
              <FiltroSelecao
                rotulo="Papel"
                valor={papelFiltro}
                aoMudar={setPapelFiltro}
                opcoes={[
                  { valor: "todos", texto: "Todos" },
                  { valor: "admin", texto: ROTULO_PAPEL.admin },
                  { valor: "operator", texto: ROTULO_PAPEL.operator },
                ]}
              />
            }
          />
        )}
      </div>

      <ModalRedefinirSenha usuario={redefinindo} aoFechar={() => setRedefinindo(null)} />
    </>
  );
}

/**
 * A senha aparece em texto claro de propósito: o admin precisa lê-la para
 * entregar à pessoa, e campo mascarado aqui só levaria a ele digitar errado
 * duas vezes e não descobrir até o outro tentar entrar.
 */
function CampoSenha({
  valor,
  aoMudar,
  rotulo = "Senha inicial",
}: {
  valor: string;
  aoMudar: (v: string) => void;
  rotulo?: string;
}) {
  return (
    <div className="flex items-end gap-2">
      <Campo
        rotulo={rotulo}
        type="text"
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        minLength={6}
        dica="Mínimo de 6 caracteres. Anote antes de salvar — ela não é exibida de novo."
        className="font-mono"
        required
      />
      <Botao variante="secundario" onClick={() => aoMudar(gerarSenha())} className="mb-6 shrink-0">
        Gerar
      </Botao>
    </div>
  );
}

function ModalRedefinirSenha({
  usuario,
  aoFechar,
}: {
  usuario: Usuario | null;
  aoFechar: () => void;
}) {
  const [senha, setSenha] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const { mostrar } = useToast();
  const ajuste = useAjustarUsuario();

  function fechar() {
    aoFechar();
    setSenha("");
    setErro(null);
  }

  async function salvar() {
    if (!usuario) return;
    setErro(null);
    try {
      await ajuste.mutateAsync({ id: usuario.id, senha });
      mostrar({
        tipo: "sucesso",
        titulo: "Senha redefinida",
        descricao: `Entregue a nova senha para ${usuario.nome}.`,
      });
      fechar();
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível redefinir a senha."));
    }
  }

  return (
    <Modal
      aberto={usuario !== null}
      aoFechar={fechar}
      aoConfirmar={salvar}
      confirmando={ajuste.isPending}
      titulo="Redefinir senha"
      descricao={
        usuario
          ? `Nova senha para ${usuario.nome} <${usuario.email}>. As sessões abertas continuam válidas.`
          : undefined
      }
      largura="sm"
      rodape={
        <>
          <Botao variante="fantasma" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" onClick={salvar} carregando={ajuste.isPending}>
            Redefinir
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <CampoSenha valor={senha} aoMudar={setSenha} rotulo="Nova senha" />
        <MensagemErro>{erro}</MensagemErro>
      </div>
    </Modal>
  );
}
