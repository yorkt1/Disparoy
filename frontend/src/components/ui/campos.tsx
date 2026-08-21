
import * as React from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/formato";

/** Campos de formulário — rótulo, contador de caracteres e erro num só lugar. */

const controle =
  "w-full rounded-lg border border-borda-forte bg-superficie-2 px-3 text-sm text-tinta placeholder:text-tinta-3 " +
  "transition-colors hover:border-borda-viva focus:border-marca disabled:opacity-50";

export function Rotulo({
  htmlFor,
  children,
  obrigatorio,
  className,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  obrigatorio?: boolean;
  className?: string;
}) {
  return (
    <label htmlFor={htmlFor} className={cn("block text-xs font-medium text-tinta-2", className)}>
      {children}
      {obrigatorio ? <span className="ml-0.5 text-critico">*</span> : null}
    </label>
  );
}

export function MensagemErro({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="mt-1.5 flex items-start gap-1.5 text-xs text-critico">
      <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export function Contador({ atual, maximo }: { atual: number; maximo: number }) {
  const perto = atual > maximo * 0.9;
  const estourou = atual > maximo;
  return (
    <span
      className={cn(
        "tabular text-xs",
        estourou ? "text-critico" : perto ? "text-aviso" : "text-tinta-3",
      )}
    >
      {atual}/{maximo}
    </span>
  );
}

export interface PropsCampo extends Omit<React.ComponentProps<"input">, "size"> {
  rotulo?: string;
  erro?: string;
  dica?: string;
  maxCaracteres?: number;
}

export function Campo({
  rotulo,
  erro,
  dica,
  maxCaracteres,
  className,
  id,
  value,
  required,
  ...props
}: PropsCampo) {
  const gerado = React.useId();
  const idCampo = id ?? gerado;
  const tamanho = typeof value === "string" ? value.length : 0;

  return (
    <div>
      {rotulo || maxCaracteres ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          {rotulo ? (
            <Rotulo htmlFor={idCampo} obrigatorio={required}>
              {rotulo}
            </Rotulo>
          ) : (
            <span />
          )}
          {maxCaracteres ? <Contador atual={tamanho} maximo={maxCaracteres} /> : null}
        </div>
      ) : null}
      <input
        id={idCampo}
        value={value}
        required={required}
        aria-invalid={erro ? true : undefined}
        className={cn(controle, "h-9.5", erro && "border-critico", className)}
        {...props}
      />
      {dica && !erro ? <p className="mt-1.5 text-xs text-tinta-3">{dica}</p> : null}
      <MensagemErro>{erro}</MensagemErro>
    </div>
  );
}

export interface PropsAreaTexto extends React.ComponentProps<"textarea"> {
  rotulo?: string;
  erro?: string;
  dica?: string;
  maxCaracteres?: number;
  acessorio?: React.ReactNode;
  /** Cresce em altura para caber todo o texto, sem barra de rolagem interna. */
  autoAjuste?: boolean;
}

export function AreaTexto({
  rotulo,
  erro,
  dica,
  maxCaracteres,
  acessorio,
  autoAjuste,
  className,
  id,
  value,
  required,
  ...props
}: PropsAreaTexto) {
  const gerado = React.useId();
  const idCampo = id ?? gerado;
  const tamanho = typeof value === "string" ? value.length : 0;
  const ref = React.useRef<HTMLTextAreaElement>(null);

  // Zera a altura antes de medir para o campo também ENCOLHER ao apagar texto,
  // não só crescer. Reage a `value` porque o conteúdo muda por fora (ex.: as
  // variações geradas caem aqui de uma vez).
  React.useLayoutEffect(() => {
    if (!autoAjuste) return;
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [autoAjuste, value]);

  return (
    <div>
      {rotulo || maxCaracteres || acessorio ? (
        <div className="mb-1.5 flex items-center justify-between gap-3">
          {rotulo ? (
            <Rotulo htmlFor={idCampo} obrigatorio={required}>
              {rotulo}
            </Rotulo>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {acessorio}
            {maxCaracteres ? <Contador atual={tamanho} maximo={maxCaracteres} /> : null}
          </div>
        </div>
      ) : null}
      <textarea
        ref={ref}
        id={idCampo}
        value={value}
        required={required}
        aria-invalid={erro ? true : undefined}
        className={cn(
          controle,
          "py-2.5 leading-relaxed",
          autoAjuste ? "resize-none overflow-hidden" : "resize-y",
          erro && "border-critico",
          className,
        )}
        {...props}
      />
      {dica && !erro ? <p className="mt-1.5 text-xs text-tinta-3">{dica}</p> : null}
      <MensagemErro>{erro}</MensagemErro>
    </div>
  );
}

export interface PropsSelecao extends React.ComponentProps<"select"> {
  rotulo?: string;
  erro?: string;
}

export function Selecao({ rotulo, erro, className, id, children, ...props }: PropsSelecao) {
  const gerado = React.useId();
  const idCampo = id ?? gerado;
  return (
    <div>
      {rotulo ? (
        <Rotulo htmlFor={idCampo} className="mb-1.5">
          {rotulo}
        </Rotulo>
      ) : null}
      <select
        id={idCampo}
        aria-invalid={erro ? true : undefined}
        className={cn(controle, "h-9.5 cursor-pointer pr-8", erro && "border-critico", className)}
        {...props}
      >
        {children}
      </select>
      <MensagemErro>{erro}</MensagemErro>
    </div>
  );
}

/** Checkbox com rótulo e descrição, usado nas opções da etapa 3. */
export function CaixaSelecao({
  rotulo,
  descricao,
  className,
  id,
  ...props
}: React.ComponentProps<"input"> & { rotulo: React.ReactNode; descricao?: string }) {
  const gerado = React.useId();
  const idCampo = id ?? gerado;
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <input
        id={idCampo}
        type="checkbox"
        className="mt-0.5 size-4 shrink-0 cursor-pointer rounded border-borda-forte bg-superficie-2 accent-marca"
        {...props}
      />
      <label htmlFor={idCampo} className="cursor-pointer select-none">
        <span className="block text-sm text-tinta">{rotulo}</span>
        {descricao ? <span className="mt-0.5 block text-xs text-tinta-3">{descricao}</span> : null}
      </label>
    </div>
  );
}
