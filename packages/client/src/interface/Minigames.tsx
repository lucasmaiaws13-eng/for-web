import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useLocation, useNavigate, useParams } from "@revolt/routing";
import { Avatar, Header, main } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { HeaderIcon } from "./common/CommonHeader";

/* ------------------------------------------------------------------ */
/* Tipos que vem do servico callju-jogos                               */
/* ------------------------------------------------------------------ */

type Direcao = "H" | "V";
type Casa = [number, number];
type Nivel = "normal" | "expert";

const NIVEIS: Nivel[] = ["normal", "expert"];

const NIVEL_INFO: Record<Nivel, { nome: string; descricao: string }> = {
  normal: { nome: "Normal", descricao: "palavras do dia a dia" },
  expert: { nome: "Expert", descricao: "vocabulário e cultura cabeludos" },
};

type Dica = {
  numero: number;
  direcao: Direcao;
  linha: number;
  coluna: number;
  tamanho: number;
  dica: string;
};

type Grade = {
  tamanho: number;
  abertas: boolean[][];
  numeros: (number | null)[][];
  dicas: Dica[];
};

type Estado = {
  tamanho: number;
  iniciou: boolean;
  terminou: boolean;
  inicio_ms?: number;
  tempo_ms?: number | null;
  ajuda: boolean;
  grau_ajuda: number;
  ajudas: RegistroAjuda[];
  equipe: { id: string; nome: string } | null;
};

type Status = { data: string; niveis: Record<Nivel, Estado> };

type LinhaRanking = {
  id: string;
  nome: string;
  tempo_ms: number;
  ajuda: boolean;
  grau_ajuda: number;
  ajudas: RegistroAjuda[];
  eu: boolean;
};

type Membro = { id: string; nome: string };

type LinhaEquipe = {
  id: string;
  nome: string;
  membros: Membro[];
  tempo_ms: number;
  ajuda: boolean;
  grau_ajuda: number;
  ajudas: RegistroAjuda[];
  eu: boolean;
};

type Ranking = {
  terminaram: LinhaRanking[];
  jogando: number;
  equipes: LinhaEquipe[];
  equipes_jogando: number;
};

type RespostaRanking = { data: string; niveis: Record<Nivel, Ranking> };

type ResumoSala = {
  id: string;
  nivel: Nivel;
  nome: string;
  tamanho: number;
  online: Membro[];
  progresso: number;
  terminou: boolean;
};

type Pessoa = {
  id: string;
  nome: string;
  cor: string;
  online: boolean;
  cursor: Casa | null;
  direcao: Direcao;
  letras: number;
};

type FotoSala = {
  sala: {
    id: string;
    tipo: "livre" | "equipe";
    nivel: Nivel;
    nome: string;
    data: string | null;
    dono: string;
    comecou: boolean;
    inicio_ms: number | null;
    tempo_ms: number | null;
    cheia_errada: boolean;
    ajuda: boolean;
    ajudas: RegistroAjuda[];
    grau_ajuda: number;
    vagas: number | null;
  };
  grade: Grade | null;
  letras: string[][] | null;
  autores: (string | null)[][] | null;
  erradas: Casa[];
  reveladas: Casa[];
  pessoas: Pessoa[];
  agora_ms: number;
};

type TipoAjuda =
  | "checar_palavra"
  | "checar_grade"
  | "revelar_letra"
  | "revelar_palavra";

/** Cada ajuda usada: qual, em que momento da partida e, na sala, quem */
type RegistroAjuda = { tipo: TipoAjuda; t_ms: number; quem?: string };

/* Checar e revelar sao familias diferentes: cor e icone proprios */
const COR_CHECAR = "#6cc6f0";
const COR_REVELAR = "#f2c14e";

const INFO_AJUDA: Record<TipoAjuda, { familia: "checar" | "revelar"; acao: string }> = {
  checar_palavra: { familia: "checar", acao: "checou uma palavra" },
  checar_grade: { familia: "checar", acao: "checou a grade" },
  revelar_letra: { familia: "revelar", acao: "revelou uma letra" },
  revelar_palavra: { familia: "revelar", acao: "revelou uma palavra" },
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

const Base = styled("div", {
  base: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    color: "var(--md-sys-color-on-surface)",
  },
});

const conteudo = cva({
  base: {
    ...main.raw(),
    padding: "32px 16px 64px",
    gap: "20px",
    alignItems: "center",
  },
});

const cartaoJogo = cva({
  base: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "10px",
    padding: "18px",
    minHeight: "230px",
    borderRadius: "18px",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container-high)",
    color: "var(--md-sys-color-on-surface)",
    cursor: "pointer",
    textAlign: "start",
    font: "inherit",
    transition: "transform 150ms ease, border-color 150ms ease",
    _hover: {
      transform: "translateY(-2px)",
      borderColor: "var(--callju-accent-line)",
    },
    _focusVisible: {
      outline: "2px solid var(--callju-accent)",
      outlineOffset: "2px",
    },
  },
});

const cartao = {
  width: "100%",
  "max-width": "560px",
  padding: "20px",
  "border-radius": "20px",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  background: "rgba(255, 255, 255, 0.035)",
  "box-shadow":
    "inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 14px 36px rgba(0, 0, 0, 0.35)",
  "backdrop-filter": "blur(18px) saturate(1.2)",
  "box-sizing": "border-box",
} as const;

const botaoSecundario = {
  padding: "8px 12px",
  "font-size": "0.82em",
  "border-radius": "99px",
  cursor: "pointer",
  color: "var(--md-sys-color-on-surface)",
  background: "var(--md-sys-color-surface-container-high)",
  border: "1px solid var(--md-sys-color-outline-variant)",
} as const;

const botaoRevelar = {
  ...botaoSecundario,
  color: "#f2c14e",
  background: "rgba(242, 193, 78, 0.07)",
  border: "1px dashed rgba(242, 193, 78, 0.45)",
} as const;

const campoTexto = {
  width: "100%",
  "box-sizing": "border-box",
  padding: "11px 12px",
  "border-radius": "10px",
  border: "1px solid var(--md-sys-color-outline-variant)",
  background: "var(--md-sys-color-surface-container)",
  color: "var(--md-sys-color-on-surface)",
  font: "inherit",
} as const;

const selo = {
  "font-size": "0.72em",
  padding: "2px 8px",
  "border-radius": "99px",
  background: "var(--md-sys-color-surface-variant)",
  opacity: "0.85",
  "white-space": "nowrap",
} as const;

const paragrafo = {
  margin: "16px 0",
  "line-height": "1.55",
  opacity: "0.8",
  "font-size": "0.92em",
} as const;

const botaoPrincipal = {
  width: "100%",
  padding: "13px",
  "font-size": "1em",
} as const;

function formataTempo(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${seg}` : `${m}:${seg}`;
}

/**
 * Letra digitada vira maiuscula e sem acento, como nas cruzadas impressas.
 * "ç" se decompoe em "c" mais a cedilha, e a cedilha cai junto dos acentos.
 */
function normalizaLetra(tecla: string) {
  const l = tecla
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
  return /^[A-Z]$/.test(l) ? l : "";
}

function dataPorExtenso(data: string) {
  return new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

const chave = (r: number, c: number) => `${r},${c}`;

const casasDe = (d: Dica): Casa[] =>
  Array.from({ length: d.tamanho }, (_, i) =>
    d.direcao === "H" ? [d.linha, d.coluna + i] : [d.linha + i, d.coluna],
  );

/* O nivel escolhido fica lembrado neste navegador */
const CHAVE_NIVEL = "callju-cruzada-nivel";

function nivelSalvo(): Nivel {
  try {
    const n = localStorage.getItem(CHAVE_NIVEL);
    return n === "expert" ? "expert" : "normal";
  } catch {
    return "normal";
  }
}

function salvarNivel(n: Nivel) {
  try {
    localStorage.setItem(CHAVE_NIVEL, n);
  } catch {
    // Sem armazenamento local, so volta pro Normal na proxima visita
  }
}

class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly dados: Record<string, unknown>,
  ) {
    super(typeof dados.erro === "string" ? dados.erro : `HTTP ${status}`);
  }
}

type Api = <T>(caminho: string, corpo?: unknown) => Promise<T>;

/**
 * Chamada ao servico dos minigames.
 *
 * Quem a pessoa e nao sai daqui: o token de sessao vai no cabecalho e o
 * servico pergunta a propria API do Stoat.
 */
function useApi(): Api {
  const client = useClient();

  return async function chamar<T>(caminho: string, corpo?: unknown): Promise<T> {
    const [cabecalho, token] = client().authenticationHeader;
    const resposta = await fetch(`/jogos${caminho}`, {
      method: corpo === undefined ? "GET" : "POST",
      headers: {
        [cabecalho]: token,
        ...(corpo === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
    if (!resposta.ok) {
      const dados = await resposta.json().catch(() => ({}));
      throw new ErroApi(resposta.status, dados);
    }
    return resposta.json();
  };
}

/**
 * Foto de perfil da pessoa, a mesma do app. Quem nao estiver no cache do
 * cliente aparece com a inicial do nome.
 */
function Foto(props: {
  id: string;
  nome: string;
  tamanho: number;
  cor?: string;
  apagada?: boolean;
}) {
  const client = useClient();

  return (
    <span
      title={props.nome}
      style={{
        display: "inline-flex",
        "flex-shrink": "0",
        "border-radius": "50%",
        "box-shadow": props.cor ? `0 0 0 2px ${props.cor}` : undefined,
        opacity: props.apagada ? "0.4" : "1",
        transition: "opacity 200ms ease",
      }}
    >
      <Avatar
        size={props.tamanho}
        src={client().users.get(props.id)?.avatarURL}
        fallback={props.nome}
      />
    </span>
  );
}

function Pilha(props: { membros: Membro[]; tamanho: number }) {
  return (
    <span style={{ display: "inline-flex", "padding-left": "6px" }}>
      <For each={props.membros}>
        {(m) => (
          <span
            style={{
              "margin-left": "-6px",
              "border-radius": "50%",
              "box-shadow": "0 0 0 2px var(--md-sys-color-surface-container-high)",
              display: "inline-flex",
            }}
          >
            <Foto id={m.id} nome={m.nome} tamanho={props.tamanho} />
          </span>
        )}
      </For>
    </span>
  );
}

/**
 * Icone das palavras cruzadas: uma grade 5x5 com CAJU na horizontal
 * cruzando JAMBU na vertical, e UXI embaixo.
 */
function IconeCruzada(props: { tamanho: number }) {
  const letras: [number, number, string][] = [
    [0, 1, "J"],
    [1, 0, "C"],
    [1, 1, "A"],
    [1, 2, "J"],
    [1, 3, "U"],
    [2, 1, "M"],
    [3, 1, "B"],
    [4, 1, "U"],
    [4, 2, "X"],
    [4, 3, "I"],
  ];
  const lado = 10;
  const passo = 11.5;
  const inicio = 4;

  return (
    <svg
      width={props.tamanho}
      height={props.tamanho}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Palavras cruzadas"
    >
      <defs>
        <linearGradient id="callju-icone-cruzada" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stop-color="#8f1d0a" />
          <stop offset="0.45" stop-color="#c9551f" />
          <stop offset="0.75" stop-color="#e8823c" />
          <stop offset="1" stop-color="#f2a355" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#callju-icone-cruzada)" />
      <For each={Array.from({ length: 25 }, (_, i) => i)}>
        {(i) => (
          <rect
            x={inicio + (i % 5) * passo}
            y={inicio + Math.floor(i / 5) * passo}
            width={lado}
            height={lado}
            rx="2.5"
            fill="rgba(20, 8, 4, 0.22)"
          />
        )}
      </For>
      <For each={letras}>
        {([r, c, l]) => {
          const cruzamento = r === 1 && c === 1;
          return (
            <>
              <rect
                x={inicio + c * passo}
                y={inicio + r * passo}
                width={lado}
                height={lado}
                rx="2.5"
                fill={cruzamento ? "#1b0f0a" : "rgba(255, 255, 255, 0.94)"}
              />
              <text
                x={inicio + c * passo + lado / 2}
                y={inicio + r * passo + lado / 2 + 0.4}
                text-anchor="middle"
                dominant-baseline="central"
                font-size="7"
                font-weight="800"
                font-family="inherit"
                fill={cruzamento ? "#f2a355" : "#7a2a0c"}
              >
                {l}
              </text>
            </>
          );
        }}
      </For>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Selo e linha do tempo das ajudas                                    */
/* ------------------------------------------------------------------ */

function contarAjudas(ajudas: RegistroAjuda[]) {
  let checou = 0;
  let revelou = 0;
  for (const a of ajudas) {
    if (INFO_AJUDA[a.tipo]?.familia === "checar") checou++;
    else if (INFO_AJUDA[a.tipo]?.familia === "revelar") revelou++;
  }
  return { checou, revelou };
}

/** "2 checagens e 1 revelação", ou "ajuda" pra partida sem registro detalhado */
function descreverAjudas(ajudas: RegistroAjuda[], grau: number) {
  const { checou, revelou } = contarAjudas(ajudas);
  const partes: string[] = [];
  if (checou) partes.push(`${checou} ${checou === 1 ? "checagem" : "checagens"}`);
  if (revelou) partes.push(`${revelou} ${revelou === 1 ? "revelação" : "revelações"}`);
  if (!partes.length && grau > 0) return "ajuda";
  return partes.join(" e ");
}

function resumoFinal(ajudas: RegistroAjuda[], grau: number) {
  return grau > 0
    ? `Com ${descreverAjudas(ajudas, grau)}, fica marcado no ranking.`
    : "Sem ajuda nenhuma. Bonito.";
}

function textoDaAjuda(a: RegistroAjuda) {
  const acao = INFO_AJUDA[a.tipo]?.acao ?? "usou ajuda";
  return a.quem ? `${a.quem} ${acao}` : acao.charAt(0).toUpperCase() + acao.slice(1);
}

/**
 * Selo com quantas vezes checou e revelou. Com `alternar`, vira botao que
 * abre a linha do tempo.
 */
function SeloAjudas(props: {
  ajudas: RegistroAjuda[];
  grau: number;
  aberto?: boolean;
  alternar?: () => void;
}) {
  const conta = () => contarAjudas(props.ajudas ?? []);
  const titulo = () =>
    `Usou ${descreverAjudas(props.ajudas ?? [], props.grau)}${props.alternar ? ". Toca pra ver quando." : ""}`;

  const estilo = {
    display: "inline-flex",
    "align-items": "center",
    gap: "7px",
    padding: "3px 9px",
    "border-radius": "99px",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container)",
    color: "var(--md-sys-color-on-surface)",
    "font-family": "inherit",
    "font-size": "0.76em",
    "font-weight": "700",
    "font-variant-numeric": "tabular-nums",
    "white-space": "nowrap",
  } as const;

  const conteudo = () => (
    <>
      <Show when={conta().checou}>
        <span style={{ display: "inline-flex", "align-items": "center", gap: "2px", color: COR_CHECAR }}>
          <Symbol size={15} color={COR_CHECAR}>
            fact_check
          </Symbol>
          {conta().checou}
        </span>
      </Show>
      <Show when={conta().revelou}>
        <span style={{ display: "inline-flex", "align-items": "center", gap: "2px", color: COR_REVELAR }}>
          <Symbol size={15} color={COR_REVELAR}>
            lightbulb
          </Symbol>
          {conta().revelou}
        </span>
      </Show>
      <Show when={!conta().checou && !conta().revelou}>
        <span style={{ opacity: "0.8" }}>ajuda</span>
      </Show>
      <Show when={props.alternar}>
        <span style={{ display: "inline-flex", opacity: "0.55", "margin-left": "-3px" }}>
          <Symbol size={15}>{props.aberto ? "expand_less" : "expand_more"}</Symbol>
        </span>
      </Show>
    </>
  );

  return (
    <Show when={props.grau > 0}>
      <Show
        when={props.alternar}
        fallback={
          <span title={titulo()} style={estilo}>
            {conteudo()}
          </span>
        }
      >
        <button
          type="button"
          title={titulo()}
          aria-expanded={props.aberto}
          onClick={() => props.alternar!()}
          style={{ ...estilo, cursor: "pointer" }}
        >
          {conteudo()}
        </button>
      </Show>
    </Show>
  );
}

/** Quando cada ajuda aconteceu, numa barra do tempo da partida e em lista */
function LinhaDoTempoAjudas(props: { ajudas: RegistroAjuda[]; tempo_ms: number; recuo?: string }) {
  const total = () => Math.max(props.tempo_ms, 1, ...props.ajudas.map((a) => a.t_ms));
  const cor = (a: RegistroAjuda) =>
    INFO_AJUDA[a.tipo]?.familia === "revelar" ? COR_REVELAR : COR_CHECAR;
  const icone = (a: RegistroAjuda) =>
    INFO_AJUDA[a.tipo]?.familia === "revelar" ? "lightbulb" : "fact_check";

  return (
    <div
      style={{
        padding: `2px 12px 12px ${props.recuo ?? "12px"}`,
        display: "flex",
        "flex-direction": "column",
        gap: "6px",
      }}
    >
      <Show
        when={props.ajudas.length}
        fallback={
          <span style={{ "font-size": "0.8em", opacity: "0.55" }}>
            Essa ajuda é de antes do registro detalhado, então não dá pra saber
            qual foi nem quando.
          </span>
        }
      >
        <div
          style={{
            position: "relative",
            height: "6px",
            margin: "10px 5px 0",
            "border-radius": "99px",
            background: "var(--md-sys-color-surface-variant)",
          }}
        >
          <For each={props.ajudas}>
            {(a) => (
              <span
                title={`${formataTempo(a.t_ms)} · ${textoDaAjuda(a)}`}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: `${Math.min(100, (a.t_ms / total()) * 100)}%`,
                  width: "11px",
                  height: "11px",
                  transform: "translate(-50%, -50%)",
                  "border-radius": "50%",
                  background: cor(a),
                  "box-shadow": "0 0 0 2px var(--md-sys-color-surface-container-high)",
                }}
              />
            )}
          </For>
        </div>
        <div
          style={{
            display: "flex",
            "justify-content": "space-between",
            "font-size": "0.7em",
            opacity: "0.45",
            "font-variant-numeric": "tabular-nums",
            margin: "0 0 2px",
          }}
        >
          <span>0:00</span>
          <span>{formataTempo(props.tempo_ms)}</span>
        </div>
        <For each={props.ajudas}>
          {(a) => (
            <div style={{ display: "flex", "align-items": "center", gap: "8px", "font-size": "0.82em" }}>
              <span
                style={{
                  "min-width": "40px",
                  opacity: "0.55",
                  "font-variant-numeric": "tabular-nums",
                }}
              >
                {formataTempo(a.t_ms)}
              </span>
              <Symbol size={15} color={cor(a)}>
                {icone(a)}
              </Symbol>
              <span>{textoDaAjuda(a)}</span>
            </div>
          )}
        </For>
      </Show>
    </div>
  );
}

function LegendaAjudas() {
  const item = { display: "inline-flex", "align-items": "center", gap: "3px" } as const;
  return (
    <p
      style={{
        margin: "12px 0 0",
        "font-size": "0.76em",
        opacity: "0.6",
        display: "flex",
        "flex-wrap": "wrap",
        gap: "4px 12px",
        "align-items": "center",
      }}
    >
      <span style={item}>
        <Symbol size={14} color={COR_CHECAR}>
          fact_check
        </Symbol>
        checou
      </span>
      <span style={item}>
        <Symbol size={14} color={COR_REVELAR}>
          lightbulb
        </Symbol>
        revelou
      </span>
      <span>Ordem: sem ajuda, depois só checou, depois revelou. Toca no selo pra ver quando.</span>
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Pagina                                                              */
/* ------------------------------------------------------------------ */

export function MinigamesPage() {
  const params = useParams<{ id?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const chamar = useApi();

  const naCruzada = () => location.pathname.startsWith("/minigames/cruzadas");

  return (
    <Base>
      <Header placement="primary">
        <HeaderIcon>
          <Symbol size={22} color="var(--callju-accent)">
            sports_esports
          </Symbol>
        </HeaderIcon>
        Minigames
      </Header>

      <div use:scrollable={{ class: conteudo() }}>
        <Show
          when={params.id}
          keyed
          fallback={
            <Show when={naCruzada()} fallback={<TelaInicial chamar={chamar} />}>
              <Cruzadas chamar={chamar} />
            </Show>
          }
        >
          {(id) => (
            <SalaEmGrupo
              id={id}
              chamar={chamar}
              voltar={() => navigate("/minigames/cruzadas")}
            />
          )}
        </Show>
      </div>
    </Base>
  );
}

/* ------------------------------------------------------------------ */
/* Tela inicial: escolher o minigame                                   */
/* ------------------------------------------------------------------ */

function TelaInicial(props: { chamar: Api }) {
  const navigate = useNavigate();
  const [status, setStatus] = createSignal<Status>();

  onMount(async () => {
    try {
      setStatus(await props.chamar<Status>("/cruzada/status"));
    } catch {
      // Sem o servico, o cartao so fica sem o resumo do dia
    }
  });

  return (
    <div
      style={{
        width: "100%",
        "max-width": "720px",
        display: "flex",
        "flex-direction": "column",
        gap: "18px",
      }}
    >
      <div>
        <div
          style={{
            "font-size": "1.6em",
            "font-weight": "800",
            "letter-spacing": "-0.02em",
          }}
        >
          Minigames
        </div>
        <div style={{ opacity: "0.6", "font-size": "0.92em", "margin-top": "2px" }}>
          Joguinhos rápidos pra jogar sozinho ou com a galera do Callju.
        </div>
      </div>

      <div
        style={{
          display: "grid",
          "grid-template-columns": "repeat(auto-fill, minmax(230px, 1fr))",
          gap: "14px",
        }}
      >
        <button class={cartaoJogo()} onClick={() => navigate("/minigames/cruzadas")}>
          <IconeCruzada tamanho={68} />
          <div
            style={{
              "font-size": "1.15em",
              "font-weight": "750",
              "letter-spacing": "-0.01em",
              "margin-top": "4px",
            }}
          >
            Palavras cruzadas
          </div>
          <div style={{ opacity: "0.6", "font-size": "0.86em", "line-height": "1.45" }}>
            Uma grade 9x9 nova todo dia, no Normal e no Expert. Sozinho, em
            equipe ou em grupo.
          </div>
          <div style={{ display: "flex", gap: "6px", "flex-wrap": "wrap", "margin-top": "auto" }}>
            <For each={NIVEIS}>
              {(n) => (
                <span
                  style={{
                    ...selo,
                    display: "inline-flex",
                    "align-items": "center",
                    gap: "3px",
                    background: status()?.niveis[n].terminou
                      ? "var(--callju-accent-soft)"
                      : "var(--md-sys-color-surface-variant)",
                    color: status()?.niveis[n].terminou ? "var(--callju-accent)" : undefined,
                  }}
                >
                  <Show when={status()?.niveis[n].terminou}>
                    <Symbol size={13}>check</Symbol>
                  </Show>
                  {NIVEL_INFO[n].nome}
                </span>
              )}
            </For>
          </div>
        </button>

        <div
          style={{
            display: "flex",
            "flex-direction": "column",
            "align-items": "center",
            "justify-content": "center",
            gap: "12px",
            padding: "18px",
            "min-height": "230px",
            "border-radius": "18px",
            border: "2px dashed var(--md-sys-color-outline-variant)",
            "text-align": "center",
            "box-sizing": "border-box",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              display: "grid",
              "place-items": "center",
              "border-radius": "16px",
              background: "var(--md-sys-color-surface-container-high)",
              color: "var(--callju-accent)",
            }}
          >
            <Symbol size={28}>add</Symbol>
          </div>
          <div style={{ "font-weight": "700" }}>Mais minigames em breve!</div>
          <div style={{ opacity: "0.5", "font-size": "0.82em", "max-width": "200px" }}>
            Tem ideia de jogo? Manda pro Lucas.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Palavras cruzadas: nivel, cruzada do dia, ranking e salas em grupo  */
/* ------------------------------------------------------------------ */

function Cruzadas(props: { chamar: Api }) {
  const navigate = useNavigate();

  const [nivel, setNivelInterno] = createSignal<Nivel>(nivelSalvo());
  const [status, setStatus] = createSignal<Status>();
  const [ranking, setRanking] = createSignal<RespostaRanking>();
  const [salas, setSalas] = createSignal<ResumoSala[]>();
  const [jogando, setJogando] = createSignal(false);
  const [erro, setErro] = createSignal("");

  const [montandoEquipe, setMontandoEquipe] = createSignal(false);
  const [nomeEquipe, setNomeEquipe] = createSignal("");
  const [erroEquipe, setErroEquipe] = createSignal("");
  const [ocupado, setOcupado] = createSignal(false);

  function setNivel(n: Nivel) {
    setNivelInterno(n);
    salvarNivel(n);
    setMontandoEquipe(false);
    setErroEquipe("");
  }

  const estado = () => status()?.niveis[nivel()];
  const nomeNivel = () => NIVEL_INFO[nivel()].nome;
  const salasDoNivel = () => (salas() ?? []).filter((s) => s.nivel === nivel());

  async function atualizar() {
    try {
      const [s, r, g] = await Promise.all([
        props.chamar<Status>("/cruzada/status"),
        props.chamar<RespostaRanking>("/cruzada/ranking"),
        props.chamar<{ salas: ResumoSala[] }>("/grupo/salas"),
      ]);
      setStatus(s);
      setRanking(r);
      setSalas(g.salas);
      setErro("");
    } catch {
      setErro(
        "Não consegui falar com o servidor dos minigames. Tenta de novo daqui a pouco.",
      );
    }
  }

  onMount(atualizar);

  // Ranking e salas mudam enquanto os outros jogam. Atualiza sozinho, mas so
  // na tela de espera: no meio do jogo nao faz falta.
  const intervalo = setInterval(() => {
    if (!jogando()) atualizar();
  }, 15000);
  onCleanup(() => clearInterval(intervalo));

  async function criarEquipe(e: Event) {
    e.preventDefault();
    if (ocupado()) return;
    setOcupado(true);
    setErroEquipe("");
    try {
      const r = await props.chamar<{ id: string }>("/grupo/criar", {
        tipo: "equipe",
        nivel: nivel(),
        nome: nomeEquipe(),
      });
      navigate(`/minigames/sala/${r.id}`);
    } catch (err) {
      setErroEquipe(
        err instanceof ErroApi ? err.message : "Não consegui criar a equipe.",
      );
    } finally {
      setOcupado(false);
    }
  }

  async function criarSala() {
    if (ocupado()) return;
    setOcupado(true);
    try {
      const r = await props.chamar<{ id: string }>("/grupo/criar", {
        tipo: "livre",
        nivel: nivel(),
      });
      navigate(`/minigames/sala/${r.id}`);
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : "Não consegui criar a sala.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Show
      when={!jogando()}
      fallback={
        <Cruzada
          nivel={nivel()}
          chamar={props.chamar}
          aoTerminar={atualizar}
          irParaEquipe={(id) => navigate(`/minigames/sala/${id}`)}
          voltar={() => {
            setJogando(false);
            atualizar();
          }}
        />
      }
    >
      <div
        style={{
          width: "100%",
          "max-width": "560px",
          display: "flex",
          "flex-direction": "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex" }}>
          <BotaoVoltar texto="Minigames" onClick={() => navigate("/minigames")} />
        </div>
        <SeletorNivel nivel={nivel()} escolher={setNivel} status={status()} />
      </div>

      <Show when={erro()}>
        <div style={{ ...cartao, color: "#ff8a7a" }}>{erro()}</div>
      </Show>

      {/* Cruzada do dia */}
      <div style={cartao}>
        <TituloCartao
          icone="grid_on"
          titulo={`Cruzada do dia · ${nomeNivel()}`}
          subtitulo={
            status()
              ? `${dataPorExtenso(status()!.data)} · ${estado()!.tamanho}x${estado()!.tamanho} · a mesma pra todo mundo`
              : "Carregando…"
          }
        />

        <Show when={estado()}>
          <Show
            when={!estado()!.equipe}
            fallback={
              <>
                <p style={paragrafo}>
                  Na {nomeNivel()} de hoje você joga na equipe{" "}
                  <b style={{ color: "var(--callju-accent)" }}>{estado()!.equipe!.nome}</b>.
                </p>
                <button
                  class="callju-btn"
                  onClick={() => navigate(`/minigames/sala/${estado()!.equipe!.id}`)}
                  style={botaoPrincipal}
                >
                  Abrir a equipe
                </button>
              </>
            }
          >
            <p style={paragrafo}>
              <Show
                when={estado()!.terminou}
                fallback={
                  estado()!.iniciou
                    ? `Você já começou a ${nomeNivel()} de hoje. O relógio continua correndo.`
                    : "O relógio começa quando a grade abre. Em cada nível, dá pra jogar sozinho ou numa equipe de até 5 pessoas, mas é um ou outro por dia. Ajuda é liberada e fica marcada no ranking."
                }
              >
                Você terminou a {nomeNivel()} de hoje em{" "}
                <b style={{ color: "var(--callju-accent)" }}>
                  {formataTempo(estado()!.tempo_ms ?? 0)}
                </b>
                {estado()!.grau_ajuda
                  ? `, com ${descreverAjudas(estado()!.ajudas, estado()!.grau_ajuda)}.`
                  : ", sem ajuda nenhuma."}{" "}
                {nivel() === "normal" && !status()!.niveis.expert.terminou
                  ? "Encara a Expert?"
                  : "Amanhã tem outra."}
              </Show>
            </p>

            <Show when={!estado()!.terminou}>
              <Show
                when={!montandoEquipe()}
                fallback={
                  <form
                    onSubmit={criarEquipe}
                    style={{ display: "flex", "flex-direction": "column", gap: "10px" }}
                  >
                    <input
                      style={campoTexto}
                      placeholder="Nome da equipe"
                      maxLength={32}
                      value={nomeEquipe()}
                      onInput={(e) => setNomeEquipe(e.currentTarget.value)}
                      ref={(el) => setTimeout(() => el.focus())}
                    />
                    <p
                      style={{
                        ...paragrafo,
                        margin: "0",
                        "font-size": "0.82em",
                        opacity: "0.6",
                      }}
                    >
                      Equipe da {nomeNivel()} de hoje. Depois é só mandar o link no
                      chat. O relógio só começa quando alguém da equipe apertar
                      Começar.
                    </p>
                    <Show when={erroEquipe()}>
                      <p style={{ margin: "0", color: "#ff8a7a", "font-size": "0.88em" }}>
                        {erroEquipe()}
                      </p>
                    </Show>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <button
                        class="callju-btn"
                        type="submit"
                        disabled={ocupado() || !nomeEquipe().trim()}
                        style={{ ...botaoPrincipal, flex: "1" }}
                      >
                        Criar equipe
                      </button>
                      <button
                        type="button"
                        onClick={() => setMontandoEquipe(false)}
                        style={{ ...botaoSecundario, "font-size": "0.92em", padding: "0 16px" }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                }
              >
                <div style={{ display: "flex", gap: "8px", "flex-wrap": "wrap" }}>
                  <button
                    class="callju-btn"
                    onClick={() => setJogando(true)}
                    style={{ ...botaoPrincipal, flex: "1 1 180px" }}
                  >
                    {estado()!.iniciou ? "Continuar" : "Jogar sozinho"}
                  </button>
                  <Show when={!estado()!.iniciou}>
                    <button
                      onClick={() => setMontandoEquipe(true)}
                      style={{
                        ...botaoSecundario,
                        flex: "1 1 180px",
                        "font-size": "1em",
                        padding: "12px",
                        display: "flex",
                        "align-items": "center",
                        "justify-content": "center",
                        gap: "6px",
                      }}
                    >
                      <Symbol size={20}>groups</Symbol>
                      Criar equipe pra hoje
                    </button>
                  </Show>
                </div>
              </Show>
            </Show>
          </Show>
        </Show>
      </div>

      <PainelRanking dados={ranking()?.niveis[nivel()]} nomeNivel={nomeNivel()} />

      {/* Cruzada em grupo, fora do ranking */}
      <div style={cartao}>
        <TituloCartao
          icone="edit_note"
          titulo={`Cruzada em grupo · ${nomeNivel()}`}
          subtitulo="fora do ranking · grade diferente da do dia"
        />
        <p style={paragrafo}>
          Todo mundo preenchendo a mesma grade ao mesmo tempo, vendo o cursor e
          as letras de cada um na hora.
        </p>

        <Show when={salasDoNivel().length}>
          <div
            style={{
              display: "flex",
              "flex-direction": "column",
              gap: "6px",
              "margin-bottom": "14px",
            }}
          >
            <For each={salasDoNivel().slice(0, 6)}>
              {(s) => (
                <button
                  onClick={() => navigate(`/minigames/sala/${s.id}`)}
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "10px",
                    padding: "10px 12px",
                    "border-radius": "10px",
                    border: "1px solid var(--md-sys-color-outline-variant)",
                    background: "transparent",
                    color: "var(--md-sys-color-on-surface)",
                    cursor: "pointer",
                    "text-align": "start",
                    font: "inherit",
                  }}
                >
                  <span style={{ flex: "1", "min-width": "0" }}>
                    <span style={{ display: "block", "font-weight": "600" }}>{s.nome}</span>
                    <span style={{ "font-size": "0.8em", opacity: "0.55" }}>
                      {s.terminou
                        ? "terminada"
                        : s.online.length
                          ? `${s.progresso}% preenchida`
                          : `${s.progresso}% preenchida · ninguém agora`}
                    </span>
                  </span>
                  <Pilha membros={s.online} tamanho={24} />
                  <Symbol size={20}>chevron_right</Symbol>
                </button>
              )}
            </For>
          </div>
        </Show>

        <button
          class="callju-btn"
          onClick={criarSala}
          disabled={ocupado()}
          style={botaoPrincipal}
        >
          Criar sala
        </button>
      </div>
    </Show>
  );
}

function SeletorNivel(props: {
  nivel: Nivel;
  escolher: (n: Nivel) => void;
  status?: Status;
}) {
  return (
    <div
      role="tablist"
      aria-label="Nível"
      style={{
        display: "grid",
        "grid-template-columns": "1fr 1fr",
        gap: "4px",
        padding: "4px",
        "border-radius": "16px",
        background: "var(--md-sys-color-surface-container-high)",
      }}
    >
      <For each={NIVEIS}>
        {(n) => {
          const ativo = () => props.nivel === n;
          return (
            <button
              role="tab"
              aria-selected={ativo()}
              onClick={() => props.escolher(n)}
              style={{
                display: "flex",
                "flex-direction": "column",
                "align-items": "center",
                gap: "1px",
                padding: "10px 8px",
                "border-radius": "12px",
                border: "none",
                cursor: "pointer",
                font: "inherit",
                color: ativo() ? "#fff" : "var(--md-sys-color-on-surface)",
                background: ativo() ? "var(--callju-grad)" : "transparent",
                transition: "background 150ms ease",
              }}
            >
              <span
                style={{
                  "font-weight": "750",
                  display: "inline-flex",
                  "align-items": "center",
                  gap: "4px",
                }}
              >
                {NIVEL_INFO[n].nome}
                <Show when={props.status?.niveis[n].terminou}>
                  <Symbol size={16}>check_circle</Symbol>
                </Show>
              </span>
              <span style={{ "font-size": "0.74em", opacity: ativo() ? "0.9" : "0.55" }}>
                {NIVEL_INFO[n].descricao}
              </span>
            </button>
          );
        }}
      </For>
    </div>
  );
}

function TituloCartao(props: { icone: string; titulo: string; subtitulo: string }) {
  return (
    <div style={{ display: "flex", "align-items": "center", gap: "14px" }}>
      <div
        style={{
          width: "48px",
          height: "48px",
          "flex-shrink": "0",
          display: "grid",
          "place-items": "center",
          "border-radius": "12px",
          background: "var(--callju-grad)",
          color: "#fff",
        }}
      >
        <Symbol size={26}>{props.icone}</Symbol>
      </div>
      <div style={{ "min-width": "0" }}>
        <div
          style={{
            "font-size": "1.15em",
            "font-weight": "750",
            "letter-spacing": "-0.01em",
          }}
        >
          {props.titulo}
        </div>
        <div style={{ opacity: "0.55", "font-size": "0.85em" }}>{props.subtitulo}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Ranking                                                             */
/* ------------------------------------------------------------------ */

function PainelRanking(props: { dados?: Ranking; nomeNivel: string }) {
  const [aba, setAba] = createSignal<"sozinho" | "equipes">("sozinho");
  const medalha = (i: number) => ["🥇", "🥈", "🥉"][i] ?? `${i + 1}º`;

  // Quem jogou em equipe abre direto na aba das equipes
  let escolheuAba = false;
  createEffect(() => {
    if (!escolheuAba && props.dados?.equipes.some((e) => e.eu)) {
      escolheuAba = true;
      setAba("equipes");
    }
  });

  const linha = (eu: boolean) =>
    ({
      display: "flex",
      "align-items": "center",
      gap: "10px",
      padding: "8px 12px",
      "border-radius": "10px",
      background: eu ? "var(--callju-accent-soft)" : "transparent",
      border: eu ? "1px solid var(--callju-accent-line)" : "1px solid transparent",
    }) as const;

  const tempo = {
    "font-variant-numeric": "tabular-nums",
    "font-weight": "700",
  } as const;

  const nome = (eu: boolean) =>
    ({
      flex: "1",
      "min-width": "0",
      overflow: "hidden",
      "text-overflow": "ellipsis",
      "white-space": "nowrap",
      "font-weight": eu ? "700" : "500",
    }) as const;

  const abaEstilo = (ativa: boolean) =>
    ({
      padding: "5px 12px",
      "border-radius": "99px",
      border: "none",
      cursor: "pointer",
      font: "inherit",
      "font-size": "0.82em",
      "font-weight": ativa ? "700" : "500",
      color: ativa ? "#fff" : "var(--md-sys-color-on-surface)",
      background: ativa ? "var(--callju-grad)" : "transparent",
    }) as const;

  return (
    <div style={cartao}>
      <div
        style={{
          display: "flex",
          "align-items": "center",
          gap: "8px",
          "margin-bottom": "12px",
          "flex-wrap": "wrap",
        }}
      >
        <Symbol size={20} color="var(--callju-accent)">
          leaderboard
        </Symbol>
        <span style={{ "font-weight": "700", flex: "1" }}>
          Ranking de hoje · {props.nomeNivel}
        </span>
        <div
          role="tablist"
          style={{
            display: "flex",
            gap: "2px",
            padding: "3px",
            "border-radius": "99px",
            background: "var(--md-sys-color-surface-container)",
          }}
        >
          <button
            role="tab"
            aria-selected={aba() === "sozinho"}
            style={abaEstilo(aba() === "sozinho")}
            onClick={() => setAba("sozinho")}
          >
            Sozinho
          </button>
          <button
            role="tab"
            aria-selected={aba() === "equipes"}
            style={abaEstilo(aba() === "equipes")}
            onClick={() => setAba("equipes")}
          >
            Equipes
          </button>
        </div>
      </div>

      <Show
        when={props.dados}
        fallback={<p style={{ opacity: "0.5", margin: "0" }}>Carregando…</p>}
      >
        <Show when={aba() === "sozinho"}>
          <Show
            when={props.dados!.terminaram.length}
            fallback={
              <p style={{ opacity: "0.55", margin: "0", "font-size": "0.92em" }}>
                Ninguém terminou sozinho ainda. O primeiro lugar está livre.
              </p>
            }
          >
            <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
              <For each={props.dados!.terminaram}>
                {(l, i) => {
                  const [aberto, setAberto] = createSignal(false);
                  return (
                    <div>
                      <div style={linha(l.eu)}>
                        <span style={{ width: "26px", "text-align": "center" }}>
                          {medalha(i())}
                        </span>
                        <Foto id={l.id} nome={l.nome} tamanho={28} />
                        <span style={nome(l.eu)}>
                          {l.nome}
                          {l.eu ? " (você)" : ""}
                        </span>
                        <SeloAjudas
                          ajudas={l.ajudas ?? []}
                          grau={l.grau_ajuda ?? (l.ajuda ? 2 : 0)}
                          aberto={aberto()}
                          alternar={() => setAberto(!aberto())}
                        />
                        <span style={tempo}>{formataTempo(l.tempo_ms)}</span>
                      </div>
                      <Show when={aberto()}>
                        <LinhaDoTempoAjudas ajudas={l.ajudas ?? []} tempo_ms={l.tempo_ms} recuo="50px" />
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>

          <Show when={props.dados!.jogando}>
            <p style={{ opacity: "0.5", margin: "12px 0 0", "font-size": "0.85em" }}>
              {props.dados!.jogando === 1
                ? "1 pessoa jogando agora"
                : `${props.dados!.jogando} pessoas jogando agora`}
            </p>
          </Show>
        </Show>

        <Show when={aba() === "equipes"}>
          <Show
            when={props.dados!.equipes.length}
            fallback={
              <p style={{ opacity: "0.55", margin: "0", "font-size": "0.92em" }}>
                Nenhuma equipe terminou ainda. Monta a sua e chama a galera.
              </p>
            }
          >
            <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
              <For each={props.dados!.equipes}>
                {(eq, i) => {
                  const [aberto, setAberto] = createSignal(false);
                  return (
                    <div>
                      <div style={linha(eq.eu)}>
                        <span style={{ width: "26px", "text-align": "center" }}>
                          {medalha(i())}
                        </span>
                        <span style={{ flex: "1", "min-width": "0" }}>
                          <span style={{ ...nome(eq.eu), display: "block" }}>
                            {eq.nome}
                            {eq.eu ? " (sua)" : ""}
                          </span>
                          <span
                            style={{
                              display: "block",
                              "font-size": "0.76em",
                              opacity: "0.55",
                              overflow: "hidden",
                              "text-overflow": "ellipsis",
                              "white-space": "nowrap",
                            }}
                          >
                            {eq.membros.map((m) => m.nome).join(", ")}
                          </span>
                        </span>
                        <Pilha membros={eq.membros} tamanho={26} />
                        <SeloAjudas
                          ajudas={eq.ajudas ?? []}
                          grau={eq.grau_ajuda ?? (eq.ajuda ? 2 : 0)}
                          aberto={aberto()}
                          alternar={() => setAberto(!aberto())}
                        />
                        <span style={tempo}>{formataTempo(eq.tempo_ms)}</span>
                      </div>
                      <Show when={aberto()}>
                        <LinhaDoTempoAjudas ajudas={eq.ajudas ?? []} tempo_ms={eq.tempo_ms} recuo="50px" />
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>
          </Show>

          <Show when={props.dados!.equipes_jogando}>
            <p style={{ opacity: "0.5", margin: "12px 0 0", "font-size": "0.85em" }}>
              {props.dados!.equipes_jogando === 1
                ? "1 equipe jogando agora"
                : `${props.dados!.equipes_jogando} equipes jogando agora`}
            </p>
          </Show>
        </Show>

        <Show
          when={[...props.dados!.terminaram, ...props.dados!.equipes].some(
            (x) => (x.grau_ajuda ?? (x.ajuda ? 2 : 0)) > 0,
          )}
        >
          <LegendaAjudas />
        </Show>
      </Show>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tabuleiro: grade, teclado, dicas e ajuda. Serve pros tres modos.    */
/* ------------------------------------------------------------------ */

function Tabuleiro(props: {
  grade: Grade;
  letras: string[][];
  bloqueado: boolean;
  erradas: Set<string>;
  reveladas: Set<string>;
  aviso: string;
  textoAjuda: string;
  /** Cor de quem escreveu cada letra, no modo em grupo */
  corDaCasa?: (r: number, c: number) => string | undefined;
  /** Os outros jogadores da sala, pra desenhar o cursor deles */
  outros?: Pessoa[];
  escrever: (r: number, c: number, letra: string, cursor: Casa, direcao: Direcao) => void;
  aoMover?: (cursor: Casa, direcao: Direcao) => void;
  ajuda: (tipo: TipoAjuda, corpo: Record<string, unknown>) => void;
}) {
  const [sel, setSel] = createSignal<Casa>([0, 0]);
  const [dir, setDir] = createSignal<Direcao>("H");

  let entrada: HTMLInputElement | undefined;

  const aberta = (r: number, c: number) => !!props.grade.abertas[r]?.[c];

  const palavraEm = (r: number, c: number, direcao: Direcao) =>
    props.grade.dicas.find(
      (d) => d.direcao === direcao && casasDe(d).some(([a, b]) => a === r && b === c),
    );

  const outra = (d: Direcao): Direcao => (d === "H" ? "V" : "H");

  const ordenadas = createMemo(() =>
    [...props.grade.dicas].sort((a, b) =>
      a.direcao === b.direcao ? a.numero - b.numero : a.direcao === "H" ? -1 : 1,
    ),
  );

  const palavraAtual = createMemo(() => {
    const [r, c] = sel();
    return palavraEm(r, c, dir()) ?? palavraEm(r, c, outra(dir()));
  });

  const naPalavraAtual = (r: number, c: number) => {
    const p = palavraAtual();
    return !!p && casasDe(p).some(([a, b]) => a === r && b === c);
  };

  const cursoresDosOutros = createMemo(() => {
    const m = new Map<string, Pessoa>();
    for (const p of props.outros ?? []) {
      if (p.online && p.cursor) m.set(chave(p.cursor[0], p.cursor[1]), p);
    }
    return m;
  });

  onMount(() => {
    // Comeca na primeira palavra que ainda tem casa vazia
    const alvo =
      ordenadas().find((d) => casasDe(d).some(([a, b]) => !props.letras[a]?.[b])) ??
      ordenadas()[0];
    setDir(alvo.direcao);
    setSel(casasDe(alvo).find(([a, b]) => !props.letras[a]?.[b]) ?? [alvo.linha, alvo.coluna]);
    // No celular nao foca sozinho: o teclado cobriria a grade antes da pessoa ler
    if (!window.matchMedia("(pointer: coarse)").matches) entrada?.focus();
  });

  createEffect(() => props.aoMover?.(sel(), dir()));

  function tocarCasa(r: number, c: number) {
    if (!aberta(r, c) || props.bloqueado) return;
    const [sr, sc] = sel();
    if (sr === r && sc === c) {
      if (palavraEm(r, c, outra(dir()))) setDir(outra(dir()));
    } else {
      setSel([r, c]);
      if (!palavraEm(r, c, dir())) setDir(outra(dir()));
    }
    entrada?.focus();
  }

  function escolherDica(d: Dica) {
    if (props.bloqueado) return;
    setDir(d.direcao);
    const vazia = casasDe(d).find(([a, b]) => !props.letras[a]?.[b]);
    setSel(vazia ?? [d.linha, d.coluna]);
    entrada?.focus();
  }

  function vizinhaNaPalavra(passo: 1 | -1): Casa | undefined {
    const p = palavraAtual();
    if (!p) return;
    const lista = casasDe(p);
    const [r, c] = sel();
    const j = lista.findIndex(([a, b]) => a === r && b === c) + passo;
    return j >= 0 && j < lista.length ? lista[j] : undefined;
  }

  function mover(dr: number, dc: number) {
    let [r, c] = sel();
    for (let k = 0; k < props.grade.tamanho; k++) {
      r += dr;
      c += dc;
      if (r < 0 || c < 0 || r >= props.grade.tamanho || c >= props.grade.tamanho) return;
      if (aberta(r, c)) {
        setSel([r, c]);
        if (!palavraEm(r, c, dir())) setDir(outra(dir()));
        return;
      }
    }
  }

  function proximaPalavra(passo: 1 | -1) {
    const p = palavraAtual();
    if (!p) return;
    const lista = ordenadas();
    const i = lista.indexOf(p);
    escolherDica(lista[(i + passo + lista.length) % lista.length]);
  }

  const [avisoLocal, setAvisoLocal] = createSignal("");

  const vazias = createMemo(() =>
    props.grade.abertas.reduce(
      (total, linha, r) => total + linha.filter((ab, c) => ab && !props.letras[r]?.[c]).length,
      0,
    ),
  );

  function gravar(r: number, c: number, letra: string, cursor: Casa) {
    // Letra revelada ja e a certa: fica travada
    if (props.reveladas.has(chave(r, c))) return;
    setAvisoLocal("");
    props.escrever(r, c, letra, cursor, dir());
  }

  /**
   * Finalizei, checar: so confere a grade cheia. Com casa vazia, avisa quantas
   * faltam sem gastar checagem.
   */
  function finalizar() {
    const faltam = vazias();
    if (faltam > 0) {
      setAvisoLocal(
        faltam === 1
          ? "Ainda falta 1 casa pra finalizar."
          : `Ainda faltam ${faltam} casas pra finalizar.`,
      );
    } else {
      setAvisoLocal("");
      props.ajuda("checar_grade", {});
    }
    entrada?.focus();
  }

  function digitar(letra: string) {
    const [r, c] = sel();
    const proxima = vizinhaNaPalavra(1) ?? [r, c];
    gravar(r, c, letra, proxima);
    setSel(proxima);
  }

  function aoTeclar(e: KeyboardEvent) {
    if (props.bloqueado) return;
    const [r, c] = sel();

    if (e.key === "Backspace") {
      e.preventDefault();
      if (props.letras[r]?.[c] && !props.reveladas.has(chave(r, c))) {
        gravar(r, c, "", [r, c]);
      } else {
        const anterior = vizinhaNaPalavra(-1);
        if (anterior) {
          setSel(anterior);
          gravar(anterior[0], anterior[1], "", anterior);
        }
      }
      return;
    }

    const setas: Record<string, [number, number, Direcao]> = {
      ArrowRight: [0, 1, "H"],
      ArrowLeft: [0, -1, "H"],
      ArrowDown: [1, 0, "V"],
      ArrowUp: [-1, 0, "V"],
    };
    if (setas[e.key]) {
      e.preventDefault();
      const [dr, dc, sentido] = setas[e.key];
      // Primeiro toque na seta do outro sentido so vira a direcao
      if (dir() !== sentido && palavraEm(r, c, sentido)) setDir(sentido);
      else mover(dr, dc);
      return;
    }

    if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      proximaPalavra(e.shiftKey ? -1 : 1);
      return;
    }

    if (e.key === " ") {
      e.preventDefault();
      if (palavraEm(r, c, outra(dir()))) setDir(outra(dir()));
      return;
    }

    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const letra = normalizaLetra(e.key);
    if (letra) {
      e.preventDefault();
      digitar(letra);
    }
  }

  /**
   * Teclado de celular muitas vezes nao informa a tecla no keydown, so
   * entrega o texto no input. Pega a ultima letra e limpa o campo.
   */
  function aoDigitarNoCelular(e: InputEvent) {
    const campo = e.currentTarget as HTMLInputElement;
    const letra = normalizaLetra(campo.value.slice(-1));
    campo.value = "";
    if (letra && !props.bloqueado) digitar(letra);
  }

  function pedirAjuda(tipo: TipoAjuda) {
    const p = palavraAtual();
    const corpo: Record<string, unknown> = {};
    if (tipo === "checar_palavra" || tipo === "revelar_palavra") {
      if (!p) return;
      corpo.numero = p.numero;
      corpo.direcao = p.direcao;
    }
    if (tipo === "revelar_letra") corpo.celula = sel();
    props.ajuda(tipo, corpo);
    entrada?.focus();
  }

  return (
    <>
      {/* Dica da palavra selecionada */}
      <Show when={palavraAtual() && !props.bloqueado}>
        <div
          style={{
            padding: "12px 16px",
            "border-radius": "12px",
            background: "var(--callju-accent-soft)",
            border: "1px solid var(--callju-accent-line)",
            "font-size": "0.98em",
            "line-height": "1.4",
          }}
        >
          <b style={{ color: "var(--callju-accent)" }}>
            {palavraAtual()!.numero}{" "}
            {palavraAtual()!.direcao === "H" ? "Horizontal" : "Vertical"}
          </b>
          {" · "}
          {palavraAtual()!.dica}
          <span style={{ opacity: "0.5" }}> ({palavraAtual()!.tamanho} letras)</span>
        </div>
      </Show>

      <div
        style={{
          display: "flex",
          "flex-wrap": "wrap",
          gap: "20px",
          "align-items": "flex-start",
          "justify-content": "center",
        }}
      >
        {/* Grade */}
        <div style={{ position: "relative", width: "min(460px, 94vw)" }}>
          <input
            ref={entrada}
            aria-label="Digite as letras da cruzada"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck={false}
            inputmode="text"
            onKeyDown={aoTeclar}
            onInput={aoDigitarNoCelular}
            style={{
              position: "absolute",
              opacity: "0",
              width: "1px",
              height: "1px",
              top: "0",
              left: "0",
              "pointer-events": "none",
            }}
          />
          <div
            style={{
              display: "grid",
              "grid-template-columns": `repeat(${props.grade.tamanho}, 1fr)`,
              gap: "3px",
            }}
          >
            <For each={Array.from({ length: props.grade.tamanho ** 2 }, (_, i) => i)}>
              {(i) => {
                const n = props.grade.tamanho;
                const r = Math.floor(i / n);
                const c = i % n;

                const minha = () => !props.bloqueado && sel()[0] === r && sel()[1] === c;
                const naPalavra = () => !props.bloqueado && naPalavraAtual(r, c);
                const errada = () => props.erradas.has(chave(r, c));
                const revelada = () => props.reveladas.has(chave(r, c));
                const outro = () => cursoresDosOutros().get(chave(r, c));
                const letra = () => props.letras[r]?.[c] ?? "";
                const autor = () => (letra() ? props.corDaCasa?.(r, c) : undefined);

                return (
                  <Show when={aberta(r, c)} fallback={<div style={{ "aspect-ratio": "1" }} />}>
                    <div
                      onClick={() => tocarCasa(r, c)}
                      title={outro()?.nome}
                      style={{
                        position: "relative",
                        "aspect-ratio": "1",
                        display: "grid",
                        "place-items": "center",
                        "border-radius": "6px",
                        cursor: props.bloqueado ? "default" : "pointer",
                        "user-select": "none",
                        "font-weight": "750",
                        "font-size": "clamp(13px, 3.9vw, 22px)",
                        transition: "background 120ms ease, box-shadow 120ms ease",
                        color: errada()
                          ? "#ff7a66"
                          : minha()
                            ? "#fff"
                            : revelada()
                              ? "var(--callju-accent)"
                              : "var(--md-sys-color-on-surface)",
                        background: minha()
                          ? "var(--callju-grad)"
                          : errada()
                            ? "rgba(255, 90, 70, 0.14)"
                            : naPalavra()
                              ? "var(--callju-accent-soft)"
                              : "var(--md-sys-color-surface-container-high)",
                        border: naPalavra()
                          ? "1px solid var(--callju-accent-line)"
                          : "1px solid var(--md-sys-color-outline-variant)",
                        "box-shadow":
                          outro() && !minha() ? `inset 0 0 0 2px ${outro()!.cor}` : undefined,
                      }}
                    >
                      <Show when={props.grade.numeros[r][c]}>
                        <span
                          style={{
                            position: "absolute",
                            top: "1px",
                            left: "3px",
                            "font-size": "0.42em",
                            "font-weight": "600",
                            opacity: "0.75",
                          }}
                        >
                          {props.grade.numeros[r][c]}
                        </span>
                      </Show>
                      {letra()}
                      <Show when={autor()}>
                        <span
                          style={{
                            position: "absolute",
                            left: "25%",
                            right: "25%",
                            bottom: "3px",
                            height: "2px",
                            "border-radius": "2px",
                            background: autor(),
                          }}
                        />
                      </Show>
                    </div>
                  </Show>
                );
              }}
            </For>
          </div>

          <Show when={props.aviso || avisoLocal()}>
            <p
              style={{
                margin: "10px 0 0",
                "font-size": "0.88em",
                "text-align": "center",
                opacity: "0.85",
              }}
            >
              {props.aviso || avisoLocal()}
            </p>
          </Show>

          <Show when={!props.bloqueado}>
            <div
              style={{
                display: "flex",
                "flex-direction": "column",
                "align-items": "center",
                gap: "10px",
                "margin-top": "14px",
              }}
            >
              {/* Checar: conferir o que ja foi escrito */}
              <div
                style={{
                  display: "flex",
                  "flex-wrap": "wrap",
                  gap: "6px",
                  "justify-content": "center",
                }}
              >
                <button
                  class="callju-btn"
                  onClick={finalizar}
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "6px",
                    padding: "9px 16px",
                    "font-size": "0.9em",
                  }}
                >
                  <Symbol size={18}>task_alt</Symbol>
                  Finalizei, checar
                </button>
                <button
                  onClick={() => pedirAjuda("checar_palavra")}
                  style={{ ...botaoSecundario, display: "flex", "align-items": "center", gap: "5px" }}
                >
                  <Symbol size={16} color={COR_CHECAR}>
                    fact_check
                  </Symbol>
                  Checar palavra
                </button>
              </div>

              {/* Ajuda: entregar resposta */}
              <div
                style={{
                  display: "flex",
                  "flex-wrap": "wrap",
                  gap: "6px",
                  "justify-content": "center",
                  "align-items": "center",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    "align-items": "center",
                    gap: "3px",
                    "font-size": "0.7em",
                    "text-transform": "uppercase",
                    "letter-spacing": "0.12em",
                    color: COR_REVELAR,
                  }}
                >
                  <Symbol size={14} color={COR_REVELAR}>
                    lightbulb
                  </Symbol>
                  Ajuda
                </span>
                <button style={botaoRevelar} onClick={() => pedirAjuda("revelar_letra")}>
                  Revelar letra
                </button>
                <button style={botaoRevelar} onClick={() => pedirAjuda("revelar_palavra")}>
                  Revelar palavra
                </button>
              </div>
            </div>
            <p
              style={{
                margin: "8px 0 0",
                "font-size": "0.75em",
                "text-align": "center",
                opacity: "0.45",
              }}
            >
              {props.textoAjuda}
            </p>
          </Show>
        </div>

        {/* Dicas */}
        <div
          style={{
            flex: "1 1 260px",
            "max-width": "340px",
            display: "flex",
            "flex-direction": "column",
            gap: "14px",
          }}
        >
          <For each={["H", "V"] as Direcao[]}>
            {(sentido) => (
              <div>
                <div
                  style={{
                    "font-size": "0.72em",
                    "text-transform": "uppercase",
                    "letter-spacing": "0.12em",
                    opacity: "0.5",
                    "margin-bottom": "6px",
                  }}
                >
                  {sentido === "H" ? "Horizontais" : "Verticais"}
                </div>
                <For each={ordenadas().filter((d) => d.direcao === sentido)}>
                  {(d) => (
                    <button
                      onClick={() => escolherDica(d)}
                      style={{
                        display: "flex",
                        gap: "8px",
                        width: "100%",
                        "text-align": "start",
                        padding: "6px 8px",
                        "border-radius": "8px",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--md-sys-color-on-surface)",
                        "font-size": "0.88em",
                        "line-height": "1.35",
                        background:
                          palavraAtual() === d && !props.bloqueado
                            ? "var(--callju-accent-soft)"
                            : "transparent",
                        opacity: casasDe(d).every(([a, b]) => props.letras[a]?.[b]) ? "0.5" : "1",
                      }}
                    >
                      <b style={{ "min-width": "18px", color: "var(--callju-accent)" }}>
                        {d.numero}
                      </b>
                      <span>{d.dica}</span>
                    </button>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>
    </>
  );
}

function avisoDeChecagem(total: number) {
  return total === 0
    ? "Tudo certo até aqui."
    : total === 1
      ? "1 letra errada, marcada em vermelho."
      : `${total} letras erradas, marcadas em vermelho.`;
}

const colunaDoJogo = {
  width: "100%",
  "max-width": "800px",
  display: "flex",
  "flex-direction": "column",
  gap: "16px",
} as const;

function Relogio(props: { texto: string; terminou: boolean }) {
  return (
    <span
      style={{
        "font-variant-numeric": "tabular-nums",
        "font-size": "1.3em",
        "font-weight": "750",
        color: props.terminou ? "var(--callju-accent)" : undefined,
      }}
    >
      {props.texto}
    </span>
  );
}

function BotaoVoltar(props: { texto: string; onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      style={{ ...botaoSecundario, display: "flex", "align-items": "center", gap: "4px" }}
    >
      <Symbol size={18}>arrow_back</Symbol>
      {props.texto}
    </button>
  );
}

function CartaoFinal(props: { titulo: string; texto: string; acao: string; aoClicar: () => void }) {
  return (
    <div
      style={{
        ...cartao,
        "max-width": "none",
        "text-align": "center",
        border: "1px solid var(--callju-accent-line)",
        background: "var(--callju-accent-soft)",
      }}
    >
      <div style={{ "font-size": "1.2em", "font-weight": "750" }}>{props.titulo}</div>
      <div style={{ opacity: "0.7", "margin-top": "4px", "font-size": "0.92em" }}>
        {props.texto}
      </div>
      <button
        class="callju-btn"
        onClick={props.aoClicar}
        style={{ "margin-top": "14px", padding: "10px 22px" }}
      >
        {props.acao}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cruzada do dia sozinho                                              */
/* ------------------------------------------------------------------ */

type RespostaHoje = Estado & { data: string; agora_ms: number; grade: Grade };

type RespostaAjuda = Estado & {
  erradas?: Casa[];
  reveladas?: [number, number, string][];
};

function Cruzada(props: {
  nivel: Nivel;
  chamar: Api;
  aoTerminar: () => void;
  voltar: () => void;
  irParaEquipe: (id: string) => void;
}) {
  // O nivel nao muda durante a partida: guardado uma vez so
  const nivel = props.nivel;

  const [grade, setGrade] = createSignal<Grade>();
  const [data, setData] = createSignal("");
  const [letras, setLetras] = createSignal<string[][]>([]);
  const [erradas, setErradas] = createSignal<Set<string>>(new Set());
  const [reveladas, setReveladas] = createSignal<Set<string>>(new Set());
  const [ajudas, setAjudas] = createSignal<RegistroAjuda[]>([]);
  const [grau, setGrau] = createSignal(0);

  function aplicarAjudas(e: Estado) {
    setAjudas(e.ajudas ?? []);
    setGrau(e.grau_ajuda ?? (e.ajuda ? 2 : 0));
  }
  const [inicio, setInicio] = createSignal(0);
  const [desvio, setDesvio] = createSignal(0);
  const [agora, setAgora] = createSignal(Date.now());
  const [terminou, setTerminou] = createSignal<number>();
  const [aviso, setAviso] = createSignal("");
  const [enviando, setEnviando] = createSignal(false);

  const relogio = setInterval(() => setAgora(Date.now()), 250);
  onCleanup(() => clearInterval(relogio));

  const chaveLocal = (d: string) => `callju-cruzada-${nivel}-${d}`;

  function guardar() {
    try {
      localStorage.setItem(chaveLocal(data()), JSON.stringify(letras()));
    } catch {
      // Sem armazenamento local, so perde o progresso ao recarregar
    }
  }

  onMount(async () => {
    try {
      const r = await props.chamar<RespostaHoje>(`/cruzada/hoje?nivel=${nivel}`);
      const n = r.grade.tamanho;

      let salvas: string[][] | null = null;
      try {
        salvas = JSON.parse(localStorage.getItem(chaveLocal(r.data)) ?? "null");
      } catch {
        salvas = null;
      }

      setData(r.data);
      aplicarAjudas(r);
      setInicio(r.inicio_ms ?? Date.now());
      // O relogio do servidor manda: o desvio corrige o do computador
      setDesvio(r.agora_ms - Date.now());
      if (r.terminou) setTerminou(r.tempo_ms ?? 0);
      setLetras(
        salvas && salvas.length === n
          ? salvas
          : Array.from({ length: n }, () => Array<string>(n).fill("")),
      );
      setGrade(r.grade);
    } catch (err) {
      const equipe =
        err instanceof ErroApi ? (err.dados.equipe as { id: string } | undefined) : undefined;
      if (equipe) props.irParaEquipe(equipe.id);
      else setAviso("Não consegui abrir a grade de hoje. Volta e tenta de novo.");
    }
  });

  function escrever(r: number, c: number, letra: string) {
    setLetras((atual) => {
      const copia = atual.map((linha) => [...linha]);
      copia[r][c] = letra;
      return copia;
    });
    setErradas((e) => {
      if (!e.has(chave(r, c))) return e;
      const novo = new Set(e);
      novo.delete(chave(r, c));
      return novo;
    });
    setAviso("");
    guardar();
    conferirSeCompleta();
  }

  async function conferirSeCompleta() {
    const g = grade();
    if (!g || enviando() || terminou() !== undefined) return;

    const cheia = g.abertas.every((linha, r) =>
      linha.every((ab, c) => !ab || !!letras()[r]?.[c]),
    );
    if (!cheia) return;

    setEnviando(true);
    try {
      const r = await props.chamar<Estado & { certa: boolean }>("/cruzada/enviar", {
        nivel,
        letras: letras(),
      });
      if (r.certa) {
        setTerminou(r.tempo_ms ?? 0);
        aplicarAjudas(r);
        props.aoTerminar();
      } else {
        setAviso("A grade está cheia, mas tem letra errada. Aperta Finalizei, checar pra ver onde.");
      }
    } catch {
      setAviso("Não consegui enviar. Confere a conexão e digita de novo.");
    } finally {
      setEnviando(false);
    }
  }

  async function pedirAjuda(tipo: TipoAjuda, corpo: Record<string, unknown>) {
    try {
      // Finalizei, checar com a grade ja certa: termina sem contar checagem
      if (tipo === "checar_grade") {
        const envio = await props.chamar<Estado & { certa: boolean }>("/cruzada/enviar", {
          nivel,
          letras: letras(),
        });
        if (envio.certa) {
          setTerminou(envio.tempo_ms ?? 0);
          aplicarAjudas(envio);
          props.aoTerminar();
          return;
        }
      }

      const resp = await props.chamar<RespostaAjuda>("/cruzada/ajuda", {
        nivel,
        tipo,
        letras: letras(),
        ...corpo,
      });
      aplicarAjudas(resp);

      if (resp.erradas) {
        setErradas(new Set(resp.erradas.map(([a, b]) => chave(a, b))));
        setAviso(avisoDeChecagem(resp.erradas.length));
      }

      if (resp.reveladas) {
        setLetras((atual) => {
          const copia = atual.map((linha) => [...linha]);
          for (const [a, b, l] of resp.reveladas!) copia[a][b] = l;
          return copia;
        });
        setReveladas((s) => {
          const novo = new Set(s);
          for (const [a, b] of resp.reveladas!) novo.add(chave(a, b));
          return novo;
        });
        guardar();
        conferirSeCompleta();
      }
    } catch {
      setAviso("Não consegui pedir ajuda agora.");
    }
  }

  const tempoNaTela = () =>
    terminou() !== undefined
      ? formataTempo(terminou()!)
      : formataTempo(agora() + desvio() - inicio());

  return (
    <div style={colunaDoJogo}>
      <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
        <BotaoVoltar texto="Palavras cruzadas" onClick={props.voltar} />
        <span style={{ ...selo, "font-weight": "700" }}>{NIVEL_INFO[nivel].nome}</span>
        <div style={{ flex: "1" }} />
        <SeloAjudas ajudas={ajudas()} grau={grau()} />
        <Relogio texto={tempoNaTela()} terminou={terminou() !== undefined} />
      </div>

      <Show when={terminou() !== undefined}>
        <CartaoFinal
          titulo={`Terminou a ${NIVEL_INFO[nivel].nome} em ${formataTempo(terminou()!)}!`}
          texto={resumoFinal(ajudas(), grau())}
          acao="Ver o ranking"
          aoClicar={props.voltar}
        />
      </Show>

      <Show when={!grade() && aviso()}>
        <p style={{ "text-align": "center", opacity: "0.8" }}>{aviso()}</p>
      </Show>

      <Show when={grade()}>
        <Tabuleiro
          grade={grade()!}
          letras={letras()}
          bloqueado={terminou() !== undefined}
          erradas={erradas()}
          reveladas={reveladas()}
          aviso={aviso()}
          textoAjuda="Checar e revelar ficam marcados no ranking: primeiro vem quem não usou nada, depois quem só checou, depois quem revelou. Espaço vira a direção, Tab pula de palavra."
          escrever={(r, c, l) => escrever(r, c, l)}
          ajuda={pedirAjuda}
        />
      </Show>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sala em tempo real: equipe do dia ou cruzada em grupo               */
/* ------------------------------------------------------------------ */

function SalaEmGrupo(props: { id: string; chamar: Api; voltar: () => void }) {
  const client = useClient();

  const [foto, setFoto] = createSignal<FotoSala>();
  const [letras, setLetras] = createSignal<string[][]>([]);
  const [conectado, setConectado] = createSignal(false);
  const [erroFatal, setErroFatal] = createSignal("");
  const [aviso, setAviso] = createSignal("");
  const [copiado, setCopiado] = createSignal(false);
  const [desvio, setDesvio] = createSignal(0);
  const [agora, setAgora] = createSignal(Date.now());

  const eu = () => client().user?.id;
  const linkConvite = () => `${location.origin}/minigames/sala/${props.id}`;

  // A grade de uma sala nunca muda depois que aparece. Sem isso, cada foto
  // nova recriaria o tabuleiro inteiro.
  const grade = createMemo(() => foto()?.grade ?? undefined, undefined, {
    equals: (a, b) => !!a === !!b,
  });

  const relogio = setInterval(() => setAgora(Date.now()), 250);
  onCleanup(() => clearInterval(relogio));

  /* ---- Letras digitadas aqui que o servidor ainda nao confirmou ---- */
  const pendentes = new Map<string, { letra: string; t: number }>();

  let nivelGuardado = false;

  function receber(f: FotoSala) {
    setDesvio(f.agora_ms - Date.now());
    setFoto(f);
    // Voltando da sala, a tela das cruzadas abre no nivel dela
    if (!nivelGuardado) {
      nivelGuardado = true;
      salvarNivel(f.sala.nivel);
    }
    if (!f.letras) return;

    // A foto pode ter saido antes da ultima letra digitada chegar la. Por
    // um instante, a letra local vale mais que a do servidor.
    const base = f.letras.map((l) => [...l]);
    const agoraMs = Date.now();
    for (const [k, p] of pendentes) {
      const [r, c] = k.split(",").map(Number);
      if (base[r]?.[c] === p.letra || agoraMs - p.t > 2500) pendentes.delete(k);
      else base[r][c] = p.letra;
    }
    setLetras(base);
  }

  /* ---- Envio em fila, pra letras chegarem na ordem digitada ---- */
  let fila: Promise<unknown> = Promise.resolve();

  function enviar<T>(acao: string, corpo: unknown): Promise<T | undefined> {
    const vez = fila.then(() =>
      props.chamar<T>(`/grupo/sala/${props.id}/${acao}`, corpo),
    );
    fila = vez.catch(() => undefined);
    return vez;
  }

  let timerCursor: ReturnType<typeof setTimeout> | undefined;

  function escrever(r: number, c: number, letra: string, cursor: Casa, direcao: Direcao) {
    setLetras((atual) => {
      const copia = atual.map((linha) => [...linha]);
      copia[r][c] = letra;
      return copia;
    });
    pendentes.set(chave(r, c), { letra, t: Date.now() });
    clearTimeout(timerCursor);
    setAviso("");
    enviar("letra", { celula: [r, c], letra, cursor, direcao }).catch(() =>
      setAviso("Uma letra não chegou no servidor. Confere a conexão."),
    );
  }

  function moverCursor(cursor: Casa, direcao: Direcao) {
    clearTimeout(timerCursor);
    timerCursor = setTimeout(
      () => enviar("cursor", { cursor, direcao }).catch(() => undefined),
      300,
    );
  }
  onCleanup(() => clearTimeout(timerCursor));

  async function pedirAjuda(tipo: TipoAjuda, corpo: Record<string, unknown>) {
    try {
      const r = await enviar<{ erradas?: Casa[] }>("ajuda", { tipo, ...corpo });
      if (r?.erradas) setAviso(avisoDeChecagem(r.erradas.length));
    } catch {
      setAviso("Não consegui pedir ajuda agora.");
    }
  }

  /* ---- Conexao em tempo real ---- */
  let vivo = true;
  let atual: AbortController | undefined;
  let ultimaMensagem = Date.now();

  async function conectar() {
    let tentativas = 0;

    while (vivo) {
      try {
        const [cabecalho, token] = client().authenticationHeader;
        atual = new AbortController();
        const resposta = await fetch(`/jogos/grupo/sala/${props.id}/eventos`, {
          headers: { [cabecalho]: token },
          signal: atual.signal,
        });

        if (resposta.status === 403 || resposta.status === 404) {
          const dados = await resposta.json().catch(() => ({}));
          setErroFatal(dados.erro ?? "Não deu pra entrar nessa sala.");
          return;
        }
        if (!resposta.ok || !resposta.body) throw new Error();

        setConectado(true);
        tentativas = 0;
        ultimaMensagem = Date.now();

        const leitor = resposta.body.pipeThrough(new TextDecoderStream()).getReader();
        let buffer = "";
        for (;;) {
          const { value, done } = await leitor.read();
          if (done) break;
          ultimaMensagem = Date.now();
          buffer += value;
          let fim: number;
          while ((fim = buffer.indexOf("\n\n")) >= 0) {
            const bloco = buffer.slice(0, fim);
            buffer = buffer.slice(fim + 2);
            const dados = bloco
              .split("\n")
              .filter((l) => l.startsWith("data: "))
              .map((l) => l.slice(6))
              .join("\n");
            if (dados) receber(JSON.parse(dados));
          }
        }
      } catch {
        // Cai pra reconexao logo abaixo
      }

      setConectado(false);
      if (!vivo) return;
      await new Promise((ok) => setTimeout(ok, Math.min(1000 * 2 ** tentativas++, 10000)));
    }
  }

  onMount(conectar);

  // O servidor manda um ping a cada 15 s. Silencio longo e conexao morta que
  // o navegador ainda nao percebeu: derruba pra reconectar.
  const vigia = setInterval(() => {
    if (conectado() && Date.now() - ultimaMensagem > 40000) atual?.abort();
  }, 10000);

  onCleanup(() => {
    vivo = false;
    clearInterval(vigia);
    atual?.abort();
  });

  /* ---- Derivados pra tela ---- */
  const sala = () => foto()?.sala;
  const terminou = () => sala()?.tempo_ms != null;
  const pessoas = () => foto()?.pessoas ?? [];
  const outros = createMemo(() => pessoas().filter((p) => p.id !== eu()));
  const corDe = createMemo(() => new Map(pessoas().map((p) => [p.id, p.cor])));
  const erradas = createMemo(() => new Set((foto()?.erradas ?? []).map(([a, b]) => chave(a, b))));
  const reveladas = createMemo(
    () => new Set((foto()?.reveladas ?? []).map(([a, b]) => chave(a, b))),
  );
  const nomeNivel = () => (sala() ? NIVEL_INFO[sala()!.nivel].nome : "");

  const tempoNaTela = () => {
    const s = sala();
    if (!s?.comecou) return "0:00";
    if (s.tempo_ms != null) return formataTempo(s.tempo_ms);
    return formataTempo(agora() + desvio() - (s.inicio_ms ?? 0));
  };

  const avisoDaTela = () =>
    aviso() ||
    (sala()?.cheia_errada ? "A grade está cheia, mas tem letra errada. Aperta Finalizei, checar pra ver onde." : "");

  async function copiarConvite() {
    try {
      await navigator.clipboard.writeText(linkConvite());
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setAviso("Não consegui copiar. Seleciona o link e copia na mão.");
    }
  }

  return (
    <div style={colunaDoJogo}>
      <div style={{ display: "flex", "align-items": "center", gap: "12px", "flex-wrap": "wrap" }}>
        <BotaoVoltar texto="Palavras cruzadas" onClick={props.voltar} />
        <div style={{ flex: "1", "min-width": "0" }}>
          <Show when={sala()}>
            <div
              style={{
                "font-weight": "700",
                overflow: "hidden",
                "text-overflow": "ellipsis",
                "white-space": "nowrap",
              }}
            >
              {sala()!.tipo === "equipe" ? `Equipe ${sala()!.nome}` : sala()!.nome}
            </div>
            <div style={{ "font-size": "0.78em", opacity: "0.55" }}>
              {sala()!.tipo === "equipe"
                ? `cruzada do dia · ${nomeNivel()} · vale ranking`
                : `em grupo · ${nomeNivel()} · fora do ranking`}
            </div>
          </Show>
        </div>
        <Show when={foto() && !conectado() && !erroFatal()}>
          <span style={selo}>reconectando…</span>
        </Show>
        <Show when={sala()}>
          <SeloAjudas ajudas={sala()!.ajudas ?? []} grau={sala()!.grau_ajuda ?? 0} />
        </Show>
        <Relogio texto={tempoNaTela()} terminou={terminou()} />
      </div>

      <Show when={erroFatal()}>
        <CartaoFinal
          titulo="Não deu pra entrar"
          texto={erroFatal()}
          acao="Voltar pras palavras cruzadas"
          aoClicar={props.voltar}
        />
      </Show>

      <Show when={!foto() && !erroFatal()}>
        <p style={{ "text-align": "center", opacity: "0.6" }}>Entrando na sala…</p>
      </Show>

      <Show when={foto() && !erroFatal()}>
        {/* Quem esta na sala */}
        <div
          style={{
            display: "flex",
            "flex-wrap": "wrap",
            gap: "8px",
            "align-items": "center",
          }}
        >
          <For each={pessoas()}>
            {(p) => (
              <span
                style={{
                  display: "inline-flex",
                  "align-items": "center",
                  gap: "8px",
                  padding: "4px 10px 4px 4px",
                  "border-radius": "99px",
                  background: "var(--md-sys-color-surface-container-high)",
                  opacity: p.online ? "1" : "0.5",
                  "font-size": "0.85em",
                }}
              >
                <Foto id={p.id} nome={p.nome} tamanho={24} cor={p.cor} />
                <span style={{ "font-weight": p.id === eu() ? "700" : "500" }}>
                  {p.id === eu() ? "você" : p.nome}
                </span>
                <Show when={sala()!.comecou}>
                  <span style={{ opacity: "0.55", "font-variant-numeric": "tabular-nums" }}>
                    {p.letras}
                  </span>
                </Show>
              </span>
            )}
          </For>
          <div style={{ flex: "1" }} />
          <Show when={!terminou()}>
            <button
              onClick={copiarConvite}
              style={{ ...botaoSecundario, display: "flex", "align-items": "center", gap: "6px" }}
            >
              <Symbol size={18}>{copiado() ? "check" : "link"}</Symbol>
              {copiado() ? "Link copiado" : "Copiar convite"}
            </button>
          </Show>
        </div>

        {/* Equipe esperando a galera */}
        <Show when={!sala()!.comecou}>
          <div style={{ ...cartao, "max-width": "none" }}>
            <TituloCartao
              icone="groups"
              titulo={`Equipe ${sala()!.nome}`}
              subtitulo={`${nomeNivel()} de hoje · ${pessoas().length} de ${sala()!.vagas ?? 5} pessoas`}
            />
            <p style={paragrafo}>
              Manda o link no chat pra chamar a galera. A grade só aparece e o
              relógio só começa quando alguém apertar Começar. Quem entra na
              equipe não joga a {nomeNivel()} de hoje sozinho.
            </p>
            <input
              readOnly
              value={linkConvite()}
              onFocus={(e) => e.currentTarget.select()}
              style={{ ...campoTexto, "margin-bottom": "10px", "font-size": "0.88em" }}
            />
            <button
              class="callju-btn"
              onClick={() => enviar("comecar", {}).catch(() => setAviso("Não consegui começar."))}
              style={botaoPrincipal}
            >
              Começar
            </button>
            <Show when={aviso()}>
              <p style={{ margin: "10px 0 0", "font-size": "0.88em", "text-align": "center" }}>
                {aviso()}
              </p>
            </Show>
          </div>
        </Show>

        <Show when={terminou()}>
          <CartaoFinal
            titulo={`Terminaram em ${formataTempo(sala()!.tempo_ms!)}!`}
            texto={
              sala()!.tipo === "equipe"
                ? `Entrou no ranking de equipes da ${nomeNivel()}. ${resumoFinal(sala()!.ajudas ?? [], sala()!.grau_ajuda ?? 0)}`
                : `Grade fechada em grupo. ${resumoFinal(sala()!.ajudas ?? [], sala()!.grau_ajuda ?? 0)}`
            }
            acao={sala()!.tipo === "equipe" ? "Ver o ranking" : "Voltar pras palavras cruzadas"}
            aoClicar={props.voltar}
          />
          <Show when={sala()!.ajudas?.length}>
            <div style={{ ...cartao, "max-width": "none", padding: "14px 8px 4px" }}>
              <div style={{ "font-weight": "700", padding: "0 12px", "font-size": "0.92em" }}>
                Quando cada um pediu ajuda
              </div>
              <LinhaDoTempoAjudas ajudas={sala()!.ajudas} tempo_ms={sala()!.tempo_ms ?? 0} />
            </div>
          </Show>
        </Show>

        <Show when={grade()}>
          <Tabuleiro
            grade={grade()!}
            letras={letras()}
            bloqueado={terminou()}
            erradas={erradas()}
            reveladas={reveladas()}
            aviso={avisoDaTela()}
            textoAjuda={
              sala()!.tipo === "equipe"
                ? "Checar e revelar valem pra equipe inteira e ficam marcados no ranking, com o nome de quem usou. Espaço vira a direção, Tab pula de palavra."
                : "Checagens e revelações aparecem pra todo mundo da sala. Espaço vira a direção, Tab pula de palavra."
            }
            corDaCasa={(r, c) => {
              const autor = foto()?.autores?.[r]?.[c];
              return autor ? corDe().get(autor) : undefined;
            }}
            outros={outros()}
            escrever={escrever}
            aoMover={moverCursor}
            ajuda={pedirAjuda}
          />
        </Show>
      </Show>
    </div>
  );
}
