
import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/formato";

type TipoToast = "sucesso" | "erro" | "aviso" | "info";

interface Toast {
  id: number;
  tipo: TipoToast;
  titulo: string;
  descricao?: string;
}

interface ContextoToast {
  mostrar: (t: Omit<Toast, "id">) => void;
}

const Ctx = React.createContext<ContextoToast | null>(null);

export function useToast(): ContextoToast {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useToast precisa estar dentro de <ProvedorToast>.");
  return ctx;
}

const ESTILOS: Record<TipoToast, { icone: React.ReactNode; anel: string }> = {
  sucesso: { icone: <CheckCircle2 className="size-4 text-bom" />, anel: "ring-bom/30" },
  erro: { icone: <XCircle className="size-4 text-critico" />, anel: "ring-critico/35" },
  aviso: { icone: <AlertTriangle className="size-4 text-aviso" />, anel: "ring-aviso/30" },
  info: { icone: <Info className="size-4 text-marca-tenue" />, anel: "ring-marca/30" },
};

export function ProvedorToast({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const proximoId = React.useRef(1);

  const remover = React.useCallback((id: number) => {
    setToasts((atual) => atual.filter((t) => t.id !== id));
  }, []);

  const mostrar = React.useCallback(
    (t: Omit<Toast, "id">) => {
      const id = proximoId.current++;
      setToasts((atual) => [...atual, { ...t, id }]);
      setTimeout(() => remover(id), 6000);
    },
    [remover],
  );

  const valor = React.useMemo(() => ({ mostrar }), [mostrar]);

  return (
    <Ctx.Provider value={valor}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed right-4 bottom-4 z-100 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border border-borda bg-superficie-2 px-4 py-3 shadow-lg ring-1 ring-inset",
              ESTILOS[t.tipo].anel,
            )}
          >
            <span aria-hidden className="mt-0.5 shrink-0">
              {ESTILOS[t.tipo].icone}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-tinta">{t.titulo}</p>
              {t.descricao ? <p className="mt-0.5 text-xs text-tinta-2">{t.descricao}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => remover(t.id)}
              aria-label="Dispensar aviso"
              className="shrink-0 rounded p-0.5 text-tinta-3 hover:text-tinta"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
