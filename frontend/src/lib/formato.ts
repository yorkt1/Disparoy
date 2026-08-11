import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Ponte entre os componentes e as utilidades do domínio.
 *
 * Os formatadores vêm do pacote compartilhado — assim uma data ou um telefone
 * aparecem igual na tela, no log da API e no worker. Só `cn()` nasce aqui,
 * porque depende de Tailwind e não faz sentido no backend.
 */
export {
  formatarData,
  formatarDataHora,
  formatarNumero,
  formatarPercentual,
  formatarTelefone,
  gerarId,
  percentual,
  slugify,
} from "@disparoy/dominio";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
