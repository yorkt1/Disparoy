import {
  Check,
  CheckCheck,
  CheckCircle2,
  CircleDashed,
  CirclePause,
  Clock,
  HelpCircle,
  Loader2,
  MessageSquare,
  XCircle,
} from "lucide-react";
import { Badge, type TomBadge } from "@/components/ui/primitivos";
import type {
  ConfiancaCanal,
  SituacaoContato,
  StatusCampanha,
  StatusCanal,
  StatusTemplate,
} from "@disparoy/dominio";

/**
 * Selos de estado. Cada um leva ÍCONE + TEXTO: a cor nunca é o único canal que
 * carrega o significado.
 */

const CAMPANHA: Record<StatusCampanha, { texto: string; tom: TomBadge; icone: React.ReactNode }> = {
  rascunho: { texto: "Rascunho", tom: "neutro", icone: <CircleDashed className="size-3.5" /> },
  agendada: { texto: "Agendada", tom: "marca", icone: <Clock className="size-3.5" /> },
  em_andamento: {
    texto: "Em andamento",
    tom: "marca",
    icone: <Loader2 className="size-3.5 animate-spin" />,
  },
  pausada: { texto: "Pausada", tom: "aviso", icone: <CirclePause className="size-3.5" /> },
  // Tom crítico, e não "aviso": pausa automática quase sempre exige alguém
  // reconectar um QR. Se aparecesse igual à pausa manual, ninguém agiria.
  pausada_por_canal: {
    texto: "Pausada pelo sistema",
    tom: "critico",
    icone: <CirclePause className="size-3.5" />,
  },
  concluida: { texto: "Concluída", tom: "bom", icone: <CheckCircle2 className="size-3.5" /> },
  falhou: { texto: "Falhou", tom: "critico", icone: <XCircle className="size-3.5" /> },
};

export function SeloCampanha({ status }: { status: StatusCampanha }) {
  const c = CAMPANHA[status];
  return (
    <Badge tom={c.tom} icone={c.icone}>
      {c.texto}
    </Badge>
  );
}

const CANAL: Record<StatusCanal, { texto: string; tom: TomBadge; icone: React.ReactNode }> = {
  conectado: { texto: "Conectado", tom: "bom", icone: <CheckCircle2 className="size-3.5" /> },
  desconectado: { texto: "Desconectado", tom: "neutro", icone: <XCircle className="size-3.5" /> },
  aguardando_qr: { texto: "Aguardando QR", tom: "aviso", icone: <Clock className="size-3.5" /> },
  banido: { texto: "Banido", tom: "critico", icone: <XCircle className="size-3.5" /> },
};

/**
 * Selo do canal, com o grau de confiança junto.
 *
 * `confianca` chega de `apresentarCanal()`, no domínio. Sem ela o selo afirmava
 * "Conectado" a partir de um cache que ninguém tinha conferido — inclusive para
 * um canal que nunca chegou a parear.
 *
 * Não confirmado perde a cor: verde desbotado ainda é lido como "está tudo bem"
 * de relance, e o ponto aqui é justamente não afirmar.
 */
export function SeloCanal({
  status,
  confianca = "confirmado",
}: {
  status: StatusCanal;
  confianca?: ConfiancaCanal;
}) {
  const c = CANAL[status];
  if (confianca === "confirmado") {
    return (
      <Badge tom={c.tom} icone={c.icone}>
        {c.texto}
      </Badge>
    );
  }

  return (
    <Badge
      tom={confianca === "contraditorio" ? "aviso" : "neutro"}
      icone={<HelpCircle className="size-3.5" />}
    >
      {c.texto}
    </Badge>
  );
}

/**
 * Onde cada contato parou dentro da campanha.
 *
 * O texto diz o degrau e o que ele IMPLICA, porque a pergunta que o operador
 * faz olhando a lista não é "qual o status" — é "preciso fazer algo com esta
 * pessoa?". "Lido" sozinho não responde; "Lido, sem resposta" responde.
 *
 * `respondeu` fica com o tom da marca e não com `bom`: verde é o tom de
 * "entregue e acabou". Resposta não é fim de fluxo, é a pessoa esperando
 * alguém do outro lado — precisa saltar da tela, não se misturar ao sucesso
 * silencioso.
 */
const SITUACAO: Record<SituacaoContato, { texto: string; tom: TomBadge; icone: React.ReactNode }> = {
  pendente: { texto: "Na fila", tom: "neutro", icone: <CircleDashed className="size-3.5" /> },
  falhou: { texto: "Falhou", tom: "critico", icone: <XCircle className="size-3.5" /> },
  enviado: { texto: "Não lido", tom: "aviso", icone: <Check className="size-3.5" /> },
  lido: { texto: "Lido, sem resposta", tom: "bom", icone: <CheckCheck className="size-3.5" /> },
  respondeu: { texto: "Respondeu", tom: "marca", icone: <MessageSquare className="size-3.5" /> },
};

export function SeloSituacao({ situacao }: { situacao: SituacaoContato }) {
  const s = SITUACAO[situacao];
  return (
    <Badge tom={s.tom} icone={s.icone}>
      {s.texto}
    </Badge>
  );
}

/** O mesmo rótulo sem o selo — para os botões de filtro, que já têm forma própria. */
export const ROTULO_SITUACAO: Record<SituacaoContato, string> = {
  pendente: "Na fila",
  falhou: "Falhou",
  enviado: "Não lido",
  lido: "Lido",
  respondeu: "Respondeu",
};

const TEMPLATE: Record<StatusTemplate, { texto: string; tom: TomBadge; icone: React.ReactNode }> = {
  aprovado: { texto: "Aprovado", tom: "bom", icone: <CheckCircle2 className="size-3.5" /> },
  pendente: { texto: "Em análise", tom: "aviso", icone: <Clock className="size-3.5" /> },
  rejeitado: { texto: "Rejeitado", tom: "critico", icone: <XCircle className="size-3.5" /> },
  pausado: { texto: "Pausado", tom: "serio", icone: <CirclePause className="size-3.5" /> },
};

export function SeloTemplate({ status }: { status: StatusTemplate }) {
  const c = TEMPLATE[status];
  return (
    <Badge tom={c.tom} icone={c.icone}>
      {c.texto}
    </Badge>
  );
}

export const ROTULO_CATEGORIA = {
  marketing: "Marketing",
  utilidade: "Utilidade",
  autenticacao: "Autenticação",
} as const;

export const ROTULO_CONEXAO = {
  qrcode: "QR Code",
  api_oficial: "API Oficial",
} as const;
