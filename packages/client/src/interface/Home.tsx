import { For, Show, createSignal, onCleanup, onMount } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { IS_DEV, useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Button, Header, iconSize, main } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import MdHome from "@material-design-icons/svg/filled/home.svg?component-solid";

import { AppModal, AvisoModal, GuiaModal, PixModal } from "./CalljuModals";
import { HeaderIcon } from "./common/CommonHeader";

// >>> TROQUE AQUI pela sua chave Pix (CPF, telefone, email ou aleatoria)
const CHAVE_PIX = "+5591983673239";

// >>> TROQUE AQUI pelo codigo do convite permanente do servidor principal.
// So o codigo, nao a URL inteira. Ex: se o link e /invite/AbC123, use "AbC123".
// Enquanto estiver com o valor de exemplo, o botao fica escondido.
const CONVITE_SERVIDOR = "TA4TJ57t";

/** De quanto em quanto tempo o carrossel troca sozinho */
const TEMPO_DO_SLIDE = 7000;

const Base = styled("div", {
  base: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    color: "var(--md-sys-color-on-surface)",
  },
});

const content = cva({
  base: {
    ...main.raw(),
    padding: "40px 20px 56px",
    gap: "22px",
    alignItems: "center",
  },
});

/**
 * Painel de vidro.
 *
 * O desfoque com o contorno claro por cima da a impressao de uma placa de
 * vidro sobre o fundo. Quem desligou os efeitos de transparencia nas
 * configuracoes recebe a mesma placa em cor cheia: o desenho continua de pe,
 * sem o custo de desfocar a tela.
 */
const Vidro = styled("div", {
  base: {
    position: "relative",
    overflow: "hidden",
    borderRadius: "18px",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "rgba(255, 255, 255, 0.04)",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 12px 32px rgba(0, 0, 0, 0.35)",
  },
  variants: {
    desfoque: {
      true: {
        backdropFilter: "blur(18px) saturate(1.2)",
      },
      false: {
        background: "var(--md-sys-color-surface-container)",
      },
    },
  },
});

/* ------------------------------------------------------------------ */
/* Carrossel                                                           */
/* ------------------------------------------------------------------ */

type Slide = {
  etiqueta: string;
  titulo: string;
  texto: string;
  icone: string;
  aoClicar: () => void;
};

/**
 * Carrossel das novidades.
 *
 * A home antiga empilhava aviso, banner, botao e quatro cartoes, e tudo pedia
 * atencao ao mesmo tempo. Aqui as novidades se revezam num lugar so: uma de
 * cada vez, trocando sozinha, com as bolinhas pra quem quiser ir direto.
 * Passar o mouse segura o slide, porque ler importa mais que o relogio.
 */
function Carrossel(props: { slides: Slide[]; desfoque: boolean }) {
  const [atual, setAtual] = createSignal(0);
  const [parado, setParado] = createSignal(false);

  onMount(() => {
    const relogio = setInterval(() => {
      if (!parado()) setAtual((i) => (i + 1) % props.slides.length);
    }, TEMPO_DO_SLIDE);
    onCleanup(() => clearInterval(relogio));
  });

  return (
    <Vidro
      desfoque={props.desfoque}
      style={{ width: "100%", "max-width": "560px" }}
      onMouseEnter={() => setParado(true)}
      onMouseLeave={() => setParado(false)}
    >
      <Trilho style={{ transform: `translateX(-${atual() * 100}%)` }}>
        <For each={props.slides}>
          {(slide) => (
            <SlideBase onClick={slide.aoClicar}>
              <Icone>
                <Symbol size={26}>{slide.icone}</Symbol>
              </Icone>

              <span style={{ flex: "1", "min-width": "0" }}>
                <Etiqueta>{slide.etiqueta}</Etiqueta>
                <Titulo>{slide.titulo}</Titulo>
                <Texto>{slide.texto}</Texto>
              </span>

              <Seta>
                <Symbol size={20}>chevron_right</Symbol>
              </Seta>
            </SlideBase>
          )}
        </For>
      </Trilho>

      <Bolinhas>
        <For each={props.slides}>
          {(slide, i) => (
            <Bolinha
              ativa={atual() === i()}
              aria-label={slide.titulo}
              onClick={() => setAtual(i())}
            />
          )}
        </For>
      </Bolinhas>
    </Vidro>
  );
}

const Trilho = styled("div", {
  base: {
    display: "flex",
    transition: "transform var(--mov-entrada)",
  },
});

const SlideBase = styled("button", {
  base: {
    flex: "0 0 100%",
    display: "flex",
    alignItems: "center",
    gap: "16px",

    padding: "22px 22px 28px",
    border: "none",
    background: "transparent",
    color: "var(--md-sys-color-on-surface)",
    textAlign: "start",
    font: "inherit",
    cursor: "pointer",

    transition: "background var(--mov-toque)",
    _hover: {
      background: "rgba(255, 255, 255, 0.03)",
    },
  },
});

const Icone = styled("span", {
  base: {
    width: "46px",
    height: "46px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: "14px",
    color: "#ffe6d2",
    background: "var(--callju-destaque)",
    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.35)",
  },
});

const Etiqueta = styled("span", {
  base: {
    display: "block",
    fontSize: "0.68em",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "var(--callju-accent-claro)",
  },
});

const Titulo = styled("span", {
  base: {
    display: "block",
    marginTop: "4px",
    fontSize: "1.05em",
    fontWeight: 700,
    letterSpacing: "-0.01em",
  },
});

const Texto = styled("span", {
  base: {
    display: "block",
    marginTop: "3px",
    fontSize: "0.86em",
    opacity: 0.55,
    lineHeight: 1.4,
  },
});

const Seta = styled("span", {
  base: {
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    opacity: 0.4,
    transition: "transform var(--mov-toque), opacity var(--mov-toque)",

    "button:hover &": {
      opacity: 0.9,
      transform: "translateX(3px)",
    },
  },
});

const Bolinhas = styled("div", {
  base: {
    position: "absolute",
    bottom: "12px",
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    gap: "6px",
  },
});

const Bolinha = styled("button", {
  base: {
    width: "6px",
    height: "6px",
    padding: 0,
    border: "none",
    cursor: "pointer",
    borderRadius: "99px",
    background: "rgba(255, 255, 255, 0.22)",
    transition: "width var(--mov-elastico), background var(--mov-estado)",
  },
  variants: {
    ativa: {
      true: {
        width: "18px",
        background: "var(--callju-accent)",
      },
    },
  },
});

/* ------------------------------------------------------------------ */
/* Atalhos                                                             */
/* ------------------------------------------------------------------ */

const Atalhos = styled("div", {
  base: {
    width: "100%",
    maxWidth: "560px",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: "10px",
  },
});

const Atalho = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "11px",

    padding: "13px 14px",
    borderRadius: "14px",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container)",
    color: "var(--md-sys-color-on-surface)",

    font: "inherit",
    fontSize: "0.88em",
    fontWeight: 600,
    textAlign: "start",
    cursor: "pointer",

    transition:
      "background var(--mov-toque), border-color var(--mov-toque), transform var(--mov-toque)",

    _hover: {
      background: "var(--md-sys-color-surface-container-high)",
      borderColor: "rgba(255, 255, 255, 0.12)",
      transform: "translateY(-2px)",
    },

    "&:active": {
      transform: "translateY(0)",
    },
  },
});

const IconeAtalho = styled("span", {
  base: {
    width: "32px",
    height: "32px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: "10px",
    color: "var(--callju-accent-claro)",
    background: "var(--callju-hover)",
  },
});

/* ------------------------------------------------------------------ */
/* Pagina                                                              */
/* ------------------------------------------------------------------ */

export function HomePage() {
  const { openModal } = useModals();
  const navigate = useNavigate();
  const client = useClient();
  const state = useState();

  const [guiaAberto, setGuiaAberto] = createSignal(false);
  const [pixAberto, setPixAberto] = createSignal(false);
  const [appAberto, setAppAberto] = createSignal(false);
  const [avisoAberto, setAvisoAberto] = createSignal(false);

  const conviteConfigurado =
    CONVITE_SERVIDOR !== "cole-o-codigo-do-convite-aqui";

  const slides: Slide[] = [
    {
      etiqueta: "novidade",
      titulo: "Callju pro computador",
      texto: "Sem aba de navegador perdida, e se atualiza sozinho",
      icone: "desktop_windows",
      aoClicar: () => setAppAberto(true),
    },
    {
      etiqueta: "minigames",
      titulo: "Palavras cruzadas do dia",
      texto: "Uma grade nova por dia, sozinho ou em equipe, com ranking",
      icone: "sports_esports",
      aoClicar: () => navigate("/minigames"),
    },
    {
      etiqueta: "em fase de testes",
      titulo: "O Callju é nosso canto na internet",
      texto: "Feito por um amigo, sem anúncio e sem dono. Veja como funciona",
      icone: "favorite",
      aoClicar: () => setAvisoAberto(true),
    },
    {
      etiqueta: "apoie",
      titulo: "Me ajude a manter no ar",
      texto: "O servidor tem custo todo mês e sai do bolso do Lucas",
      icone: "volunteer_activism",
      aoClicar: () => setPixAberto(true),
    },
  ];

  return (
    <Base>
      <Header placement="primary">
        <HeaderIcon>
          <MdHome {...iconSize(22)} fill="var(--callju-accent)" />
        </HeaderIcon>
        <Trans>Home</Trans>
      </Header>

      <div use:scrollable={{ class: content() }}>
        <Brilho />

        {/* Marca menor do que era: ela apresenta a casa, nao ocupa a casa */}
        <Marca class="callju-rise">
          <img src="/assets/web/callju-marca.png" alt="" />
          <span>
            <span class="callju-wordmark">Callju</span>
            <small>call + caju</small>
          </span>
        </Marca>

        <Show when={conviteConfigurado}>
          <button
            class="callju-btn callju-rise"
            onClick={() => navigate(`/invite/${CONVITE_SERVIDOR}`)}
            style={{
              width: "100%",
              "max-width": "560px",
              padding: "15px 20px",
              display: "flex",
              "align-items": "center",
              gap: "14px",
              "text-align": "start",
            }}
          >
            <Symbol size={22}>headset_mic</Symbol>
            <span style={{ flex: "1", "min-width": "0" }}>
              <span
                style={{
                  display: "block",
                  "font-size": "1.02em",
                  "font-weight": "700",
                  "letter-spacing": "-0.01em",
                }}
              >
                Entrar no servidor
              </span>
              <span
                style={{
                  display: "block",
                  "font-size": "0.84em",
                  opacity: "0.85",
                  "margin-top": "2px",
                }}
              >
                pra conversar com a galera é por aqui
              </span>
            </span>
            <Symbol size={20}>chevron_right</Symbol>
          </button>
        </Show>

        <Carrossel slides={slides} desfoque={state.theme.blur} />

        <Atalhos>
          <Atalho
            onClick={() =>
              openModal({ type: "create_group_or_server", client: client()! })
            }
          >
            <IconeAtalho>
              <Symbol size={19}>add</Symbol>
            </IconeAtalho>
            Criar um grupo
          </Atalho>

          <Atalho onClick={() => setGuiaAberto(true)}>
            <IconeAtalho>
              <Symbol size={19}>menu_book</Symbol>
            </IconeAtalho>
            Como usar
          </Atalho>

          <Atalho onClick={() => navigate("/minigames")}>
            <IconeAtalho>
              <Symbol size={19}>sports_esports</Symbol>
            </IconeAtalho>
            Minigames
          </Atalho>

          <Atalho onClick={() => setPixAberto(true)}>
            <IconeAtalho>
              <Symbol size={19}>favorite</Symbol>
            </IconeAtalho>
            Apoiar o Callju
          </Atalho>
        </Atalhos>

        <GuiaModal
          aberto={guiaAberto()}
          fechar={() => setGuiaAberto(false)}
          mostrarBotaoServidor={conviteConfigurado}
          entrarNoServidor={() => navigate(`/invite/${CONVITE_SERVIDOR}`)}
        />

        <PixModal
          aberto={pixAberto()}
          fechar={() => setPixAberto(false)}
          chave={CHAVE_PIX}
        />

        <AppModal aberto={appAberto()} fechar={() => setAppAberto(false)} />

        <AvisoModal
          aberto={avisoAberto()}
          fechar={() => setAvisoAberto(false)}
          abrirPix={() => setPixAberto(true)}
        />

        <Show when={IS_DEV}>
          <Button onPress={() => navigate("/dev")}>
            Open Development Page
          </Button>
        </Show>
      </div>
    </Base>
  );
}

/**
 * Luz fraca atras do conteudo.
 *
 * Um circulo grande e bem apagado na cor da marca, no alto da tela. E o unico
 * lugar da home com cor no fundo: o resto e preto, e a luz so tira o ar de
 * pagina vazia.
 */
const Brilho = styled("div", {
  base: {
    position: "absolute",
    top: "-140px",
    left: "50%",
    width: "760px",
    height: "420px",
    transform: "translateX(-50%)",
    pointerEvents: "none",
    background:
      "radial-gradient(closest-side, rgba(232, 130, 60, 0.13), transparent)",
  },
});

const Marca = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "2px",

    "& img": {
      width: "54px",
      height: "54px",
    },

    "& > span": {
      display: "flex",
      flexDirection: "column",
      lineHeight: 1,
    },

    "& .callju-wordmark": {
      fontSize: "2.1em",
      fontWeight: 800,
      letterSpacing: "-0.035em",
    },

    "& small": {
      marginTop: "6px",
      fontSize: "0.62em",
      letterSpacing: "0.26em",
      textTransform: "uppercase",
      opacity: 0.35,
    },
  },
});
