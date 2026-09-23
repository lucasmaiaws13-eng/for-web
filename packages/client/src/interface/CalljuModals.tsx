import { For, Show, createEffect, createSignal, onCleanup } from "solid-js";

import { Symbol } from "@revolt/ui/components/utils/Symbol";

/**
 * Modais do Callju: guia em carrossel e apoio via Pix.
 *
 * Estilos inline de proposito, sem depender do codegen do Panda.
 * As animacoes vivem em src/index.css e usam apenas transform,
 * opacity e filter, que o navegador resolve na GPU.
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
        class="callju-fade"
        onClick={props.fechar}
        style={{
          position: "fixed",
          inset: "0",
          "z-index": "9999",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          padding: "20px",
          background: "rgba(0, 0, 0, 0.64)",
          "backdrop-filter": "blur(8px)",
          "-webkit-backdrop-filter": "blur(8px)",
        }}
      >
        <div
          class="callju-rise"
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            "max-width": props.largura ?? "440px",
            "max-height": "88vh",
            overflow: "auto",
            padding: "24px 24px 20px",
            "border-radius": "22px",
            color: "var(--md-sys-color-on-surface)",
            // Vidro, como o resto do app. O contorno laranja em volta de cada
            // pop-up deixava tudo com cara de aviso de erro.
            background: "rgba(22, 22, 26, 0.86)",
            "backdrop-filter": "blur(22px) saturate(1.2)",
            "-webkit-backdrop-filter": "blur(22px) saturate(1.2)",
            "box-shadow":
              "inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 28px 70px rgba(0, 0, 0, 0.55)",
            border: "1px solid rgba(255, 255, 255, 0.09)",
          }}
        >
          {props.children}
        </div>
      </div>
    </Show>
  );
}

/**
 * Selo do icone no topo do pop-up.
 *
 * Pop-up so de texto nao diz do que se trata antes de a pessoa ler. O selo com
 * o icone entrega o assunto num olhar, e usa o degrade da marca, o mesmo dos
 * botoes principais.
 */
function SeloDoModal(props: { icone: string }) {
  return (
    <span
      style={{
        width: "44px",
        height: "44px",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        "border-radius": "14px",
        color: "#fff",
        background: "var(--callju-grad)",
        "box-shadow": "0 6px 18px rgba(0, 0, 0, 0.4)",
      }}
    >
      <Symbol size={24}>{props.icone}</Symbol>
    </span>
  );
}

function BotaoFechar(props: { onClick: () => void }) {
  return (
    <button
      onClick={props.onClick}
      aria-label="Fechar"
      class="callju-btn-ghost"
      style={{
        width: "32px",
        height: "32px",
        padding: "0",
        display: "flex",
        "align-items": "center",
        "justify-content": "center",
        "border-radius": "99px",
        background: "rgba(255, 255, 255, 0.05)",
        color: "var(--md-sys-color-on-surface-variant)",
      }}
    >
      <Symbol size={18}>close</Symbol>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Guia em carrossel                                                   */
/* ------------------------------------------------------------------ */

const PASSOS = [
  {
    icone: "waving_hand",
    titulo: "Bem-vindo ao Callju",
    texto:
      "É o nosso canto pra jogar e conversar. Voz em alta qualidade, tela em 1080p, sem anúncio e sem limite artificial de nada.",
  },
  {
    icone: "login",
    titulo: "Entrar no servidor",
    texto:
      "Use o botão no fim deste guia, ou o primeiro cartão da tela inicial. Você entra na hora, sem precisar pedir autorização a ninguém.",
  },
  {
    icone: "mic",
    titulo: "Conversar por voz",
    texto:
      "Clique num canal com ícone de alto-falante e pronto, você já está na call. Não precisa ligar pra ninguém nem esperar alguém atender.",
  },
  {
    icone: "screen_share",
    titulo: "Compartilhar a tela",
    texto:
      "Dentro do canal de voz, use o botão de tela na barra de controles. Dá pra escolher a tela inteira ou só uma janela, com ou sem o áudio do jogo.",
  },
  {
    icone: "headset_mic",
    titulo: "Se o microfone estiver ruim",
    texto:
      "Vá em Configurações e depois Áudio. A dica que resolve quase sempre: se você usa fone Bluetooth, escolha o microfone do notebook. O Bluetooth derruba a qualidade do som dos dois lados ao mesmo tempo.",
  },
  {
    icone: "install_mobile",
    titulo: "Instalar como aplicativo",
    texto:
      "No Chrome, abra o menu e escolha Instalar. Fica com cara de programa de verdade, sem barra de navegador em volta.",
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

  createEffect(() => {
    if (props.aberto) setI(0);
  });

  const anterior = () => setI((v) => Math.max(0, v - 1));
  const proximo = () => setI((v) => Math.min(PASSOS.length - 1, v + 1));

  createEffect(() => {
    if (!props.aberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") anterior();
      if (e.key === "ArrowRight") proximo();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

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
        }}
      >
        <span
          style={{
            "font-size": "0.72em",
            "letter-spacing": "0.2em",
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
        style={{ "min-height": "236px", "padding-top": "14px" }}
      >
        {/* key faz o Solid recriar o bloco, disparando a animacao a cada passo */}
        <Show when={PASSOS[i()]} keyed>
          {(passo) => (
            <div class="callju-rise">
              <div style={{ "font-size": "2.7em", "line-height": "1" }}>
                <Symbol size={26}>{passo.icone}</Symbol>
              </div>
              <h2
                style={{
                  "font-size": "1.35em",
                  "font-weight": "800",
                  margin: "12px 0 8px",
                  "letter-spacing": "-0.015em",
                }}
              >
                {passo.titulo}
              </h2>
              <p
                style={{
                  "line-height": "1.62",
                  opacity: "0.78",
                  margin: "0",
                }}
              >
                {passo.texto}
              </p>
            </div>
          )}
        </Show>
      </div>

      <div
        style={{
          display: "flex",
          gap: "7px",
          "justify-content": "center",
          margin: "20px 0 18px",
        }}
      >
        <For each={PASSOS}>
          {(_, idx) => (
            <button
              onClick={() => setI(idx())}
              aria-label={`Ir para o passo ${idx() + 1}`}
              style={{
                width: idx() === i() ? "24px" : "8px",
                height: "8px",
                padding: "0",
                border: "none",
                cursor: "pointer",
                "border-radius": "99px",
                transition: "width 200ms var(--callju-ease), opacity 200ms ease",
                opacity: idx() === i() ? "1" : "0.45",
                background:
                  idx() === i()
                    ? "var(--callju-grad)"
                    : "var(--md-sys-color-outline)",
              }}
            />
          )}
        </For>
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          class="callju-btn-ghost"
          onClick={anterior}
          disabled={i() === 0}
          style={{ flex: "0 0 auto", padding: "12px 20px", "font-size": "0.95em" }}
        >
          Voltar
        </button>

        <Show
          when={ultimo() && props.mostrarBotaoServidor}
          fallback={
            <button
              class="callju-btn"
              onClick={ultimo() ? props.fechar : proximo}
              style={{ flex: "1", padding: "12px 20px", "font-size": "0.95em" }}
            >
              {ultimo() ? "Fechar" : "Próximo"}
            </button>
          }
        >
          <button
            class="callju-btn"
            onClick={() => {
              props.fechar();
              props.entrarNoServidor();
            }}
            style={{ flex: "1", padding: "12px 20px", "font-size": "0.95em" }}
          >
            Entrar no servidor
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
        <SeloDoModal icone="volunteer_activism" />
        <BotaoFechar onClick={props.fechar} />
      </div>

      <h2
        style={{
          "font-size": "1.3em",
          "font-weight": "800",
          margin: "14px 0 8px",
          "letter-spacing": "-0.015em",
        }}
      >
        Me ajude a manter isso no ar
      </h2>

      <p style={{ "line-height": "1.62", opacity: "0.78", margin: "0 0 18px" }}>
        O Callju roda num servidor pago, com custo todo mês. Se o app te serve e
        você puder ajudar, faz diferença de verdade. Qualquer valor conta.
      </p>

      <div
        style={{
          padding: "14px 16px",
          "border-radius": "12px",
          background: "var(--md-sys-color-surface-variant)",
          "border-inline-start": "3px solid var(--callju-accent)",
          "font-family": "ui-monospace, monospace",
          "font-size": "0.95em",
          "word-break": "break-all",
          "margin-bottom": "14px",
        }}
      >
        {props.chave}
      </div>

      <button
        class={copiado() ? "callju-btn-ghost" : "callju-btn"}
        onClick={copiar}
        style={{ width: "100%", padding: "13px", "font-size": "0.98em" }}
      >
        {copiado() ? "Copiado. Valeu demais!" : "Copiar chave Pix"}
      </button>

      <p
        style={{
          "text-align": "center",
          opacity: "0.42",
          "font-size": "0.85em",
          margin: "16px 0 0",
        }}
      >
        Sem pressão nenhuma. O servidor continua de pé de qualquer jeito.
      </p>
    </Overlay>
  );
}

/* ------------------------------------------------------------------ */
/* Aviso de fase de testes                                             */
/* ------------------------------------------------------------------ */

export function AvisoModal(props: {
  aberto: boolean;
  fechar: () => void;
  abrirPix: () => void;
}) {
  return (
    <Overlay aberto={props.aberto} fechar={props.fechar} largura="420px">
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
        }}
      >
        <span style={{ "font-size": "2.1em", "line-height": "1" }}>🚧</span>
        <BotaoFechar onClick={props.fechar} />
      </div>

      <h2
        style={{
          "font-size": "1.3em",
          "font-weight": "800",
          margin: "14px 0 10px",
          "letter-spacing": "-0.015em",
        }}
      >
        Em fase de testes
      </h2>

      <p style={{ "line-height": "1.62", opacity: "0.78", margin: "0 0 12px" }}>
        Achou algum problema ou alguma coisa estranha? Me chama direto que eu
        arrumo. Ainda tô ajustando bastante coisa por aqui.
      </p>

      <p style={{ "line-height": "1.62", opacity: "0.78", margin: "0 0 12px" }}>
        Só peço duas coisas: não espalhe o link pra muita gente, e evite mandar
        muitos arquivos de uma vez. Assim o servidor segue leve pra todo mundo.
      </p>

      <p style={{ "line-height": "1.62", opacity: "0.78", margin: "0 0 20px" }}>
        O Callju roda num servidor pago, com custo todo mês. Se puder dar uma
        força, agradeço demais.
      </p>

      <div style={{ display: "flex", gap: "10px" }}>
        <button
          class="callju-btn-ghost"
          onClick={props.fechar}
          style={{ flex: "0 0 auto", padding: "12px 20px", "font-size": "0.95em" }}
        >
          Fechar
        </button>
        <button
          class="callju-btn"
          onClick={() => {
            props.fechar();
            props.abrirPix();
          }}
          style={{ flex: "1", padding: "12px 20px", "font-size": "0.95em" }}
        >
          Quero ajudar
        </button>
      </div>
    </Overlay>
  );
}

/* ------------------------------------------------------------------ */
/* Baixar o app para computador                                        */
/* ------------------------------------------------------------------ */

/**
 * Endereco fixo da versao mais recente.
 *
 * O GitHub mantem /releases/latest apontando sempre para a ultima versao
 * publicada, entao este link nao precisa ser trocado a cada lancamento.
 */
export const LINK_DO_APP =
  "https://github.com/lucasmaiaws13-eng/for-desktop/releases/latest/download/callju-setup.exe";

/** Onde o APK do Android mora: servido pelo proprio site */
const LINK_DO_ANDROID = "/callju-android.apk";

/**
 * Aviso do aplicativo de celular.
 *
 * O APK e assinado com a chave de depuracao do Android, que e o suficiente pra
 * instalar no celular mas faz o sistema pedir confirmacao. Melhor explicar isso
 * antes de a pessoa se assustar com o aviso.
 */
export function AndroidModal(props: { aberto: boolean; fechar: () => void }) {
  return (
    <Overlay aberto={props.aberto} fechar={props.fechar} largura="440px">
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
        }}
      >
        <SeloDoModal icone="phone_android" />
        <BotaoFechar onClick={props.fechar} />
      </div>

      <h2
        style={{
          "font-size": "1.3em",
          "font-weight": "800",
          margin: "14px 0 8px",
          "letter-spacing": "-0.015em",
        }}
      >
        Callju no Android
      </h2>

      <p style={{ "line-height": "1.62", opacity: "0.78", margin: "0 0 16px" }}>
        Primeira versão do aplicativo de celular. Ele abre direto, sem passar
        pelo navegador. Ainda está em teste, então pode ter canto torto: se
        achar algum, me conta.
      </p>

      <div
        style={{
          padding: "14px 16px",
          "border-radius": "12px",
          background: "var(--md-sys-color-surface-container-high)",
          "border-inline-start": "3px solid var(--callju-accent)",
          "margin-bottom": "18px",
        }}
      >
        <div
          style={{
            "font-weight": "700",
            "font-size": "0.95em",
            "margin-bottom": "6px",
          }}
        >
          O Android vai pedir permissão. É esperado.
        </div>
        <div style={{ "line-height": "1.6", opacity: "0.78", "font-size": "0.92em" }}>
          Ao abrir o arquivo baixado, o celular avisa que não instala apps de
          fora da loja. Toque em <b>Configurações</b> e permita a instalação
          para o navegador, depois volte e confirme.
          <br />
          <br />
          Ele não está na Play Store porque publicar lá custa e exige conta de
          desenvolvedor. Por enquanto o app também não manda notificação: pra
          isso o site continua sendo o melhor caminho no celular.
        </div>
      </div>

      <a
        class="callju-btn"
        href={LINK_DO_ANDROID}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "block",
          width: "100%",
          padding: "13px",
          "font-size": "0.98em",
          "text-align": "center",
          "text-decoration": "none",
          "box-sizing": "border-box",
        }}
      >
        Baixar para Android
      </a>

      <p
        style={{
          "text-align": "center",
          opacity: "0.42",
          "font-size": "0.85em",
          margin: "16px 0 0",
        }}
      >
        No iPhone ainda não tem app. O site funciona igual por lá.
      </p>
    </Overlay>
  );
}

export function AppModal(props: { aberto: boolean; fechar: () => void }) {
  return (
    <Overlay aberto={props.aberto} fechar={props.fechar} largura="440px">
      <div
        style={{
          display: "flex",
          "align-items": "center",
          "justify-content": "space-between",
        }}
      >
        <SeloDoModal icone="desktop_windows" />
        <BotaoFechar onClick={props.fechar} />
      </div>

      <h2
        style={{
          "font-size": "1.3em",
          "font-weight": "800",
          margin: "14px 0 8px",
          "letter-spacing": "-0.015em",
        }}
      >
        Callju no seu computador
      </h2>

      <p style={{ "line-height": "1.62", opacity: "0.78", margin: "0 0 16px" }}>
        É o mesmo Callju, mas como programa. Sem aba de navegador se perdendo no
        meio de mil outras, com ícone do lado do relógio e notificação de
        verdade. E ele se atualiza sozinho, você não precisa baixar de novo.
      </p>

      <div
        style={{
          padding: "14px 16px",
          "border-radius": "12px",
          background: "var(--md-sys-color-surface-variant)",
          "border-inline-start": "3px solid var(--callju-accent)",
          "margin-bottom": "18px",
        }}
      >
        <div
          style={{
            "font-weight": "700",
            "font-size": "0.95em",
            "margin-bottom": "6px",
          }}
        >
          O Windows vai reclamar. É esperado.
        </div>
        <div style={{ "line-height": "1.6", opacity: "0.78", "font-size": "0.92em" }}>
          Vai aparecer uma tela azul dizendo "O Windows protegeu o seu
          computador". Clica em <b>Mais informações</b> e depois em{" "}
          <b>Executar assim mesmo</b>.
          <br />
          <br />
          Isso acontece porque o instalador não tem assinatura digital, que é um
          certificado que custa mais de mil reais por ano. O aviso não diz que
          tem vírus, diz que o Windows não conhece quem assinou. Só aparece na
          primeira instalação.
        </div>
      </div>

      <a
        class="callju-btn"
        href={LINK_DO_APP}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "block",
          width: "100%",
          padding: "13px",
          "font-size": "0.98em",
          "text-align": "center",
          "text-decoration": "none",
          "box-sizing": "border-box",
        }}
      >
        Baixar para Windows
      </a>

      <p
        style={{
          "text-align": "center",
          opacity: "0.42",
          "font-size": "0.85em",
          margin: "16px 0 0",
        }}
      >
        Por enquanto só Windows. No Mac e no Linux, o site funciona igual.
      </p>
    </Overlay>
  );
}
