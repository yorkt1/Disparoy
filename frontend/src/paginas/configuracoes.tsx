import { ShieldAlert } from "lucide-react";
import { CabecalhoPagina, Card, EstadoVazio } from "@/components/ui/primitivos";
import { Carregando, ErroCarregamento } from "@/components/ui/estados";
import { ListaUsuarios } from "@/components/usuarios/lista-usuarios";
import { GestaoEmpresas } from "@/components/empresas/gestao-empresas";
import { useSessao, useUsuarios } from "@/hooks/consultas";

/**
 * Usuários e acessos — só administradores.
 *
 * O bloqueio real está na API (`@SomenteAdmin` em /usuarios); aqui é só para o
 * operador não bater numa tela de erro se digitar a rota na barra.
 */
export function PaginaConfiguracoes() {
  const sessao = useSessao();
  const ehAdmin = sessao.data?.usuario.papel === "admin";
  const ehContaGlobal = sessao.data?.usuario.empresaId === null;
  const usuarios = useUsuarios(ehAdmin);

  if (sessao.isLoading) {
    return (
      <>
        <CabecalhoPagina titulo="Usuários e acessos" />
        <Carregando />
      </>
    );
  }

  if (sessao.data && !ehAdmin) {
    return (
      <>
        <CabecalhoPagina titulo="Usuários e acessos" />
        <Card>
          <EstadoVazio
            icone={<ShieldAlert className="size-7" />}
            titulo="Acesso restrito"
            descricao="Só administradores gerenciam os logins do sistema."
          />
        </Card>
      </>
    );
  }

  if (usuarios.isLoading) {
    return (
      <>
        <CabecalhoPagina titulo="Usuários e acessos" />
        <Carregando />
      </>
    );
  }

  if (usuarios.error) {
    return (
      <>
        <CabecalhoPagina titulo="Usuários e acessos" />
        <ErroCarregamento erro={usuarios.error} aoTentarNovamente={() => void usuarios.refetch()} />
      </>
    );
  }

  return (
    <div className="space-y-6">
      {/*
        Empresas só para a conta GLOBAL.

        Papel e empresa são coisas diferentes: o admin de uma empresa cliente
        também tem `papel: "admin"`, mas administra a empresa dele — não o
        sistema. A API recusa a rota para ele; aqui a seção nem aparece, para
        não oferecer um botão que só devolveria erro.
      */}
      {ehContaGlobal && <GestaoEmpresas />}

      <ListaUsuarios usuarios={usuarios.data ?? []} sessaoId={sessao.data?.usuario.id ?? ""} />
    </div>
  );
}
