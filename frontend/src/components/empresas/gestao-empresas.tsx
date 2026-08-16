import * as React from "react";
import { Building2, KeyRound, Plus, Smartphone, UserRound } from "lucide-react";
import { Botao } from "@/components/ui/botao";
import { Campo, MensagemErro, Selecao } from "@/components/ui/campos";
import { Modal } from "@/components/ui/modal";
import { Badge, Card, CardCabecalho, EstadoVazio, Separador } from "@/components/ui/primitivos";
import { Carregando, ErroCarregamento } from "@/components/ui/estados";
import { useToast } from "@/components/ui/toast";
import { ErroApi } from "@/lib/api";
import { formatarData } from "@/lib/formato";
import {
  useCriarEmpresa,
  useCriarUsuario,
  useEmpresas,
  type EmpresaResumo,
} from "@/hooks/consultas";

function mensagemDe(e: unknown, padrao: string): string {
  if (e instanceof ErroApi) return e.primeiroCampo ?? e.message;
  return e instanceof Error ? e.message : padrao;
}

/**
 * Empresas clientes e os acessos de cada uma.
 *
 * É por aqui que o sistema ganha clientes: a conta de administração cria a
 * empresa, cria o login dela (`acesso@empresa.com`) e entrega. O cliente entra,
 * conecta o WhatsApp DELE e dispara dentro do que é dele — sem enxergar canal,
 * campanha ou contato de mais ninguém.
 *
 * A tela só aparece para a conta global. Um admin de empresa é administrador
 * DELA, não do sistema, e a API recusa a rota para ele.
 */
export function GestaoEmpresas() {
  const empresas = useEmpresas();
  const [criandoEmpresa, setCriandoEmpresa] = React.useState(false);
  const [criandoAcesso, setCriandoAcesso] = React.useState<EmpresaResumo | null>(null);

  return (
    <>
      <Card>
        <CardCabecalho
          titulo="Empresas"
          descricao="Cada empresa recebe um acesso próprio e conecta o próprio WhatsApp."
          acao={
            <Botao variante="primario" tamanho="sm" onClick={() => setCriandoEmpresa(true)}>
              <Plus aria-hidden className="size-4" />
              Nova empresa
            </Botao>
          }
        />
        <Separador />

        {empresas.isLoading && <Carregando rotulo="Carregando empresas…" />}
        {empresas.error && (
          <ErroCarregamento
            erro={empresas.error}
            aoTentarNovamente={() => void empresas.refetch()}
          />
        )}

        {empresas.data?.length === 0 && (
          <EstadoVazio
            icone={<Building2 className="size-6" />}
            titulo="Nenhuma empresa ainda"
            descricao="Crie a primeira e gere o acesso que ela vai usar para conectar o WhatsApp."
          />
        )}

        {empresas.data && empresas.data.length > 0 && (
          <ul className="divide-y divide-borda">
            {empresas.data.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-tinta">{e.nome}</p>
                  <p className="mt-0.5 text-xs text-tinta-3">
                    criada em {formatarData(e.criadaEm)}
                  </p>
                </div>

                {/* As duas perguntas que importam de relance: já tem quem
                    entre, e já tem número conectado? */}
                <Badge tom={e.acessos > 0 ? "neutro" : "aviso"} icone={<UserRound className="size-3.5" />}>
                  {e.acessos} {e.acessos === 1 ? "acesso" : "acessos"}
                </Badge>
                <Badge tom={e.canais > 0 ? "bom" : "neutro"} icone={<Smartphone className="size-3.5" />}>
                  {e.canais} {e.canais === 1 ? "canal" : "canais"}
                </Badge>

                <Botao variante="secundario" tamanho="sm" onClick={() => setCriandoAcesso(e)}>
                  <KeyRound aria-hidden className="size-3.5" />
                  Criar acesso
                </Botao>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ModalNovaEmpresa aberto={criandoEmpresa} aoFechar={() => setCriandoEmpresa(false)} />
      <ModalNovoAcesso empresa={criandoAcesso} aoFechar={() => setCriandoAcesso(null)} />
    </>
  );
}

function ModalNovaEmpresa({ aberto, aoFechar }: { aberto: boolean; aoFechar: () => void }) {
  const [nome, setNome] = React.useState("");
  const [erro, setErro] = React.useState<string | null>(null);
  const criacao = useCriarEmpresa();
  const { mostrar } = useToast();

  function fechar() {
    aoFechar();
    setNome("");
    setErro(null);
  }

  async function salvar() {
    setErro(null);
    try {
      const { empresa } = await criacao.mutateAsync(nome.trim());
      mostrar({
        tipo: "sucesso",
        titulo: "Empresa criada",
        descricao: `Agora crie o acesso de ${empresa.nome}.`,
      });
      fechar();
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível criar a empresa."));
    }
  }

  return (
    <Modal
      aberto={aberto}
      aoFechar={fechar}
      titulo="Nova empresa"
      descricao="Só o nome. O acesso e os canais vêm depois."
      rodape={
        <>
          <Botao variante="fantasma" onClick={fechar}>
            Cancelar
          </Botao>
          <Botao
            variante="primario"
            onClick={salvar}
            carregando={criacao.isPending}
            disabled={nome.trim().length < 2}
          >
            Criar empresa
          </Botao>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Campo
          rotulo="Nome da empresa"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Empreende Brazil Club"
          dica="Aparece só para você, na administração."
          required
        />
        <MensagemErro>{erro}</MensagemErro>
      </div>
    </Modal>
  );
}

/**
 * O login que a empresa vai usar.
 *
 * Não há convite por e-mail nem auto-cadastro: a senha é definida aqui e
 * entregue ao cliente. Por isso ela aparece na tela uma vez, ao criar — depois
 * não há como recuperá-la, só redefinir.
 */
function ModalNovoAcesso({
  empresa,
  aoFechar,
}: {
  empresa: EmpresaResumo | null;
  aoFechar: () => void;
}) {
  const [nome, setNome] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [senha, setSenha] = React.useState("");
  const [papel, setPapel] = React.useState<"admin" | "operator">("admin");
  const [erro, setErro] = React.useState<string | null>(null);
  const [criado, setCriado] = React.useState<{ email: string; senha: string } | null>(null);
  const criacao = useCriarUsuario();

  // Sugere o e-mail a partir do nome da empresa: é o padrão que você usa, e
  // digitar de novo só cria chance de erro.
  React.useEffect(() => {
    if (!empresa) return;
    setNome(empresa.nome);
    const slug = empresa.nome
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    setEmail(`acesso@${slug || "empresa"}.com`);
  }, [empresa]);

  function fechar() {
    aoFechar();
    setSenha("");
    setErro(null);
    setCriado(null);
    setPapel("admin");
  }

  async function salvar() {
    if (!empresa) return;
    setErro(null);
    try {
      await criacao.mutateAsync({
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        senha,
        papel,
        empresaId: empresa.id,
      });
      setCriado({ email: email.trim().toLowerCase(), senha });
    } catch (e) {
      setErro(mensagemDe(e, "Não foi possível criar o acesso."));
    }
  }

  return (
    <Modal
      aberto={empresa !== null}
      aoFechar={fechar}
      titulo={criado ? "Acesso criado" : `Acesso de ${empresa?.nome ?? ""}`}
      descricao={
        criado
          ? "Entregue estes dados ao cliente. A senha não aparece de novo."
          : "Este login entra no painel e conecta o WhatsApp da empresa."
      }
      rodape={
        criado ? (
          <Botao variante="primario" onClick={fechar}>
            Concluir
          </Botao>
        ) : (
          <>
            <Botao variante="fantasma" onClick={fechar}>
              Cancelar
            </Botao>
            <Botao
              variante="primario"
              onClick={salvar}
              carregando={criacao.isPending}
              disabled={nome.trim().length < 2 || !email.includes("@") || senha.length < 8}
            >
              Criar acesso
            </Botao>
          </>
        )
      }
    >
      {criado ? (
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-borda bg-superficie-2 p-4">
            <p className="text-xs text-tinta-3">E-mail</p>
            <p className="font-mono text-sm text-tinta">{criado.email}</p>
            <p className="mt-3 text-xs text-tinta-3">Senha</p>
            <p className="font-mono text-sm text-tinta">{criado.senha}</p>
          </div>
          <p className="text-xs text-tinta-3">
            Ao entrar, o cliente vai em <strong className="text-tinta-2">Canais → Conectar
            canal</strong> e pareia o número dele — por QR Code ou pelo código de 8 dígitos.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Campo
            rotulo="Nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
          <Campo
            rotulo="E-mail de acesso"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            dica="É com ele que o cliente entra no painel."
            required
          />
          <Campo
            rotulo="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            dica="Mínimo de 8 caracteres. Anote: ela não aparece de novo."
            required
          />
          <Selecao
            rotulo="Papel dentro da empresa"
            value={papel}
            onChange={(e) => setPapel(e.target.value as "admin" | "operator")}
          >
            <option value="admin">Administrador — gerencia canais e usuários da empresa</option>
            <option value="operator">Operador — só dispara pelos canais liberados</option>
          </Selecao>
          <MensagemErro>{erro}</MensagemErro>
        </div>
      )}
    </Modal>
  );
}
