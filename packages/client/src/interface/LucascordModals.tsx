import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";

/**
 * Modais do Lucascord: guia em carrossel e pagina de apoio via Pix.
 *
 * Escrito com estilos inline de proposito: nao depende do codegen do Panda,
 * entao continua funcionando mesmo se a build de estilos mudar.
 * As cores saem das variaveis do tema, entao funciona no claro e no escuro.
 */

/* ------------------------------------------------------------------ */
/* Base compartilhada                                                  */
/* ------------------------------------------------------------------ */

function Overlay(props: {
  aberto: boolean;
  fechar: () => void;
  children: any;
  largura?: string;
}) {
  // Esc fecha
  createEffect(() => {
    if (!props.aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.fechar();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  return (
    <Show when={props.aberto}>
      <div
        onClick={props.fechar}
        style={{
          position: "fixed",
          inset: "0",
          "z-index": "9999",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          padding: "20px",
          background: "rgba(0, 0, 0, 0.62)",
          "backdrop-filter": "blur(6px)",
          "-webkit-backdrop-filter": "blur(6px)",
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            "max-width": props.largura ?? "440px",
            "max-height": "88vh",
            overflow: "auto",
            padding: "26px 24px 20px",
            "border-radius": "18px",
            color: "var(--md-sys-color-on-surface)",
            background: "var(--md-sys-color-surface-container-high)",
            "box-shadow": "0 24px 60px rgba(0, 0, 0, 0.45)",
            border: "1px solid rgba(255, 255, 255, 0.07)",
          }}
        >
          {props.children}
        </div>
      </div>
    </Show>
  );
}

function BotaoFechar(props: { onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      aria-label="Fechar"
      style={{
        border: "none",
        background: "transparent",
        color: "var(--md-sys-color-on-surface)",
        opacity: "0.5",
        "font-size": "1.5em",
        "line-height": "1",
        cursor: "pointer",
        padding: "0 4px",
      }}
    >
      &times;
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Guia em carrossel                                                   */
/* ------------------------------------------------------------------ */

const PASSOS = [
  {
    emoji: "👋",
    titulo: "Bem-vindo ao Lucascord",
    texto:
      "É o nosso canto pra jogar e conversar: voz em alta qualidade, tela em 1080p e servidor aqui no Brasil. Sem anúncio, sem limite artificial.",
  },
  {
    emoji: "🚪",
    titulo: "Entrar no servidor",
    texto:
      "Use o botão no fim deste guia ou o primeiro cartão da tela inicial. Você entra na hora, sem precisar pedir autorização.",
  },
  {
    emoji: "🎙️",
    titulo: "Conversar por voz",
    texto:
      "Clique num canal com ícone de alto-falante e pronto — você já está na call. Não precisa ligar pra ninguém nem esperar atender.",
  },
  {
    emoji: "🖥️",
    titulo: "Compartilhar a tela",
    texto:
      "Já dentro do canal de voz, use o botão de tela na barra de controles. Dá pra escolher a tela inteira ou só uma janela, com ou sem o áudio do jogo.",
  },
  {
    emoji: "🎧",
    titulo: "Se o microfone estiver ruim",
    texto:
      "Configurações → Áudio. Dica que resolve 90% dos casos: se você usa fone Bluetooth, escolha o microfone do notebook. O Bluetooth derruba a qualidade do som dos dois lados ao mesmo tempo.",
  },
  {
    emoji: "📱",
    titulo: "Instalar como aplicativo",
    texto:
      "No Chrome, abra o menu e escolha 'Instalar'. Fica com cara de programa de verdade, sem barra de navegador.",
  },
];

export function GuiaModal(props: {
  aberto: boolean;
  fechar: () => void;
  mostrarBotaoServidor: boolean;
  entrarNoServidor: () => void;
}) {
  const [i, setI] = createSignal(0);
  const ultimo = () => i() === PASSOS.length - 1;

  // volta pro inicio toda vez que reabrir
  createEffect(() => {
    if (props.aberto) setI(0);
  });

  const anterior = () => setI((v) => Math.max(0, v - 1));
  const proximo = () => setI((v) => Math.min(PASSOS.length - 1, v + 1));

  // navegacao por teclado
  createEffect(() => {
    if (!props.aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") anterior();
      if (e.key === "ArrowRight") proximo();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  // swipe no celular
  let toqueX = 0;
  const inicioToque = (e: TouchEvent) => (toqueX = e.touches[0].clientX);
  const fimToque = (e: TouchEvent) => {
    const d = e.changedTouches[0].clientX - toqueX;
    if (Math.abs(d) < 45) return;
    d < 0 ? proximo() : anterior();
  };

  return (
    <Overlay aberto={props.aberto} fechar={props.fechar} largura="440px">
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
          "margin-bottom": "4px",
        }}
      >
        <span
          style={{
            "font-size": "0.75em",
            "letter-spacing": "0.18em",
            "text-transform": "uppercase",
            opacity: "0.45",
          }}
        >
          Guia rápido &middot; {i() + 1} de {PASSOS.length}
        </span>
        <BotaoFechar onClick={props.fechar} />
      </div>

      <div
        onTouchStart={inicioToque}
        onTouchEnd={fimToque}
        style={{ "min-height": "230px", "padding-top": "10px" }}
      >
        <div style={{ "font-size": "2.6em", "line-height": "1" }}>
          {PASSOS[i()].emoji}
        </div>
        <h2
          style={{
            "font-size": "1.35em",
            "font-weight": "800",
            margin: "12px 0 8px",
            "letter-spacing": "-0.01em",
          }}
        >
          {PASSOS[i()].titulo}
        </h2>
        <p style={{ "line-height": "1.6", opacity: "0.8", margin: "0" }}>
          {PASSOS[i()].texto}
        </p>
      </div>

      {/* bolinhas de progresso */}
      <div
        style={{
          display: "flex",
          gap: "7px",
          "justify-content": "center",
          margin: "18px 0 16px",
        }}
      >
        <For each={PASSOS}>
          {(_, idx) => (
            <button
              onClick={() => setI(idx())}
              aria-label={`Ir para o passo ${idx() + 1}`}
              style={{
                width: idx() === i() ? "22px" : "8px",
                height: "8px",
                padding: "0",
                border: "none",
                cursor: "pointer",
                "border-radius": "99px",
                transition: "width 160ms ease, background 160ms ease",
                background:
                  idx() === i()
                    ? "var(--md-sys-color-primary)"
                    : "var(--md-sys-color-outline)",
              }}
            />
          )}
        </For>
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={anterior}
          disabled={i() === 0}
          style={{
            flex: "0 0 auto",
            padding: "11px 18px",
            "border-radius": "99px",
            border: "none",
            cursor: i() === 0 ? "default" : "pointer",
            opacity: i() === 0 ? "0.3" : "1",
            color: "var(--md-sys-color-on-surface)",
            background: "var(--md-sys-color-surface-variant)",
            "font-size": "0.95em",
          }}
        >
          Voltar
        </button>

        <Show
          when={ultimo() && props.mostrarBotaoServidor}
          fallback={
            <button
              onClick={ultimo() ? props.fechar : proximo}
              style={{
                flex: "1",
                padding: "11px 18px",
                "border-radius": "99px",
                border: "none",
                cursor: "pointer",
                "font-weight": "600",
                color: "var(--md-sys-color-on-primary)",
                background: "var(--md-sys-color-primary)",
                "font-size": "0.95em",
              }}
            >
              {ultimo() ? "Fechar" : "Próximo"}
            </button>
          }
        >
          <button
            onClick={() => {
              props.fechar();
              props.entrarNoServidor();
            }}
            style={{
              flex: "1",
              padding: "11px 18px",
              "border-radius": "99px",
              border: "none",
              cursor: "pointer",
              "font-weight": "600",
              color: "var(--md-sys-color-on-primary)",
              background: "var(--md-sys-color-primary)",
              "font-size": "0.95em",
            }}
          >
            Entrar no servidor &rarr;
          </button>
        </Show>
      </div>
    </Overlay>
  );
}

/* ------------------------------------------------------------------ */
/* Modal do Pix                                                        */
/* ------------------------------------------------------------------ */

export function PixModal(props: {
  aberto: boolean;
  fechar: () => void;
  chave: string;
}) {
  const [copiado, setCopiado] = createSignal(false);

  createEffect(() => {
    if (props.aberto) setCopiado(false);
  });

  const copiar = () => {
    navigator.clipboard
      ?.writeText(props.chave)
      .then(() => setCopiado(true))
      .catch(() => setCopiado(false));
  };

  return (
    <Overlay aberto={props.aberto} fechar={props.fechar} largura="400px">
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
        }}
      >
        <span style={{ "font-size": "1.9em", "line-height": "1" }}>💜</span>
        <BotaoFechar onClick={props.fechar} />
      </div>

      <h2
        style={{
          "font-size": "1.3em",
          "font-weight": "800",
          margin: "12px 0 8px",
        }}
      >
        Me ajude a manter isso no ar
      </h2>

      <p style={{ "line-height": "1.6", opacity: "0.8", margin: "0 0 18px" }}>
        O Lucascord roda num servidor pago aqui em São Paulo, com custo todo
        mês. Se o app te serve e você puder ajudar, faz diferença de verdade —
        e qualquer valor conta.
      </p>

      <div
        style={{
          padding: "13px 15px",
          "border-radius": "10px",
          background: "var(--md-sys-color-surface-variant)",
          "font-family": "ui-monospace, monospace",
          "font-size": "0.95em",
          "word-break": "break-all",
          "margin-bottom": "12px",
        }}
      >
        {props.chave}
      </div>

      <button
        onClick={copiar}
        style={{
          width: "100%",
          padding: "12px",
          "border-radius": "99px",
          border: "none",
          cursor: "pointer",
          "font-weight": "600",
          "font-size": "0.98em",
          color: copiado()
            ? "var(--md-sys-color-on-surface)"
            : "var(--md-sys-color-on-primary)",
          background: copiado()
            ? "var(--md-sys-color-surface-variant)"
            : "var(--md-sys-color-primary)",
          transition: "background 160ms ease",
        }}
      >
        {copiado() ? "Copiado! Valeu demais ❤️" : "Copiar chave Pix"}
      </button>

      <p
        style={{
          "text-align": "center",
          opacity: "0.45",
          "font-size": "0.85em",
          margin: "14px 0 0",
        }}
      >
        Sem pressão nenhuma — o servidor continua de pé de qualquer jeito.
      </p>
    </Overlay>
  );
}
