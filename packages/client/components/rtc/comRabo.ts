import { Accessor, createEffect, createSignal, onCleanup } from "solid-js";

/**
 * Mantem um sinal ligado por mais um instante depois que ele desliga.
 *
 * O servidor avisa quem esta falando a cada 200 ms, e no meio de uma frase
 * sempre tem uma pausa curta entre palavras. Sem isto o anel dos outros pisca
 * o tempo todo. Ligar continua imediato: o rabo so atrasa o apagar.
 */
export function comRabo(fonte: Accessor<boolean>, ms = 400): Accessor<boolean> {
  const [aceso, setAceso] = createSignal(fonte());
  let relogio: ReturnType<typeof setTimeout> | undefined;

  createEffect(() => {
    if (fonte()) {
      clearTimeout(relogio);
      setAceso(true);
    } else {
      clearTimeout(relogio);
      relogio = setTimeout(() => setAceso(false), ms);
    }
  });

  onCleanup(() => clearTimeout(relogio));
  return aceso;
}
