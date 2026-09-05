import { createSignal, Show } from "solid-js";
import {
  TrackReference,
  useEnsureParticipant,
  useIsMuted,
  useIsSpeaking,
  useTrackRefContext,
  VideoTrack,
} from "solid-livekit-components";

import { Track } from "livekit-client";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { UserContextMenu } from "@revolt/app";
import { useUser } from "@revolt/markdown/users";
import { useVoice } from "@revolt/rtc";
import { useState } from "@revolt/state";
import { Avatar } from "@revolt/ui/components/design";
import { Row } from "@revolt/ui/components/layout";
import { OverflowingText } from "@revolt/ui/components/utils";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { VoiceStatefulUserIcons } from "../VoiceStatefulUserIcons";

type TileProps = {
  focus?: boolean;
};

/**
 * Individual participant tile
 */
export function ParticipantTile(props: TileProps) {
  const voice = useVoice();
  const state = useState();
  const participant = useEnsureParticipant();
  const track = useTrackRefContext();
  const user = useUser(participant.identity);

  let videoRef: HTMLVideoElement | undefined;

  const [videoDims, setVideoDims] = createSignal<{
    height: number;
    width: number;
  }>({ height: 0, width: 0 });

  const isMuted = useIsMuted({
    participant,
    source: Track.Source.Microphone,
  });

  const isScreenShareAudioMuted = useIsMuted({
    participant,
    source: Track.Source.ScreenShareAudio,
  });

  const isRemoteScreenShareMuted = useIsMuted({
    participant,
    source: Track.Source.ScreenShare,
  });

  const isScreenShareAudioUserMuted = () =>
    !user().user!.self && state.voice.getScreenShareMuted(user().user!.id)
      ? "by-user"
      : isScreenShareAudioMuted() || false;

  const isVideoMuted = useIsMuted({
    participant,
    source: Track.Source.Camera,
  });

  const isVideo = () => !isVideoMuted();
  const isScreenShare = () => track.source === Track.Source.ScreenShare;
  const isSpeaking = useIsSpeaking(participant);

  /**
   * Se o video desta pessoa deve aparecer
   *
   * Camera continua como sempre foi. Transmissao de tela agora espera um
   * clique: antes o quadro era montado sozinho e, como o VideoTrack se
   * inscreve na faixa ao aparecer, todo mundo caia dentro da live sem pedir.
   * A propria tela de quem transmite segue visivel, senao a pessoa perde a
   * previa do que esta mostrando.
   */
  const assistindo = () =>
    !isScreenShare() ||
    participant.isLocal ||
    voice.estaAssistindo(participant.identity);

  const getHeight = () => {
    if (!props.focus || videoDims().height == 0) return {};
    // Calculate the aspect ratio
    const ratio = videoDims().width / videoDims().height;

    return ratio > 1
      ? { height: `min(var(--vc-w) / ${ratio}, 100%)` }
      : { height: "100%" };
  };

  return (
    <Show
      when={!isScreenShare() || !assistindo() || !isRemoteScreenShareMuted()}
    >
      <div
        class={
          tile({
            speaking: !isScreenShare() && isSpeaking(),
            video: isVideo() || isScreenShare(),
            fullscreen: voice.layout() === "fullscreen",
            ...props,
          }) + (isScreenShare() ? " vc_tile group" : " vc_tile")
        }
        onClick={() => voice.toggleFocus(track)}
        use:floating={{
          // TODO: Conflicts with focusing, maybe only show if clicking name itself
          //   userCard: {
          //     user: user().user!,
          //     member: user().member,
          //   },
          contextMenu: () => (
            <UserContextMenu
              user={user().user!}
              member={user().member}
              inVoice={!isScreenShare()}
              isScreenshare={isScreenShare()}
            />
          ),
        }}
        style={{ ...getHeight() }}
      >
        <Show
          when={(isVideo() || isScreenShare()) && assistindo()}
          fallback={
            <Show
              when={isScreenShare() && !assistindo()}
              fallback={
                <AvatarOnly>
                  <Avatar
                    src={user().avatar}
                    fallback={user().username}
                    size={48}
                    interactive={false}
                  />
                </AvatarOnly>
              }
            >
              <ConviteLive>
                <div
                  style={{
                    display: "flex",
                    "align-items": "center",
                    gap: "8px",
                    "min-width": "0",
                    "font-size": "0.9em",
                    "font-weight": "600",
                  }}
                >
                  <span
                    class="callju-speaking"
                    style={{
                      width: "8px",
                      height: "8px",
                      "flex-shrink": "0",
                      "border-radius": "99px",
                      background: "var(--callju-accent)",
                    }}
                  />
                  <OverflowingText>
                    {user().username} está ao vivo
                  </OverflowingText>
                </div>

                <button
                  class="callju-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    voice.alternarAssistir(participant.identity);
                  }}
                  style={{
                    padding: "9px 20px",
                    "font-size": "0.85em",
                  }}
                >
                  Assistir
                </button>
              </ConviteLive>
            </Show>
          }
        >
          <VideoTrack
            style={{
              "grid-area": "1/1",
              "object-fit": "contain",
              width: "100%",
              height: "100%",
              overflow: "hidden",
            }}
            trackRef={track as TrackReference}
            manageSubscription={true}
            ref={videoRef}
            on:resize={() => {
              setVideoDims({
                height: videoRef?.videoHeight || 0,
                width: videoRef?.videoWidth || 0,
              });
            }}
          />
        </Show>
        <Overlay showOnHover={isScreenShare()}>
          <OverlayInner>
            <OverflowingText>{user().username}</OverflowingText>
            <Row gap="md">
              {isScreenShare() ? (
                <>
                  <Show when={isScreenShareAudioUserMuted()}>
                    <Symbol
                      size={18}
                      color={
                        isScreenShareAudioUserMuted() === "by-user"
                          ? "var(--md-sys-color-error)"
                          : undefined
                      }
                    >
                      no_sound
                    </Symbol>
                  </Show>
                  <Show when={assistindo() && !participant.isLocal}>
                    <button
                      class="callju-btn-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        voice.alternarAssistir(participant.identity);
                      }}
                      style={{
                        padding: "5px 12px",
                        "font-size": "0.75em",
                        "white-space": "nowrap",
                      }}
                    >
                      Parar de assistir
                    </button>
                  </Show>
                </>
              ) : (
                <VoiceStatefulUserIcons
                  userId={participant.identity}
                  muted={isMuted()}
                  camera={isVideo()}
                />
              )}
            </Row>
          </OverlayInner>
        </Overlay>
      </div>
    </Show>
  );
}

export const tile = cva({
  base: {
    display: "grid",
    aspectRatio: "16/9",
    transition: "all .3s ease, width 0s, height 0s",
    borderRadius: "var(--borderRadius-lg)",
    width: "var(--vc-tile-width)",
    maxWidth: "calc(var(--vc-h) * 16 / 9)",
    cursor: "pointer",

    color: "var(--md-sys-color-on-surface)",
    background: "#0002",

    overflow: "hidden",
    outlineWidth: "3px",
    outlineStyle: "solid",
    outlineOffset: "-3px",
    outlineColor: "transparent",
  },
  variants: {
    speaking: {
      true: {
        outlineColor: "var(--callju-accent)",
      },
    },
    focus: {
      true: {
        width: "auto",
        maxWidth: "none",
      },
    },
    video: {
      true: {},
    },
    fullscreen: {
      true: {
        minWidth: "20%",
      },
    },
  },
  compoundVariants: [
    {
      video: [false],
      focus: [true],
      css: {
        height: "100%",
        maxHeight: "calc(var(--vc-w) * 9 / 16)",
      },
    },
    {
      video: [true],
      focus: [true],
      css: {
        aspectRatio: "auto",
      },
    },
  ],
});

const ConviteLive = styled("div", {
  base: {
    gridArea: "1/1",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    padding: "12px",
    minWidth: 0,
    textAlign: "center",
  },
});

const AvatarOnly = styled("div", {
  base: {
    gridArea: "1/1",
    display: "grid",
    placeItems: "center",
    overflow: "hidden",

    // TODO: Refactor the avatar component to be reactive later.
    "& > *": {
      width: "auto !important",
      height: "30% !important",
      minHeight: "48px",
    },
  },
});

const Overlay = styled("div", {
  base: {
    minWidth: 0,
    gridArea: "1/1",

    padding: "var(--gap-md) var(--gap-lg)",

    opacity: 1,
    display: "flex",
    alignItems: "end",
    flexDirection: "row",

    transition: "var(--transitions-fast) all",
    transitionTimingFunction: "ease",
  },
  variants: {
    showOnHover: {
      true: {
        opacity: 0,

        _groupHover: {
          opacity: 1,
        },
      },
      false: {
        opacity: 1,
      },
    },
  },
  defaultVariants: {
    showOnHover: false,
  },
});

const OverlayInner = styled("div", {
  base: {
    minWidth: 0,

    display: "flex",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",

    _first: {
      flexGrow: 1,
    },
  },
});
