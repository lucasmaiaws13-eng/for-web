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
import { useNavigate, useParams } from "@revolt/routing";
import { Avatar, Header, main } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { HeaderIcon } from "./common/CommonHeader";

/* ------------------------------------------------------------------ */
/* Tipos que vem do servico callju-jogos                               */
/* ------------------------------------------------------------------ */

type Direcao = "H" | "V";
type Casa = [number, number];

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
  data: string;
  tamanho: number;
  iniciou: boolean;
  terminou: boolean;
  inicio_ms?: number;
  tempo_ms?: number | null;
  ajuda: boolean;
  equipe: { id: string; nome: string } | null;
};

type LinhaRanking = {
  id: string;
  nome: string;
  tempo_ms: number;
  ajuda: boolean;
  eu: boolean;
};

type Membro = { id: string; nome: string };

type LinhaEquipe = {
  id: string;
  nome: string;
  membros: Membro[];
  tempo_ms: number;
  ajuda: boolean;
  eu: boolean;
};

type Ranking = {
  terminaram: LinhaRanking[];
  jogando: number;
  equipes: LinhaEquipe[];
  equipes_jogando: number;
};

type ResumoSala = {
  id: string;
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
    nome: string;
    data: string | null;
    dono: string;
    comecou: boolean;
    inicio_ms: number | null;
    tempo_ms: number | null;
    cheia_errada: boolean;
    ajuda: boolean;
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

const cartao = {
  width: "100%",
  "max-width": "560px",
  padding: "20px",
  "border-radius": "16px",
  background: "var(--md-sys-color-surface-container-high)",
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

/* ------------------------------------------------------------------ */
/* Pagina                                                              */
/* ------------------------------------------------------------------ */

export function MinigamesPage() {
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const chamar = useApi();

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
        <Show when={params.id} keyed fallback={<Inicio chamar={chamar} />}>
          {(id) => (
            <SalaEmGrupo
              id={id}
              chamar={chamar}
              voltar={() => navigate("/minigames")}
            />
          )}
        </Show>
      </div>
    </Base>
  );
}

/* ------------------------------------------------------------------ */
/* Tela inicial: cruzada do dia, ranking e salas em grupo              */
/* ------------------------------------------------------------------ */

function Inicio(props: { chamar: Api }) {
  const navigate = useNavigate();

  const [status, setStatus] = createSignal<Estado>();
  const [ranking, setRanking] = createSignal<Ranking>();
  const [salas, setSalas] = createSignal<ResumoSala[]>();
  const [jogando, setJogando] = createSignal(false);
  const [erro, setErro] = createSignal("");

  const [montandoEquipe, setMontandoEquipe] = createSignal(false);
  const [nomeEquipe, setNomeEquipe] = createSignal("");
  const [erroEquipe, setErroEquipe] = createSignal("");
  const [ocupado, setOcupado] = createSignal(false);

  async function atualizar() {
    try {
      const [s, r, g] = await Promise.all([
        props.chamar<Estado>("/cruzada/status"),
        props.chamar<Ranking>("/cruzada/ranking"),
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
      <Show when={erro()}>
        <div style={{ ...cartao, color: "#ff8a7a" }}>{erro()}</div>
      </Show>

      {/* Cruzada do dia */}
      <div style={cartao}>
        <TituloCartao
          icone="grid_on"
          titulo="Palavras cruzadas do dia"
          subtitulo={
            status()
              ? `${dataPorExtenso(status()!.data)} · ${status()!.tamanho}x${status()!.tamanho} · a mesma pra todo mundo`
              : "Carregando…"
          }
        />

        <Show when={status()}>
          <Show
            when={!status()!.equipe}
            fallback={
              <>
                <p style={paragrafo}>
                  Hoje você joga na equipe{" "}
                  <b style={{ color: "var(--callju-accent)" }}>
                    {status()!.equipe!.nome}
                  </b>
                  .
                </p>
                <button
                  class="callju-btn"
                  onClick={() => navigate(`/minigames/sala/${status()!.equipe!.id}`)}
                  style={botaoPrincipal}
                >
                  Abrir a equipe
                </button>
              </>
            }
          >
            <p style={paragrafo}>
              <Show
                when={status()!.terminou}
                fallback={
                  status()!.iniciou
                    ? "Você já começou a de hoje. O relógio continua correndo."
                    : "O relógio começa quando a grade abre. Dá pra jogar sozinho ou numa equipe de até 5 pessoas, mas é um ou outro por dia. Ajuda é liberada e fica marcada no ranking."
                }
              >
                Você terminou a de hoje em{" "}
                <b style={{ color: "var(--callju-accent)" }}>
                  {formataTempo(status()!.tempo_ms ?? 0)}
                </b>
                {status()!.ajuda ? ", usando ajuda." : ", sem ajuda nenhuma."}{" "}
                Amanhã tem outra.
              </Show>
            </p>

            <Show when={!status()!.terminou}>
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
                    <p style={{ ...paragrafo, margin: "0", "font-size": "0.82em", opacity: "0.6" }}>
                      Depois é só mandar o link da equipe no chat. O relógio só
                      começa quando alguém da equipe apertar Começar.
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
                    {status()!.iniciou ? "Continuar" : "Jogar sozinho"}
                  </button>
                  <Show when={!status()!.iniciou}>
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

      <PainelRanking dados={ranking()} />

      {/* Cruzada em grupo, fora do ranking */}
      <div style={cartao}>
        <TituloCartao
          icone="edit_note"
          titulo="Cruzada em grupo"
          subtitulo="fora do ranking · grade diferente da do dia"
        />
        <p style={paragrafo}>
          Todo mundo preenchendo a mesma grade ao mesmo tempo, vendo o cursor e
          as letras de cada um na hora.
        </p>

        <Show when={salas()?.length}>
          <div
            style={{
              display: "flex",
              "flex-direction": "column",
              gap: "6px",
              "margin-bottom": "14px",
            }}
          >
            <For each={salas()!.slice(0, 6)}>
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

function PainelRanking(props: { dados?: Ranking }) {
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
        <span style={{ "font-weight": "700", flex: "1" }}>Ranking de hoje</span>
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
                {(l, i) => (
                  <div style={linha(l.eu)}>
                    <span style={{ width: "26px", "text-align": "center" }}>
                      {medalha(i())}
                    </span>
                    <Foto id={l.id} nome={l.nome} tamanho={28} />
                    <span style={nome(l.eu)}>
                      {l.nome}
                      {l.eu ? " (você)" : ""}
                    </span>
                    <Show when={l.ajuda}>
                      <span title="Usou alguma ajuda nesta grade" style={selo}>
                        ajuda
                      </span>
                    </Show>
                    <span style={tempo}>{formataTempo(l.tempo_ms)}</span>
                  </div>
                )}
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
                {(eq, i) => (
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
                    <Show when={eq.ajuda}>
                      <span title="A equipe usou alguma ajuda" style={selo}>
                        ajuda
                      </span>
                    </Show>
                    <span style={tempo}>{formataTempo(eq.tempo_ms)}</span>
                  </div>
                )}
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

  function gravar(r: number, c: number, letra: string, cursor: Casa) {
    // Letra revelada ja e a certa: fica travada
    if (props.reveladas.has(chave(r, c))) return;
    props.escrever(r, c, letra, cursor, dir());
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

          <Show when={props.aviso}>
            <p
              style={{
                margin: "10px 0 0",
                "font-size": "0.88em",
                "text-align": "center",
                opacity: "0.85",
              }}
            >
              {props.aviso}
            </p>
          </Show>

          <Show when={!props.bloqueado}>
            <div
              style={{
                display: "flex",
                "flex-wrap": "wrap",
                gap: "6px",
                "justify-content": "center",
                "margin-top": "12px",
              }}
            >
              <button style={botaoSecundario} onClick={() => pedirAjuda("checar_palavra")}>
                Checar palavra
              </button>
              <button style={botaoSecundario} onClick={() => pedirAjuda("checar_grade")}>
                Checar tudo
              </button>
              <button style={botaoSecundario} onClick={() => pedirAjuda("revelar_letra")}>
                Revelar letra
              </button>
              <button style={botaoSecundario} onClick={() => pedirAjuda("revelar_palavra")}>
                Revelar palavra
              </button>
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

function BotaoVoltar(props: { onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      style={{ ...botaoSecundario, display: "flex", "align-items": "center", gap: "4px" }}
    >
      <Symbol size={18}>arrow_back</Symbol>
      Minigames
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Cruzada do dia sozinho                                              */
/* ------------------------------------------------------------------ */

type RespostaHoje = Estado & { agora_ms: number; grade: Grade };

type RespostaAjuda = Estado & {
  erradas?: Casa[];
  reveladas?: [number, number, string][];
};

function Cruzada(props: {
  chamar: Api;
  aoTerminar: () => void;
  voltar: () => void;
  irParaEquipe: (id: string) => void;
}) {
  const [grade, setGrade] = createSignal<Grade>();
  const [data, setData] = createSignal("");
  const [letras, setLetras] = createSignal<string[][]>([]);
  const [erradas, setErradas] = createSignal<Set<string>>(new Set());
  const [reveladas, setReveladas] = createSignal<Set<string>>(new Set());
  const [ajuda, setAjuda] = createSignal(false);
  const [inicio, setInicio] = createSignal(0);
  const [desvio, setDesvio] = createSignal(0);
  const [agora, setAgora] = createSignal(Date.now());
  const [terminou, setTerminou] = createSignal<number>();
  const [aviso, setAviso] = createSignal("");
  const [enviando, setEnviando] = createSignal(false);

  const relogio = setInterval(() => setAgora(Date.now()), 250);
  onCleanup(() => clearInterval(relogio));

  function guardar() {
    try {
      localStorage.setItem(`callju-cruzada-${data()}`, JSON.stringify(letras()));
    } catch {
      // Sem armazenamento local, so perde o progresso ao recarregar
    }
  }

  onMount(async () => {
    try {
      const r = await props.chamar<RespostaHoje>("/cruzada/hoje");
      const n = r.grade.tamanho;

      let salvas: string[][] | null = null;
      try {
        salvas = JSON.parse(localStorage.getItem(`callju-cruzada-${r.data}`) ?? "null");
      } catch {
        salvas = null;
      }

      setData(r.data);
      setAjuda(r.ajuda);
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
      const equipe = err instanceof ErroApi ? (err.dados.equipe as { id: string } | undefined) : undefined;
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
        letras: letras(),
      });
      if (r.certa) {
        setTerminou(r.tempo_ms ?? 0);
        setAjuda(r.ajuda);
        props.aoTerminar();
      } else {
        setAviso("A grade está cheia, mas tem letra errada em algum lugar.");
      }
    } catch {
      setAviso("Não consegui enviar. Confere a conexão e digita de novo.");
    } finally {
      setEnviando(false);
    }
  }

  async function pedirAjuda(tipo: TipoAjuda, corpo: Record<string, unknown>) {
    try {
      const resp = await props.chamar<RespostaAjuda>("/cruzada/ajuda", {
        tipo,
        letras: letras(),
        ...corpo,
      });
      setAjuda(true);

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
        <BotaoVoltar onClick={props.voltar} />
        <div style={{ flex: "1" }} />
        <Show when={ajuda()}>
          <span title="Usar ajuda fica marcado no ranking" style={selo}>
            usou ajuda
          </span>
        </Show>
        <Relogio texto={tempoNaTela()} terminou={terminou() !== undefined} />
      </div>

      <Show when={terminou() !== undefined}>
        <CartaoFinal
          titulo={`Terminou em ${formataTempo(terminou()!)}!`}
          texto={ajuda() ? "Com ajuda, fica o selo no ranking." : "Sem ajuda nenhuma. Bonito."}
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
          textoAjuda="Qualquer ajuda fica marcada no ranking. Espaço vira a direção, Tab pula de palavra."
          escrever={(r, c, l) => escrever(r, c, l)}
          ajuda={pedirAjuda}
        />
      </Show>
    </div>
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

  function receber(f: FotoSala) {
    setDesvio(f.agora_ms - Date.now());
    setFoto(f);
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

  const tempoNaTela = () => {
    const s = sala();
    if (!s?.comecou) return "0:00";
    if (s.tempo_ms != null) return formataTempo(s.tempo_ms);
    return formataTempo(agora() + desvio() - (s.inicio_ms ?? 0));
  };

  const avisoDaTela = () =>
    aviso() ||
    (sala()?.cheia_errada ? "A grade está cheia, mas tem letra errada em algum lugar." : "");

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
        <BotaoVoltar onClick={props.voltar} />
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
              {sala()!.tipo === "equipe" ? "cruzada do dia · vale ranking" : "em grupo · fora do ranking"}
            </div>
          </Show>
        </div>
        <Show when={foto() && !conectado() && !erroFatal()}>
          <span style={selo}>reconectando…</span>
        </Show>
        <Show when={sala()?.ajuda}>
          <span title="A sala usou alguma ajuda" style={selo}>
            usou ajuda
          </span>
        </Show>
        <Relogio texto={tempoNaTela()} terminou={terminou()} />
      </div>

      <Show when={erroFatal()}>
        <CartaoFinal
          titulo="Não deu pra entrar"
          texto={erroFatal()}
          acao="Voltar pros minigames"
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
              subtitulo={`${pessoas().length} de ${sala()!.vagas ?? 5} pessoas`}
            />
            <p style={paragrafo}>
              Manda o link no chat pra chamar a galera. A grade só aparece e o
              relógio só começa quando alguém apertar Começar. Quem entra na
              equipe não joga a de hoje sozinho.
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
                ? sala()!.ajuda
                  ? "Entrou no ranking de equipes, com o selo de ajuda."
                  : "Entrou no ranking de equipes, sem ajuda nenhuma."
                : "Grade fechada em grupo."
            }
            acao={sala()!.tipo === "equipe" ? "Ver o ranking" : "Voltar pros minigames"}
            aoClicar={props.voltar}
          />
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
                ? "Ajuda vale pra equipe inteira e fica marcada no ranking. Espaço vira a direção, Tab pula de palavra."
                : "Ajuda aparece pra todo mundo da sala. Espaço vira a direção, Tab pula de palavra."
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
