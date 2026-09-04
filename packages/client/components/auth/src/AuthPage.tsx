import { JSX } from "solid-js";

import { styled } from "styled-system/jsx";

import { Titlebar } from "@revolt/app/interface/desktop/Titlebar";
import { useState } from "@revolt/state";
import { IconButton, iconSize } from "@revolt/ui";

import MdDarkMode from "@material-design-icons/svg/filled/dark_mode.svg?component-solid";

import { FlowBase } from "./flows/Flow";

/**
 * Authentication page layout
 */
const Base = styled("div", {
  base: {
    width: "100%",
    height: "100%",
    padding: "40px 35px",

    userSelect: "none",
    overflowY: "scroll",

    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",

    mdDown: {
      padding: "30px 20px",
    },
  },
});

const Root = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    paddingBottom: "env(keyboard-inset-height)",

    color: "var(--md-sys-color-on-surface)",

    // Fundo em degrade: manchas translucidas por cima da cor do tema,
    // entao funciona tanto no modo escuro quanto no claro.
    background: `
      radial-gradient(900px 520px at 12% -8%, rgba(139, 92, 246, 0.28), transparent 62%),
      radial-gradient(760px 460px at 88% 4%, rgba(236, 72, 153, 0.20), transparent 58%),
      radial-gradient(820px 620px at 60% 108%, rgba(56, 189, 248, 0.18), transparent 60%),
      var(--md-sys-color-surface)
    `,
    backgroundAttachment: "fixed",
  },
});

/**
 * Top and bottom navigation bars
 */
const Nav = styled("div", {
  base: {
    height: "32px",
    display: "flex",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",

    textDecoration: "none",
  },
});

/**
 * Navigation items
 */
const NavItems = styled("div", {
  base: {
    gap: "10px",
    display: "flex",
    alignItems: "center",

    fontSize: "0.9em",
  },
  variants: {
    variant: {
      default: {
        "& > *": {
          textAlign: "center",
        },
      },
      stack: {
        md: {
          flexDirection: "column",
        },
      },
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

/**
 * Authentication page
 */
export function AuthPage(props: { children: JSX.Element }) {
  const state = useState();

  return (
    <Root>
      <Titlebar />
      <Base css={{ scrollbar: "hidden" }}>
        <Nav>
          <div />
          <IconButton
            variant="tonal"
            onPress={() =>
              state.theme.setMode(
                state.theme.activeTheme.darkMode ? "light" : "dark",
              )
            }
          >
            <MdDarkMode {...iconSize("24px")} />
          </IconButton>
        </Nav>
        <FlowBase>{props.children}</FlowBase>
        <Nav>
          <NavItems variant="stack">
            <span style={{ opacity: "0.35", "font-size": "0.85em" }}>
              Lucascord &middot; nosso canto na internet
            </span>
          </NavItems>
        </Nav>
      </Base>
    </Root>
  );
}
