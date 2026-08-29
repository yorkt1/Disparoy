
import * as React from "react";
import { FileSpreadsheet, Loader2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/formato";
import { Botao } from "./botao";

/**
 * Área de upload com arrastar-e-soltar.
 *
 * Valida extensão e tamanho antes de entregar o arquivo — o servidor revalida,
 * mas errar aqui evita subir 40 MB para receber um 400.
 */

export interface PropsDropzone {
  /** Extensões aceitas, com ponto: [".csv", ".xlsx"]. */
  extensoes: readonly string[];
  maxBytes: number;
  aoSelecionar: (arquivo: File) => void;
  arquivoAtual?: { nome: string; tamanho: number } | null;
  aoRemover?: () => void;
  carregando?: boolean;
  descricao?: string;
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function Dropzone({
  extensoes,
  maxBytes,
  aoSelecionar,
  arquivoAtual,
  aoRemover,
  carregando = false,
  descricao,
}: PropsDropzone) {
  const [arrastando, setArrastando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function validarEEntregar(arquivo: File | undefined) {
    if (!arquivo) return;
    setErro(null);

    const extensao = arquivo.name.slice(arquivo.name.lastIndexOf(".")).toLowerCase();
    if (!extensoes.includes(extensao)) {
      setErro(`Formato não aceito. Use ${extensoes.join(", ")}.`);
      return;
    }
    if (arquivo.size > maxBytes) {
      setErro(`Arquivo acima de ${formatarTamanho(maxBytes)}.`);
      return;
    }
    aoSelecionar(arquivo);
  }

  if (arquivoAtual) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-borda-forte bg-superficie-2 px-4 py-3">
        <FileSpreadsheet aria-hidden className="size-5 shrink-0 text-marca-tenue" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-tinta">{arquivoAtual.nome}</p>
          <p className="tabular text-xs text-tinta-3">{formatarTamanho(arquivoAtual.tamanho)}</p>
        </div>
        {carregando ? (
          <Loader2 aria-hidden className="size-4 animate-spin text-tinta-3" />
        ) : aoRemover ? (
          <Botao tamanho="icone" variante="fantasma" onClick={aoRemover} aria-label="Remover arquivo">
            <X aria-hidden className="size-4" />
          </Botao>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          validarEEntregar(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Selecionar planilha de contatos"
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-9 text-center transition-colors",
          arrastando
            ? "border-marca bg-marca/8"
            : "border-borda-forte bg-superficie-2 hover:border-borda-hover hover:bg-superficie-3",
        )}
      >
        {carregando ? (
          <Loader2 aria-hidden className="size-6 animate-spin text-marca-tenue" />
        ) : (
          <UploadCloud aria-hidden className="size-6 text-tinta-3" />
        )}
        <p className="text-sm text-tinta">
          Arraste a planilha aqui ou <span className="text-marca-tenue">procure no computador</span>
        </p>
        <p className="text-xs text-tinta-3">
          {descricao ?? `${extensoes.join(", ")} · até ${formatarTamanho(maxBytes)}`}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={extensoes.join(",")}
        className="sr-only"
        onChange={(e) => {
          validarEEntregar(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {erro ? (
        <p role="alert" className="mt-2 text-xs text-critico">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
