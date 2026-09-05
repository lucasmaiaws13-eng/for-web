import { For, Show, splitProps } from "solid-js";
import {
  TrackLoop,
  useEnsureParticipant,
  useIsMuted,
  useIsSpeaking,
  useTracks,
} from "solid-livekit-components";

import { Track } from "livekit-client";
import { Channel, VoiceParticipant } from "stoat.js";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { UserContextMenu } from "@revolt/app";
import { useUser } from "@revolt/markdown/users";
import { InRoom } from "@revolt/rtc";

import { Avatar, Ripple, typography } from "../../design";
import { Row } from "../../layout";

import { VoiceStatefulUserIcons } from "./VoiceStatefulUserIcons";

/**
 * Render a preview of users (or the active participants) for a given channel
 *
 * Designed for the server sidebar to be below channels
 */
export function VoiceChannelPreview(props: { channel: Channel }) {
  return (
    <InRoom
      channelId={props.channel.id}
      fallback={<VariantPreview channel={props.channel} />}
    >
      <VariantLive />
    </InRoom>
  );
}

/**
 * Use API as the source of truth
 */
function VariantLive() {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false },
  );

  // Quem esta transmitindo tela ou camera neste instante.
  //
  // Antes esta variante mandava screenshare={false} fixo, entao o simbolo
  // de transmissao nunca aparecia justamente para quem estava dentro da
  // call. A lista da API (VariantPreview) ja acertava isso; aqui faltava.
  const telas = useTracks(
    [{ source: Track.Source.ScreenShare, withPlaceholder: false }],
    { onlySubscribed: false },
  );

  const cameras = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: false }],
    { onlySubscribed: false },
  );

  const transmitindoTela = () =>
    new Set(telas().map((t) => t.participant.identity));

  const transmitindoCamera = () =>
    new Set(cameras().map((t) => t.participant.identity));

  return (
    <Base>
      <TrackLoop tracks={tracks}>
        {() => (
          <ParticipantLive
            telas={transmitindoTela()}
            cameras={transmitindoCamera()}
          />
        )}
      </TrackLoop>
    </Base>
  );
}

/**
 * Use LiveKit as the source of truth
 */
function VariantPreview(props: { channel: Channel }) {
  return (
    <Show when={props.channel.voiceParticipants.size}>
      <Base>
        <For each={[...props.channel.voiceParticipants.values()]}>
          {(participant) => <ParticipantPreview participant={participant} />}
        </For>
      </Base>
    </Show>
  );
}

/**
 * Live variant of participant
 */
function ParticipantLive(props: {
  telas: Set<string>;
  cameras: Set<string>;
}) {
  const participant = useEnsureParticipant();

  const isMuted = useIsMuted({
    participant,
    source: Track.Source.Microphone,
  });

  const isSpeaking = useIsSpeaking(participant);

  return (
    <CommonUser
      userId={participant.identity}
      speaking={isSpeaking()}
      muted={isMuted()}
      // Cravado, e nao por esquecimento: nao existe de onde tirar esse valor.
      //
      // Nada no cliente informa o ensurdecimento ao servidor, o campo
      // is_receiving da API so e lido e nunca escrito, e a stoat.js nao tem
      // metodo para isso. As duas vias do LiveKit tambem estao fechadas:
      // o token traz CanPublishData: false e CanUpdateOwnMetadata: false.
      //
      // Destravar exige mexer no grant do token, no codigo da API em Rust.
      deafened={false}
      camera={props.cameras.has(participant.identity)}
      screenshare={props.telas.has(participant.identity)}
      isLive
    />
  );
}

/**
 * Preview variant of participant
 */
function ParticipantPreview(props: { participant: VoiceParticipant }) {
  return (
    <CommonUser
      userId={props.participant.userId}
      speaking={false}
      muted={!props.participant.isPublishing()}
      deafened={!props.participant.isReceiving()}
      camera={props.participant.isCamera()}
      screenshare={props.participant.isScreensharing()}
    />
  );
}

/**
 * Component used for both variants
 */
function CommonUser(props: {
  userId: string;
  speaking: boolean;
  muted: boolean;
  deafened: boolean;
  camera: boolean;
  screenshare: boolean;
  isLive?: boolean;
}) {
  const [iconProps, rest] = splitProps(props, [
    "muted",
    "deafened",
    "camera",
    "screenshare",
  ]);

  const user = useUser(() => rest.userId);

  return (
    <div
      class={previewUser({ speaking: rest.speaking })}
      use:floating={{
        userCard: {
          user: user().user!,
          member: user().member,
        },
        contextMenu: () => (
          <UserContextMenu
            user={user().user!}
            member={user().member}
            inVoice={rest.isLive}
          />
        ),
      }}
    >
      <Ripple />
      <Avatar size={24} src={user().avatar} fallback={user().username} />{" "}
      <PreviewUsername>{user().username}</PreviewUsername>
      <Row gap="sm">
        <VoiceStatefulUserIcons {...iconProps} userId={rest.userId} />
      </Row>
    </div>
  );
}

const Base = styled("div", {
  base: {
    minWidth: 0,
    display: "flex",
    flexDirection: "column",

    marginBlock: "var(--gap-sm)",
    marginInlineStart: "var(--gap-xl)",
    marginInlineEnd: "var(--gap-md)",

    color: "var(--md-sys-color-outline)",

    borderRadius: "var(--borderRadius-md)",
  },
});

const previewUser = cva({
  base: {
    padding: "var(--gap-sm)",
    position: "relative", // ... <Ripple />
    display: "flex",
    gap: "var(--gap-md)",
    alignItems: "center",
    borderRadius: "var(--borderRadius-md)",
  },
  variants: {
    speaking: {
      true: {
        color: "var(--md-sys-color-on-surface)",

        "& svg": {
          outlineOffset: "1px",
          outline: "2px solid var(--callju-accent)",
          borderRadius: "var(--borderRadius-circle)",
        },
      },
    },
  },
});

const PreviewUsername = styled("span", {
  base: {
    ...typography.raw(),

    flexGrow: 1,
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
  },
});
