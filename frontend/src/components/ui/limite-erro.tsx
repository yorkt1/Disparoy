import * as React from "react";
import { AlertTriangle } from "lucide-react";
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
}

export class LimiteErro extends React.Component<Props, Estado> {
  state: Estado = { erro: null };

  static getDerivedStateFromError(erro: Error): Estado {
    return { erro };
  }

  componentDidCatch(erro: Error, info: React.ErrorInfo): void {
    // Sem serviço de erro configurado, o console é o que existe. Fica com a
    // pilha de componentes junto, que é a parte que a stack do erro não tem.
    console.error("Erro não tratado no painel:", erro, info.componentStack);
  }

  componentDidUpdate(anterior: Props): void {
    // Navegar para outra tela precisa limpar o erro; senão o painel fica preso
    // na tela de falha mesmo depois de o usuário sair da rota que quebrou.
    if (this.state.erro && anterior.chave !== this.props.chave) {
      this.setState({ erro: null });
    }
  }

  private tentarNovamente = (): void => {
    this.setState({ erro: null });
  };

  private recarregar = (): void => {
    window.location.reload();
  };

  render(): React.ReactNode {
    const { erro } = this.state;
    if (!erro) return this.props.children;

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
            <pre className="mt-2 max-h-40 overflow-auto rounded-lg bg-superficie-2 p-3 text-[11px] leading-relaxed text-tinta-2">
              {erro.message}
            </pre>
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
