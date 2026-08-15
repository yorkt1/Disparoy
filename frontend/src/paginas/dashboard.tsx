import {
  AlertTriangle,
  CheckCheck,
  Eye,
  MessageSquareReply,
  Plus,
  Send,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { formatarNumero, formatarPercentual, percentual } from "@/lib/formato";
import { BotaoLink } from "@/components/ui/botao";
import { Card, CardCabecalho, Separador } from "@/components/ui/primitivos";
import { Carregando, ErroCarregamento, Esqueleto } from "@/components/ui/estados";
import { CartaoMetrica } from "@/components/dashboard/cartao-metrica";
import { GraficoStatus } from "@/components/charts/grafico-status";
import { TabelaUltimasCampanhas } from "@/components/dashboard/tabela-ultimas-campanhas";
import {
  temCampanhaAndando,
  useCampanhas,
  useCanais,
  useMetricas,
  useSessao,
} from "@/hooks/consultas";

export function PaginaDashboard() {
  const sessao = useSessao();
  const canais = useCanais();
  const campanhas = useCampanhas({ porPagina: 8 });
  // As métricas só se atualizam sozinhas quando há disparo acontecendo — quem
  // sabe disso é a lista de campanhas, carregada logo acima.
  const metricas = useMetricas(temCampanhaAndando(campanhas.data));

  const primeiroNome = sessao.data?.usuario.nome.split(" ")[0] ?? "";
  const conectados = (canais.data ?? []).filter((c) => c.status === "conectado").length;

  const rotuloCanais = new Map((canais.data ?? []).map((c) => [c.id, c.nome]));
  const linhas = (campanhas.data?.itens ?? []).map((c) => ({
    ...c,
    canaisRotulo:
      c.canaisIds.length === 1
        ? (rotuloCanais.get(c.canaisIds[0]) ?? "—")
        : `${c.canaisIds.length} canais`,
  }));

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-tinta">
            Bem-vindo de volta{primeiroNome ? `, ${primeiroNome}` : ""}
          </h1>
          <p className="mt-1 text-sm text-tinta-3">
            {conectados} canais conectados
            {metricas.data
              ? ` · ${formatarNumero(metricas.data.mensagensHoje)} mensagens enviadas hoje`
              : ""}
          </p>
        </div>
        <BotaoLink to="/campanhas/nova" variante="primario">
          <Plus aria-hidden className="size-4" />
          Nova Campanha
        </BotaoLink>
      </div>

      {sessao.data?.integracao.semProvedor ? (
        <div className="mb-6 flex items-start gap-3 rounded-card border border-critico/35 bg-critico/8 px-4 py-3">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-critico" />
          <p className="text-xs text-tinta-2">
            <span className="font-medium text-critico">
              Nenhum provedor de WhatsApp configurado.
            </span>{" "}
            Toda mensagem vai falhar no envio. Preencha as credenciais da Meta e/ou do gateway de
            QR Code em <code className="rounded bg-superficie-3 px-1 py-0.5">backend/.env</code>{" "}
            (veja <code className="rounded bg-superficie-3 px-1 py-0.5">.env.example</code>).
          </p>
        </div>
      ) : null}

      {metricas.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Esqueleto key={i} className="h-28" />
          ))}
        </div>
      ) : metricas.error ? (
        <ErroCarregamento erro={metricas.error} aoTentarNovamente={() => void metricas.refetch()} />
      ) : metricas.data ? (
        <Metricas dados={metricas.data} />
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardCabecalho
            titulo="Mensagens por status"
            descricao="Acumulado de todas as campanhas"
          />
          <Separador />
          {metricas.data ? (
            <GraficoStatus
              enviadas={metricas.data.porStatus.enviadas}
              entregues={metricas.data.porStatus.entregues}
              lidas={metricas.data.porStatus.lidas}
              falhas={metricas.data.porStatus.falhas}
            />
          ) : (
            <Carregando rotulo="Carregando métricas…" />
          )}
        </Card>

        <Card className="overflow-hidden">
          <CardCabecalho
            titulo="Últimas campanhas"
            descricao="Clique no nome para abrir os detalhes"
            acao={
              <BotaoLink to="/campanhas" tamanho="sm" variante="fantasma">
                Ver todas
              </BotaoLink>
            }
          />
          <Separador />
          {campanhas.isLoading ? (
            <Carregando />
          ) : campanhas.error ? (
            <ErroCarregamento
              erro={campanhas.error}
              aoTentarNovamente={() => void campanhas.refetch()}
            />
          ) : (
            <TabelaUltimasCampanhas campanhas={linhas} porPagina={6} />
          )}
        </Card>
      </div>
    </>
  );
}

function Metricas({ dados }: { dados: NonNullable<ReturnType<typeof useMetricas>["data"]> }) {
  return (
    <section aria-label="Métricas gerais" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <CartaoMetrica
        rotulo="Contatos que podem receber"
        valor={formatarNumero(dados.contatosElegiveis)}
        tom="bom"
        icone={<ShieldCheck className="size-4" />}
        contexto={
          dados.contatosOptOut > 0
            ? `${formatarNumero(dados.contatosOptOut)} pediram para sair`
            : "Nenhum pedido de saída registrado"
        }
      />
      <CartaoMetrica
        rotulo="Campanhas enviadas"
        valor={formatarNumero(dados.totalCampanhasEnviadas)}
        icone={<Send className="size-4" />}
        contexto="Total desde o início da conta"
      />
      <CartaoMetrica
        rotulo="Mensagens enviadas hoje"
        valor={formatarNumero(dados.mensagensHoje)}
        icone={<TrendingUp className="size-4" />}
        contexto="Somando todos os canais"
      />
      <CartaoMetrica
        rotulo="Taxa de entrega"
        valor={formatarPercentual(dados.taxaEntrega)}
        tom={dados.taxaEntrega >= 95 ? "bom" : dados.taxaEntrega >= 85 ? "aviso" : "critico"}
        icone={<CheckCheck className="size-4" />}
        medidor={dados.taxaEntrega}
        contexto={`${formatarNumero(dados.porStatus.entregues)} entregues de ${formatarNumero(
          dados.porStatus.enviadas,
        )} enviadas`}
      />
      <CartaoMetrica
        rotulo="Taxa de leitura"
        valor={formatarPercentual(dados.taxaLeitura)}
        tom={dados.taxaLeitura >= 60 ? "bom" : "aviso"}
        icone={<Eye className="size-4" />}
        medidor={dados.taxaLeitura}
        contexto={`${formatarNumero(dados.porStatus.lidas)} mensagens abertas`}
      />
      <CartaoMetrica
        rotulo="Respostas recebidas"
        valor={formatarNumero(dados.respostasRecebidas)}
        icone={<MessageSquareReply className="size-4" />}
        contexto={`${formatarPercentual(
          percentual(dados.respostasRecebidas, dados.porStatus.lidas),
        )} de quem leu respondeu`}
      />
    </section>
  );
}
