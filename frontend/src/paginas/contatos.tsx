import * as React from "react";
import { CircleSlash, ShieldCheck, Trash2, Upload, UserRoundX, Users } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Badge, CabecalhoPagina, Card, EstadoVazio } from "@/components/ui/primitivos";
import { Carregando, ErroCarregamento } from "@/components/ui/estados";
import { Modal } from "@/components/ui/modal";
import { FiltroSelecao, Paginacao } from "@/components/ui/tabela";
import { useToast } from "@/components/ui/toast";
import { ImportadorContatos } from "@/components/contatos/importador-contatos";
import {
  useContatos,
  useExcluirContato,
  useListas,
  useRegistrarOptOut,
  type FiltroContatos,
} from "@/hooks/consultas";
import { ErroApi } from "@/lib/api";
import { formatarData, formatarNumero, formatarTelefone } from "@/lib/formato";
import { motivoInelegivel, ROTULO_INELEGIVEL, type Contato } from "@disparoy/dominio";

export function PaginaContatos() {
  const [situacao, setSituacao] = React.useState<NonNullable<FiltroContatos["situacao"]>>("todos");
  const [pagina, setPagina] = React.useState(1);
  const [busca, setBusca] = React.useState("");
  const [importando, setImportando] = React.useState(false);

  // A busca só vai ao servidor depois que o usuário para de digitar.
  const [buscaAplicada, setBuscaAplicada] = React.useState("");
  React.useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAplicada(busca);
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [busca]);

  const contatos = useContatos({ pagina, porPagina: 25, busca: buscaAplicada, situacao });
  const listas = useListas();
  const optOut = useRegistrarOptOut();
  const exclusao = useExcluirContato();
  const { mostrar } = useToast();

  async function registrarSaida(c: Contato) {
    if (!confirm(`Marcar ${formatarTelefone(c.telefone)} como "não quer mais receber"?`)) return;
    try {
      await optOut.mutateAsync({ id: c.id, motivo: "Solicitação registrada pelo operador" });
      mostrar({ tipo: "info", titulo: "Opt-out registrado", descricao: "Removido das campanhas pendentes." });
    } catch (e) {
      mostrar({
        tipo: "erro",
        titulo: "Não foi possível registrar",
        descricao: e instanceof ErroApi ? e.message : "Tente novamente.",
      });
    }
  }

  async function excluir(c: Contato) {
    if (
      !confirm(
        `Excluir definitivamente ${formatarTelefone(c.telefone)}?\n\n` +
          `Use para atender pedido de exclusão do titular (direito ao esquecimento). ` +
          `As mensagens já enviadas permanecem no histórico.`,
      )
    ) {
      return;
    }
    try {
      await exclusao.mutateAsync(c.id);
      mostrar({ tipo: "info", titulo: "Contato excluído" });
    } catch (e) {
      mostrar({
        tipo: "erro",
        titulo: "Não foi possível excluir",
        descricao: e instanceof ErroApi ? e.message : "Tente novamente.",
      });
    }
  }

  const totalListas = listas.data?.length ?? 0;

  return (
    <>
      <CabecalhoPagina
        titulo="Contatos"
        descricao={
          contatos.data
            ? `${formatarNumero(contatos.data.total)} contatos · ${totalListas} listas`
            : undefined
        }
        acao={
          <Botao variante="primario" onClick={() => setImportando(true)}>
            <Upload aria-hidden className="size-4" />
            Importar contatos
          </Botao>
        }
      />

      {listas.data && listas.data.length > 0 ? (
        <div className="mb-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {listas.data.slice(0, 4).map((l) => (
            <Card key={l.id} className="px-4 py-3">
              <p className="truncate text-sm font-medium text-tinta">{l.nome}</p>
              <p className="tabular mt-1 text-xs text-tinta-3">
                <span className="text-bom">{formatarNumero(l.totalElegiveis)}</span> elegíveis de{" "}
                {formatarNumero(l.totalContatos)}
              </p>
            </Card>
          ))}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-borda px-5 py-3">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou telefone…"
            aria-label="Buscar contatos"
            className="h-9 min-w-56 flex-1 rounded-lg border border-borda-forte bg-superficie-2 px-3 text-sm text-tinta placeholder:text-tinta-3 focus:border-marca focus:outline-none"
          />
          <FiltroSelecao
            rotulo="Situação"
            valor={situacao}
            aoMudar={(v) => {
              setSituacao(v as FiltroContatos["situacao"] as never);
              setPagina(1);
            }}
            opcoes={[
              { valor: "todos", texto: "Todos" },
              { valor: "elegiveis", texto: "Podem receber" },
              { valor: "sem_opt_in", texto: "Sem consentimento" },
              { valor: "opt_out", texto: "Pediram saída" },
            ]}
          />
        </div>

        {contatos.isLoading ? (
          <Carregando />
        ) : contatos.error ? (
          <ErroCarregamento erro={contatos.error} aoTentarNovamente={() => void contatos.refetch()} />
        ) : contatos.data && contatos.data.itens.length === 0 ? (
          <EstadoVazio
            icone={<Users className="size-7" />}
            titulo="Nenhum contato"
            descricao="Importe uma planilha para começar."
            acao={
              <Botao variante="primario" onClick={() => setImportando(true)}>
                <Upload aria-hidden className="size-4" />
                Importar contatos
              </Botao>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr className="border-b border-borda">
                    {["Contato", "Telefone", "Situação", "Consentimento", "Ações"].map((t, i) => (
                      <th
                        key={t}
                        scope="col"
                        className={`px-5 py-3 text-xs font-medium text-tinta-3 ${i === 4 ? "text-right" : "text-left"}`}
                      >
                        {t}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {contatos.data?.itens.map((c) => (
                    <LinhaContato
                      key={c.id}
                      contato={c}
                      ocupado={optOut.isPending || exclusao.isPending}
                      aoOptOut={() => registrarSaida(c)}
                      aoExcluir={() => excluir(c)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {contatos.data && contatos.data.totalPaginas > 1 ? (
              <Paginacao
                pagina={contatos.data.pagina}
                totalPaginas={contatos.data.totalPaginas}
                total={contatos.data.total}
                porPagina={contatos.data.porPagina}
                aoMudar={setPagina}
              />
            ) : null}
          </>
        )}
      </Card>

      <Modal
        aberto={importando}
        aoFechar={() => setImportando(false)}
        titulo="Importar contatos"
        descricao="Planilha ou colagem manual, com registro de consentimento."
        largura="lg"
      >
        <ImportadorContatos aoConcluir={() => setImportando(false)} />
      </Modal>
    </>
  );
}

function LinhaContato({
  contato,
  ocupado,
  aoOptOut,
  aoExcluir,
}: {
  contato: Contato;
  ocupado: boolean;
  aoOptOut: () => void;
  aoExcluir: () => void;
}) {
  const motivo = motivoInelegivel(contato);

  return (
    <tr className="border-b border-borda/60 last:border-0 hover:bg-superficie-2">
      <td className="px-5 py-3.5">
        <span className="text-tinta">{contato.nome ?? "—"}</span>
      </td>
      <td className="tabular px-5 py-3.5 text-tinta-2">{formatarTelefone(contato.telefone)}</td>
      <td className="px-5 py-3.5">
        {motivo === null ? (
          <Badge tom="bom" icone={<ShieldCheck className="size-3.5" />}>
            Pode receber
          </Badge>
        ) : motivo === "pediu_saida" ? (
          <Badge tom="critico" icone={<UserRoundX className="size-3.5" />}>
            {ROTULO_INELEGIVEL[motivo]}
          </Badge>
        ) : (
          <Badge tom="aviso" icone={<CircleSlash className="size-3.5" />}>
            {ROTULO_INELEGIVEL[motivo]}
          </Badge>
        )}
      </td>
      <td className="px-5 py-3.5 text-xs text-tinta-3">
        {contato.optInEm ? (
          <>
            {formatarData(contato.optInEm)}
            {contato.optInOrigem ? <span className="ml-1.5">· {contato.optInOrigem}</span> : null}
          </>
        ) : (
          "—"
        )}
      </td>
      <td className="px-5 py-3.5 text-right">
        <div className="flex items-center justify-end gap-1">
          {contato.optOutEm === null ? (
            <Botao tamanho="sm" variante="fantasma" disabled={ocupado} onClick={aoOptOut}>
              <UserRoundX aria-hidden className="size-3.5" />
              Opt-out
            </Botao>
          ) : null}
          <Botao
            tamanho="icone"
            variante="fantasma"
            disabled={ocupado}
            onClick={aoExcluir}
            aria-label={`Excluir contato ${contato.telefone}`}
            className="hover:bg-critico/15 hover:text-critico"
          >
            <Trash2 aria-hidden className="size-3.5" />
          </Botao>
        </div>
      </td>
    </tr>
  );
}
