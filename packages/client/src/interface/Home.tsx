import { Match, Show, Switch, createSignal } from "solid-js";

import { Trans } from "@lingui/solid/macro";
import { css, cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { IS_DEV, useClient } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import {
  Button,
  CategoryButton,
  Column,
  Header,
  iconSize,
  main,
} from "@revolt/ui";

import MdAddCircle from "@material-design-icons/svg/filled/add_circle.svg?component-solid";
import MdFavorite from "@material-design-icons/svg/filled/favorite.svg?component-solid";
import MdGroups3 from "@material-design-icons/svg/filled/groups_3.svg?component-solid";
import MdHelpCenter from "@material-design-icons/svg/filled/help_center.svg?component-solid";
import MdHome from "@material-design-icons/svg/filled/home.svg?component-solid";
import MdSettings from "@material-design-icons/svg/filled/settings.svg?component-solid";


import { HeaderIcon } from "./common/CommonHeader";
import { AvisoModal, GuiaModal, PixModal } from "./CalljuModals";

// >>> TROQUE AQUI pela sua chave Pix (CPF, telefone, email ou aleatoria)
const CHAVE_PIX = "+5591983673239";

// >>> TROQUE AQUI pelo codigo do convite permanente do servidor principal.
// So o codigo, nao a URL inteira. Ex: se o link e /invite/AbC123, use "AbC123".
// Enquanto estiver com o valor de exemplo, o botao fica escondido.
const CONVITE_SERVIDOR = "TA4TJ57t";

/**
 * Base layout of the home page (i.e. the header/background)
 */
const Base = styled("div", {
  base: {
    width: "100%",
    display: "flex",
    flexDirection: "column",

    color: "var(--md-sys-color-on-surface)",
  },
});

/**
 * Layout of the content as a whole
 */
const content = cva({
  base: {
    ...main.raw(),

    padding: "48px 0",

    gap: "32px",
    alignItems: "center",
    justifyContent: "center",
  },
});

/**
 * Layout of the buttons
 */
const Buttons = styled("div", {
  base: {
    gap: "8px",
    padding: "8px",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    borderRadius: "var(--borderRadius-lg)",

    color: "var(--md-sys-color-on-surface-variant)",
    background: "var(--md-sys-color-surface-variant)",
  },
});

/**
 * Make sure the columns are separated
 */
const SeparatedColumn = styled(Column, {
  base: {
    justifyContent: "stretch",
    marginInline: "0.25em",
    width: "260px",
    "& > *": {
      flexGrow: 1,
    },
  },
});

/**
 * Cartao de acao da tela inicial.
 *
 * Titulo e descricao usam pesos, tamanhos e opacidades bem distintos
 * de proposito: e o que cria hierarquia sem precisar de outra familia
 * tipografica.
 */
function CartaoAcao(props: {
  emoji: string;
  titulo: string;
  texto: string;
  onClick: () => void;
  destaque?: boolean;
}) {
  return (
    <button
      class="callju-lift"
      onClick={props.onClick}
      style={{
        display: "flex",
        "align-items": "center",
        gap: "13px",
        padding: "14px 15px",
        "border-radius": "14px",
        cursor: "pointer",
        "text-align": "start",
        color: "var(--md-sys-color-on-surface)",
        background: "var(--md-sys-color-surface-container-high)",
        border: props.destaque
          ? "1px solid var(--callju-accent-line)"
          : "1px solid transparent",
      }}
    >
      <span
        style={{
          width: "36px",
          height: "36px",
          "flex-shrink": "0",
          display: "flex",
          "align-items": "center",
          "justify-content": "center",
          "border-radius": "10px",
          "font-size": "1.05em",
          background: props.destaque
            ? "var(--callju-accent-soft)"
            : "var(--md-sys-color-surface-variant)",
        }}
      >
        {props.emoji}
      </span>

      <span style={{ "min-width": "0" }}>
        <span
          style={{
            display: "block",
            "font-size": "0.95em",
            "font-weight": "650",
            "letter-spacing": "-0.005em",
          }}
        >
          {props.titulo}
        </span>
        <span
          style={{
            display: "block",
            "font-size": "0.8em",
            "font-weight": "400",
            opacity: "0.5",
            "margin-top": "2px",
            "line-height": "1.35",
          }}
        >
          {props.texto}
        </span>
      </span>
    </button>
  );
}

/**
 * Home page
 */
export function HomePage() {
  const { openModal } = useModals();
  const navigate = useNavigate();
  const client = useClient();
  const instance = useInstance();

  const [guiaAberto, setGuiaAberto] = createSignal(false);
  const [pixAberto, setPixAberto] = createSignal(false);
  const [avisoAberto, setAvisoAberto] = createSignal(false);
  const conviteConfigurado = CONVITE_SERVIDOR !== "cole-o-codigo-do-convite-aqui";

  return (
    <Base>
      <Header placement="primary">
        <HeaderIcon>
          <MdHome {...iconSize(22)} fill="var(--callju-accent)" />
        </HeaderIcon>
        <Trans>Home</Trans>
      </Header>
      <div use:scrollable={{ class: content() }}>
        <div
          class="callju-rise"
          style={{
            display: "flex",
            "align-items": "center",
            "justify-content": "center",
            gap: "10px",
            "flex-wrap": "wrap",
          }}
        >
          <button
            onClick={() => setAvisoAberto(true)}
            class="callju-lift"
            style={{
              display: "flex",
              "align-items": "center",
              gap: "9px",
              padding: "9px 16px",
              "border-radius": "99px",
              cursor: "pointer",
              "font-size": "0.82em",
              "font-weight": "600",
              "letter-spacing": "0.01em",
              color: "var(--callju-accent)",
              background: "var(--callju-accent-soft)",
              border: "1px solid var(--callju-accent-line)",
            }}
          >
            <span
              class="callju-speaking"
              style={{
                width: "7px",
                height: "7px",
                "border-radius": "99px",
                background: "var(--callju-accent)",
              }}
            />
            Em fase de testes
          </button>

          <span
            class="callju-speaking"
            style={{
              "font-size": "0.8em",
              opacity: "0.55",
              "font-style": "italic",
            }}
          >
            clique aqui!
          </span>
        </div>

        <div style={{ "text-align": "center" }}>
          {/* O emoji fica FORA do elemento com degrade: dentro dele o
              background-clip nao pinta elementos filhos, e o filho ainda
              herda color:transparent, o que deixava o emoji invisivel. */}
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "center",
              gap: "0.22em",
              "font-size": "2.6em",
              "font-weight": "800",
              "line-height": "1.1",
            }}
          >
            <span style={{ transform: "translateY(-0.06em)" }}>🥭</span>
            <span
              class="callju-wordmark"
              style={{ "letter-spacing": "-0.035em" }}
            >
              Callju
            </span>
          </div>
          <div
            style={{
              "font-size": "0.7em",
              "letter-spacing": "0.26em",
              "text-transform": "uppercase",
              opacity: "0.38",
              "margin-top": "8px",
            }}
          >
            call + caju
          </div>
        </div>

        <Show when={conviteConfigurado}>
          <button
            class="callju-btn callju-rise"
            onClick={() => navigate(`/invite/${CONVITE_SERVIDOR}`)}
            style={{
              width: "100%",
              "max-width": "540px",
              padding: "16px 18px",
              display: "flex",
              "align-items": "center",
              gap: "16px",
              "text-align": "start",
            }}
          >
            <span
              style={{
                width: "42px",
                height: "42px",
                "flex-shrink": "0",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                "border-radius": "99px",
                "font-size": "1.25em",
                background: "rgba(255, 255, 255, 0.18)",
              }}
            >
              🎧
            </span>

            <span style={{ flex: "1", "min-width": "0" }}>
              <span
                style={{
                  display: "block",
                  "font-size": "1.06em",
                  "font-weight": "700",
                  "letter-spacing": "-0.01em",
                }}
              >
                Entrar no servidor
              </span>
              <span
                style={{
                  display: "block",
                  "font-size": "0.86em",
                  "font-weight": "400",
                  opacity: "0.85",
                  "margin-top": "3px",
                }}
              >
                pra conversar com a galera é por aqui
              </span>
            </span>

            <span
              style={{
                width: "30px",
                height: "30px",
                "flex-shrink": "0",
                display: "flex",
                "align-items": "center",
                "justify-content": "center",
                "border-radius": "99px",
                "font-size": "1.15em",
                background: "rgba(255, 255, 255, 0.18)",
              }}
            >
              &rsaquo;
            </span>
          </button>
        </Show>

        <div
          style={{
            width: "100%",
            "max-width": "540px",
            display: "grid",
            "grid-template-columns": "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "10px",
          }}
        >
          <CartaoAcao
            emoji="➕"
            titulo="Criar um grupo"
            texto="Chame a galera e monte um canal novo"
            onClick={() =>
              openModal({
                type: "create_group_or_server",
                client: client()!,
              })
            }
          />
          <CartaoAcao
            emoji="⚙️"
            titulo="Configurações"
            texto="Microfone, câmera, tema e notificações"
            onClick={() => openModal({ type: "settings", config: "user" })}
          />
          <CartaoAcao
            emoji="📖"
            titulo="Como usar o Callju"
            texto="Primeira vez aqui? Começa por aqui"
            onClick={() => setGuiaAberto(true)}
          />
          <CartaoAcao
            emoji="🧡"
            titulo="Me ajude a manter no ar"
            texto="O servidor tem custo mensal"
            onClick={() => setPixAberto(true)}
            destaque
          />
        </div>

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
