import { createEffect, JSX, splitProps } from "solid-js";
import { styled } from "styled-system/jsx";

import { MdRipple } from "@material/web/ripple/ripple";
import { useState } from "@revolt/state";
import { Ripple } from "@revolt/ui";
import { SlideState } from "@revolt/ui/components/navigation/SlideDrawer";

/**
 * Sidebar button
 */
export function SidebarButton(
  props: JSX.HTMLAttributes<HTMLAnchorElement> & {
    "aria-selected"?: boolean;
    noDrawer?: boolean;
  },
) {
  const { diagDrawer } = useState();
  const [local, other] = splitProps(props, ["onClick", "noDrawer", "class"]);
  let ripple: MdRipple | undefined;

  createEffect(() => {
    const sPos = diagDrawer()?.state;
    if (sPos === SlideState.SHOWN || sPos === SlideState.HIDDEN)
      //@ts-expect-error private call
      ripple?.endPressAnimation();
  });

  function onClick(e: Event) {
    if (!local.noDrawer) diagDrawer()?.setShown(true);
    // @ts-expect-error callable listener
    if (local.onClick) local.onClick(e);
  }

  return (
    <SidebarButtonBase
      {...other}
      class={"button" + (local.class ? " " + local.class : "")}
      onClick={onClick}
    >
      <Ripple ref={ripple} />
      {props.children}
    </SidebarButtonBase>
  );
}

const SidebarButtonBase = styled("a", {
  base: {
    // for <Ripple />:
    position: "relative",
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    padding: "8px 10px",
    fontWeight: 500,
    marginInlineEnd: "12px",
    fontSize: "15px",
    userSelect: "none",
    transition:
      "background var(--mov-toque), color var(--mov-estado), transform var(--mov-toque)",
    color: "var(--md-sys-color-on-surface-variant)",
    fill: "var(--md-sys-color-on-surface-variant)",
    background: "unset",
    borderRadius: "12px",

    _hover: {
      background: "var(--callju-hover)",
      color: "var(--md-sys-color-on-surface)",
      fill: "var(--md-sys-color-on-surface)",
    },

    "&:active": {
      transform: "scale(0.99)",
    },

    "& svg": {
      flexShrink: 0,
    },
  },
  variants: {
    "aria-selected": {
      true: {
        // Mesma selecao discreta da lista de canais: um degrau de cinza e o
        // texto na cor da marca
        background: "var(--callju-selecionado)",
        color: "var(--callju-accent-claro)",
        fill: "var(--callju-accent-claro)",
      },
    },
  },
});

export const SidebarButtonTitle = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexGrow: 1,
    minWidth: 0,
    paddingInlineEnd: "8px",
  },
});

export const SidebarButtonContent = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
});

export const SidebarButtonIcon = styled("div", {
  base: {
    display: "flex",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flexShrink: 0,
    gap: "2px",
  },
});
