import { createEffect, createSignal, onCleanup, Show } from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { useState } from "@revolt/state";
import { CategoryButton, Checkbox, Column, Text } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

/**
 * Nome legivel para o codigo fisico da tecla
 *
 * Guardamos KeyboardEvent.code, que diz a posicao da tecla e nao a letra que
 * ela produz. Isso mantem o atalho funcionando em qualquer layout, mas os
 * nomes crus sao feios, entao traduzimos os mais comuns.
 */
function nomeDaTecla(code: string) {
  const conhecidas: Record<string, string> = {
    Backquote: "` (acima do Tab)",
    Space: "Barra de espaço",
    ShiftLeft: "Shift esquerdo",
    ShiftRight: "Shift direito",
    ControlLeft: "Ctrl esquerdo",
    ControlRight: "Ctrl direito",
    AltLeft: "Alt esquerdo",
    AltRight: "Alt direito",
    CapsLock: "Caps Lock",
    Tab: "Tab",
    Backslash: "\\",
    IntlBackslash: "\\ (ao lado do Shift)",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
  };

  if (conhecidas[code]) return conhecidas[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return "Num " + code.slice(6);
  return code;
}

/**
 * Push to talk
 */
export function PushToTalkOptions() {
  const { voice } = useState();
  const [capturando, setCapturando] = createSignal(false);

  /**
   * Enquanto espera a nova tecla, engole tudo: qualquer tecla serve como
   * atalho, inclusive as que normalmente fariam outra coisa na pagina.
   */
  function capturar(evento: KeyboardEvent) {
    evento.preventDefault();
    evento.stopPropagation();

    // Escape desiste sem trocar nada
    if (evento.code !== "Escape") {
      voice.pushToTalkKey = evento.code;
    }

    setCapturando(false);
  }

  createEffect(() => {
    if (!capturando()) return;

    window.addEventListener("keydown", capturar, { capture: true });
    onCleanup(() =>
      window.removeEventListener("keydown", capturar, { capture: true }),
    );
  });

  return (
    <Column>
      <Text class="title">
        <Trans>Push to Talk</Trans>
      </Text>

      <CategoryButton.Group>
        <CategoryButton
          icon={<Symbol>mic</Symbol>}
          action={<Checkbox checked={voice.pushToTalk} />}
          onClick={() => (voice.pushToTalk = !voice.pushToTalk)}
        >
          <Trans>Falar só enquanto segurar a tecla</Trans>
        </CategoryButton>

        <Show when={voice.pushToTalk}>
          <CategoryButton
            icon={<Symbol>keyboard</Symbol>}
            action={
              <Text class="label">
                {capturando() ? "aperte uma tecla" : nomeDaTecla(voice.pushToTalkKey)}
              </Text>
            }
            onClick={() => setCapturando((c) => !c)}
          >
            <Trans>Tecla</Trans>
          </CategoryButton>
        </Show>
      </CategoryButton.Group>

      <Text class="label">
        <Show
          when={capturando()}
          fallback={
            <Trans>
              Só funciona com a janela do Callju em foco. Navegador não deixa a
              página ler o teclado enquanto você está em outro programa, então
              jogando em tela cheia o atalho não responde.
            </Trans>
          }
        >
          <Trans>Aperte a tecla que quer usar, ou Esc para desistir.</Trans>
        </Show>
      </Text>
    </Column>
  );
}
