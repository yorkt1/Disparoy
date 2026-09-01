import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import {
  formatarData,
  formatarDataHora,
  formatarNumero,
  formatarPercentual,
  formatarTelefone,
  gerarId,
  percentual,
  slugify,
} from "@disparoy/dominio";

/**
 * Ponte entre os componentes e as utilidades do domínio.
 *
 * Os formatadores vêm do pacote compartilhado — assim uma data ou um telefone
 * aparecem igual na tela, no log da API e no worker. `cn()` e `formatarQuando()`
 * nascem aqui: um depende de Tailwind, o outro é decisão de apresentação que só
 * existe na tela. Nenhum dos dois faz sentido no backend, e `shared/` é copiado
 * byte a byte para lá — o que entra ali vira duas cópias para manter em
 * sincronia.
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
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * "há 12 min" para o que é recente, data absoluta para o resto.
 *
 * Uma campanha que saiu há duas horas aparecia como "31/08/2026" — a mesma
 * coisa que uma de ontem à noite, e a mesma coisa que uma da semana passada se
 * a tela estivesse aberta desde então. O disparo se acompanha por minuto: nas
 * primeiras horas, "quanto tempo faz" é a informação, e a data é ruído.
 *
 * O corte é 48 h porque é quando "há 40 h" para de ajudar e vira conta de
 * cabeça. Data futura (campanha agendada) volta ao absoluto com hora: ali o que
 * importa é QUANDO vai sair, não daqui a quanto.
 */
export function formatarQuando(iso: string | null | undefined): string {
  if (!iso) return "—";

  const alvo = new Date(iso).getTime();
  if (Number.isNaN(alvo)) return "—";

  const ms = Date.now() - alvo;
  if (ms < 0) return formatarDataHora(iso);

  const minutos = Math.floor(ms / 60_000);
  if (minutos < 1) return "agora";
  if (minutos < 60) return `há ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 48) return `há ${horas} h`;

  return formatarData(iso);
}
