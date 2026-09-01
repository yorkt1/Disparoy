import { Activity, Cloud, Radio, Server } from "lucide-react";
import type { Canal } from "@disparoy/dominio";
import { cn } from "@/lib/formato";
import {
  temCampanhaAndando,
  useCampanhas,
  useCanais,
  useSaudeApi,
  useSessao,
} from "@/hooks/consultas";

type Nivel = "bom" | "aviso" | "critico";

interface Indicador {
  nome: string;
  detalhe: string;
  nivel: Nivel;
  icone: React.ReactNode;
}

/**
 * "O sistema está de pé?" — API, worker, canais e disparo em uma linha.
 *
 * Morava no topo do Dashboard, que é a tela de RESULTADO: quem abre o dashboard
 * quer saber quantas mensagens saíram, e a faixa de saúde empurrava os números
 * para baixo da dobra todo dia para dizer "operacional" — o estado normal, que
 * não precisa ser anunciado. Aqui ela abre a tela em que a pergunta é
 * exatamente essa, e é o contexto que falta antes de ler as falhas: gateway
 * fora do ar explica uma coluna inteira de erros de uma vez.
 *
 * Busca os próprios dados em vez de recebê-los por prop porque é o único
 * consumidor das quatro consultas juntas — e o React Query serve do cache
 * quando outra tela já as carregou.
 */
export function IndicadoresSaude() {
  const apiSaude = useSaudeApi();
  const sessao = useSessao();
  const canais = useCanais();
  // Mesmo `porPagina` do dashboard de propósito: a chave de cache é o filtro,
  // e um número diferente aqui abriria uma segunda consulta para responder a
  // mesma pergunta.
  const campanhas = useCampanhas({ porPagina: 8 });
  const campanhaAndando = temCampanhaAndando(campanhas.data);

  const indicadores: Indicador[] = [
    {
      nome: "API",
      detalhe: apiSaude.isPending
        ? "verificando"
        : apiSaude.data?.ok
          ? "operacional"
          : "indisponível",
      nivel: apiSaude.isPending ? "aviso" : apiSaude.data?.ok ? "bom" : "critico",
      icone: <Cloud aria-hidden className="size-4" />,
    },
    {
      nome: "Worker",
      detalhe: sessao.isPending
        ? "verificando"
        : sessao.data?.disparo.ativo
          ? "operacional"
          : "sem pulso recente",
      nivel: sessao.isPending ? "aviso" : sessao.data?.disparo.ativo ? "bom" : "aviso",
      icone: <Activity aria-hidden className="size-4" />,
    },
    estadoDosCanais(canais.data ?? []),
    {
      nome: "Campanhas",
      detalhe: campanhaAndando ? "há disparo em andamento" : "nenhum disparo em andamento",
      nivel: "bom",
      icone: <Server aria-hidden className="size-4" />,
    },
  ];

  return (
    <section aria-label="Saúde do sistema" className="mb-6">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {indicadores.map((indicador) => (
          <div
            key={indicador.nome}
            className="flex items-center gap-3 rounded-card border border-borda bg-superficie px-4 py-3"
          >
            <span className={cn("rounded-full p-2", fundos[indicador.nivel])}>
              {indicador.icone}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className={cn("size-2 rounded-full", bolas[indicador.nivel])}
                />
                <p className="text-xs font-medium text-tinta">{indicador.nome}</p>
              </div>
              <p className="mt-0.5 truncate text-[11px] text-tinta-3">{indicador.detalhe}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function estadoDosCanais(canais: Canal[]): Indicador {
  if (canais.length === 0) {
    return {
      nome: "WhatsApp",
      detalhe: "nenhum canal configurado",
      nivel: "aviso",
      icone: <Radio aria-hidden className="size-4" />,
    };
  }

  const conectados = canais.filter((canal) => canal.status === "conectado").length;
  const desconectados = canais.filter((canal) => canal.status === "desconectado").length;
  const nivel: Nivel = desconectados > 0 ? "critico" : conectados === canais.length ? "bom" : "aviso";

  return {
    nome: "WhatsApp",
    detalhe: `${conectados}/${canais.length} canais conectados`,
    nivel,
    icone: <Radio aria-hidden className="size-4" />,
  };
}

const bolas: Record<Nivel, string> = {
  bom: "bg-bom",
  aviso: "bg-aviso",
  critico: "bg-critico",
};

const fundos: Record<Nivel, string> = {
  bom: "bg-bom/10 text-bom",
  aviso: "bg-aviso/10 text-aviso",
  critico: "bg-critico/10 text-critico",
};
