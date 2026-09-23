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

/**
 * Volume (0 a 1) a partir do qual conta como fala.
 *
 * Baixo de proposito. O filtro de ruido ja limpou o que nao e voz, entao o
 * risco de acender a toa e pequeno, e o custo de exigir voz alta e o anel
 * perder o comeco da frase, que era a reclamacao.
 */
const NIVEL_DE_FALA = 0.007;

/** Quanto o anel fica aceso depois do ultimo som, em ms */
const RABO_DA_FALA = 180;

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

  /**
   * Quem esta ensurdecido na chamada
   *
   * O Stoat nao transmite esse estado: o campo is_receiving existe no
   * protocolo mas nada no servidor dele o calcula, e o token do LiveKit fecha
   * as duas vias que um cliente teria para avisar os outros. Entao um servico
   * nosso, com chave de administrador, grava isso como atributo do
   * participante, e a volta chega aqui pelo proprio LiveKit.
   */
  surdos: Accessor<Set<string>>;
  #setSurdos: Setter<Set<string>>;

  /**
   * Se a propria pessoa esta falando agora, medido aqui no computador.
   *
   * O anel de quem fala vem do servidor: ele ouve o volume de cada um e avisa
   * a sala. Para os outros isso e o unico jeito, e o atraso da ida e volta
   * passa despercebido. No proprio rosto incomoda muito, porque o anel e a
   * unica confirmacao de que a voz saiu, e chegava depois da frase terminar.
   *
   * Aqui o nivel do microfone e lido direto da faixa que esta sendo enviada,
   * ja depois do filtro de ruido, entao o anel acende junto com a voz e nao
   * acende com o ventilador.
   */
  falandoLocal: Accessor<boolean>;
  #setFalandoLocal: Setter<boolean>;

  /** Medicao em andamento do proprio microfone */
  #medidorLocal?: { faixa: MediaStreamTrack; parar: () => void };

  /**
   * Se o navegador esta segurando o som que chega.
   *
   * Celular (e as vezes o navegador de mesa) so deixa tocar som depois de um
   * toque na tela. Enquanto isso a pessoa fica na call sem ouvir ninguem, sem
   * nenhuma pista do motivo. Com este sinal a tela mostra o aviso e o botao.
   */
  audioBloqueado: Accessor<boolean>;
  #setAudioBloqueado: Setter<boolean>;

  /** Ultimo problema com o microfone, pra tela poder explicar */
  problemaNoMicrofone: Accessor<string | undefined>;
  #setProblemaNoMicrofone: Setter<string | undefined>;

  private sound: SoundController;
  private device: Device;

  private openModal;
  private instancia;
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

    const [surdos, setSurdos] = createSignal<Set<string>>(new Set());
    this.surdos = surdos;
    this.#setSurdos = setSurdos;

    const [falandoLocal, setFalandoLocal] = createSignal(false);
    this.falandoLocal = falandoLocal;
    this.#setFalandoLocal = setFalandoLocal;

    const [audioBloqueado, setAudioBloqueado] = createSignal(false);
    this.audioBloqueado = audioBloqueado;
    this.#setAudioBloqueado = setAudioBloqueado;

    const [problemaNoMicrofone, setProblemaNoMicrofone] = createSignal<
      string | undefined
    >();
    this.problemaNoMicrofone = problemaNoMicrofone;
    this.#setProblemaNoMicrofone = setProblemaNoMicrofone;

    const inst = useInstance();
    this.instancia = inst;
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

    // O som de entrada tocava quando a conexao fechava, alguns segundos depois
    // do clique. Ate la o clique parecia nao ter funcionado. Agora ele toca na
    // hora, so pra quem entrou; quem ja esta na sala continua ouvindo pelo
    // aviso de participante novo.
    this.sound.playSound("userJoinVoice");

    const comecou = performance.now();
    const marcar = (etapa: string) =>
      console.info(`[callju] entrar na call: ${etapa} em ${Math.round(performance.now() - comecou)} ms`);

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

        // Audio estava sem configuracao nenhuma aqui, caindo no padrao do
        // LiveKit, que e 32 kbps. O Discord usa 64, e ate 96 em servidor de
        // comunidade. Era metade da taxa dele, e essa e a maior parte da
        // diferenca de qualidade que se escuta, mais que supressao de ruido.
        //
        // 96 kbps, o teto do Discord. Vai como objeto proprio em vez do preset
        // pronto porque o preset de 96 do LiveKit e estereo, e microfone e
        // fonte unica: em estereo metade dos bits duplicaria o mesmo audio.
        // Em mono os 96 inteiros vao para a voz.
        audioPreset: { maxBitrate: 96_000 },

        // Reducao de dados de fundo. Ganha banda mas engole o comecinho das
        // frases quando alguem volta a falar, e voz cortando incomoda mais do
        // que banda gasta numa call de dez pessoas.
        dtx: false,

        // Manda audio redundante para aguentar perda de pacote sem picotar.
        red: true,
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
      // O som de entrada ja tocou no clique, la em cima
      this.#relerSurdos();
      this.avisarSurdez();
    });

    room.addListener("disconnected", () => this.#setState("DISCONNECTED"));

    // O LiveKit avisa quando o navegador solta ou segura o som que chega
    room.addListener("audioPlaybackChanged", () => {
      this.#setAudioBloqueado(!room.canPlaybackAudio);
    });

    // O LiveKit avisa todo mundo quando um atributo muda, e quem entra depois
    // ja recebe os atributos atuais junto da lista de participantes. Por isso
    // atributo, e nao mensagem solta: mensagem quem chega atrasado perde.
    room.addListener("participantAttributesChanged", () => this.#relerSurdos());

    room.addListener("localTrackPublished", (pub) => {
      if (pub.audioTrack && pub.audioTrack.source === Track.Source.Microphone) {
        if (!pub.audioTrack.getProcessor()) {
          pub.audioTrack?.setProcessor(
            (this.voiceProcessor = new VoiceProcessor(this.#settings)),
          );
        }
      }
      this.#acompanharProprioMicrofone();
    });

    // Microfone fechado, aberto, trocado ou mudo: a medicao segue a faixa que
    // estiver no ar no momento.
    room.addListener("localTrackUnpublished", () =>
      this.#acompanharProprioMicrofone(),
    );
    room.addListener("trackMuted", (_pub, participante) => {
      if (participante.isLocal) this.#acompanharProprioMicrofone();
    });
    room.addListener("trackUnmuted", (_pub, participante) => {
      if (participante.isLocal) this.#acompanharProprioMicrofone();
    });

    room.addListener("participantConnected", () => {
      this.sound.playSound("userJoinVoice");
    });

    room.addListener("participantDisconnected", (participante) => {
      this.sound.playSound("userLeaveVoice");

      this.#pararDeAcompanhar(participante.identity);

      // O servidor do Stoat as vezes nao manda o aviso de saida, e a pessoa
      // fica de fantasma na lista do canal. Quem esta na call sabe da saida na
      // hora, pelo proprio LiveKit: da pra corrigir a lista aqui mesmo.
      this.#tirarDaLista(participante.identity);
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

    // Escolha do servidor de voz.
    //
    // A medicao de latencia batia em cada servidor antes de qualquer outra
    // coisa, e so depois pedia a entrada. Com um servidor so, que e o nosso
    // caso, isso era uma ida e volta inteira de espera pra escolher o unico
    // candidato. Com varios ela continua valendo.
    const nos = this.config.features.livekit.nodes;
    const selected =
      nos.length === 1
        ? nos[0].name
        : await Promise.any(
            nos.map(async (node) =>
              fetch(node.public_url.replace("wss", "https")).then(
                () => node.name,
              ),
            ),
          );
    marcar("servidor escolhido");

    // Adianta DNS, TLS e o aperto de mao enquanto o pedido de entrada vai e
    // volta, em vez de fazer tudo isso depois.
    const enderecos = nos.filter((node) => node.name === selected);
    if (enderecos.length) {
      room.prepareConnection(enderecos[0].public_url);
    }

    if (!auth) {
      auth = await channel.joinCall(selected);
      marcar("entrada autorizada");
    }

    await room.connect(auth.url, auth.token, {
      autoSubscribe: false,
    });
    marcar("conectado");

    // Entrar na call e um clique, e clique conta como permissao pra tocar som.
    // Tentar aqui resolve o caso comum; se o navegador recusar, o sinal acende
    // e a tela oferece o botao.
    await this.liberarAudio();
  }

  /**
   * Tira alguem da lista de quem esta no canal de voz.
   *
   * A lista vem dos avisos do servidor. Quando um aviso se perde, a pessoa
   * fica ali parada, muda, ate a pagina ser recarregada. Aqui ela sai assim
   * que o LiveKit conta que a conexao caiu.
   */
  #tirarDaLista(identidade: string) {
    const canal = this.channel();
    if (canal?.voiceParticipants.has(identidade)) {
      canal.voiceParticipants.delete(identidade);
    }
  }

  disconnect() {
    this.device.releaseWakeLock();
    this.#pararDeMedirMicrofone();
    try {
      const room = this.room();
      if (!room) return;

      // Sair da call tira a gente da lista na hora, sem esperar a volta do
      // aviso do servidor
      const eu = room.localParticipant.identity;
      if (eu) this.#tirarDaLista(eu);

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
      this.#setSurdos(new Set());

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

      this.avisarSurdez();
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
  /**
   * Liga, desliga ou troca a medicao do proprio microfone conforme o que esta
   * publicado agora.
   */
  #acompanharProprioMicrofone() {
    const publicacao = this.room()?.localParticipant.getTrackPublication(
      Track.Source.Microphone,
    );
    const audio = publicacao?.audioTrack;

    // A faixa medida e a que vai pro ar: com filtro de ruido ligado, e a
    // processada. Ela so aparece um instante depois da publicacao, dai a
    // segunda olhada logo abaixo.
    const faixa =
      publicacao && !publicacao.isMuted
        ? (audio?.getProcessor()?.processedTrack ?? audio?.mediaStreamTrack)
        : undefined;

    if (!faixa || faixa.readyState !== "live") {
      this.#pararDeMedirMicrofone();
      return;
    }

    if (this.#medidorLocal?.faixa === faixa) return;
    this.#medirMicrofone(faixa);

    if (!audio?.getProcessor()?.processedTrack) {
      setTimeout(() => this.#acompanharProprioMicrofone(), 500);
    }
  }

  #pararDeMedirMicrofone() {
    this.#medidorLocal?.parar();
    this.#medidorLocal = undefined;
    this.#setFalandoLocal(false);
  }

  /**
   * Mede o volume da faixa a cada 50 ms e acende o anel na hora.
   *
   * O rabo de 250 ms evita que o anel pisque entre uma silaba e outra, que era
   * a reclamacao de "acende e apaga rapido demais".
   */
  #medirMicrofone(faixa: MediaStreamTrack) {
    this.#pararDeMedirMicrofone();

    try {
      const contexto = new AudioContext();
      const analisador = contexto.createAnalyser();
      analisador.fftSize = 512;
      analisador.smoothingTimeConstant = 0;

      const fonte = contexto.createMediaStreamSource(new MediaStream([faixa]));
      fonte.connect(analisador);

      const amostras = new Uint8Array(analisador.fftSize);
      let ultimaVoz = 0;

      // Medir a cada quadro, e nao a cada 50 ms: o anel acende junto com a
      // primeira silaba em vez de no quadro seguinte
      let vivo = true;
      const medir = () => {
        if (!vivo) return;
        analisador.getByteTimeDomainData(amostras);

        let soma = 0;
        for (const amostra of amostras) {
          const desvio = (amostra - 128) / 128;
          soma += desvio * desvio;
        }
        const nivel = Math.sqrt(soma / amostras.length);

        const agora = performance.now();
        if (nivel > NIVEL_DE_FALA) ultimaVoz = agora;
        this.#setFalandoLocal(agora - ultimaVoz < RABO_DA_FALA);

        requestAnimationFrame(medir);
      };

      requestAnimationFrame(medir);

      this.#medidorLocal = {
        faixa,
        parar: () => {
          vivo = false;
          fonte.disconnect();
          contexto.close().catch(() => undefined);
        },
      };
    } catch (erro) {
      // Sem medicao local o anel volta a depender do servidor, como antes
      console.warn("[callju] nao consegui medir o proprio microfone", erro);
    }
  }

  /**
   * Pede ao navegador pra soltar o som que chega.
   *
   * Precisa acontecer dentro de um gesto da pessoa (um clique, um toque). Se
   * nao der, o sinal fica ligado e a tela mostra o botao pra tentar de novo.
   */
  async liberarAudio() {
    const room = this.room();
    if (!room) return;

    try {
      await room.startAudio();
      this.#setAudioBloqueado(!room.canPlaybackAudio);
    } catch {
      this.#setAudioBloqueado(true);
    }
  }

  /**
   * Traduz a falha do microfone pra uma frase que a pessoa entenda.
   */
  #explicarMicrofone(erro: unknown) {
    const nome = (erro as { name?: string })?.name;

    if (nome === "NotAllowedError")
      return "O navegador bloqueou o microfone. Libere o acesso ao microfone nas permissões do site e tente de novo.";
    if (nome === "NotFoundError")
      return "Nenhum microfone foi encontrado neste aparelho.";
    if (nome === "NotReadableError")
      return "Outro aplicativo está usando o microfone. Feche ele e tente de novo.";

    return "Não consegui abrir o microfone. Tente de novo em instantes.";
  }

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
      this.#setProblemaNoMicrofone(this.#explicarMicrofone(e));
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
   * Se a pessoa esta ensurdecida
   */
  estaSurdo(identidade: string) {
    return this.surdos().has(identidade);
  }

  /**
   * Refaz a lista de quem esta ensurdecido a partir dos atributos
   */
  #relerSurdos() {
    const room = this.room();
    if (!room) return;

    const proximo = new Set<string>();

    for (const p of room.remoteParticipants.values()) {
      if (p.attributes?.surdo) proximo.add(p.identity);
    }

    if (room.localParticipant.attributes?.surdo) {
      proximo.add(room.localParticipant.identity);
    }

    this.#setSurdos(proximo);
  }

  /**
   * Conta ao servico o estado atual de ensurdecimento
   *
   * O cliente nao pode gravar o proprio atributo, o token do Stoat proibe.
   * Entao pedimos ao nosso servico, que tem chave de administrador. Ele nao
   * acredita em quem dizemos ser: valida a sessao contra a API do Stoat.
   */
  async avisarSurdez() {
    const room = this.room();
    const canal = this.channel();
    if (!room || !canal) return;

    try {
      await fetch("/estado/surdo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: this.instancia.client.authenticationHeader[1],
          canal: canal.id,
          surdo: this.#settings.deafen,
        }),
      });
    } catch (e) {
      // Nao poder avisar so significa que os outros nao veem o icone.
      // Nao e motivo para atrapalhar a chamada de ninguem.
      console.warn("[callju] nao consegui avisar o ensurdecer", e);
    }
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

    // Aqui existia um aviso para quem transmite, avisando que alguem entrou
    // ou saiu da live, para tocar um som so na maquina dele. Foi removido.
    //
    // O LiveKit nao conta espectadores para o cliente, entao a unica via era
    // o canal de dados da sala. Mas o token que o Stoat emite traz
    // CanPublishData: false, e sem essa permissao publishData sempre falha.
    // Ou seja, o recurso nunca funcionou, so falhava em silencio.
    //
    // Para reviver isso e preciso mudar o grant do token, que fica no codigo
    // da API em Rust, nao neste cliente.
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
