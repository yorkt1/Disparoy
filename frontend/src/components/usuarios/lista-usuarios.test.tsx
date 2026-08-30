// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Usuario } from "@disparoy/dominio";

/**
 * Acessos — a tela onde um erro vira problema de permissão.
 *
 * Duas travas moram aqui, e são as que estes testes protegem:
 *
 * 1. Ninguém mexe no próprio acesso. Um admin que se rebaixa a operador, ou se
 *    desativa, tranca a si mesmo para fora sem ter como voltar pelo produto. A
 *    API também recusa, mas descobrir isso depois do clique é descobrir tarde.
 *
 * 2. Esta tela NÃO cria acesso. O botão que ficava aqui chamava a API sem
 *    `empresaId`, e a API herdava a empresa de quem criava — quando quem criava
 *    era a conta global, o acesso nascia global também, e o cliente entrava
 *    vendo canal, campanha e dashboard de TODAS as empresas. A saída foi apagar
 *    o segundo caminho, não acrescentar um seletor: criar acesso mora em
 *    Empresas, onde o modal nasce preso a uma empresa.
 */

const { hooks, mostrar } = vi.hoisted(() => ({
  hooks: { ajustar: vi.fn(), excluir: vi.fn() },
  mostrar: vi.fn(),
}));

vi.mock("@/hooks/consultas", () => ({
  useAjustarUsuario: () => hooks.ajustar(),
  useExcluirUsuario: () => hooks.excluir(),
}));

vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ mostrar }) }));

import { ListaUsuarios } from "./lista-usuarios";

const EU = "u-eu";

function usuario(patch: Partial<Usuario> = {}): Usuario {
  return {
    id: "u-outro",
    nome: "Outro Fulano",
    email: "outro@exemplo.com",
    papel: "operator",
    ativo: true,
    criadoEm: "2026-01-01T00:00:00.000Z",
    ...patch,
  } as Usuario;
}

function ajusteOk() {
  const mutateAsync = vi.fn().mockResolvedValue(undefined);
  hooks.ajustar.mockReturnValue({ mutateAsync, isPending: false, variables: undefined });
  return mutateAsync;
}

function exclusaoOk() {
  const mutateAsync = vi.fn().mockResolvedValue(undefined);
  hooks.excluir.mockReturnValue({ mutateAsync, isPending: false });
  return mutateAsync;
}

function montar(usuarios: Usuario[], podeExcluir = false) {
  render(<ListaUsuarios usuarios={usuarios} sessaoId={EU} podeExcluir={podeExcluir} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  ajusteOk();
  exclusaoOk();
});

describe("ListaUsuarios — ninguém mexe no próprio acesso", () => {
  const eu = usuario({ id: EU, nome: "Eu Mesmo", papel: "admin" });

  it("o seletor de papel do próprio usuário fica travado", () => {
    // Um admin que se rebaixa a operador perde a tela de acessos e não tem
    // como voltar pelo produto.
    montar([eu]);
    expect(screen.getByLabelText("Papel de Eu Mesmo")).toBeDisabled();
  });

  it("não dá para desativar a si mesmo", () => {
    montar([eu]);
    expect(screen.getByRole("button", { name: /Desativar/i })).toBeDisabled();
  });

  it("o papel de OUTRO usuário continua editável", () => {
    // Sem este par, os dois testes acima passariam mesmo se a tela estivesse
    // travada para todo mundo.
    montar([eu, usuario({ nome: "Colega" })]);
    expect(screen.getByLabelText("Papel de Colega")).toBeEnabled();
  });

  it("desativar OUTRO usuário funciona e avisa", async () => {
    const mutateAsync = ajusteOk();
    montar([usuario({ nome: "Colega" })]);

    await userEvent.click(screen.getByRole("button", { name: /Desativar/i }));

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u-outro", ativo: false }),
    );
  });

  it("trocar o papel de outro manda o papel novo", async () => {
    const mutateAsync = ajusteOk();
    montar([usuario({ nome: "Colega", papel: "operator" })]);

    await userEvent.selectOptions(screen.getByLabelText("Papel de Colega"), "admin");

    expect(mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u-outro", papel: "admin" }),
    );
  });

  it("recusa da API vira aviso, não silêncio", async () => {
    // A API recusa remover o último admin. A mensagem dela é a que vale — ela
    // sabe qual regra barrou.
    const mutateAsync = vi.fn().mockRejectedValue(new Error("Não é possível remover o último admin."));
    hooks.ajustar.mockReturnValue({ mutateAsync, isPending: false, variables: undefined });
    montar([usuario({ nome: "Colega", papel: "admin" })]);

    await userEvent.click(screen.getByRole("button", { name: /Desativar/i }));

    expect(mostrar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: "erro",
        descricao: "Não é possível remover o último admin.",
      }),
    );
  });
});

describe("ListaUsuarios — a tela não cria acesso", () => {
  it("não existe botão de criar acesso aqui", () => {
    // Era o caminho que fazia o acesso nascer global quando quem criava era a
    // conta de administração. Dois caminhos para a mesma coisa é como um deles
    // fica errado sem ninguém notar.
    montar([usuario()]);
    expect(screen.queryByRole("button", { name: /Novo acesso/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Criar (acesso|usuário)/i })).not.toBeInTheDocument();
  });
});

describe("ListaUsuarios — estado e senha", () => {
  it("desativado aparece como desativado, e oferece reativar", () => {
    montar([usuario({ nome: "Colega", ativo: false })]);
    expect(screen.getByText("Desativado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reativar/i })).toBeInTheDocument();
  });

  it("reativar a si mesmo é permitido — não tranca ninguém para fora", () => {
    // A trava existe contra perder acesso. Reativar só devolve.
    montar([usuario({ id: EU, nome: "Eu Mesmo", ativo: false })]);
    expect(screen.getByRole("button", { name: /Reativar/i })).toBeEnabled();
  });

  it("a senha gerada evita os caracteres que se confundem ao ditar", async () => {
    // Sem e-mail de convite, o admin lê a senha por telefone. O/0 e l/1/I são
    // exatamente os pares que fazem a pessoa não conseguir entrar.
    montar([usuario({ nome: "Colega" })]);
    await userEvent.click(screen.getByRole("button", { name: /Redefinir senha/i }));
    await userEvent.click(screen.getByRole("button", { name: /^Gerar$/i }));

    const campo = screen.getByLabelText(/Nova senha/) as HTMLInputElement;
    expect(campo.value.length).toBeGreaterThanOrEqual(14);
    expect(campo.value).not.toMatch(/[O0lI1]/);
  });
});

/**
 * Exclusão — a única ação desta tela que não tem desfazer.
 *
 * Desativar e excluir ficam lado a lado na mesma linha, e a diferença entre
 * eles é permanente. O que estes testes seguram é que excluir não apareça para
 * quem a API vai recusar, que não apareça na própria linha, e que não aconteça
 * sem uma confirmação que diga QUEM vai sumir.
 */
describe("ListaUsuarios — excluir acesso", () => {
  const eu = usuario({ id: EU, nome: "Eu Mesmo", papel: "admin" });

  function botaoExcluir(nome: string) {
    return screen.queryByRole("button", { name: `Excluir o acesso de ${nome}` });
  }

  it("sem permissão, o botão de excluir não existe", () => {
    // O acesso de empresa vê a lista, mas a API recusa o DELETE para ele.
    // Mostrar o botão seria oferecer um clique que só devolve erro.
    montar([eu, usuario()], false);
    expect(botaoExcluir("Outro Fulano")).toBeNull();
  });

  it("com permissão, o botão aparece para os outros", () => {
    montar([eu, usuario()], true);
    expect(botaoExcluir("Outro Fulano")).not.toBeNull();
  });

  it("não dá para excluir a si mesmo, nem com permissão", () => {
    // Não há auto-cadastro nem recuperação por e-mail: quem apaga o próprio
    // acesso não tem ninguém para readmiti-lo.
    montar([eu, usuario()], true);
    expect(botaoExcluir("Eu Mesmo")).toBeNull();
  });

  it("o clique abre a confirmação com nome e e-mail, e não exclui sozinho", async () => {
    const excluir = exclusaoOk();
    montar([eu, usuario()], true);

    await userEvent.click(botaoExcluir("Outro Fulano")!);

    // Quem confirma precisa ver de quem se trata: o erro possível aqui é
    // acertar o botão da linha errada, e um "tem certeza?" genérico não pega.
    // A busca é DENTRO do modal: o e-mail também está na linha da tabela atrás.
    const dialogo = within(screen.getByRole("dialog"));
    expect(dialogo.getByText("outro@exemplo.com")).toBeTruthy();
    expect(dialogo.getByText("Outro Fulano")).toBeTruthy();
    expect(excluir).not.toHaveBeenCalled();
  });

  it("confirmar exclui e avisa", async () => {
    const excluir = exclusaoOk();
    montar([eu, usuario()], true);

    await userEvent.click(botaoExcluir("Outro Fulano")!);
    await userEvent.click(screen.getByRole("button", { name: /Excluir mesmo assim/ }));

    expect(excluir).toHaveBeenCalledWith("u-outro");
    expect(mostrar).toHaveBeenCalledWith(
      expect.objectContaining({ titulo: "Acesso excluído" }),
    );
  });

  it("recusa da API aparece na tela, em vez de sumir", async () => {
    // A API barra o último administrador de uma empresa. Sem isto, o modal
    // fecharia como se tivesse dado certo e o acesso continuaria lá.
    const mutateAsync = vi
      .fn()
      .mockRejectedValue(new Error("Este é o último administrador ativo."));
    hooks.excluir.mockReturnValue({ mutateAsync, isPending: false });

    montar([eu, usuario()], true);
    await userEvent.click(botaoExcluir("Outro Fulano")!);
    await userEvent.click(screen.getByRole("button", { name: /Excluir mesmo assim/ }));

    expect(screen.getByText(/último administrador ativo/)).toBeTruthy();
  });
});
