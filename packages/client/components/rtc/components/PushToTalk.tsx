import { createEffect, onCleanup } from "solid-js";

import { useState } from "@revolt/state";

import { useVoice } from "../state";

/**
 * Push to talk: o microfone so abre enquanto a tecla estiver segurada
 *
 * Fica montado apenas durante a chamada, entao fora dela nao sobra nenhum
 * ouvinte pendurado no documento.
 *
 * Limite conhecido do navegador: a pagina so recebe tecla enquanto a janela
 * esta em foco. Nao da para contornar isso sem app nativo, e e justamente por
 * isso que o microfone e solto quando a janela perde o foco. Sem essa parte,
 * sair do Callju com a tecla apertada deixaria o microfone aberto sem ninguem
 * perceber, que e o pior desfecho possivel para um recurso de privacidade.
 */
export function PushToTalk() {
  const voice = useVoice();
  const state = useState();

  let segurando = false;

  function ehATecla(evento: KeyboardEvent) {
    return state.voice.pushToTalk && evento.code === state.voice.pushToTalkKey;
  }

  function aoApertar(evento: KeyboardEvent) {
    if (!ehATecla(evento)) return;

    // A tecla passa a pertencer ao push to talk: nao digita, nao rola a
    // pagina e nao dispara atalho.
    evento.preventDefault();

    // keydown se repete sozinho enquanto a tecla fica presa. Sem esta guarda
    // mandariamos dezenas de pedidos por segundo ao LiveKit.
    if (segurando) return;
    segurando = true;

    voice.transmitirPorTecla(true);
  }

  function aoSoltar(evento: KeyboardEvent) {
    if (!ehATecla(evento)) return;

    evento.preventDefault();
    segurando = false;
    voice.transmitirPorTecla(false);
  }

  function aoPerderFoco() {
    if (!segurando) return;
    segurando = false;
    voice.transmitirPorTecla(false);
  }

  // Ligar ou desligar o modo no meio da chamada precisa valer na hora
  createEffect(() => {
    state.voice.pushToTalk;
    segurando = false;
    voice.reconciliarMicrofone();
  });

  // capture para receber a tecla antes de qualquer campo de texto
  window.addEventListener("keydown", aoApertar, { capture: true });
  window.addEventListener("keyup", aoSoltar, { capture: true });
  window.addEventListener("blur", aoPerderFoco);

  onCleanup(() => {
    window.removeEventListener("keydown", aoApertar, { capture: true });
    window.removeEventListener("keyup", aoSoltar, { capture: true });
    window.removeEventListener("blur", aoPerderFoco);

    // Sair da chamada com a tecla apertada nao pode deixar o microfone aberto
    if (segurando) voice.transmitirPorTecla(false);
  });

  return null;
}
