// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Canal, ResumoCampanha, StatusCampanha } from "@disparoy/dominio";

/**
 * A tabela de campanhas — a mesma no dashboard e em `/campanhas`.
 *
 * Estes testes cobrem os dois pontos em que ela afirmava coisa que não
 * aconteceu:
 *
 * 1. **"0 canais".** Campanha que já disparou sempre teve canal; zero ids
 *    significa que o canal foi EXCLUÍDO depois. O rótulo antigo se lia como
 *    "rodou sem canal nenhum", que é impossível — e aparecia de verdade, em
 *    duas das seis linhas de uma conta real.
 *
 * 2. **"Concluída · 100%".** Toda campanha terminada mostrava as duas coisas,
 *    e nenhuma dizia se as mensagens chegaram. Uma campanha 100% concluída com
 *    metade falhando ficava idêntica a uma que funcionou.
 */

import { TabelaUltimasCampanhas } from "./tabela-ultimas-campanhas";

function campanha(patch: Partial<ResumoCampanha> = {}): ResumoCampanha {
  return {
    id: "camp-1",
    nome: "Promo de sexta",
    status: "concluida" as StatusCampanha,
    canaisIds: ["can-1"],
    templatePrincipal: null,
    progresso: 100,
    criadaEm: "2026-08-29T12:00:00.000Z",
    iniciadaEm: "2026-08-29T12:05:00.000Z",
    concluidaEm: "2026-08-29T12:30:00.000Z",
    agendadaPara: null,
    metricas: { total: 10, enviadas: 10, entregues: 10, lidas: 4, falhas: 0, respostas: 1 },
    ...patch,
  } as ResumoCampanha;
}

function canal(patch: Partial<Canal> = {}): Canal {
  return { id: "can-1", nome: "marmitateste", status: "conectado", ...patch } as Canal;
}

function montar(campanhas: ResumoCampanha[], canais: Canal[] = [canal()], compacta = false) {
  return render(
    <MemoryRouter>
      <TabelaUltimasCampanhas campanhas={campanhas} canais={canais} acaoCompacta={compacta} />
    </MemoryRouter>,
  );
}

describe("TabelaUltimasCampanhas — de qual canal a campanha saiu", () => {
  it("mostra o nome do canal quando ele ainda existe", () => {
    montar([campanha()]);
    expect(screen.getByText("marmitateste")).toBeInTheDocument();
  });

  it("campanha que já rodou e ficou sem canal diz que o canal foi removido", () => {
    montar([campanha({ canaisIds: [], status: "concluida" })]);

    // O texto antigo. Ele se lê como "disparou sem canal", que não acontece.
    expect(screen.queryByText("0 canais")).not.toBeInTheDocument();
    expect(screen.getByText("canal removido")).toBeInTheDocument();
  });

  it("rascunho sem canal não acusa remoção — ali zero é 'ainda não escolhi'", () => {
    montar([campanha({ canaisIds: [], status: "rascunho", progresso: 0 })]);

    expect(screen.getByText("nenhum escolhido")).toBeInTheDocument();
    expect(screen.queryByText("canal removido")).not.toBeInTheDocument();
  });

  it("não afirma remoção enquanto a lista de canais não chegou", () => {
    // A consulta de canais é separada da de campanhas: existe um instante em
    // que a tabela já renderizou e nenhum id resolve para nome. Sem a guarda,
    // TODA linha diria "canal removido" nesse instante.
    montar([campanha()], []);

    expect(screen.queryByText("canal removido")).not.toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("com mais de um canal conta, em vez de listar", () => {
    montar([campanha({ canaisIds: ["can-1", "can-2"] })]);
    expect(screen.getByText("2 canais")).toBeInTheDocument();
  });
});

describe("TabelaUltimasCampanhas — resultado de quem já terminou", () => {
  it("campanha concluída mostra quantas chegaram, não só que terminou", () => {
    montar([campanha({ metricas: { total: 10, enviadas: 10, entregues: 9, lidas: 4, falhas: 0, respostas: 1 } })]);

    expect(screen.getByText("9 de 10 entregues")).toBeInTheDocument();
  });

  it("a falha ganha linha própria — é a única parte que pede ação", () => {
    montar([campanha({ metricas: { total: 10, enviadas: 10, entregues: 6, lidas: 2, falhas: 4, respostas: 0 } })]);

    expect(screen.getByText("6 de 10 entregues")).toBeInTheDocument();
    expect(screen.getByText("4 falharam")).toBeInTheDocument();
  });

  it("sem falha nenhuma, não inventa a linha de falha", () => {
    montar([campanha()]);
    expect(screen.queryByText(/falharam|falhou/)).not.toBeInTheDocument();
  });

  it("campanha em andamento continua com a barra de progresso", () => {
    montar([campanha({ status: "em_andamento", progresso: 43, concluidaEm: null })]);

    const barra = screen.getByRole("progressbar");
    expect(barra).toHaveAttribute("aria-valuenow", "43");
    // Enquanto roda, "quantas entregues" ainda está mudando: o que importa é
    // quanto falta.
    expect(screen.queryByText(/entregues/)).not.toBeInTheDocument();
  });
});

describe("TabelaUltimasCampanhas — chegar aos detalhes", () => {
  it("cada linha tem um botão de detalhes, rotulado com o nome da campanha", () => {
    montar([campanha()]);

    const botao = screen.getByLabelText("Ver detalhes da campanha Promo de sexta");
    expect(botao).toHaveAttribute("href", "/campanhas/camp-1");
  });

  it("no modo compacto o rótulo some, mas o nome continua no aria-label", () => {
    // O dashboard divide a largura com o gráfico; o rótulo escrito empurrava a
    // coluna de ações para fora da vista. Quem usa leitor de tela não pode
    // pagar por isso.
    montar([campanha()], [canal()], true);

    expect(screen.queryByText("Ver detalhes")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Ver detalhes da campanha Promo de sexta")).toBeInTheDocument();
  });

  it("sem nenhuma campanha, convida a criar a primeira", () => {
    montar([]);
    expect(screen.getByText("Nenhuma campanha ainda")).toBeInTheDocument();
  });
});
