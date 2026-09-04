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
import MdContentCopy from "@material-design-icons/svg/filled/content_copy.svg?component-solid";
import MdSettings from "@material-design-icons/svg/filled/settings.svg?component-solid";

import Wordmark from "../../public/assets/web/wordmark.svg?component-solid";

import { HeaderIcon } from "./common/CommonHeader";

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
          <Wordmark
            class={css({
              width: "160px",
              fill: "var(--md-sys-color-on-surface)",
            })}
          />
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
              onClick={() => {
                navigator.clipboard
                  ?.writeText(CHAVE_PIX)
                  .then(() => alert("Chave Pix copiada! Valeu demais \u2764\ufe0f"))
                  .catch(() => alert("Chave Pix: " + CHAVE_PIX));
              }}
              description="O servidor tem custo mensal. Toda ajuda conta!"
              icon={<MdFavorite {...iconSize(22)} />}
            >
              Me ajude! (copiar Pix)
            </CategoryButton>
          </SeparatedColumn>
        </Buttons>

        <Show when={guiaAberto()}>
          <div
            style={{
              "max-width": "560px",
              margin: "16px auto 0",
              padding: "18px 20px",
              "border-radius": "12px",
              background: "var(--md-sys-color-surface-container)",
              "line-height": "1.65",
              "font-size": "0.95em",
            }}
          >
            <b style={{ "font-size": "1.1em" }}>Guia rapido</b>

            <p>
              <b>1. Entrar no servidor.</b> Use o botao no fim deste guia (ou o
              primeiro cartao da tela inicial). Voce entra na hora.
            </p>
            <p>
              <b>2. Conversar por voz.</b> Clique num canal com o icone de
              alto-falante. Voce entra automaticamente &mdash; nao precisa
              chamar ninguem.
            </p>
            <p>
              <b>3. Compartilhar a tela.</b> Ja dentro do canal de voz, use o
              botao de tela na barra de controles. Da pra escolher a tela toda
              ou so uma janela, com ou sem o audio do jogo.
            </p>
            <p>
              <b>4. Microfone com problema?</b> Configuracoes &rarr; Audio. Se
              voce usa fone Bluetooth, prefira o microfone do notebook: o
              Bluetooth derruba a qualidade do som pros dois lados.
            </p>
            <p>
              <b>5. Instalar como app.</b> No Chrome, menu &rarr; "Instalar".
              Fica com cara de programa, sem aba de navegador.
            </p>

            <Show when={conviteConfigurado}>
              <div style={{ margin: "18px 0 6px" }}>
                <Button onPress={() => navigate(`/invite/${CONVITE_SERVIDOR}`)}>
                  Entrar no servidor
                </Button>
                <div
                  style={{
                    opacity: "0.55",
                    "font-size": "0.9em",
                    "margin-top": "6px",
                  }}
                >
                  pra conversar com a galera e por aqui &gt;
                </div>
              </div>
            </Show>

            <p style={{ opacity: "0.6", "margin-bottom": "0" }}>
              Audio em 48 kHz e tela em 1080p, num servidor em Sao Paulo.
            </p>
          </div>
        </Show>
        <Show when={IS_DEV}>
          <Button onPress={() => navigate("/dev")}>
            Open Development Page
          </Button>
        </Show>
      </div>
    </Base>
  );
}
