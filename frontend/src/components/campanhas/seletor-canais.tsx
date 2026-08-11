
import { BadgeCheck, QrCode, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import type { Canal } from "@disparoy/dominio";
import { cn, formatarTelefone } from "@/lib/formato";
import { EstadoVazio } from "@/components/ui/primitivos";
import { ROTULO_CONEXAO } from "./selo-status";

/** Etapa 2 — escolha de um ou mais números conectados. */
export function SeletorCanais({
  canais,
  selecionados,
  aoAlternar,
}: {
  canais: Canal[];
  selecionados: string[];
  aoAlternar: (id: string) => void;
}) {
  if (canais.length === 0) {
    return (
      <EstadoVazio
        icone={<Smartphone className="size-7" />}
        titulo="Nenhum canal conectado"
        descricao="Conecte um número de WhatsApp antes de criar a campanha."
        acao={
          <Link
            to="/canais"
            className="rounded-lg bg-marca px-4 py-2 text-sm font-medium text-white hover:bg-marca-forte"
          >
            Conectar canal
          </Link>
        }
      />
    );
  }

  return (
    <fieldset>
      <legend className="sr-only">Canais de envio</legend>
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {canais.map((canal) => {
          const marcado = selecionados.includes(canal.id);
          const oficial = canal.tipoConexao === "api_oficial";

          return (
            <label
              key={canal.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors",
                marcado
                  ? "border-marca bg-marca/8"
                  : "border-borda-forte bg-superficie-2 hover:border-[#4a4a46]",
              )}
            >
              <input
                type="checkbox"
                checked={marcado}
                onChange={() => aoAlternar(canal.id)}
                className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-borda-forte bg-superficie accent-marca"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-tinta">{canal.nome}</span>
                <span className="tabular mt-0.5 block text-xs text-tinta-2">
                  {canal.numero ? formatarTelefone(canal.numero) : "aguardando pareamento"}
                </span>
                <span
                  className={cn(
                    "mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] ring-1 ring-inset",
                    oficial
                      ? "bg-marca/12 text-marca-tenue ring-marca/30"
                      : "bg-superficie-3 text-tinta-2 ring-borda-forte",
                  )}
                >
                  {oficial ? (
                    <BadgeCheck aria-hidden className="size-3" />
                  ) : (
                    <QrCode aria-hidden className="size-3" />
                  )}
                  {ROTULO_CONEXAO[canal.tipoConexao]}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-tinta-3">
        {canais.length === 1
          ? "Seu único canal conectado já vem selecionado. Conectar um segundo número divide o volume entre os dois e reduz o risco de bloqueio."
          : "Com mais de um canal selecionado, os contatos são distribuídos entre eles — o que reduz o volume por número e o risco de bloqueio."}
      </p>
    </fieldset>
  );
}
