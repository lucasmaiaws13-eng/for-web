import { createEffect, createMemo } from "solid-js";
import { AudioTrack, useTracks } from "solid-livekit-components";

import { getTrackReferenceId, isLocal } from "@livekit/components-core";
import { Key } from "@solid-primitives/keyed";
import { RemoteTrackPublication, RoomEvent, Track } from "livekit-client";

import { useState } from "@revolt/state";

import { useVoice } from "../state";

export function RoomAudioManager() {
  const voice = useVoice();
  const state = useState();

  const tracks = useTracks(
    [
      Track.Source.Microphone,
      Track.Source.ScreenShareAudio,
      Track.Source.Unknown,
    ],
    {
      // Estes dois eventos faltavam, e a ausencia deles deixava gente muda.
      //
      // updateOnlyOn nao acrescenta ao padrao do LiveKit, ele SUBSTITUI. Com
      // a lista vazia sobrava so o conjunto obrigatorio, que avisa quando a
      // faixa e publicada mas nao quando ela e de fato assinada. O elemento de
      // audio era montado antes da faixa existir e ficava parado ali, mudo,
      // ate alguem mexer no volume e forcar os efeitos a rodarem de novo.
      //
      // A lista segue curta de proposito: o padrao do LiveKit inclui eventos
      // de quem esta falando, que refariam esta lista a cada fala.
      updateOnlyOn: [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed],
      onlySubscribed: false,
    },
  );

  const filteredTracks = createMemo(() =>
    tracks().filter(
      (track) =>
        !isLocal(track.participant) &&
        track.publication.kind === Track.Kind.Audio &&
        // O audio de uma transmissao so entra depois que a pessoa escolhe
        // assistir. Sem esta linha a live continuaria tocando no ouvido de
        // quem fechou o video, que e metade do incomodo.
        (track.source !== Track.Source.ScreenShareAudio ||
          voice.estaAssistindo(track.participant.identity)),
    ),
  );

  createEffect(() => {
    const tracks = filteredTracks();
    console.info("[rtc] filtered tracks", filteredTracks());
    for (const track of tracks) {
      (track.publication as RemoteTrackPublication).setSubscribed(true);
      console.info(track.publication);
    }
  });

  return (
    <div style={{ display: "none" }}>
      <Key each={filteredTracks()} by={(item) => getTrackReferenceId(item)}>
        {(track) => (
          <AudioTrack
            trackRef={track()}
            volume={
              state.voice.outputVolume *
              (track().source === Track.Source.ScreenShareAudio
                ? state.voice.getScreenShareVolume(track().participant.identity)
                : state.voice.getUserVolume(track().participant.identity))
            }
            muted={
              (track().source === Track.Source.ScreenShareAudio
                ? state.voice.getScreenShareMuted(track().participant.identity)
                : state.voice.getUserMuted(track().participant.identity)) ||
              voice.deafen()
            }
            enableBoosting
          />
        )}
      </Key>
    </div>
  );
}
