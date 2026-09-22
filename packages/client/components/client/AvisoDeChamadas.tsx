import { onCleanup, onMount } from "solid-js";

import { Channel, VoiceParticipant } from "stoat.js";

import { useNavigate } from "@revolt/routing";
import { useState } from "@revolt/state";

import { useClient } from ".";

/** De quanto em quanto tempo olhamos os canais de voz */
const INTERVALO = 10_000;

/**
 * Quanto tempo a call precisa durar antes de virar aviso.
 *
 * Sem essa espera, quem entra e sai por engano avisaria a galera toda. Com
 * ela, so vira aviso quem realmente ficou na chamada.
 */
const ESPERA = 30_000;

/** Depois de avisar de um canal, fica quieto por este tempo */
const SILENCIO = 2 * 60 * 60 * 1000;

/**
 * Avisa no computador quando uma call comeca.
 *
 * Muita gente deixa o Callju aberto e nao percebe que a galera entrou na call.
 * O aviso serve pra isso, e por isso mesmo e comedido: so quando a chamada sai
 * do zero, so depois de ela durar um tempo, so uma vez por canal a cada duas
 * horas, e nunca pra quem ja esta numa call. Da pra desligar nas configuracoes.
 */
export function AvisoDeChamadas() {
  const client = useClient();
  const state = useState();
  const navigate = useNavigate();

  /** Desde quando cada canal tem gente, e quando avisamos dele */
  const desde = new Map<string, number>();
  const avisados = new Map<string, number>();

  function olhar() {
    const eu = client().user?.id;
    if (!eu) return;

    const agora = Date.now();
    let euEmChamada = false;
    const canais: { canal: Channel; gente: VoiceParticipant[] }[] = [];

    for (const canal of client().channels.values()) {
      if (!canal.isVoice) continue;
      const gente = [...canal.voiceParticipants.values()];
      if (gente.some((p) => p.userId === eu)) euEmChamada = true;
      canais.push({ canal, gente });
    }

    for (const { canal, gente } of canais) {
      if (!gente.length) {
        // Call vazia zera tudo: a proxima que comecar aqui pode avisar de novo
        desde.delete(canal.id);
        avisados.delete(canal.id);
        continue;
      }

      if (!desde.has(canal.id)) desde.set(canal.id, agora);

      if (euEmChamada) continue;
      if (gente.every((p) => p.userId === eu)) continue;
      if (agora - (avisados.get(canal.id) ?? 0) < SILENCIO) continue;
      if (agora - desde.get(canal.id)! < ESPERA) continue;

      avisados.set(canal.id, agora);
      avisar(canal, gente);
    }
  }

  function avisar(canal: Channel, gente: VoiceParticipant[]) {
    if (
      Notification.permission !== "granted" ||
      state.settings.desktopNotificationsState !== "allowed" ||
      !state.settings.avisarChamadas
    )
      return;

    const primeiro = client().users.get(gente[0].userId);
    const nome = primeiro?.displayName ?? "Alguém";
    const onde = canal.server?.name
      ? `${canal.name} · ${canal.server.name}`
      : canal.name;

    const aviso = new Notification(
      gente.length > 1
        ? `${nome} e mais ${gente.length - 1} estão na call`
        : `${nome} começou uma call`,
      {
        body: onde,
        icon: primeiro?.avatarURL,
        badge: "/assets/web/android-chrome-512x512.png",
        tag: `call-${canal.id}`,
        silent: true,
      },
    );

    aviso.addEventListener("click", () => {
      window.focus();
      navigate(canal.path);
    });
  }

  onMount(() => {
    const relogio = setInterval(olhar, INTERVALO);
    onCleanup(() => clearInterval(relogio));
  });

  return null;
}
