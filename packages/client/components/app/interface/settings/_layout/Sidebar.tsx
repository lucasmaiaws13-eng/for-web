import { Accessor, For, Setter, Show, createMemo, createSignal, onMount } from "solid-js";

import { styled } from "styled-system/jsx";

import { Column, OverflowingText } from "@revolt/ui";

// import MdError from "@material-design-icons/svg/filled/error.svg?component-solid";
// import MdOpenInNew from "@material-design-icons/svg/filled/open_in_new.svg?component-solid";
import { SettingsList } from "..";
import { useSettingsNavigation } from "../Settings";

import {
  SidebarButton,
  SidebarButtonContent,
  SidebarButtonTitle,
} from "./SidebarButton";

/**
 * Settings Sidebar Layout
 */
export function SettingsSidebar(props: {
  list: Accessor<SettingsList<unknown>>;
  setPage: Setter<string | undefined>;
  page: Accessor<string | undefined>;
}) {
  const { navigate } = useSettingsNavigation();
  const [busca, setBusca] = createSignal("");

  /**
   * Lista filtrada pela busca.
   *
   * A tela de configuracoes cresceu e virou uma lista longa de nomes. Procurar
   * pelo nome e mais rapido que passar o olho por tudo, e quando o campo esta
   * vazio nada muda.
   */
  const categorias = createMemo(() => {
    const termo = busca().trim().toLowerCase();
    const entradas = props.list().entries;
    if (!termo) return entradas;

    return entradas
      .map((categoria) => ({
        ...categoria,
        entries: categoria.entries.filter((entrada) =>
          String(entrada.title ?? "")
            .toLowerCase()
            .includes(termo),
        ),
      }))
      .filter((categoria) => categoria.entries.length);
  });

  /**
   * Select first page on load
   */
  onMount(() => {
    if (!props.page()) {
      props.setPage(props.list().entries[0].entries[0].id);
    }
  });

  return (
    <Base class="settings_sidebar">
      <div use:invisibleScrollable>
        <Content class="content">
          <Campo
            type="search"
            placeholder="Buscar nas configurações"
            value={busca()}
            onInput={(e) => setBusca(e.currentTarget.value)}
          />

          <Column gap="lg">
            {props.list().prepend}
            <For each={categorias()}>
              {(category) => (
                <Show when={!category.hidden}>
                  <Column>
                    <Show when={category.title}>
                      <CategoryTitle>{category.title}</CategoryTitle>
                    </Show>
                    <Column gap="s">
                      <For each={category.entries}>
                        {(entry) => (
                          <Show when={!entry.hidden}>
                            <SidebarButton
                              onClick={() => navigate(entry)}
                              aria-selected={
                                props.page()?.split("/")[0] ===
                                entry.id?.split("/")[0]
                              }
                            >
                              <SidebarButtonTitle>
                                {entry.icon}
                                <SidebarButtonContent>
                                  <OverflowingText>
                                    {entry.title}
                                  </OverflowingText>
                                </SidebarButtonContent>
                              </SidebarButtonTitle>
                              {/*<SidebarButtonIcon>
                                <MdOpenInNew
                                  {...iconSize(20)}
                                  fill={theme!.colour("primary")}
                                />
                                <MdError
                                  {...iconSize(20)}
                                  fill={theme!.colour("primary")}
                                />
                              </SidebarButtonIcon>*/}
                            </SidebarButton>
                          </Show>
                        )}
                      </For>
                    </Column>
                  </Column>
                </Show>
              )}
            </For>
            {props.list().append}
          </Column>
        </Content>
      </div>
    </Base>
  );
}

/**
 * Base layout of the sidebar
 */
const Base = styled("div", {
  base: {
    display: "flex",
    flex: "1 0 218px",
    paddingLeft: "8px",
    justifyContent: "flex-end",
    height: "100%",

    _phone: {
      position: "absolute",
      width: "100vw",
      paddingLeft: "12px",

      "& > *": {
        width: "100%",
      },
    },
  },
});

/**
 * Aligned content within the sidebar
 */
const Content = styled("div", {
  base: {
    minWidth: "230px",
    maxWidth: "300px",
    padding: "74px 0 8px",
    display: "flex",
    gap: "2px",

    flexDirection: "column",

    "& a > div": {
      margin: 0,
    },

    _tablet: {
      padding: "8px 0",
    },
    _phone: {
      padding: "8px 0",
      maxWidth: "unset",
    },
  },
});

/**
 * Campo de busca no topo da navegacao
 */
const Campo = styled("input", {
  base: {
    width: "calc(100% - 12px)",
    marginBottom: "6px",
    padding: "9px 12px",

    borderRadius: "12px",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container)",
    color: "var(--md-sys-color-on-surface)",

    font: "inherit",
    fontSize: "0.88em",

    transition: "border-color var(--mov-estado), background var(--mov-estado)",

    "&::placeholder": {
      color: "var(--md-sys-color-on-surface-variant)",
    },

    "&:focus": {
      outline: "none",
      borderColor: "var(--callju-accent-line)",
      background: "var(--md-sys-color-surface-container-high)",
    },
  },
});

/**
 * Titles for each category
 */
const CategoryTitle = styled("span", {
  base: {
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",

    textTransform: "uppercase",
    fontSize: "0.68rem",
    fontWeight: 700,
    letterSpacing: "0.12em",
    margin: "6px 8px 2px",
    marginInlineEnd: "20px",

    color: "var(--md-sys-color-on-surface-variant)",
    opacity: 0.7,
  },
});
