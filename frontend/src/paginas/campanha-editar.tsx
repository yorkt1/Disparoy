import * as React from "react";
import { ChevronLeft, Save } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { IntervaloAleatorio, MensagemSequencia, Spintax } from "@disparoy/dominio";
import { EditorMensagem } from "@/components/campanhas/editor-mensagem";
import { SeletorCanais } from "@/components/campanhas/seletor-canais";
import { ControleIntervalo } from "@/components/campanhas/controle-intervalo";
import { Botao } from "@/components/ui/botao";
import { Campo, CaixaSelecao } from "@/components/ui/campos";
import { Carregando, ErroCarregamento } from "@/components/ui/estados";
import { useToast } from "@/components/ui/toast";
import { ErroApi } from "@/lib/api";
import { useCampanha, useCanais, useEditarCampanha, useSpintax } from "@/hooks/consultas";

export function PaginaEditarCampanha() {
  const { id = "" } = useParams();
  const consulta = useCampanha(id);
  const canais = useCanais();
  const spintax = useSpintax();
  const edicao = useEditarCampanha();
  const navegar = useNavigate();
  const { mostrar } = useToast();
  const campanha = consulta.data?.campanha;
  const [nome, setNome] = React.useState("");
  const [canaisIds, setCanaisIds] = React.useState<string[]>([]);
  const [sequencia, setSequencia] = React.useState<MensagemSequencia[]>([]);
  const [intervaloContatos, setIntervaloContatos] = React.useState<IntervaloAleatorio>({ minSegundos: 90, maxSegundos: 240 });
  const [intervaloMensagens, setIntervaloMensagens] = React.useState<IntervaloAleatorio>({ minSegundos: 3, maxSegundos: 9 });
  const [validarNumeros, setValidarNumeros] = React.useState(true);
  const [variacoes, setVariacoes] = React.useState<Spintax[]>([]);

  React.useEffect(() => {
    if (!campanha) return;
    setNome(campanha.nome);
    setCanaisIds(campanha.canaisIds);
    setSequencia(campanha.sequencia);
    setIntervaloContatos(campanha.intervaloEntreContatos);
    setIntervaloMensagens(campanha.intervaloEntreMensagens);
    setValidarNumeros(campanha.validarNumeros);
  }, [campanha]);

  React.useEffect(() => setVariacoes(spintax.data ?? []), [spintax.data]);

  if (consulta.isLoading || canais.isLoading || spintax.isLoading) {
    return <Carregando rotulo="Carregando campanha…" />;
  }
  const erro = consulta.error ?? canais.error ?? spintax.error;
  if (erro) return <ErroCarregamento erro={erro} aoTentarNovamente={() => void consulta.refetch()} />;
  if (!campanha) return <ErroCarregamento erro={new Error("Campanha não encontrada.")} />;

  async function salvar() {
    const campanhaAtual = campanha;
    if (!campanhaAtual) return;
    try {
      /*
       * `agendadaPara` NÃO vai no corpo, e a ausência é proposital.
       *
       * Esta tela não tem campo de data: ela lia o valor da campanha e o
       * devolvia igual. Só que o tempo passa entre carregar e salvar — uma
       * campanha agendada para 9:11 que o operador abrisse às 9:30 era
       * regravada com 9:11, agora no passado, e ficava esperando um horário
       * que nunca chega (até a manutenção expirá-la, meia hora depois).
       *
       * O campo é opcional na API e omiti-lo preserva o valor gravado. Quem
       * não oferece o controle não deve reescrever o dado.
       */
      await edicao.mutateAsync({
        id,
        nome: nome.trim(),
        canaisIds,
        sequencia,
        intervaloEntreContatos: intervaloContatos,
        intervaloEntreMensagens: intervaloMensagens,
        validarNumeros,
      });
      mostrar({ tipo: "sucesso", titulo: "Campanha atualizada", descricao: "As alterações foram salvas." });
      navegar(`/campanhas/${id}`);
    } catch (e) {
      mostrar({
        tipo: "erro",
        titulo: "Não foi possível editar a campanha",
        descricao: e instanceof ErroApi ? e.primeiroCampo ?? e.message : "Tente novamente.",
      });
    }
  }

  return (
    <>
      <div className="mb-6">
        <Link to={`/campanhas/${id}`} className="inline-flex items-center gap-1 text-xs text-tinta-3 hover:text-tinta">
          <ChevronLeft aria-hidden className="size-3.5" /> Campanha
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-tinta">Editar campanha</h1>
            <p className="mt-1 text-sm text-tinta-3">Altere a sequência, os canais e os intervalos sem perder o público salvo.</p>
          </div>
          <Botao variante="primario" carregando={edicao.isPending} onClick={() => void salvar()}>
            {!edicao.isPending ? <Save aria-hidden className="size-4" /> : null} Salvar alterações
          </Botao>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <section className="rounded-card border border-borda bg-superficie p-5">
          <h2 className="text-sm font-semibold text-tinta">Identificação</h2>
          <Campo rotulo="Nome da campanha" value={nome} onChange={(e) => setNome(e.target.value)} />
        </section>

        <section className="rounded-card border border-borda bg-superficie p-5">
          <h2 className="text-sm font-semibold text-tinta">Canais de envio</h2>
          <div className="mt-3">
            <SeletorCanais canais={canais.data ?? []} selecionados={canaisIds} aoAlternar={(canalId) => setCanaisIds((atual) => atual.includes(canalId) ? atual.filter((valor) => valor !== canalId) : [...atual, canalId])} />
          </div>
        </section>

        <section className="rounded-card border border-borda bg-superficie p-5">
          <h2 className="text-sm font-semibold text-tinta">Sequência e intervalos</h2>
          <ul className="mt-3 flex flex-col gap-3">
            {sequencia.map((mensagem, indice) => (
              <EditorMensagem
                key={mensagem.id}
                mensagem={mensagem}
                indice={indice}
                total={sequencia.length}
                variacoes={variacoes}
                aoAtualizar={(campos) => setSequencia((atual) => atual.map((item) => item.id === mensagem.id ? { ...item, ...campos } : item))}
                aoRemover={() => setSequencia((atual) => atual.length > 1 ? atual.filter((item) => item.id !== mensagem.id) : atual)}
                aoMover={(direcao) => setSequencia((atual) => { const origem = atual.findIndex((item) => item.id === mensagem.id); const destino = origem + direcao; if (origem < 0 || destino < 0 || destino >= atual.length) return atual; const copia = [...atual]; const [item] = copia.splice(origem, 1); copia.splice(destino, 0, item); return copia; })}
                aoMudarVariacoes={setVariacoes}
              />
            ))}
          </ul>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ControleIntervalo titulo="Intervalo entre contatos" descricao="Sorteado a cada contato da fila." valor={intervaloContatos} aoMudar={setIntervaloContatos} />
            <ControleIntervalo titulo="Intervalo entre mensagens" descricao="Sorteado entre os passos do mesmo contato." valor={intervaloMensagens} aoMudar={setIntervaloMensagens} />
          </div>
          <div className="mt-4">
            <CaixaSelecao rotulo="Validar números no WhatsApp antes de disparar" checked={validarNumeros} onChange={(e) => setValidarNumeros(e.target.checked)} />
          </div>
        </section>
      </div>
    </>
  );
}
