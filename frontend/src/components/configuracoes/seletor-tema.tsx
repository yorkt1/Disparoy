import { Check, Moon, Sun } from "lucide-react";
import { Card, CardCabecalho, CardCorpo } from "@/components/ui/primitivos";
import { cn } from "@/lib/formato";
import { useTema } from "@/hooks/use-tema";
import { definirTema, type Tema } from "@/lib/tema";

const OPCOES: { valor: Tema; rotulo: string; descricao: string; icone: typeof Sun }[] = [
  {
    valor: "claro",
    rotulo: "Claro",
    descricao: "Padrão. Melhor em sala iluminada e para imprimir a tela.",
    icone: Sun,
  },
  {
    valor: "escuro",
    rotulo: "Escuro",
    descricao: "Para quem acompanha disparo à noite ou com o monitor no escuro.",
    icone: Moon,
  },
];

/**
 * Escolha de tema — vale para este navegador, não para a conta.
 *
 * Fica no localStorage e não na API de propósito: é preferência de aparelho.
 * A mesma pessoa usa o painel no notebook de dia e no celular à noite, e
 * carregar a escolha junto com o login faria o tema do celular sobrescrever o
 * do notebook a cada troca.
 *
 * O que manda é o atributo no <html>; `useTema` só assina as trocas, para este
 * card não continuar marcando a opção antiga quando alguém usa o atalho do
 * menu de perfil com esta tela aberta.
 */
export function SeletorTema() {
  const tema = useTema();

  return (
    <Card>
      <CardCabecalho
        titulo="Aparência"
        descricao="Vale só neste navegador — o painel lembra da escolha no próximo acesso."
      />
      <CardCorpo>
        <div role="radiogroup" aria-label="Tema do painel" className="grid gap-3 sm:grid-cols-2">
          {OPCOES.map((opcao) => {
            const Icone = opcao.icone;
            const selecionado = tema === opcao.valor;
            return (
              <button
                key={opcao.valor}
                type="button"
                role="radio"
                aria-checked={selecionado}
                onClick={() => definirTema(opcao.valor)}
                className={cn(
                  "flex items-start gap-3 rounded-card border p-4 text-left transition-colors",
                  selecionado
                    ? "border-marca bg-marca/8"
                    : "border-borda bg-superficie-2 hover:border-borda-hover",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    selecionado ? "bg-marca/12 text-marca-tenue" : "bg-superficie-3 text-tinta-3",
                  )}
                >
                  <Icone className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-medium text-tinta">
                    {opcao.rotulo}
                    {selecionado ? (
                      <Check aria-hidden className="size-3.5 text-marca-tenue" />
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-tinta-3">{opcao.descricao}</span>
                </span>
              </button>
            );
          })}
        </div>
      </CardCorpo>
    </Card>
  );
}
