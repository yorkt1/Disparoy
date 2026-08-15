import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { ROTULO_PAPEL } from "@disparoy/dominio";
import { CabecalhoPagina, Card, CardCabecalho, CardCorpo } from "@/components/ui/primitivos";
import { Carregando, ErroCarregamento } from "@/components/ui/estados";
import { Botao } from "@/components/ui/botao";
import { Campo } from "@/components/ui/campos";
import { useToast } from "@/components/ui/toast";
import { ErroApi } from "@/lib/api";
import { useSessao, useTrocarSenha } from "@/hooks/consultas";

/**
 * Meu perfil.
 *
 * O menu de perfil já apontava para `/perfil`, mas a rota não existia — o link
 * caía no 404. Esta tela fecha isso e resolve o que faltava junto: até agora
 * ninguém trocava a própria senha. Quem quisesse dependia de um admin, e o
 * admin que esquecesse a dele ficava trancado do lado de fora, porque
 * `ADMIN_SENHA` no ambiente só vale quando a conta é criada.
 */
export function PaginaPerfil() {
  const sessao = useSessao();

  if (sessao.isLoading) {
    return (
      <>
        <CabecalhoPagina titulo="Meu perfil" />
        <Carregando />
      </>
    );
  }

  if (sessao.error || !sessao.data) {
    return (
      <>
        <CabecalhoPagina titulo="Meu perfil" />
        <ErroCarregamento erro={sessao.error} aoTentarNovamente={() => void sessao.refetch()} />
      </>
    );
  }

  const { usuario } = sessao.data;

  return (
    <>
      <CabecalhoPagina titulo="Meu perfil" descricao="Seus dados de acesso ao painel." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardCabecalho titulo="Conta" />
          <CardCorpo className="space-y-3 text-sm">
            <Linha rotulo="Nome" valor={usuario.nome} />
            <Linha rotulo="E-mail" valor={usuario.email} />
            <Linha
              rotulo="Papel"
              valor={
                <span className="flex items-center gap-1.5">
                  <ShieldCheck aria-hidden className="size-3.5 text-tinta-3" />
                  {ROTULO_PAPEL[usuario.papel]}
                </span>
              }
            />
            <p className="pt-1 text-xs text-tinta-3">
              Nome, e-mail e papel são definidos por um administrador.
            </p>
          </CardCorpo>
        </Card>

        <FormularioSenha />
      </div>
    </>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-borda pb-3 last:border-0 last:pb-0">
      <span className="text-xs text-tinta-3">{rotulo}</span>
      <span className="min-w-0 truncate text-right text-tinta">{valor}</span>
    </div>
  );
}

const MINIMO = 8;

function FormularioSenha() {
  const [atual, setAtual] = React.useState("");
  const [nova, setNova] = React.useState("");
  const [confirmacao, setConfirmacao] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);

  const { mostrar } = useToast();
  const trocar = useTrocarSenha();

  /**
   * A confirmação é conferida só aqui, no navegador.
   *
   * Não é validação de segurança — é para o operador não trocar a senha por
   * uma que ele digitou errado e descobrir no próximo login, já sem conseguir
   * entrar. Mandar o campo para a API não acrescentaria nada.
   */
  const divergem = confirmacao.length > 0 && nova !== confirmacao;
  const podeEnviar =
    atual.length > 0 && nova.length >= MINIMO && nova === confirmacao && !trocar.isPending;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);

    if (nova === atual) {
      setErro("A nova senha precisa ser diferente da atual.");
      return;
    }

    try {
      await trocar.mutateAsync({ senhaAtual: atual, novaSenha: nova });
      setAtual("");
      setNova("");
      setConfirmacao("");
      mostrar({
        tipo: "sucesso",
        titulo: "Senha alterada",
        // Aviso honesto: os tokens são assinados e sem estado, então não há
        // como derrubar as sessões antigas — melhor dizer do que deixar
        // alguém supor que trocar a senha expulsou quem estava logado.
        descricao: "Sessões já abertas em outros aparelhos continuam válidas até expirarem.",
      });
    } catch (e) {
      // A API devolve 400 (não 401) quando a senha atual está errada, de
      // propósito: o cliente HTTP limpa a sessão em todo 401, e errar a senha
      // antiga não pode expulsar ninguém do painel.
      setErro(e instanceof ErroApi ? e.message : "Não foi possível alterar a senha.");
    }
  }

  return (
    <Card>
      <CardCabecalho
        titulo="Trocar senha"
        descricao="Você precisa informar a senha atual para confirmar que é você."
      />
      <CardCorpo>
        <form onSubmit={(e) => void enviar(e)} className="space-y-4">
          {/* Campo oculto com o usuário: sem ele o gerenciador de senhas do
              navegador não sabe qual credencial está sendo atualizada e salva
              a entrada errada. */}
          <input type="text" name="username" autoComplete="username" hidden readOnly />

          <Campo
            rotulo="Senha atual"
            type="password"
            autoComplete="current-password"
            required
            value={atual}
            onChange={(e) => setAtual(e.target.value)}
          />

          <Campo
            rotulo="Nova senha"
            type="password"
            autoComplete="new-password"
            required
            minLength={MINIMO}
            value={nova}
            onChange={(e) => setNova(e.target.value)}
            dica={`Pelo menos ${MINIMO} caracteres.`}
          />

          <Campo
            rotulo="Repita a nova senha"
            type="password"
            autoComplete="new-password"
            required
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
            erro={divergem ? "As senhas não conferem." : undefined}
          />

          {erro ? (
            <p role="alert" className="text-xs text-critico">
              {erro}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Botao
              type="submit"
              variante="primario"
              disabled={!podeEnviar}
              carregando={trocar.isPending}
            >
              Alterar senha
            </Botao>
          </div>
        </form>
      </CardCorpo>
    </Card>
  );
}
