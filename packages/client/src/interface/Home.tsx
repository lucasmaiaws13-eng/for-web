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
import { GuiaModal, PixModal } from "./LucascordModals";

// >>> TROQUE AQUI pela sua chave Pix (CPF, telefone, email ou aleatoria)
const CHAVE_PIX = "cole-sua-chave-pix-aqui";

// >>> TROQUE AQUI pelo codigo do convite permanente do servidor principal.
// So o codigo, nao a URL inteira. Ex: se o link e /invite/AbC123, use "AbC123".
// Enquanto estiver com o valor de exemplo, o botao fica escondido.
const CONVITE_SERVIDOR = "cole-o-codigo-do-convite-aqui";

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
 * Home page
 */
export function HomePage() {
  const { openModal } = useModals();
  const navigate = useNavigate();
  const client = useClient();
  const instance = useInstance();

  const [guiaAberto, setGuiaAberto] = createSignal(false);
  const [pixAberto, setPixAberto] = createSignal(false);
  const conviteConfigurado = CONVITE_SERVIDOR !== "cole-o-codigo-do-convite-aqui";

  return (
    <Base>
      <Header placement="primary">
        <HeaderIcon>
          <MdHome {...iconSize(22)} />
        </HeaderIcon>
        <Trans>Home</Trans>
      </Header>
      <div use:scrollable={{ class: content() }}>
        <Column>
          <div
            style={{
              "font-size": "2.4em",
              "font-weight": "800",
              "letter-spacing": "-0.03em",
              "line-height": "1.1",
              background:
                "linear-gradient(115deg, #a78bfa 0%, #f0abfc 45%, #7dd3fc 100%)",
              "-webkit-background-clip": "text",
              "background-clip": "text",
              color: "transparent",
            }}
          >
            Lucascord
          </div>
        </Column>
        <Buttons>
          <SeparatedColumn>
            <Show when={conviteConfigurado}>
              <CategoryButton
                onClick={() => navigate(`/invite/${CONVITE_SERVIDOR}`)}
                description="pra conversar com a galera e por aqui >"
                icon={<MdGroups3 {...iconSize(22)} />}
              >
                Entrar no servidor
              </CategoryButton>
            </Show>

            <CategoryButton
              onClick={() =>
                openModal({
                  type: "create_group_or_server",
                  client: client()!,
                })
              }
              description="Chame a galera e monte um canal novo."
              icon={<MdAddCircle />}
            >
              Criar um grupo ou servidor
            </CategoryButton>

            <CategoryButton
              onClick={() => setGuiaAberto((v) => !v)}
              description="Primeira vez aqui? Comeca por aqui."
              icon={<MdHelpCenter {...iconSize(22)} />}
            >
              Como usar o Lucascord
            </CategoryButton>
          </SeparatedColumn>

          <SeparatedColumn>
            <CategoryButton
              onClick={() => openModal({ type: "settings", config: "user" })}
              description="Microfone, camera, tema e notificacoes."
              icon={<MdSettings />}
            >
              Abrir configuracoes
            </CategoryButton>

            <CategoryButton
              variant="tertiary"
              onClick={() => setPixAberto(true)}
              description="O servidor tem custo mensal. Toda ajuda conta!"
              icon={<MdFavorite {...iconSize(22)} />}
            >
              Me ajude! (copiar Pix)
            </CategoryButton>
          </SeparatedColumn>
        </Buttons>

        <div
          style={{
            "max-width": "560px",
            margin: "4px auto 0",
            padding: "16px 18px",
            "border-radius": "14px",
            "border-inline-start": "4px solid var(--md-sys-color-primary)",
            background: "var(--md-sys-color-surface-container)",
            "line-height": "1.6",
            "font-size": "0.92em",
          }}
        >
          <div
            style={{
              "font-weight": "700",
              "margin-bottom": "8px",
              display: "flex",
              "align-items": "center",
              gap: "8px",
            }}
          >
            <span>🚧</span>
            <span>Estamos em fase de testes!</span>
          </div>

          <p style={{ margin: "0 0 10px", opacity: "0.82" }}>
            Se encontrar qualquer dificuldade, pode reportar pra mim
            diretamente (Lucas).
          </p>

          <p style={{ margin: "0 0 10px", opacity: "0.82" }}>
            Mas seja gentil! Não envie o Lucascord para muitas pessoas
            diferentes, e evite mandar muitos arquivos muito rápido. Agradeço
            demais!
          </p>

          <p style={{ margin: "0 0 12px", opacity: "0.82" }}>
            Atualmente tenho um custo mensal para manter o app rodando e com
            boa qualidade. Considere me ajudar!
          </p>

          <button
            onClick={() => setPixAberto(true)}
            style={{
              padding: "9px 16px",
              "border-radius": "99px",
              border: "none",
              cursor: "pointer",
              "font-weight": "600",
              "font-size": "0.95em",
              color: "var(--md-sys-color-on-primary)",
              background: "var(--md-sys-color-primary)",
            }}
          >
            💜 Quero ajudar
          </button>
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

        <Show when={IS_DEV}>
          <Button onPress={() => navigate("/dev")}>
            Open Development Page
          </Button>
        </Show>
      </div>
    </Base>
  );
}
