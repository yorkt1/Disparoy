import { CabecalhoPagina } from "@/components/ui/primitivos";
import { Carregando, ErroCarregamento } from "@/components/ui/estados";
import { SeletorTema } from "@/components/configuracoes/seletor-tema";
import { ListaUsuarios } from "@/components/usuarios/lista-usuarios";
import { GestaoEmpresas } from "@/components/empresas/gestao-empresas";
import { useSessao, useUsuarios } from "@/hooks/consultas";

/**
 * Configurações do painel.
 *
 * A tela era só "Usuários e acessos", e por isso barrava quem não fosse
 * administrador. Agora tem duas naturezas: aparência, que é de cada pessoa, e
 * acessos, que é de administrador. Por isso a barreira desceu do topo da tela
 * para a seção — bloquear a página inteira deixaria o operador comum sem
 * caminho até o próprio tema.
 *
 * O bloqueio real continua na API (`@SomenteAdmin` em /usuarios); aqui é só
 * para ninguém bater numa tela de erro digitando a rota na barra.
 */
export function PaginaConfiguracoes() {
  const sessao = useSessao();
  const ehAdmin = sessao.data?.usuario.papel === "admin";
  const ehContaGlobal = sessao.data?.usuario.empresaId === null;
  const usuarios = useUsuarios(ehAdmin);

  return (
    <>
      <CabecalhoPagina titulo="Configurações" descricao="Preferências do painel e acessos." />

      <div className="space-y-6">
        <SeletorTema />

        {/*
          A seção de acessos nem aparece para quem não é administrador — e não
          aparece como "Acesso restrito". Anunciar uma porta trancada só serve
          quando a pessoa veio bater nela; aqui ela veio trocar o tema.
        */}
        {ehAdmin && <SecaoAcessos sessao={sessao} usuarios={usuarios} global={ehContaGlobal} />}
      </div>
    </>
  );
}

function SecaoAcessos({
  sessao,
  usuarios,
  global,
}: {
  sessao: ReturnType<typeof useSessao>;
  usuarios: ReturnType<typeof useUsuarios>;
  global: boolean;
}) {
  if (usuarios.isLoading) return <Carregando />;
  if (usuarios.error) {
    return (
      <ErroCarregamento erro={usuarios.error} aoTentarNovamente={() => void usuarios.refetch()} />
    );
  }

  return (
    <>
      {/*
        Empresas só para a conta GLOBAL.

        Papel e empresa são coisas diferentes: o admin de uma empresa cliente
        também tem `papel: "admin"`, mas administra a empresa dele — não o
        sistema. A API recusa a rota para ele; aqui a seção nem aparece, para
        não oferecer um botão que só devolveria erro.
      */}
      {global && <GestaoEmpresas />}

      <ListaUsuarios
        usuarios={usuarios.data ?? []}
        sessaoId={sessao.data?.usuario.id ?? ""}
        // Excluir é só da conta global — a API recusa para o resto. O botão
        // some em vez de aparecer e dar erro.
        podeExcluir={global}
      />
    </>
  );
}
