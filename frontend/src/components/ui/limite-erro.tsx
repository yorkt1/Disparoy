import * as React from "react";
import { AlertTriangle, Check, Copy, RefreshCw } from "lucide-react";
import { ehModuloDesatualizado, recarregarPorVersaoNova } from "@/lib/versao";
import { Botao } from "./botao";

/**
 * Última barreira antes da tela branca.
 *
 * O React desmonta a árvore inteira quando um erro escapa do render — sem isto
 * o painel some e sobra uma página em branco, sem mensagem e sem botão. Num
 * sistema que acompanha campanha de horas, isso é o operador achando que
 * perdeu o disparo: ele não tem como saber que os dados estão intactos no
 * servidor e que basta recarregar.
 *
 * Precisa ser classe: `componentDidCatch` e `getDerivedStateFromError` não têm
 * equivalente em hook. É a única classe do projeto, e é por isso.
 *
 * Não captura tudo: erro dentro de `onClick`, `setTimeout` ou promessa
 * rejeitada não passa pelo render e não chega aqui. Para esses, o tratamento é
 * o `ErroApi` do cliente HTTP e os estados de erro do react-query.
 */

interface Props {
  children: React.ReactNode;
  /** Some quando a rota muda, para o erro de uma tela não travar as outras. */
  chave?: string;
}

interface Estado {
  erro: Error | null;
  /**
   * Qual componente quebrou.
   *
   * A mensagem sozinha ("Cannot read properties of undefined") não diz nada
   * acionável: ela aponta a operação, nunca o lugar. Um relato de campanha que
   * não abria chegou como "parece ser de um length" e não deu para achar a
   * linha, porque o que faltava era justamente esta pilha.
   */
  pilha: string | null;
  copiado: boolean;
}

export class LimiteErro extends React.Component<Props, Estado> {
  state: Estado = { erro: null, pilha: null, copiado: false };

  static getDerivedStateFromError(erro: Error): Partial<Estado> {
    return { erro };
  }

  componentDidCatch(erro: Error, info: React.ErrorInfo): void {
    /*
     * Chunk de uma versão que não está mais publicada.
     *
     * Não é defeito de tela nenhuma: a aba foi aberta antes de um deploy e
     * pede um arquivo que a Vercel já substituiu. Recarregar traz o índice
     * novo e resolve, então a pessoa não precisa ver — nem entender — uma tela
     * de erro para isso.
     *
     * Se a recarga não acontecer (já houve uma há pouco, ou o armazenamento
     * está bloqueado), o `render` explica o caso em vez de mostrar a stack.
     */
    if (ehModuloDesatualizado(erro) && recarregarPorVersaoNova()) return;

    // Sem serviço de erro configurado, o console é o que existe. Fica com a
    // pilha de componentes junto, que é a parte que a stack do erro não tem.
    console.error("Erro não tratado no painel:", erro, info.componentStack);
    this.setState({ pilha: info.componentStack ?? null });
  }

  componentDidUpdate(anterior: Props): void {
    // Navegar para outra tela precisa limpar o erro; senão o painel fica preso
    // na tela de falha mesmo depois de o usuário sair da rota que quebrou.
    if (this.state.erro && anterior.chave !== this.props.chave) {
      this.setState({ erro: null, pilha: null, copiado: false });
    }
  }

  /** Tudo que serve para consertar, em um texto só. */
  private get relatorio(): string {
    const { erro, pilha } = this.state;
    return [
      `Erro: ${erro?.message ?? "desconhecido"}`,
      `Tela: ${window.location.href}`,
      `Quando: ${new Date().toISOString()}`,
      "",
      erro?.stack ?? "",
      pilha ? `\nComponentes:${pilha}` : "",
    ].join("\n");
  }

  private copiar = (): void => {
    /*
     * `writeText` falha em http sem TLS e quando o navegador nega a permissão,
     * e falha como promessa rejeitada — sem catch, quebraria dentro da própria
     * tela de erro. Aí o botão fica sem confirmar, que é o pior que acontece:
     * o texto continua visível para selecionar à mão.
     */
    void navigator.clipboard
      ?.writeText(this.relatorio)
      .then(() => this.setState({ copiado: true }))
      .catch(() => undefined);
  };

  private tentarNovamente = (): void => {
    this.setState({ erro: null });
  };

  private recarregar = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    const { erro, copiado } = this.state;
    if (!erro) return this.props.children;

    /*
     * A versão nova ganha tela própria, e não a de "esta tela quebrou".
     *
     * São problemas de natureza diferente: um é defeito, o outro é o painel
     * ter sido atualizado enquanto a aba estava aberta. Chamar o segundo de
     * "quebrou" — com stack e botão de copiar detalhes — faz o operador
     * relatar um bug que não existe, e nos manda caçar um erro de tela que
     * some sozinho ao recarregar.
     */
    if (ehModuloDesatualizado(erro)) {
      return (
        <div className="grid min-h-[60dvh] place-items-center px-4">
          <div className="max-w-sm rounded-card border border-borda bg-superficie px-6 py-6 text-center">
            <RefreshCw aria-hidden className="mx-auto size-6 text-tinta-3" />
            <p className="mt-3 text-sm font-medium text-tinta">O painel foi atualizado</p>
            <p className="mt-1 text-xs text-tinta-2">
              Esta aba está com a versão anterior. Recarregue para continuar — nada do seu
              trabalho foi perdido.
            </p>
            <Botao
              variante="primario"
              tamanho="sm"
              onClick={this.recarregar}
              className="mt-4"
            >
              Recarregar o painel
            </Botao>
          </div>
        </div>
      );
    }

    return (
      <div className="grid min-h-[60dvh] place-items-center px-4">
        <div className="max-w-md rounded-card border border-critico/35 bg-critico/8 px-6 py-6 text-center">
          <AlertTriangle aria-hidden className="mx-auto size-6 text-critico" />

          <p className="mt-3 text-sm font-medium text-tinta">Esta tela quebrou</p>
          <p className="mt-1 text-xs text-tinta-2">
            O erro foi na exibição, não no servidor. Suas campanhas e contatos estão
            intactos, e nenhum disparo em andamento foi interrompido.
          </p>

          {/* O detalhe fica recolhido: é o que você vai pedir num print, e é
              ruído para quem só quer voltar a trabalhar. */}
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-xs text-tinta-3 hover:text-tinta-2">
              Detalhes técnicos
            </summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-superficie-2 p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-tinta-2">
              {this.relatorio}
            </pre>
            {/* Sem este botão, relatar o erro exige abrir o console do
                navegador — e o que chega em vez disso é a descrição de
                memória, que não localiza nada. */}
            <Botao
              variante="secundario"
              tamanho="sm"
              onClick={this.copiar}
              className="mt-2 w-full"
            >
              {copiado ? (
                <>
                  <Check aria-hidden className="size-3.5" />
                  Copiado — cole no chat
                </>
              ) : (
                <>
                  <Copy aria-hidden className="size-3.5" />
                  Copiar detalhes
                </>
              )}
            </Botao>
          </details>

          <div className="mt-5 flex justify-center gap-2">
            <Botao variante="secundario" tamanho="sm" onClick={this.tentarNovamente}>
              Tentar de novo
            </Botao>
            <Botao variante="primario" tamanho="sm" onClick={this.recarregar}>
              Recarregar o painel
            </Botao>
          </div>
        </div>
      </div>
    );
  }
}
