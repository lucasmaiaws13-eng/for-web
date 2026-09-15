import {
  For,
  Show,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
} from "solid-js";

import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Header, main } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { HeaderIcon } from "./common/CommonHeader";

/* ------------------------------------------------------------------ */
/* Tipos que vem do servico callju-jogos                               */
/* ------------------------------------------------------------------ */

type Direcao = "H" | "V";

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
  iniciou: boolean;
  terminou: boolean;
  inicio_ms?: number;
  tempo_ms?: number | null;
  ajuda: boolean;
};

type LinhaRanking = {
  nome: string;
  tempo_ms: number;
  ajuda: boolean;
  eu: boolean;
};

type Ranking = { terminaram: LinhaRanking[]; jogando: number };

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

/**
 * Chamada ao servico dos minigames.
 *
 * Quem a pessoa e nao sai daqui: o token de sessao vai no cabecalho e o
 * servico pergunta a propria API do Stoat.
 */
function useApi() {
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
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    return resposta.json();
  };
}

/* ------------------------------------------------------------------ */
/* Pagina                                                              */
/* ------------------------------------------------------------------ */

export function MinigamesPage() {
  const chamar = useApi();

  const [status, setStatus] = createSignal<Estado>();
  const [ranking, setRanking] = createSignal<Ranking>();
  const [jogando, setJogando] = createSignal(false);
  const [erro, setErro] = createSignal("");

  async function atualizar() {
    try {
      const [s, r] = await Promise.all([
        chamar<Estado>("/cruzada/status"),
        chamar<Ranking>("/cruzada/ranking"),
      ]);
      setStatus(s);
      setRanking(r);
      setErro("");
    } catch {
      setErro(
        "Não consegui falar com o servidor dos minigames. Tenta de novo daqui a pouco.",
      );
    }
  }

  onMount(atualizar);

  // O ranking muda enquanto os outros jogam. Atualiza sozinho de tempos em
  // tempos, mas so na tela de espera: no meio do jogo nao faz falta.
  const intervalo = setInterval(() => {
    if (!jogando()) atualizar();
  }, 30000);
  onCleanup(() => clearInterval(intervalo));

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
          when={!jogando()}
          fallback={
            <Cruzada
              chamar={chamar}
              aoTerminar={atualizar}
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

          <div style={cartao}>
            <div
              style={{
                display: "flex",
                "align-items": "center",
                gap: "14px",
              }}
            >
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
                <Symbol size={26}>grid_on</Symbol>
              </div>

              <div style={{ "min-width": "0" }}>
                <div
                  style={{
                    "font-size": "1.15em",
                    "font-weight": "750",
                    "letter-spacing": "-0.01em",
                  }}
                >
                  Palavras cruzadas do dia
                </div>
                <div style={{ opacity: "0.55", "font-size": "0.85em" }}>
                  <Show when={status()} fallback="Carregando…">
                    {dataPorExtenso(status()!.data)} · 7x7 · a mesma pra todo
                    mundo
                  </Show>
                </div>
              </div>
            </div>

            <Show when={status()}>
              <p
                style={{
                  margin: "16px 0",
                  "line-height": "1.55",
                  opacity: "0.8",
                  "font-size": "0.92em",
                }}
              >
                <Show
                  when={status()!.terminou}
                  fallback={
                    status()!.iniciou
                      ? "Você já começou a de hoje. O relógio continua correndo."
                      : "O seu tempo começa a contar quando você abrir a grade. Ajuda é liberada, mas fica marcada no ranking."
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
                <button
                  class="callju-btn"
                  onClick={() => setJogando(true)}
                  style={{
                    width: "100%",
                    padding: "13px",
                    "font-size": "1em",
                  }}
                >
                  {status()!.iniciou ? "Continuar" : "Jogar"}
                </button>
              </Show>
            </Show>
          </div>

          <PainelRanking dados={ranking()} />

          <p
            style={{
              opacity: "0.4",
              "font-size": "0.82em",
              "text-align": "center",
              margin: "0",
            }}
          >
            Em breve: modo colaborativo, todo mundo preenchendo a mesma grade
            ao mesmo tempo.
          </p>
        </Show>
      </div>
    </Base>
  );
}

/* ------------------------------------------------------------------ */
/* Ranking                                                             */
/* ------------------------------------------------------------------ */

function PainelRanking(props: { dados?: Ranking }) {
  const medalha = (i: number) => ["🥇", "🥈", "🥉"][i] ?? `${i + 1}º`;

  return (
    <div style={cartao}>
      <div
        style={{
          "font-weight": "700",
          "margin-bottom": "12px",
          display: "flex",
          "align-items": "center",
          gap: "8px",
        }}
      >
        <Symbol size={20} color="var(--callju-accent)">
          leaderboard
        </Symbol>
        Ranking de hoje
      </div>

      <Show
        when={props.dados}
        fallback={<p style={{ opacity: "0.5", margin: "0" }}>Carregando…</p>}
      >
        <Show
          when={props.dados!.terminaram.length}
          fallback={
            <p style={{ opacity: "0.55", margin: "0", "font-size": "0.92em" }}>
              Ninguém terminou ainda. O primeiro lugar está livre.
            </p>
          }
        >
          <div style={{ display: "flex", "flex-direction": "column", gap: "4px" }}>
            <For each={props.dados!.terminaram}>
              {(linha, i) => (
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "10px",
                    padding: "9px 12px",
                    "border-radius": "10px",
                    background: linha.eu
                      ? "var(--callju-accent-soft)"
                      : "transparent",
                    border: linha.eu
                      ? "1px solid var(--callju-accent-line)"
                      : "1px solid transparent",
                  }}
                >
                  <span style={{ width: "30px", "text-align": "center" }}>
                    {medalha(i())}
                  </span>
                  <span
                    style={{
                      flex: "1",
                      "min-width": "0",
                      overflow: "hidden",
                      "text-overflow": "ellipsis",
                      "white-space": "nowrap",
                      "font-weight": linha.eu ? "700" : "500",
                    }}
                  >
                    {linha.nome}
                    {linha.eu ? " (você)" : ""}
                  </span>
                  <Show when={linha.ajuda}>
                    <span
                      title="Usou alguma ajuda nesta grade"
                      style={{
                        "font-size": "0.72em",
                        padding: "2px 8px",
                        "border-radius": "99px",
                        background: "var(--md-sys-color-surface-variant)",
                        opacity: "0.8",
                      }}
                    >
                      ajuda
                    </span>
                  </Show>
                  <span
                    style={{
                      "font-variant-numeric": "tabular-nums",
                      "font-weight": "700",
                    }}
                  >
                    {formataTempo(linha.tempo_ms)}
                  </span>
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* O jogo                                                              */
/* ------------------------------------------------------------------ */

type Api = <T>(caminho: string, corpo?: unknown) => Promise<T>;

type RespostaHoje = Estado & { agora_ms: number; grade: Grade };

type RespostaAjuda = Estado & {
  erradas?: [number, number][];
  reveladas?: [number, number, string][];
};

function Cruzada(props: { chamar: Api; aoTerminar: () => void; voltar: () => void }) {
  const [grade, setGrade] = createSignal<Grade>();
  const [data, setData] = createSignal("");
  const [letras, setLetras] = createSignal<string[][]>([]);
  const [sel, setSel] = createSignal<[number, number]>([0, 0]);
  const [dir, setDir] = createSignal<Direcao>("H");
  const [erradas, setErradas] = createSignal<Set<string>>(new Set());
  const [reveladas, setReveladas] = createSignal<Set<string>>(new Set());
  const [ajuda, setAjuda] = createSignal(false);
  const [inicio, setInicio] = createSignal(0);
  const [desvio, setDesvio] = createSignal(0);
  const [agora, setAgora] = createSignal(Date.now());
  const [terminou, setTerminou] = createSignal<number>();
  const [aviso, setAviso] = createSignal("");
  const [enviando, setEnviando] = createSignal(false);

  let entrada: HTMLInputElement | undefined;

  const relogio = setInterval(() => setAgora(Date.now()), 250);
  onCleanup(() => clearInterval(relogio));

  const chaveLocal = () => `callju-cruzada-${data()}`;

  function guardar() {
    try {
      localStorage.setItem(chaveLocal(), JSON.stringify(letras()));
    } catch {
      // Sem armazenamento local, so perde o progresso ao recarregar
    }
  }

  onMount(async () => {
    try {
      const r = await props.chamar<RespostaHoje>("/cruzada/hoje");
      const n = r.grade.tamanho;

      setGrade(r.grade);
      setData(r.data);
      setAjuda(r.ajuda);
      setInicio(r.inicio_ms ?? Date.now());
      // O relogio do servidor manda: o desvio corrige o do computador
      setDesvio(r.agora_ms - Date.now());
      if (r.terminou) setTerminou(r.tempo_ms ?? 0);

      let salvas: string[][] | null = null;
      try {
        salvas = JSON.parse(localStorage.getItem(`callju-cruzada-${r.data}`) ?? "null");
      } catch {
        salvas = null;
      }
      setLetras(
        salvas && salvas.length === n
          ? salvas
          : Array.from({ length: n }, () => Array<string>(n).fill("")),
      );

      const primeira = r.grade.dicas.find((d) => d.direcao === "H") ?? r.grade.dicas[0];
      setSel([primeira.linha, primeira.coluna]);
      setDir(primeira.direcao);
      entrada?.focus();
    } catch {
      setAviso("Não consegui abrir a grade de hoje. Volta e tenta de novo.");
    }
  });

  const casas = (d: Dica): [number, number][] =>
    Array.from({ length: d.tamanho }, (_, i) =>
      d.direcao === "H" ? [d.linha, d.coluna + i] : [d.linha + i, d.coluna],
    );

  const aberta = (r: number, c: number) => !!grade()?.abertas[r]?.[c];

  const palavraEm = (r: number, c: number, direcao: Direcao) =>
    grade()?.dicas.find(
      (d) => d.direcao === direcao && casas(d).some(([a, b]) => a === r && b === c),
    );

  const outra = (d: Direcao): Direcao => (d === "H" ? "V" : "H");

  const palavraAtual = createMemo(() => {
    const [r, c] = sel();
    return palavraEm(r, c, dir()) ?? palavraEm(r, c, outra(dir()));
  });

  const naPalavraAtual = (r: number, c: number) => {
    const p = palavraAtual();
    return !!p && casas(p).some(([a, b]) => a === r && b === c);
  };

  function tocarCasa(r: number, c: number) {
    if (!aberta(r, c) || terminou() !== undefined) return;
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
    if (terminou() !== undefined) return;
    setDir(d.direcao);
    const vazia = casas(d).find(([a, b]) => !letras()[a]?.[b]);
    setSel(vazia ?? [d.linha, d.coluna]);
    entrada?.focus();
  }

  function escrever(r: number, c: number, letra: string) {
    setLetras((atual) => {
      const copia = atual.map((linha) => [...linha]);
      copia[r][c] = letra;
      return copia;
    });
    setErradas((e) => {
      if (!e.has(`${r},${c}`)) return e;
      const n = new Set(e);
      n.delete(`${r},${c}`);
      return n;
    });
    setAviso("");
    guardar();
  }

  function andarNaPalavra(passo: 1 | -1) {
    const p = palavraAtual();
    if (!p) return;
    const lista = casas(p);
    const [r, c] = sel();
    const i = lista.findIndex(([a, b]) => a === r && b === c);
    const j = i + passo;
    if (j >= 0 && j < lista.length) setSel(lista[j]);
  }

  function mover(dr: number, dc: number) {
    const g = grade();
    if (!g) return;
    let [r, c] = sel();
    for (let k = 0; k < g.tamanho; k++) {
      r += dr;
      c += dc;
      if (r < 0 || c < 0 || r >= g.tamanho || c >= g.tamanho) return;
      if (aberta(r, c)) {
        setSel([r, c]);
        if (!palavraEm(r, c, dir())) setDir(outra(dir()));
        return;
      }
    }
  }

  function proximaPalavra(passo: 1 | -1) {
    const g = grade();
    const p = palavraAtual();
    if (!g || !p) return;
    const ordem = [...g.dicas].sort((a, b) =>
      a.direcao === b.direcao ? a.numero - b.numero : a.direcao === "H" ? -1 : 1,
    );
    const i = ordem.indexOf(p);
    escolherDica(ordem[(i + passo + ordem.length) % ordem.length]);
  }

  function digitar(letra: string) {
    const [r, c] = sel();
    escrever(r, c, letra);
    andarNaPalavra(1);
    conferirSeCompleta();
  }

  function aoTeclar(e: KeyboardEvent) {
    if (terminou() !== undefined) return;
    const [r, c] = sel();

    if (e.key === "Backspace") {
      e.preventDefault();
      if (letras()[r]?.[c]) {
        escrever(r, c, "");
      } else {
        andarNaPalavra(-1);
        const [r2, c2] = sel();
        escrever(r2, c2, "");
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
    if (letra && terminou() === undefined) digitar(letra);
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

  async function pedirAjuda(
    tipo: "checar_palavra" | "checar_grade" | "revelar_letra" | "revelar_palavra",
  ) {
    const p = palavraAtual();
    const [r, c] = sel();
    const corpo: Record<string, unknown> = { tipo, letras: letras() };

    if (tipo === "checar_palavra" || tipo === "revelar_palavra") {
      if (!p) return;
      corpo.numero = p.numero;
      corpo.direcao = p.direcao;
    }
    if (tipo === "revelar_letra") corpo.celula = [r, c];

    try {
      const resp = await props.chamar<RespostaAjuda>("/cruzada/ajuda", corpo);
      setAjuda(true);

      if (resp.erradas) {
        setErradas(new Set(resp.erradas.map(([a, b]) => `${a},${b}`)));
        const total = resp.erradas.length;
        setAviso(
          total === 0
            ? "Tudo certo até aqui."
            : total === 1
              ? "1 letra errada, marcada em vermelho."
              : `${total} letras erradas, marcadas em vermelho.`,
        );
      }

      if (resp.reveladas) {
        setLetras((atual) => {
          const copia = atual.map((linha) => [...linha]);
          for (const [a, b, l] of resp.reveladas!) copia[a][b] = l;
          return copia;
        });
        setReveladas((s) => {
          const n = new Set(s);
          for (const [a, b] of resp.reveladas!) n.add(`${a},${b}`);
          return n;
        });
        guardar();
        conferirSeCompleta();
      }
    } catch {
      setAviso("Não consegui pedir ajuda agora.");
    }
    entrada?.focus();
  }

  const tempoNaTela = () =>
    terminou() !== undefined
      ? formataTempo(terminou()!)
      : formataTempo(agora() + desvio() - inicio());

  const botaoAjuda = {
    padding: "8px 12px",
    "font-size": "0.82em",
    "border-radius": "99px",
    cursor: "pointer",
    color: "var(--md-sys-color-on-surface)",
    background: "var(--md-sys-color-surface-container-high)",
    border: "1px solid var(--md-sys-color-outline-variant)",
  } as const;

  return (
    <div
      style={{
        width: "100%",
        "max-width": "760px",
        display: "flex",
        "flex-direction": "column",
        gap: "16px",
      }}
    >
      {/* Topo: voltar, relogio e selo de ajuda */}
      <div style={{ display: "flex", "align-items": "center", gap: "12px" }}>
        <button
          onClick={props.voltar}
          style={{ ...botaoAjuda, display: "flex", "align-items": "center", gap: "4px" }}
        >
          <Symbol size={18}>arrow_back</Symbol>
          Minigames
        </button>
        <div style={{ flex: "1" }} />
        <Show when={ajuda()}>
          <span
            title="Usar ajuda fica marcado no ranking"
            style={{
              "font-size": "0.75em",
              padding: "3px 10px",
              "border-radius": "99px",
              background: "var(--md-sys-color-surface-variant)",
            }}
          >
            usou ajuda
          </span>
        </Show>
        <span
          style={{
            "font-variant-numeric": "tabular-nums",
            "font-size": "1.3em",
            "font-weight": "750",
            color: terminou() !== undefined ? "var(--callju-accent)" : undefined,
          }}
        >
          {tempoNaTela()}
        </span>
      </div>

      <Show when={terminou() !== undefined}>
        <div
          style={{
            ...cartao,
            "max-width": "none",
            "text-align": "center",
            border: "1px solid var(--callju-accent-line)",
            background: "var(--callju-accent-soft)",
          }}
        >
          <div style={{ "font-size": "1.2em", "font-weight": "750" }}>
            Terminou em {formataTempo(terminou()!)}!
          </div>
          <div style={{ opacity: "0.7", "margin-top": "4px", "font-size": "0.92em" }}>
            {ajuda() ? "Com ajuda, fica o selo no ranking." : "Sem ajuda nenhuma. Bonito."}
          </div>
          <button
            class="callju-btn"
            onClick={props.voltar}
            style={{ "margin-top": "14px", padding: "10px 22px" }}
          >
            Ver o ranking
          </button>
        </div>
      </Show>

      {/* Dica da palavra selecionada */}
      <Show when={palavraAtual() && terminou() === undefined}>
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
            {palavraAtual()!.numero} {palavraAtual()!.direcao === "H" ? "Horizontal" : "Vertical"}
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
        <Show when={grade()}>
          <div style={{ position: "relative", width: "min(400px, 92vw)" }}>
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
                "grid-template-columns": `repeat(${grade()!.tamanho}, 1fr)`,
                gap: "4px",
              }}
            >
              <For each={Array.from({ length: grade()!.tamanho ** 2 }, (_, i) => i)}>
                {(i) => {
                  const n = grade()!.tamanho;
                  const r = Math.floor(i / n);
                  const c = i % n;

                  return (
                    <Show
                      when={aberta(r, c)}
                      fallback={<div style={{ "aspect-ratio": "1" }} />}
                    >
                      <div
                        onClick={() => tocarCasa(r, c)}
                        style={{
                          position: "relative",
                          "aspect-ratio": "1",
                          display: "grid",
                          "place-items": "center",
                          "border-radius": "7px",
                          cursor: "pointer",
                          "user-select": "none",
                          "font-weight": "750",
                          "font-size": "clamp(15px, 4.6vw, 24px)",
                          transition: "background 120ms ease",
                          color: erradas().has(`${r},${c}`)
                            ? "#ff7a66"
                            : sel()[0] === r && sel()[1] === c && terminou() === undefined
                              ? "#fff"
                              : reveladas().has(`${r},${c}`)
                                ? "var(--callju-accent)"
                                : "var(--md-sys-color-on-surface)",
                          background:
                            sel()[0] === r && sel()[1] === c && terminou() === undefined
                              ? "var(--callju-grad)"
                              : erradas().has(`${r},${c}`)
                                ? "rgba(255, 90, 70, 0.14)"
                                : naPalavraAtual(r, c) && terminou() === undefined
                                  ? "var(--callju-accent-soft)"
                                  : "var(--md-sys-color-surface-container-high)",
                          border:
                            naPalavraAtual(r, c) && terminou() === undefined
                              ? "1px solid var(--callju-accent-line)"
                              : "1px solid var(--md-sys-color-outline-variant)",
                        }}
                      >
                        <Show when={grade()!.numeros[r][c]}>
                          <span
                            style={{
                              position: "absolute",
                              top: "2px",
                              left: "4px",
                              "font-size": "0.45em",
                              "font-weight": "600",
                              opacity: "0.75",
                            }}
                          >
                            {grade()!.numeros[r][c]}
                          </span>
                        </Show>
                        {letras()[r]?.[c] ?? ""}
                      </div>
                    </Show>
                  );
                }}
              </For>
            </div>

            <Show when={aviso()}>
              <p
                style={{
                  margin: "10px 0 0",
                  "font-size": "0.88em",
                  "text-align": "center",
                  opacity: "0.85",
                }}
              >
                {aviso()}
              </p>
            </Show>

            <Show when={terminou() === undefined}>
              <div
                style={{
                  display: "flex",
                  "flex-wrap": "wrap",
                  gap: "6px",
                  "justify-content": "center",
                  "margin-top": "12px",
                }}
              >
                <button style={botaoAjuda} onClick={() => pedirAjuda("checar_palavra")}>
                  Checar palavra
                </button>
                <button style={botaoAjuda} onClick={() => pedirAjuda("checar_grade")}>
                  Checar tudo
                </button>
                <button style={botaoAjuda} onClick={() => pedirAjuda("revelar_letra")}>
                  Revelar letra
                </button>
                <button style={botaoAjuda} onClick={() => pedirAjuda("revelar_palavra")}>
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
                Qualquer ajuda fica marcada no ranking. Espaço vira a direção, Tab
                pula de palavra.
              </p>
            </Show>
          </div>
        </Show>

        {/* Dicas */}
        <Show when={grade()}>
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
                  <For
                    each={grade()!
                      .dicas.filter((d) => d.direcao === sentido)
                      .sort((a, b) => a.numero - b.numero)}
                  >
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
                            palavraAtual() === d && terminou() === undefined
                              ? "var(--callju-accent-soft)"
                              : "transparent",
                          opacity: casas(d).every(([a, b]) => letras()[a]?.[b]) ? "0.5" : "1",
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
        </Show>
      </div>
    </div>
  );
}
