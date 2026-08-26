import { Activity, Cloud, Radio, Server } from "lucide-react";
import type { Canal } from "@disparoy/dominio";
import type { UseQueryResult } from "@tanstack/react-query";
import type { EstadoSaudeApi, Sessao } from "@/hooks/consultas";
import { cn } from "@/lib/formato";

type Nivel = "bom" | "aviso" | "critico";

interface Indicador {
  nome: string;
  detalhe: string;
  nivel: Nivel;
  icone: React.ReactNode;
}

export function IndicadoresSaude({
  apiSaude,
  sessao,
  canais,
  campanhaAndando,
}: {
  apiSaude: UseQueryResult<EstadoSaudeApi>;
  sessao: UseQueryResult<Sessao>;
  canais: Canal[];
  campanhaAndando: boolean;
}) {
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
    estadoDosCanais(canais),
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