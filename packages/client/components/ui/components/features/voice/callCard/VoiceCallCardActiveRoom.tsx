import { useLingui } from "@lingui/solid/macro";
import { createResizeObserver } from "@solid-primitives/resize-observer";
import { createEffect, createMemo, For, onMount, Show } from "solid-js";
import { Motion, Presence } from "solid-motionone";
import { TrackLoop } from "solid-livekit-components";
import { styled } from "styled-system/jsx";

import { useDevice } from "@revolt/common";
import { InRoom, useVoice } from "@revolt/rtc";
import { IconButton } from "@revolt/ui/components/design";
import { Symbol } from "@revolt/ui/components/utils/Symbol";
import { scrollableStyles } from "@revolt/ui/directives";

import { EsperandoConexao } from "./EsperandoConexao";
import { ParticipantTile, tile } from "./ParticipantTile";
import { VoiceCallCardActions } from "./VoiceCallCardActions";
import { VoiceCallCardStatus } from "./VoiceCallCardStatus";

/**
 * Call card (active)
 */
export function VoiceCallCardActiveRoom() {
  const voice = useVoice();
  const collapsed = createMemo(() => voice.layout() === "collapsed");
  const telaCheia = createMemo(() => voice.layout() === "fullscreen");

  return (
    <View collapsed={collapsed()} fullscreen={telaCheia()}>
      <Participants />
      <Show
        when={telaCheia()}
        fallback={
          <VoiceCallControls>
            <VoiceCallControlHolder left collapsed={collapsed()}>
              <VoiceCallCardStatus />
            </VoiceCallControlHolder>
            <VoiceCallCardActions size="sm" />
            <VoiceCallControlHolder right collapsed={collapsed()}>
              <LayoutButtons />
            </VoiceCallControlHolder>
          </VoiceCallControls>
        }
      >
        {/* Em tela cheia o video ocupa tudo e os botoes ficam por cima,
            apagados ate o mouse chegar perto. Nada de faixa preta roubando
            altura da imagem. */}
        <ControlesFlutuantes>
          <VoiceCallCardActions size="sm" />
          <LayoutButtons />
        </ControlesFlutuantes>
      </Show>
    </View>
  );
}

function LayoutButtons() {
  const voice = useVoice();
  const device = useDevice();
  const { t } = useLingui();

  return (
    <>
      {/* TODO: Refactor call controls on mobile to make these buttons not overflow */}
      <Show when={device.layout() === "desktop"}>
        <IconButton
          size="sm"
          variant="standard"
          onPress={() => voice.toggleLayout("collapsed")}
          use:floating={{
            tooltip: {
              placement: "top",
              content: t`Collapse call window`,
            },
          }}
        >
          <Symbol>unfold_less</Symbol>
        </IconButton>
        <IconButton
          size="sm"
          variant="standard"
          onPress={() => voice.toggleLayout("expanded")}
          use:floating={{
            tooltip: {
              placement: "top",
              content:
                voice.layout() === "expanded"
                  ? t`Restore call window`
                  : t`Maximize call window`,
            },
          }}
        >
          <Show
            when={voice.layout() === "expanded"}
            fallback={<Symbol>open_in_full</Symbol>}
          >
            <Symbol>close_fullscreen</Symbol>
          </Show>
        </IconButton>
      </Show>
      <IconButton
        size="sm"
        variant={"standard"}
        onPress={() => voice.toggleLayout("fullscreen")}
      >
        <Show
          when={voice.layout() === "fullscreen"}
          fallback={<Symbol>fullscreen</Symbol>}
        >
          <Symbol>fullscreen_exit</Symbol>
        </Show>
      </IconButton>
    </>
  );
}

const TILE_MIN_WIDTH = "250px",
  TILE_MIN_FOCUS_HEIGHT = "100px";

/**
 * Show a grid of participants
 */
function Participants() {
  const voice = useVoice();
  const { t } = useLingui();

  // Modify this value to get test tracks
  const testTrackCount = 0;

  let callRef: HTMLDivElement | undefined;

  const tileWidth = () => {
    const vidWidth = Math.round(
      100 / (voice.vidTracks().length + testTrackCount),
    );
    return `max(${TILE_MIN_WIDTH}, ${vidWidth}% - var(--gap-md))`;
  };

  // Clear out any focus when the track that was focused is no longer available.
  createEffect(() => {
    if (!voice.focusTrack()) voice.toggleFocus();
  });

  onMount(() => {
    createResizeObserver(callRef, ({ width, height }, el) => {
      if (el === callRef) {
        el.style.setProperty("--vc-w", `${width}px`);
        el.style.setProperty("--vc-h", `${height}px`);
      }
    });
  });

  return (
    <Call ref={callRef} class={voice.focusId() ? "" : scrollableStyles()}>
      {/* Enquanto a conexao nao fecha, a pessoa ja se ve na chamada.
          A troca entre esperar e estar na call e uma passagem: a foto piscando
          sai crescendo e sumindo enquanto o quadrinho entra. Antes um sumia e
          o outro aparecia no mesmo quadro, o que cortava a continuidade. */}
      <Presence>
        <Show when={voice.state() !== "CONNECTED"}>
          <Motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.06 }}
            transition={{ duration: 0.34, easing: [0.22, 1, 0.36, 1] }}
            style={{
              position: "absolute",
              inset: 0,
              "z-index": 2,
              "pointer-events": "none",
            }}
          >
            <EsperandoConexao />
          </Motion.div>
        </Show>
      </Presence>
      <InRoom>
        <FocusedParticipant />
        <Show when={voice.focusId() && voice.layout() !== "collapsed"}>
          <ShowBarButtonHolder>
            <div style={{ "margin-bottom": "10px" }}>
              <IconButton
                size="xs"
                variant={"tonal"}
                onPress={() => voice.toggleShowBar()}
                use:floating={{
                  tooltip: {
                    placement: "top",
                    content: voice.showBar() ? t`Hide Others` : t`Show Others`,
                  },
                }}
              >
                <Show
                  when={voice.showBar()}
                  fallback={<Symbol>keyboard_arrow_up</Symbol>}
                >
                  <Symbol>keyboard_arrow_down</Symbol>
                </Show>
              </IconButton>
            </div>
          </ShowBarButtonHolder>
        </Show>
        <Grid
          focus={!!voice.focusId()}
          show={voice.showBar()}
          class={voice.focusId() ? scrollableStyles({ direction: "x" }) : ""}
          style={{ "--vc-tile-width": tileWidth() }}
        >
          <TrackLoop
            tracks={() => voice.vidTracks().filter((t) => !voice.isFocus(t))}
          >
            {() => <ParticipantTile />}
          </TrackLoop>
          <For each={Array(testTrackCount)}>
            {() => (
              <div
                class={
                  tile({ fullscreen: voice.layout() === "fullscreen" }) +
                  " vc_tile"
                }
              />
            )}
          </For>
        </Grid>
      </InRoom>
    </Call>
  );
}

function FocusedParticipant() {
  const voice = useVoice();

  return (
    <Show when={voice.focusTrack()}>
      <TrackLoop tracks={() => [voice.focusTrack()!]}>
        {() => (
          <FocusBox>
            <ParticipantTile focus />
          </FocusBox>
        )}
      </TrackLoop>
    </Show>
  );
}

const View = styled("div", {
  base: {
    position: "relative",
    minHeight: 0,
    height: "100%",
    width: "100%",

    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: "var(--gap-md)",
    padding: "var(--gap-md)",
    transition: "padding var(--transitions-medium)",
  },
  variants: {
    collapsed: {
      true: { padding: 0 },
    },
    fullscreen: {
      true: {
        padding: 0,
        gap: 0,
        background: "#000",
      },
    },
  },
});

const ControlesFlutuantes = styled("div", {
  base: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "var(--gap-lg)",

    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "var(--gap-md)",

    zIndex: 10,
    opacity: 0.25,
    transition: "opacity var(--transitions-medium)",
    _hover: {
      opacity: 1,
    },
  },
});

const VoiceCallControls = styled("div", {
  base: {
    display: "flex",
    flexShrink: 0,
    overflow: "hidden",
  },
});

const VoiceCallControlHolder = styled("div", {
  base: {
    display: "flex",
    flex: 1,
    alignSelf: "center",
    gap: "var(--gap-md)",
    padding: "var(--gap-md)",
    opacity: 1,
    transition: "opacity var(--transitions-medium)",
  },
  variants: {
    left: {
      true: {
        justifyContent: "flex-start",
        overflow: "hidden",
      },
    },
    right: {
      true: {
        justifyContent: "flex-end",
      },
    },
    collapsed: {
      true: {
        opacity: 0,
        pointerEvents: "none",
      },
    },
  },
});

const ShowBarButtonHolder = styled("div", {
  base: {
    height: 0,
    alignSelf: "center",
    overflow: "visible",
    display: "flex",
    flexDirection: "column-reverse",
  },
});

const Call = styled("div", {
  base: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-sm)",
    flexGrow: 1,
    minHeight: 0,
  },
});

const Grid = styled("div", {
  base: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "safe center",
    alignContent: "safe center",
    minHeight: "100%",
    gap: "var(--gap-md)",
  },

  variants: {
    focus: {
      true: {
        flexDirection: "column",
        height: `max(20%, ${TILE_MIN_FOCUS_HEIGHT})`,
        minHeight: 0,
        transition: "height .3s ease",

        "& .vc_tile": {
          width: "auto",
          height: "100%",
        },
      },
    },
    show: {
      false: {
        height: 0,
      },
    },
  },
});

const FocusBox = styled("div", {
  base: {
    height: 0,
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    margin: "0 auto",
  },
});
