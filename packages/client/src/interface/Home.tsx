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

/** Nome do servidor principal, como aparece no botao de entrar */
const NOME_DO_SERVIDOR = "Salvação";

/** De quanto em quanto tempo o carrossel troca sozinho */
const TEMPO_DO_SLIDE = 7000;

const Base = styled("div", {
  base: {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    color: "var(--md-sys-color-on-surface)",
  },
});

/**
 * O conteudo fica no meio da tela, na vertical e na horizontal.
 *
 * Antes ele comecava no topo e deixava metade da tela vazia embaixo, o que
 * fazia a home parecer inacabada em telas grandes.
 */
const content = cva({
  base: {
    ...main.raw(),
    padding: "24px 20px 40px",
    gap: "18px",
    alignItems: "center",
    justifyContent: "center",
  },
});

/**
 * Placa de vidro.
 *
 * Desfoque do que esta atras, contorno claro em cima e sombra embaixo: o
 * conjunto da a impressao de uma placa de vidro sobre o fundo. Quem desligou
 * os efeitos de transparencia recebe a mesma placa em cor cheia.
 */
const Vidro = styled("div", {
  base: {
    position: "relative",
    overflow: "hidden",
    borderRadius: "22px",
    border: "1px solid rgba(255, 255, 255, 0.09)",
    background: "rgba(255, 255, 255, 0.035)",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 20px 50px rgba(0, 0, 0, 0.45)",
  },
  variants: {
    desfoque: {
      true: {
        backdropFilter: "blur(22px) saturate(1.25)",
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
 * Uma novidade de cada vez, trocando sozinha. As setas andam de slide e nao
 * abrem nada; quem quiser abrir clica no cartao. Passar o mouse segura a
 * troca, porque ler importa mais que o relogio.
 */
function Carrossel(props: { slides: Slide[] }) {
  const [atual, setAtual] = createSignal(0);
  const [parado, setParado] = createSignal(false);

  const andar = (passo: number) =>
    setAtual((i) => (i + passo + props.slides.length) % props.slides.length);

  onMount(() => {
    const relogio = setInterval(() => {
      if (!parado()) andar(1);
    }, TEMPO_DO_SLIDE);
    onCleanup(() => clearInterval(relogio));
  });

  return (
    <CarrosselBase
      onMouseEnter={() => setParado(true)}
      onMouseLeave={() => setParado(false)}
    >
      <Trilho style={{ transform: `translateX(-${atual() * 100}%)` }}>
        <For each={props.slides}>
          {(slide) => (
            <SlideBase onClick={slide.aoClicar}>
              <Icone>
                <Symbol size={24}>{slide.icone}</Symbol>
              </Icone>

              <span style={{ flex: "1", "min-width": "0" }}>
                <Etiqueta>{slide.etiqueta}</Etiqueta>
                <Titulo>{slide.titulo}</Titulo>
                <Texto>{slide.texto}</Texto>
              </span>
            </SlideBase>
          )}
        </For>
      </Trilho>

      <Seta lado="esquerda" aria-label="Anterior" onClick={() => andar(-1)}>
        <Symbol size={18}>chevron_left</Symbol>
      </Seta>
      <Seta lado="direita" aria-label="Próximo" onClick={() => andar(1)}>
        <Symbol size={18}>chevron_right</Symbol>
      </Seta>

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
    </CarrosselBase>
  );
}

const CarrosselBase = styled("div", {
  base: {
    position: "relative",
    width: "100%",
    overflow: "hidden",
    borderRadius: "16px",
    border: "1px solid rgba(255, 255, 255, 0.07)",
    background: "rgba(255, 255, 255, 0.03)",
  },
});

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
    gap: "14px",

    padding: "18px 44px 26px 18px",
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
    width: "42px",
    height: "42px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: "13px",
    color: "#fff",
    background: "var(--callju-grad)",
    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.4)",
  },
});

const Etiqueta = styled("span", {
  base: {
    display: "block",
    fontSize: "0.66em",
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "var(--callju-accent-claro)",
  },
});

const Titulo = styled("span", {
  base: {
    display: "block",
    marginTop: "3px",
    fontSize: "1em",
    fontWeight: 700,
    letterSpacing: "-0.01em",
  },
});

const Texto = styled("span", {
  base: {
    display: "block",
    marginTop: "2px",
    fontSize: "0.83em",
    opacity: 0.5,
    lineHeight: 1.4,
  },
});

const Seta = styled("button", {
  base: {
    position: "absolute",
    top: "50%",
    width: "28px",
    height: "28px",
    marginTop: "-18px",

    display: "grid",
    placeItems: "center",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "99px",
    background: "rgba(0, 0, 0, 0.35)",
    color: "var(--md-sys-color-on-surface)",
    cursor: "pointer",

    opacity: 0,
    transition: "opacity var(--mov-toque), background var(--mov-toque)",

    "div:hover > &": {
      opacity: 0.85,
    },

    _hover: {
      opacity: "1 !important",
      background: "rgba(0, 0, 0, 0.6)",
    },
  },
  variants: {
    lado: {
      esquerda: { left: "8px" },
      direita: { right: "8px" },
    },
  },
});

const Bolinhas = styled("div", {
  base: {
    position: "absolute",
    bottom: "10px",
    left: 0,
    right: 0,
    display: "flex",
    justifyContent: "center",
    gap: "5px",
  },
});

const Bolinha = styled("button", {
  base: {
    width: "5px",
    height: "5px",
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
        width: "16px",
        background: "var(--callju-accent)",
      },
    },
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
      titulo: "Nosso canto na internet",
      texto: "Sem anúncio e sem dono. Veja como o Callju funciona",
      icone: "favorite",
      aoClicar: () => setAvisoAberto(true),
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

        <Painel desfoque={state.theme.blur} class="callju-rise">
          <Marca>
            <img src="/assets/web/callju-marca.png" alt="" />
            <span>
              <span class="callju-wordmark">Callju</span>
              <small>call + caju</small>
            </span>
          </Marca>

          <Show when={conviteConfigurado}>
            <Entrar onClick={() => navigate(`/invite/${CONVITE_SERVIDOR}`)}>
              <Symbol size={20}>headset_mic</Symbol>
              <span>
                Entrar no {NOME_DO_SERVIDOR}
                <small>pra conversar com a galera é por aqui</small>
              </span>
              <Symbol size={18}>chevron_right</Symbol>
            </Entrar>
          </Show>

          <Carrossel slides={slides} />

          <Atalhos>
            <Atalho
              onClick={() =>
                openModal({ type: "create_group_or_server", client: client()! })
              }
            >
              <Symbol size={18}>add</Symbol>
              Criar um grupo
            </Atalho>

            <Atalho onClick={() => setGuiaAberto(true)}>
              <Symbol size={18}>menu_book</Symbol>
              Como usar
            </Atalho>

            <Atalho onClick={() => navigate("/minigames")}>
              <Symbol size={18}>sports_esports</Symbol>
              Minigames
            </Atalho>
          </Atalhos>
        </Painel>

        {/* Apoiar sai do meio da tela e vira um botao de canto: ele importa,
            mas nao e o que a pessoa veio fazer aqui */}
        <Apoiar onClick={() => setPixAberto(true)}>
          <Symbol size={18}>favorite</Symbol>
          <span>Apoiar o Callju</span>
        </Apoiar>

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

const Painel = styled(Vidro, {
  base: {
    width: "100%",
    maxWidth: "520px",
    padding: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
});

/**
 * Luz fraca atras do painel: unico lugar da home com cor no fundo.
 */
const Brilho = styled("div", {
  base: {
    position: "absolute",
    top: "10%",
    left: "50%",
    width: "620px",
    height: "380px",
    transform: "translateX(-50%)",
    pointerEvents: "none",
    background:
      "radial-gradient(closest-side, rgba(232, 130, 60, 0.14), transparent)",
  },
});

const Marca = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "11px",

    "& img": {
      width: "44px",
      height: "44px",
    },

    "& > span": {
      display: "flex",
      flexDirection: "column",
      lineHeight: 1,
    },

    "& .callju-wordmark": {
      fontSize: "1.7em",
      fontWeight: 800,
      letterSpacing: "-0.035em",
    },

    "& small": {
      marginTop: "5px",
      fontSize: "0.6em",
      letterSpacing: "0.26em",
      textTransform: "uppercase",
      opacity: 0.32,
    },
  },
});

/**
 * Entrar no servidor: discreto de proposito.
 *
 * Era um botao inteiro no degrade, gritando mais que tudo em volta. Agora e um
 * bloco de vidro com um fio da cor da marca, que acende ao passar o mouse.
 */
const Entrar = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",

    padding: "13px 16px",
    borderRadius: "14px",
    border: "1px solid var(--callju-accent-line)",
    background: "var(--callju-accent-soft)",
    color: "var(--callju-accent-claro)",

    font: "inherit",
    textAlign: "start",
    cursor: "pointer",
    transition:
      "background var(--mov-toque), border-color var(--mov-toque), transform var(--mov-toque)",

    "& > span": {
      flex: 1,
      minWidth: 0,
      display: "flex",
      flexDirection: "column",
      fontWeight: 700,
      fontSize: "0.98em",
      letterSpacing: "-0.01em",
    },

    "& small": {
      marginTop: "2px",
      fontWeight: 400,
      fontSize: "0.78em",
      color: "var(--md-sys-color-on-surface-variant)",
    },

    _hover: {
      background: "rgba(232, 130, 60, 0.16)",
      borderColor: "var(--callju-accent)",
      transform: "translateY(-1px)",
    },

    "&:active": {
      transform: "translateY(0)",
    },
  },
});

const Atalhos = styled("div", {
  base: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
});

const Atalho = styled("button", {
  base: {
    flex: "1 1 140px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",

    padding: "11px 12px",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.07)",
    background: "rgba(255, 255, 255, 0.03)",
    color: "var(--md-sys-color-on-surface-variant)",

    font: "inherit",
    fontSize: "0.85em",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",

    transition:
      "background var(--mov-toque), color var(--mov-toque), transform var(--mov-toque)",

    _hover: {
      background: "rgba(255, 255, 255, 0.07)",
      color: "var(--md-sys-color-on-surface)",
      transform: "translateY(-2px)",
    },

    "&:active": {
      transform: "translateY(0)",
    },
  },
});

const Apoiar = styled("button", {
  base: {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: 3,

    display: "flex",
    alignItems: "center",
    gap: "8px",

    padding: "9px 14px",
    borderRadius: "99px",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "rgba(255, 255, 255, 0.05)",
    backdropFilter: "blur(14px)",
    color: "var(--md-sys-color-on-surface-variant)",

    font: "inherit",
    fontSize: "0.82em",
    fontWeight: 600,
    cursor: "pointer",

    transition:
      "background var(--mov-toque), color var(--mov-toque), transform var(--mov-toque)",

    _hover: {
      background: "var(--callju-accent-soft)",
      color: "var(--callju-accent-claro)",
      transform: "translateY(-2px)",
    },
  },
});
