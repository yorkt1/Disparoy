import * as React from "react";
import { ClipboardList, FileSpreadsheet, Trash2, TriangleAlert } from "lucide-react";
import {
  detectarColunaNome,
  detectarColunaTelefone,
  EXTENSOES_PLANILHA,
  LIMITES,
  montarContatos,
  montarContatosColados,
  type LinhasPlanilha,
} from "@disparoy/dominio";
import { Botao } from "@/components/ui/botao";
import { AreaTexto } from "@/components/ui/campos";
import { Dropzone } from "@/components/ui/dropzone";
import { useToast } from "@/components/ui/toast";
import { api, ErroApi } from "@/lib/api";
import { formatarNumero, formatarTelefone } from "@/lib/formato";
import type { ContatoPublico } from "@/hooks/use-formulario-campanha";

/**
 * Quem vai receber a campanha.
 *
 * Substituiu o seletor de listas. Não existe mais cadastro de contatos: o
 * público entra aqui, por planilha ou colagem, e vive dentro da campanha.
 *
 * A planilha é só PARSEADA no servidor (`/contatos/ler-planilha`) — nada é
 * gravado. O que volta são linhas, e a montagem dos contatos acontece no
 * cliente, com as mesmas funções do domínio que o backend usa.
 */
export function SeletorPublico({
  publico,
  aoMudar,
}: {
  publico: ContatoPublico[];
  aoMudar: (contatos: ContatoPublico[]) => void;
}) {
  const [modo, setModo] = React.useState<"planilha" | "colar">("planilha");
  const [colado, setColado] = React.useState("");
  const [lendo, setLendo] = React.useState(false);
  const [descartados, setDescartados] = React.useState<{ invalidos: number; repetidos: number }>({
    invalidos: 0,
    repetidos: 0,
  });
  const { mostrar } = useToast();

  function aplicar(
    contatos: ContatoPublico[],
    invalidos: number,
    repetidos: number,
    origem: string,
  ) {
    aoMudar(contatos);
    setDescartados({ invalidos, repetidos });
    mostrar({
      tipo: contatos.length === 0 ? "erro" : "sucesso",
      titulo:
        contatos.length === 0
          ? "Nenhum número válido encontrado"
          : `${formatarNumero(contatos.length)} contato(s) prontos`,
      descricao: contatos.length === 0 ? origem : undefined,
    });
  }

  async function lerPlanilha(arquivo: File) {
    setLendo(true);
    try {
      const formulario = new FormData();
      formulario.append("arquivo", arquivo);
      const lidas = await api.upload<LinhasPlanilha>("/contatos/ler-planilha", formulario);

      const colunaTelefone = detectarColunaTelefone(lidas.colunas);
      const colunaNome = detectarColunaNome(lidas.colunas, colunaTelefone);
      const r = montarContatos(lidas.linhas, colunaTelefone, { colunaNome });

      aplicar(
        r.contatos.filter((c) => c.valido).map(paraPublico),
        r.invalidos,
        r.duplicados,
        "Confira se a planilha tem uma coluna com os números.",
      );
    } catch (e) {
      mostrar({
        tipo: "erro",
        titulo: "Não foi possível ler a planilha",
        descricao:
          e instanceof ErroApi ? (e.primeiroCampo ?? e.message) : "Use .xlsx, .xls ou .csv.",
      });
    } finally {
      setLendo(false);
    }
  }

  function lerColado() {
    const r = montarContatosColados(colado);
    aplicar(
      r.contatos.filter((c) => c.valido).map(paraPublico),
      r.invalidos,
      r.duplicados,
      "Cole um número por linha, com DDD.",
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1.5" role="group" aria-label="Como adicionar os contatos">
        <Botao
          variante={modo === "planilha" ? "secundario" : "fantasma"}
          tamanho="sm"
          onClick={() => setModo("planilha")}
        >
          <FileSpreadsheet aria-hidden className="size-3.5" />
          Planilha
        </Botao>
        <Botao
          variante={modo === "colar" ? "secundario" : "fantasma"}
          tamanho="sm"
          onClick={() => setModo("colar")}
        >
          <ClipboardList aria-hidden className="size-3.5" />
          Colar números
        </Botao>
      </div>

      {modo === "planilha" ? (
        <div className="flex flex-col gap-2">
          <Dropzone
            aoSelecionar={(a) => void lerPlanilha(a)}
            extensoes={EXTENSOES_PLANILHA}
            maxBytes={LIMITES.maxBytesPlanilha}
            carregando={lendo}
          />
          <p className="text-xs text-tinta-3">
            Precisa de uma coluna com os números. Uma coluna de nome é reconhecida sozinha, e as
            demais viram variáveis do texto. Dá para extrair a agenda de um canal conectado em{" "}
            <strong className="text-tinta-2">Canais → Contatos</strong>.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <AreaTexto
            rows={6}
            value={colado}
            onChange={(e) => setColado(e.target.value)}
            placeholder={"48991237324\n(48) 99123-7324\n+55 48 99123-7324"}
            aria-label="Números, um por linha"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Botao tamanho="sm" onClick={lerColado} disabled={!colado.trim()}>
              Usar estes números
            </Botao>
            <span className="text-xs text-tinta-3">Um por linha. Nome opcional antes do número.</span>
          </div>
        </div>
      )}

      {publico.length > 0 && (
        <div className="rounded-xl border border-borda bg-superficie-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-borda px-3.5 py-2.5">
            <span className="text-sm font-medium text-tinta">
              {formatarNumero(publico.length)} contato{publico.length === 1 ? "" : "s"}
            </span>
            {(descartados.invalidos > 0 || descartados.repetidos > 0) && (
              <span className="flex items-center gap-1.5 text-xs text-aviso">
                <TriangleAlert aria-hidden className="size-3.5" />
                {[
                  descartados.invalidos > 0 && `${descartados.invalidos} inválido(s)`,
                  descartados.repetidos > 0 && `${descartados.repetidos} repetido(s)`,
                ]
                  .filter(Boolean)
                  .join(" · ")}{" "}
                descartado(s)
              </span>
            )}
            <Botao
              tamanho="sm"
              variante="fantasma"
              className="ml-auto"
              onClick={() => {
                aoMudar([]);
                setDescartados({ invalidos: 0, repetidos: 0 });
              }}
            >
              <Trash2 aria-hidden className="size-3.5" />
              Limpar
            </Botao>
          </div>

          {/* Prévia curta: a lista inteira pode ter milhares de linhas, e
              renderizar todas trava a tela sem ajudar ninguém a conferir. */}
          <ul className="max-h-44 overflow-y-auto p-2">
            {publico.slice(0, 50).map((c) => (
              <li key={c.telefone} className="flex items-center gap-3 px-2 py-1 text-sm">
                <span className="min-w-0 flex-1 truncate text-tinta-2">{c.nome || "—"}</span>
                <span className="tabular shrink-0 text-tinta-3">{formatarTelefone(c.telefone)}</span>
              </li>
            ))}
          </ul>
          {publico.length > 50 && (
            <p className="border-t border-borda px-3.5 py-2 text-xs text-tinta-3">
              e mais {formatarNumero(publico.length - 50)}…
            </p>
          )}
        </div>
      )}

      <p className="text-xs text-tinta-3">
        Quem já pediu para sair é removido na hora de disparar, mesmo que venha na planilha.
      </p>
    </div>
  );
}

function paraPublico(c: {
  telefone: string;
  nome: string | null;
  variaveis: Record<string, string>;
}): ContatoPublico {
  return { telefone: c.telefone, nome: c.nome ?? "", variaveis: c.variaveis };
}
