import {
  Accessor,
  batch,
  createContext,
  createEffect,
  createSignal,
  JSX,
  Setter,
  useContext,
} from "solid-js";
import {
  RoomContext,
  TrackReferenceOrPlaceholder,
  useTracks,
} from "solid-livekit-components";

import {
  LocalTrackPublication,
  Room,
  ScreenShareCaptureOptions,
  ScreenSharePresets,
  Track,
  VideoEncoding,
  VideoPresets,
} from "livekit-client";
import { Channel } from "stoat.js";

import { SoundController, useSound } from "@revolt/client";
import { useInstance } from "@revolt/instance";
import { ModalController, useModals } from "@revolt/modal";
import { useState } from "@revolt/state";
import {
  NoiseSuppresionState,
  ScreenShareQualityName,
  Voice as VoiceSettings,
} from "@revolt/state/stores/Voice";
import { VoiceCallCardContext } from "@revolt/ui/components/features/voice/callCard/VoiceCallCard";

import { Device, useDevice } from "@revolt/common";
import { InRoom } from "./components/InRoom";
import { PushToTalk } from "./components/PushToTalk";
import { RoomAudioManager } from "./components/RoomAudioManager";
import { VoiceProcessor } from "./VoiceProcessor";

type State =
  | "READY"
  | "DISCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "RECONNECTING";

export type VoiceLayout = "fullscreen" | "expanded" | "collapsed" | undefined;

type ScreenShareQuality = Required<
  Pick<ScreenShareCaptureOptions, "contentHint" | "resolution">
> & {
  name: ScreenShareQualityName;
  fullName: string;
  encoding: VideoEncoding;
};

class Voice {
  #settings: VoiceSettings;

  channel: Accessor<Channel | undefined>;
  #setChannel: Setter<Channel | undefined>;

  room: Accessor<Room | undefined>;
  #setRoom: Setter<Room | undefined>;

  vidTracks: Accessor<TrackReferenceOrPlaceholder[]>;

  state: Accessor<State>;
  #setState: Setter<State>;

  deafen: Accessor<boolean>;
  microphone: Accessor<boolean>;

  video: Accessor<boolean>;
  #setVideo: Setter<boolean>;

  screenshare: Accessor<boolean>;
  #setScreenshare: Setter<boolean>;

  layout: Accessor<VoiceLayout>;
  #setLayout: Setter<VoiceLayout>;

  focusId: Accessor<string | undefined>;
  #setFocus: Setter<string | undefined>;

  showBar: Accessor<boolean>;
  #setShowBar: Setter<boolean>;

  /**
   * Identidades de quem o usuario escolheu assistir nesta call.
   *
   * Comeca vazio e e limpo ao sair: entrar num canal de voz nao deve arrastar
   * ninguem para dentro de uma transmissao que a pessoa nao pediu para ver.
   */
  assistindo: Accessor<Set<string>>;
  #setAssistindo: Setter<Set<string>>;

  private sound: SoundController;
  private device: Device;

  private openModal;
  private config;
  private limits;
  private screenShareTracks: Set<string>;
  private voiceProcessor?: VoiceProcessor;

  constructor(
    voiceSettings: VoiceSettings,
    modals: ModalController,
    sound: SoundController,
    device: Device,
  ) {
    this.#settings = voiceSettings;
    this.sound = sound;
    this.device = device;

    const [channel, setChannel] = createSignal<Channel>();
    this.channel = channel;
    this.#setChannel = setChannel;

    const [room, setRoom] = createSignal<Room>();
    this.room = room;
    this.#setRoom = setRoom;

    this.vidTracks = () => [];

    const [state, setState] = createSignal<State>("READY");
    this.state = state;
    this.#setState = setState;

    this.deafen = () => voiceSettings.deafen;
    this.microphone = () => voiceSettings.micOn && !voiceSettings.deafen;

    const [video, setVideo] = createSignal(false);
    this.video = video;
    this.#setVideo = setVideo;

    const [screenshare, setScreenshare] = createSignal(false);
    this.screenshare = screenshare;
    this.#setScreenshare = setScreenshare;

    const [layout, setLayout] = createSignal<VoiceLayout>();
    this.layout = layout;
    this.#setLayout = setLayout;

    const [focus, setFocus] = createSignal<string>();
    this.focusId = focus;
    this.#setFocus = setFocus;

    const [showBar, setShowBar] = createSignal(true);
    this.showBar = showBar;
    this.#setShowBar = setShowBar;

    const [assistindo, setAssistindo] = createSignal<Set<string>>(new Set());
    this.assistindo = assistindo;
    this.#setAssistindo = setAssistindo;

    const inst = useInstance();
    this.config = inst.config;
    this.limits = inst.limits;
    this.openModal = modals.openModal;

    this.screenShareTracks = new Set();

    // Setup settings listeners
    this.settingsListeners();
  }

  // Dynamically set echo cancellation and gain control when the settings are changed
  // These functions are needed to maintain reactivity. Don't ask me why but if you make them not functions it breaks.
  private settingsListeners() {
    const getSettings = () => this.#settings;

    const setEchoCancellation = (echoCancellation: boolean) => {
      const track = this.getMicrophoneTrack()?.audioTrack;
      if (track) {
        track.constraints.echoCancellation = echoCancellation;
      }
    };

    const setAutoGainControl = (autoGainControl: boolean) => {
      const track = this.getMicrophoneTrack()?.audioTrack;
      if (track) {
        track.constraints.autoGainControl = autoGainControl;
      }
    };

    const setNoiseSuppression = (noiseSuppression: NoiseSuppresionState) => {
      const track = this.getMicrophoneTrack()?.audioTrack;
      if (track) {
        if (noiseSuppression === "browser") {
          track.constraints.noiseSuppression = true;
          //@ts-expect-error voiceIsolation is not yet standard, but it supported by livekit and most chromium based browsers, including electron.
          track.constraints.voiceIsolation = true;
        } else {
          track.constraints.noiseSuppression = false;
          //@ts-expect-error voiceIsolation is not yet standard, but it supported by livekit and most chromium based browsers, including electron.
          track.constraints.voiceIsolation = false;
        }
      }
    };

    const restartTrack = () => {
      const track = this.getMicrophoneTrack()?.audioTrack;
      if (track) {
        track.restartTrack();
      }
    };

    createEffect(() => {
      setEchoCancellation(getSettings().echoCancellation ?? true);
      setAutoGainControl(getSettings().autoGainControl ?? true);
      setNoiseSuppression(getSettings().noiseSupression ?? "browser");
      restartTrack();
    });
  }

  async connect(channel: Channel, auth?: { url: string; token: string }) {
    this.disconnect();

    this.device.setWakeLocked();

    const room = new Room({
      audioCaptureDefaults: {
        deviceId: this.#settings.preferredAudioInputDevice,
        echoCancellation: this.#settings.echoCancellation,
        noiseSuppression: this.#settings.noiseSupression === "browser",
        autoGainControl: this.#settings.autoGainControl,
        voiceIsolation: this.#settings.noiseSupression === "browser",
      },
      audioOutput: {
        deviceId: this.#settings.preferredAudioOutputDevice,
      },
      videoCaptureDefaults: {
        // TODO: Support higher resolutions based on limits
        resolution: VideoPresets.h720.resolution,
        deviceId: this.#settings.preferredVideoDevice,
      },
      publishDefaults: {
        videoEncoding: VideoPresets.h720.encoding,
        screenShareEncoding: ScreenSharePresets.h720fps30.encoding,
      },
    });

    this.vidTracks = useTracks(
      [
        { source: Track.Source.Camera, withPlaceholder: true },
        { source: Track.Source.ScreenShare, withPlaceholder: false },
      ],
      { room, onlySubscribed: false },
    );

    batch(() => {
      this.#setRoom(room);
      this.#setChannel(channel);
      this.#setState("CONNECTING");
      this.#setVideo(false);
      this.#setScreenshare(false);
    });

    room.addListener("connected", () => {
      this.#setState("CONNECTED");
      if (this.speakingPermission)
        room.localParticipant
          // Com push to talk o microfone entra fechado e so abre na tecla
          .setMicrophoneEnabled(
            this.#settings.micOn && !this.#settings.pushToTalk,
          )
          .then((track) => {
            // Nesse modo o microfone fechado e o esperado, entao nao deixamos
            // esta checagem apagar a preferencia de mudo da pessoa.
            if (!this.#settings.pushToTalk) {
              this.#settings.micOn = track != null;
            }
          });
      for (const p of room.remoteParticipants.values()) {
        const screenShareTrack = p.getTrackPublication(
          Track.Source.ScreenShare,
        );
        if (screenShareTrack) {
          this.screenShareTracks.add(screenShareTrack.trackSid);
        }
      }
      this.sound.playSound("userJoinVoice");
    });

    room.addListener("disconnected", () => this.#setState("DISCONNECTED"));

    room.addListener("localTrackPublished", (pub) => {
      if (pub.audioTrack && pub.audioTrack.source === Track.Source.Microphone) {
        if (!pub.audioTrack.getProcessor()) {
          pub.audioTrack?.setProcessor(
            (this.voiceProcessor = new VoiceProcessor(this.#settings)),
          );
        }
      }
    });

    room.addListener("participantConnected", () => {
      this.sound.playSound("userJoinVoice");
    });

    room.addListener("participantDisconnected", (participante) => {
      this.sound.playSound("userLeaveVoice");

      // Se essa pessoa estava vendo a minha transmissao, o cliente dela nao
      // vai conseguir avisar que saiu. Trato a queda como saida.
      if (this.screenshare()) {
        this.sound.playSound("streamViewerLeave");
      }

      this.#pararDeAcompanhar(participante.identity);
    });

    // Aviso de quem entrou ou saiu da minha transmissao.
    //
    // O LiveKit nao conta espectadores para o cliente: quem publica nao tem
    // como saber quem se inscreveu na faixa. Entao quem assiste avisa por
    // conta propria, pelo canal de dados da sala, mandando o recado so para
    // quem esta transmitindo. Por isso o som toca apenas para essa pessoa.
    room.addListener("dataReceived", (dados) => {
      try {
        const recado = JSON.parse(new TextDecoder().decode(dados));

        if (recado.callju === "assistindo") {
          this.sound.playSound("streamViewerJoin");
        } else if (recado.callju === "parou") {
          this.sound.playSound("streamViewerLeave");
        }
      } catch {
        // Pacote de dados de outra origem. Nao e problema nosso.
      }
    });

    room.addListener("trackPublished", (pub) => {
      if (pub.source === Track.Source.ScreenShare) {
        pub.once("subscribed", (track) => {
          // Play the sound once playback starts, which might be quite a bit after subscription
          // as it starts paused for the screen share settings modal.
          track.once("videoPlaybackStarted", () => {
            this.sound.playSound("streamStart");
            if (track.sid) {
              this.screenShareTracks.add(track.sid);
            }
          });
        });
      }
    });

    room.addListener("trackUnpublished", (unpub, participante) => {
      if (this.screenShareTracks.has(unpub.trackSid)) {
        this.sound.playSound("streamEnd");
        this.screenShareTracks.delete(unpub.trackSid);

        // A transmissao acabou. Esqueco a escolha para que a proxima live
        // dessa pessoa nao comece ligada sozinha na tela de quem assistiu
        // a anterior.
        this.#pararDeAcompanhar(participante?.identity);
      }
    });

    // Gather latency
    const selected = await Promise.any(
      this.config.features.livekit.nodes.map(async (node) => {
        return fetch(node.public_url.replace("wss", "https")).then(() => {
          return node.name;
        });
      }),
    );

    if (!auth) {
      auth = await channel.joinCall(selected);
    }

    await room.connect(auth.url, auth.token, {
      autoSubscribe: false,
    });
  }

  disconnect() {
    this.device.releaseWakeLock();
    try {
      const room = this.room();
      if (!room) return;

      room.removeAllListeners();
      room.disconnect();

      batch(() => {
        this.#setState("READY");
        this.#setRoom();
        this.#setChannel();
        this.#setLayout();
        this.vidTracks = () => [];
      });

      this.screenShareTracks = new Set();
      this.#setAssistindo(new Set());

      this.sound.playSound("userLeaveVoice");
    } catch (e) {
      this.onErr(e);
    }
  }

  async toggleDeafen(fromMute?: boolean) {
    try {
      const room = this.room();
      if (!room) throw "invalid state";
      await room.localParticipant.setMicrophoneEnabled(
        (this.#settings.micOn || !!fromMute) &&
          !room.localParticipant.isMicrophoneEnabled,
      );

      this.#settings.deafen = !this.#settings.deafen;
      if (fromMute) {
        this.#settings.micOn = room.localParticipant.isMicrophoneEnabled;
      }
      if (this.#settings.deafen) {
        this.sound.playSound("deafen");
      } else {
        this.sound.playSound("undeafen");
      }
    } catch (e) {
      this.onErr(e);
    }
  }

  async toggleMute() {
    if (this.#settings.deafen) {
      this.toggleDeafen(true);
      return;
    }

    // Com push to talk o botao de mudo nao abre nem fecha o microfone agora,
    // ele decide se a tecla tem efeito. Sem isso o botao brigaria com a
    // tecla: apertar mudo abriria o microfone, ja que naquele instante ele
    // esta fechado esperando a tecla.
    if (this.#settings.pushToTalk) {
      this.#settings.micOn = !this.#settings.micOn;
      this.sound.playSound(this.#settings.micOn ? "unmute" : "mute");
      await this.reconciliarMicrofone();
      return;
    }
    try {
      const room = this.room();
      if (!room) throw "invalid state";
      await room.localParticipant.setMicrophoneEnabled(
        !room.localParticipant.isMicrophoneEnabled,
      );

      this.#settings.micOn = room.localParticipant.isMicrophoneEnabled;

      if (this.#settings.micOn) {
        this.sound.playSound("unmute");
      } else {
        this.sound.playSound("mute");
      }
    } catch (e) {
      this.onErr(e);
    }
  }

  async toggleCamera() {
    try {
      const room = this.room();
      if (!room) throw "invalid state";
      await room.localParticipant.setCameraEnabled(
        !room.localParticipant.isCameraEnabled,
      );

      this.#setVideo(room.localParticipant.isCameraEnabled);
    } catch (e) {
      this.onErr(e);
    }
  }

  /**
   * Get the enabled screen share qualities. "low" will always be enabled.
   * Each screen share quality is checked against the limit if the limit is available on the client.
   *
   * TODO: Translate the fullNames here, I can't figure out how to do it.
   *
   * @param name The name of the screen share quality to get
   * @returns A partial record of ScreenShareQualityName to ScreenShareQuality. Will always contain "low" quality.
   */
  getEnabledScreenShareQualities(): Partial<
    Record<ScreenShareQualityName, ScreenShareQuality>
  > {
    // Always enable low
    const qualities: Partial<
      Record<ScreenShareQualityName, ScreenShareQuality>
    > = {
      low: {
        name: "low",
        resolution: ScreenSharePresets.h720fps30.resolution,
        fullName: `720p 30FPS`,
        contentHint: "motion",
        encoding: ScreenSharePresets.h720fps30.encoding,
      },
    };

    const limit = this.limits().video_resolution;

    // TODO: Add more resolutions to stream from if they're enabled. May tie into premium users in the future?
    if (
      (limit[0] === 0 || limit[0] >= 1920) &&
      (limit[1] === 0 || limit[1] >= 1080)
    ) {
      qualities.high = {
        name: "high",
        resolution: ScreenSharePresets.h1080fps30.resolution,
        fullName: `1080p 30FPS`,
        contentHint: "motion",
        encoding: ScreenSharePresets.h1080fps30.encoding,
      };
      const originalResolution = ScreenSharePresets.original.resolution;
      originalResolution.frameRate = 5;
      originalResolution.aspectRatio = 0;

      const limit = this.limits().video_resolution;
      originalResolution.width = limit[0];
      originalResolution.height = limit[1];
      // If both resolutions are limited, set aspect ratio
      if (originalResolution.height !== 0 && originalResolution.width !== 0) {
        originalResolution.aspectRatio =
          originalResolution.width / originalResolution.height;
      }

      qualities.text = {
        name: "text",
        resolution: originalResolution,
        fullName: `Source 5FPS`,
        contentHint: "text",
        encoding: ScreenSharePresets.original.encoding,
      };
    }

    return qualities;
  }

  async toggleScreenshare() {
    const room = this.room();
    if (!room) throw "invalid state";

    if (this.screenshare()) {
      await room.localParticipant.setScreenShareEnabled(false);

      this.#setScreenshare(room.localParticipant.isScreenShareEnabled);

      this.sound.playSound("streamEnd");
    } else {
      const qualities = this.getEnabledScreenShareQualities();
      let screenPickerQualityName: ScreenShareQualityName | undefined;
      let screenPickerAudio: boolean | undefined;

      // Register the modal on screen picker handler if it exists
      if (window.native && window.native.onceScreenPicker) {
        window.native.onceScreenPicker((sources) => {
          this.openModal({
            type: "screen_share_picker",
            onCancel: () => {
              window.native.screenPickerCallback(-1, false);
            },
            callback: (
              idx: number,
              qualityName: ScreenShareQualityName,
              audio: boolean,
            ) => {
              window.native.screenPickerCallback(idx, audio);
              screenPickerQualityName = qualityName;
              screenPickerAudio = audio;
            },
            sources: sources,
            qualities: Object.keys(qualities).map((k) => {
              const v = qualities[k as ScreenShareQualityName]!;
              return { name: k, fullName: v.fullName };
            }),
          });
        });
      }

      try {
        const chosenQuality =
          this.getEnabledScreenShareQualities()[
            this.#settings.screenShareQuality || "low"
          ];
        const localTrack = await room.localParticipant.setScreenShareEnabled(
          true,
          {
            resolution: chosenQuality?.resolution,
            audio: {
              autoGainControl: false,
              echoCancellation: false,
              noiseSuppression: false,
              voiceIsolation: false,
              restrictOwnAudio: true,
            },
          },
          { screenShareEncoding: chosenQuality?.encoding },
        );

        const screenAudioTrack = room.localParticipant.getTrackPublication(
          Track.Source.ScreenShareAudio,
        );

        this.#setScreenshare(room.localParticipant.isScreenShareEnabled);

        // A voz do pessoal da call nao pode entrar na transmissao.
        //
        // Capturar o audio do sistema traz tudo que sai pela caixa de som,
        // inclusive o proprio Callju tocando a call. restrictOwnAudio pede ao
        // navegador para filtrar dessa captura o que a propria pagina esta
        // tocando, que e exatamente o que precisamos, e ja era pedido logo
        // acima. Mas a constraint e experimental: quem nao a conhece ignora o
        // pedido em silencio e a conversa vaza sem ninguem perceber.
        //
        // Por isso nao basta pedir, e preciso conferir. Sem a confirmacao do
        // navegador, transmitir sem som do sistema e melhor do que entregar a
        // conversa dos outros para quem assiste.
        if (
          screenAudioTrack?.track &&
          !this.#semVazamentoDaCall(screenAudioTrack)
        ) {
          console.warn(
            "[callju] transmitindo sem o som do sistema: o navegador nao " +
              "confirmou o filtro restrictOwnAudio, e sem ele a voz da call " +
              "vazaria para quem esta assistindo",
          );

          room.localParticipant.unpublishTrack(screenAudioTrack.track);
        }

        if (localTrack) {
          // This event is only fired if the screen share is ended by closing the window being streamed.
          // This catches the ending and disables screen sharing on our side. If this weren't here,
          // livekit would still share stream audio after closing the window being streamed.
          localTrack.on("ended", () => {
            this.toggleScreenshare();
            const oldAudioTrack = room.localParticipant.getTrackPublication(
              Track.Source.ScreenShareAudio,
            );
            if (oldAudioTrack && oldAudioTrack.track) {
              room.localParticipant.unpublishTrack(oldAudioTrack.track);
            }
          });

          const callback = async (
            qualityName: ScreenShareQualityName,
            audio: boolean,
          ) => {
            const quality = qualities[qualityName] || qualities.low!;

            if (localTrack.videoTrack) {
              await localTrack.videoTrack.applyScreenShareConstraints(
                {
                  resolution: {
                    frameRate: quality.resolution.frameRate,
                    width: quality.resolution.width,
                    height: quality.resolution.height,
                  },
                  contentHint: quality.contentHint,
                },
                quality.encoding,
              );
              if (!audio && screenAudioTrack?.track) {
                room.localParticipant.unpublishTrack(screenAudioTrack.track);
              }
              this.sound.playSound("streamStart");
            }
          };

          if (screenPickerQualityName) {
            callback(
              screenPickerQualityName || "low",
              screenPickerAudio || false,
            );
          } else if (this.#settings.screenShareQualityAsk) {
            if (Object.keys(qualities).length > 1) {
              localTrack.pauseUpstream();
              screenAudioTrack?.pauseUpstream();
              this.openModal({
                onCancel: async () => {
                  await room.localParticipant.setScreenShareEnabled(false);
                  this.#setScreenshare(
                    room.localParticipant.isScreenShareEnabled,
                  );
                },
                type: "screen_share_settings",
                trackReference: {
                  participant: room.localParticipant,
                  publication: localTrack,
                  source: Track.Source.ScreenShare,
                },
                qualities: Object.keys(qualities).map((k) => {
                  const v = qualities[k as ScreenShareQualityName]!;
                  return { name: k, fullName: v.fullName };
                }),
                audio: !!screenAudioTrack,
                callback: async (qualityName, audio) => {
                  callback(qualityName, audio);
                  localTrack.resumeUpstream();
                  if (audio) {
                    screenAudioTrack?.resumeUpstream();
                  }
                },
              });
            } else {
              callback(
                this.#settings.screenShareQuality || "low",
                this.#settings.screenShareAudio,
              );
            }
          }
        }
      } catch (e) {
        this.onErr(e);
      }
    }
  }

  /**
   * Se o navegador confirmou que vai tirar da captura o audio da propria
   * pagina, ou seja, a voz do pessoal da call
   *
   * getSettings() so devolve restrictOwnAudio quando o filtro foi mesmo
   * aplicado. Navegador que nao conhece a constraint ignora o pedido sem
   * avisar e nao devolve nada aqui, e esse e justamente o caso perigoso.
   * Por isso a ausencia de confirmacao conta como desprotegido, nunca o
   * contrario.
   */
  #semVazamentoDaCall(publicacao?: LocalTrackPublication) {
    const faixa = publicacao?.track?.mediaStreamTrack;

    // Sem faixa de audio nao ha o que vazar
    if (!faixa) return true;

    try {
      const config = faixa.getSettings() as MediaTrackSettings & {
        restrictOwnAudio?: boolean;
      };

      return config.restrictOwnAudio === true;
    } catch {
      return false;
    }
  }

  /**
   * Abre ou fecha o microfone conforme a tecla de push to talk
   *
   * O mudo e o ensurdecer mandam mais que a tecla: quem esta mudo no botao
   * nao transmite nem segurando, que e o que as pessoas esperam.
   */
  async transmitirPorTecla(segurando: boolean) {
    const room = this.room();
    if (!room || !this.speakingPermission) return;

    const abrir =
      segurando && this.#settings.micOn && !this.#settings.deafen;

    try {
      if (room.localParticipant.isMicrophoneEnabled !== abrir) {
        await room.localParticipant.setMicrophoneEnabled(abrir);
      }
    } catch (e) {
      console.warn("[callju] push to talk nao conseguiu mexer no microfone", e);
    }
  }

  /**
   * Recoloca o microfone no estado que as preferencias mandam
   *
   * Usado ao ligar ou desligar o push to talk no meio da chamada: ligando, o
   * microfone fecha na hora e so volta a abrir na tecla; desligando, ele volta
   * a seguir o botao de mudo.
   */
  async reconciliarMicrofone() {
    const room = this.room();
    if (!room || !this.speakingPermission) return;

    const abrir =
      this.#settings.micOn &&
      !this.#settings.deafen &&
      !this.#settings.pushToTalk;

    try {
      if (room.localParticipant.isMicrophoneEnabled !== abrir) {
        await room.localParticipant.setMicrophoneEnabled(abrir);
      }
    } catch (e) {
      console.warn("[callju] nao consegui ajustar o microfone", e);
    }
  }

  resetLayout() {
    this.#setLayout();
  }

  toggleLayout(type: VoiceLayout) {
    this.#setLayout((l) => (l === type ? undefined : type));
  }

  trackId(t: TrackReferenceOrPlaceholder) {
    return `${t.source}_${t.participant.sid}`;
  }

  toggleFocus(t?: TrackReferenceOrPlaceholder) {
    const id = t ? this.trackId(t) : undefined;
    this.#setFocus(
      this.focusId() === id || this.vidTracks().length < 2 ? undefined : id,
    );
  }

  isFocus(t: TrackReferenceOrPlaceholder) {
    return this.trackId(t) === this.focusId();
  }

  focusTrack() {
    const id = this.focusId();
    return id
      ? this.vidTracks().find((t) => this.trackId(t) === id)
      : undefined;
  }

  toggleShowBar() {
    this.#setShowBar((s) => !s);
  }

  getConnectedUser(userId: string) {
    return this.room()?.getParticipantByIdentity(userId);
  }

  /**
   * Se o usuario escolheu acompanhar a transmissao de alguem
   */
  estaAssistindo(identidade: string) {
    return this.assistindo().has(identidade);
  }

  /**
   * Entra ou sai da transmissao de alguem
   *
   * Enquanto isso for falso o video nem chega a ser montado na tela, e como o
   * LiveKit so baixa faixa inscrita, quem nao esta assistindo tambem nao
   * gasta banda com a live.
   */
  alternarAssistir(identidade: string) {
    const jaAssistia = this.estaAssistindo(identidade);

    this.#setAssistindo((atual) => {
      const proximo = new Set(atual);

      if (jaAssistia) {
        proximo.delete(identidade);
      } else {
        proximo.add(identidade);
      }

      return proximo;
    });

    this.#avisarTransmissor(identidade, jaAssistia ? "parou" : "assistindo");
  }

  /**
   * Conta para quem transmite que alguem chegou ou saiu
   *
   * O recado vai so para a identidade de quem publica a tela, entao ninguem
   * mais na call ouve o som.
   */
  #avisarTransmissor(identidade: string, tipo: "assistindo" | "parou") {
    const room = this.room();
    if (!room) return;

    try {
      room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify({ callju: tipo })),
        { reliable: true, destinationIdentities: [identidade] },
      );
    } catch (e) {
      // Um aviso perdido nao pode derrubar a call inteira
      console.warn("[callju] nao consegui avisar quem transmite", e);
    }
  }

  /**
   * Tira alguem da lista de quem estou assistindo
   */
  #pararDeAcompanhar(identidade?: string) {
    if (!identidade) return;

    this.#setAssistindo((atual) => {
      if (!atual.has(identidade)) return atual;

      const proximo = new Set(atual);
      proximo.delete(identidade);
      return proximo;
    });
  }

  showCard(channel: Channel) {
    return (
      channel.isVoice &&
      (this.channel()?.id === channel.id ||
        channel.type === "TextChannel" ||
        !!channel.voiceParticipants.size)
    );
  }

  getMicrophoneTrack(): LocalTrackPublication | undefined {
    const track = this.room()?.localParticipant.getTrackPublication(
      Track.Source.Microphone,
    );
    return track;
  }

  get listenPermission() {
    return !!this.channel()?.havePermission("Listen");
  }

  get speakingPermission() {
    return !!this.channel()?.havePermission("Speak");
  }

  private onErr(e: unknown) {
    if ((e as Error).name !== "NotAllowedError")
      this.openModal({ type: "error2", error: e });
  }
}

const voiceContext = createContext<Voice>(null as unknown as Voice);

/**
 * Mount global voice context and room audio manager
 */
export function VoiceContext(props: { children: JSX.Element }) {
  const state = useState();
  const modals = useModals();
  const sound = useSound();
  const device = useDevice();
  const voice = new Voice(state.voice, modals, sound, device);

  return (
    <voiceContext.Provider value={voice}>
      <RoomContext.Provider value={voice.room}>
        <VoiceCallCardContext>{props.children}</VoiceCallCardContext>
        <InRoom>
          <RoomAudioManager />
          <PushToTalk />
        </InRoom>
      </RoomContext.Provider>
    </voiceContext.Provider>
  );
}

export const useVoice = () => useContext(voiceContext);
