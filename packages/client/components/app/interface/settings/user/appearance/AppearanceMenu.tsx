import { createSignal, For, Match, Show, Switch } from "solid-js";

import { Trans, useLingui } from "@lingui/solid/macro";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useUser } from "@revolt/client";
import {
  UNICODE_EMOJI_PACKS,
  UnicodeEmoji,
  UnicodeEmojiPacks,
} from "@revolt/markdown/emoji/UnicodeEmoji";
import { useState } from "@revolt/state";
import { TEMAS_PRONTOS, TemaPronto } from "@revolt/state/stores/Theme";
import {
  Avatar,
  Button,
  Checkbox,
  Column,
  FloatingSelect,
  IconButton,
  MenuItem,
  MessageContainer,
  Row,
  Slider,
  Text,
} from "@revolt/ui";
import {
  FONT_KEYS,
  FONTS,
  Fonts,
  MONOSPACE_FONT_KEYS,
  MONOSPACE_FONTS,
  MonospaceFonts,
} from "@revolt/ui/themes/fonts";

import MDPalette from "@material-design-icons/svg/outlined/palette.svg?component-solid";

/**
 * All appearance options for the client
 */
export function AppearanceMenu() {
  const user = useUser();
  const state = useState();
  const { t } = useLingui();
  const [pickerRef, setPickerRef] = createSignal<HTMLDivElement>();

  function loadFonts() {
    for (const f in FONTS) FONTS[f as Fonts].load();
  }

  function loadMonoFonts() {
    for (const f in MONOSPACE_FONTS)
      MONOSPACE_FONTS[f as MonospaceFonts].load();
  }

  return (
    <Column gap="lg">
      <Column>
        <Text class="title" size="small">
          <Trans>Temas</Trans>
        </Text>

        <Temas>
          <For each={Object.entries(TEMAS_PRONTOS)}>
            {([chave, tema]) => (
              <CartaoTema
                escolhido={state.theme.tema === chave}
                onClick={() => state.theme.escolherTema(chave as TemaPronto)}
                type="button"
              >
                <Bolinha style={{ background: tema.cor }} />
                {tema.nome}
              </CartaoTema>
            )}
          </For>
        </Temas>

        <Text class="title" size="small">
          <Trans>Claro ou escuro</Trans>
        </Text>

        <Row justify="stretch">
          <Button
            group="connected-start"
            groupActive={state.theme.mode === "light"}
            onPress={() => state.theme.setMode("light")}
          >
            <Trans>Light</Trans>
          </Button>
          <Button
            group="connected"
            groupActive={state.theme.mode === "dark"}
            onPress={() => state.theme.setMode("dark")}
          >
            <Trans>Dark</Trans>
          </Button>
          <Button
            group="connected-end"
            groupActive={state.theme.mode === "system"}
            onPress={() => state.theme.setMode("system")}
          >
            <Trans>System</Trans>
          </Button>
        </Row>

        {/* Tema seu.
            Escolher uma cor aqui cria o seu tema; os prontos continuam
            intactos, cada um com a cor que foi pensada pra ele. */}
        <Text class="title" size="small">
          <Trans>Fazer o meu tema</Trans>
        </Text>

        <Row align gap="md">
          <IconButton
            ref={setPickerRef}
            variant={state.theme.tema === "personalizado" ? "filled" : "tonal"}
            shape="square"
            size="md"
            onPress={() => pickerRef()?.click()}
          >
            <MDPalette />
          </IconButton>
          <input
            ref={setPickerRef}
            type="color"
            value={state.theme.m3Accent ?? "#ffffff"}
            onInput={(e) => {
              const colour = (e.currentTarget as HTMLInputElement).value;
              state.theme.setM3Accent(colour);
            }}
            style={{
              position: "absolute",
              opacity: 0,
              width: "0px",
              height: "0px",
              padding: 0,
              border: "none",
            }}
          />
          <Text size="small">
            <Show
              when={state.theme.tema === "personalizado"}
              fallback={<Trans>Escolher uma cor e montar o meu tema</Trans>}
            >
              <Trans>Tema seu, na cor {state.theme.m3Accent}</Trans>
            </Show>
          </Text>
        </Row>

        <Row justify="stretch">
          <Button variant="outlined" onPress={() => state.theme.restaurarPadrao()}>
            <Trans>Voltar pro tema do Callju</Trans>
          </Button>
        </Row>
      </Column>

      <Column>
        <Text class="title" size="small">
          <Trans>Display & Text</Trans>
        </Text>

        <Checkbox checked={state.theme.blur} onChange={state.theme.toggleBlur}>
          <Trans>
            Enable transparency glass/blur effects (slow on older machines)
          </Trans>
        </Checkbox>

        <Preview>
          <MessagePreview>
            <MessageContainer
              avatar={
                <Avatar
                  size={36}
                  src={user()?.animatedAvatarURL}
                  fallback={user()?.displayName}
                />
              }
              timestamp={new Date()}
              username={user()?.displayName}
              pronouns={user()?.pronouns}
              isLink="hide"
            >
              Sphinx of black quartz, judge my vow
            </MessageContainer>
            <MessageContainer
              avatar={<Avatar size={36} fallback={"M"} />}
              timestamp={new Date()}
              username={"MysticPixie"}
              isLink="hide"
            >
              <code class={css({ fontFamily: `var(--fonts-monospace)` })}>
                The quick brown fox jumped over the lazy dog
              </code>
            </MessageContainer>
          </MessagePreview>
        </Preview>

        <Text class="label">
          <Trans>Message Size</Trans>
        </Text>
        <Slider
          min={12}
          max={24}
          value={state.theme.messageSize}
          onInput={(event) =>
            (state.theme.messageSize = event.currentTarget.value)
          }
        />
      </Column>

      <Text class="label">
        <Trans>Message Group Spacing</Trans>
      </Text>
      <Slider
        min={0}
        max={16}
        value={state.theme.messageGroupSpacing}
        onInput={(event) =>
          (state.theme.messageGroupSpacing = event.currentTarget.value)
        }
      />

      <FloatingSelect
        label={t`Interface Font`}
        value={state.theme.interfaceFont}
        onChange={(e) =>
          state.theme.setInterfaceFont(e.currentTarget.value as Fonts)
        }
        onOpened={loadFonts}
      >
        <For each={FONT_KEYS}>
          {(key) => (
            <MenuItem value={key} style={{ "font-family": key }}>
              {key}
            </MenuItem>
          )}
        </For>
      </FloatingSelect>

      <FloatingSelect
        label={t`Monospace Font`}
        value={state.theme.monospaceFont}
        onChange={(e) =>
          state.theme.setMonospaceFont(e.currentTarget.value as MonospaceFonts)
        }
        onOpened={loadMonoFonts}
      >
        <For each={MONOSPACE_FONT_KEYS}>
          {(key) => (
            <MenuItem value={key} style={{ "font-family": key }}>
              {key}
            </MenuItem>
          )}
        </For>
      </FloatingSelect>

      <Column>
        <Text class="title" size="small">
          <Trans>Chat Input</Trans>
        </Text>

        <Checkbox
          checked={state.settings.getValue("appearance:show_send_button")}
          onChange={(event) =>
            state.settings.setValue(
              "appearance:show_send_button",
              event.currentTarget.checked,
            )
          }
        >
          <Trans>Show send message button</Trans>
        </Checkbox>

        <FloatingSelect
          label={t`Emoji Pack (affects your messages only)`}
          value={state.settings.getValue("appearance:unicode_emoji")}
          onChange={(e) =>
            state.settings.setValue(
              "appearance:unicode_emoji",
              e.currentTarget.value as never,
            )
          }
        >
          <For each={UNICODE_EMOJI_PACKS}>
            {(pack) => <EmojiPack pack={pack} />}
          </For>
        </FloatingSelect>
      </Column>
    </Column>
  );
}

/**
 * Render an individual emoji pack
 * @param pack Pack
 */
function EmojiPack(props: { pack: UnicodeEmojiPacks }) {
  return (
    <MenuItem value={props.pack}>
      <Row>
        <UnicodeEmoji emoji="😃" pack={props.pack} />
        <UnicodeEmoji emoji="😂" pack={props.pack} />
        <UnicodeEmoji emoji="😶‍🌫️" pack={props.pack} />
        <UnicodeEmoji emoji="🤨" pack={props.pack} />
        <UnicodeEmoji emoji="🤔" pack={props.pack} />
        <Switch>
          <Match when={props.pack === "fluent-3d"}>Fluent 3D</Match>
          <Match when={props.pack === "fluent-color"}>Fluent Color</Match>
          <Match when={props.pack === "fluent-flat"}>Fluent Flat</Match>
          <Match when={props.pack === "mutant"}>Mutant Remix</Match>
          <Match when={props.pack === "noto"}>Noto</Match>
          {/* <Match when={props.pack === "openmoji"}>OpenMoji</Match> */}
          <Match when={props.pack === "twemoji"}>Twemoji</Match>
        </Switch>
      </Row>
    </MenuItem>
  );
}

const Preview = styled("div", {
  base: {
    height: "126px",
    overflow: "hidden",
    borderRadius: "var(--borderRadius-lg)",
    background: "var(--md-sys-color-surface-container-lowest)",
  },
});

const MessagePreview = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    padding: "var(--gap-md)",
    gap: "var(--message-group-spacing)",
  },
});

const Temas = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
    gap: "var(--gap-sm)",
  },
});

const CartaoTema = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",

    padding: "10px 12px",
    borderRadius: "var(--borderRadius-lg)",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container)",
    color: "var(--md-sys-color-on-surface)",

    font: "inherit",
    fontSize: "0.9em",
    cursor: "pointer",
    transition: "background 150ms ease, border-color 150ms ease",

    _hover: {
      background: "var(--md-sys-color-surface-container-high)",
    },
  },
  variants: {
    escolhido: {
      true: {
        borderColor: "var(--callju-accent)",
        background: "var(--callju-selecionado)",
      },
    },
  },
});

const Bolinha = styled("span", {
  base: {
    width: "14px",
    height: "14px",
    borderRadius: "var(--borderRadius-full)",
    flexShrink: 0,
    boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.35) inset",
  },
});
