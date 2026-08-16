import { Link } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { FormularioCampanha } from "@/components/campanhas/formulario-campanha";
import { Carregando, ErroCarregamento } from "@/components/ui/estados";
import { useCanais, useSpintax } from "@/hooks/consultas";

export function PaginaNovaCampanha() {
  const canais = useCanais();
  const spintax = useSpintax();

  // Listas saíram daqui: o público entra na etapa 4, por planilha ou colagem,
  // e não existe mais cadastro de contatos para carregar antes.
  const carregando = canais.isLoading || spintax.isLoading;
  const erro = canais.error ?? spintax.error;

  return (
    <>
      <div className="mb-6">
        <Link
          to="/campanhas"
          className="inline-flex items-center gap-1 text-xs text-tinta-3 transition-colors hover:text-tinta"
        >
          <ChevronLeft aria-hidden className="size-3.5" />
          Campanhas
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-tinta">Nova campanha</h1>
        <p className="mt-1 text-sm text-tinta-3">
          Preencha as cinco etapas abaixo. O painel à direita acompanha o que ainda falta.
        </p>
      </div>

      {carregando ? (
        <Carregando rotulo="Carregando canais e variações…" />
      ) : erro ? (
        <ErroCarregamento
          erro={erro}
          aoTentarNovamente={() => {
            void canais.refetch();
            void spintax.refetch();
          }}
        />
      ) : (
        <FormularioCampanha
          // Só canais conectados podem receber disparo.
          canais={(canais.data ?? []).filter((c) => c.status === "conectado")}
          variacoesIniciais={spintax.data ?? []}
        />
      )}
    </>
  );
}
