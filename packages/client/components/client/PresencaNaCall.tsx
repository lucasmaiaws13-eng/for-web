import { onCleanup, onMount } from "solid-js";

import { VoiceParticipant } from "stoat.js";

import { useClient } from ".";

/** De quanto em quanto tempo perguntamos quem esta em cada call */
const RITMO = 7000;

type Pessoa = {
  id: string;
  publicando: boolean;
  tela: boolean;
  camera: boolean;
  surdo: boolean;
};

/**
 * Mantem a lista de quem esta em cada call sempre certa.
 *
 * A lista chega ao navegador por avisos do servidor do Stoat. Quando um aviso
 * se perde (e isso acontece), a pessoa fica de fantasma na lista ou some dela,
 * e so uma recarga da pagina conserta. Quem sabe a verdade o tempo todo e o
 * servidor de voz: um servico nosso pergunta a ele e devolve a lista pronta,
 * e aqui a gente compara com o que esta na tela e corrige a diferenca.
 *
 * Corrigir e barato: so mexe em quem entrou ou saiu desde a ultima olhada.
 */
export function PresencaNaCall() {
  const client = useClient();

  async function conferir() {
    if (document.hidden) return;

    let salas: Record<string, Pessoa[]>;
    try {
      const [cabecalho, token] = client().authenticationHeader;
      const resposta = await fetch("/estado/quem", {
        headers: { [cabecalho]: token },
      });
      if (!resposta.ok) return;
      salas = (await resposta.json()).salas ?? {};
    } catch {
      // Servico fora do ar: a lista segue com o que os avisos trouxeram
      return;
    }

    for (const canal of client().channels.values()) {
      if (!canal.isVoice) continue;

      const gente = salas[canal.id] ?? [];
      const devemEstar = new Set(gente.map((p) => p.id));

      // Fantasmas: estao na tela e nao estao na call
      for (const id of [...canal.voiceParticipants.keys()]) {
        if (!devemEstar.has(id)) canal.voiceParticipants.delete(id);
      }

      // Quem entrou e o aviso nao chegou
      for (const pessoa of gente) {
        if (canal.voiceParticipants.has(pessoa.id)) continue;

        canal.voiceParticipants.set(
          pessoa.id,
          new VoiceParticipant(client(), {
            id: pessoa.id,
            joined_at: Date.now(),
            is_receiving: !pessoa.surdo,
            is_publishing: pessoa.publicando,
            screensharing: pessoa.tela,
            camera: pessoa.camera,
          }),
        );
      }
    }
  }

  onMount(() => {
    conferir();
    const relogio = setInterval(conferir, RITMO);
    const aoVoltar = () => {
      if (!document.hidden) conferir();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    onCleanup(() => {
      clearInterval(relogio);
      document.removeEventListener("visibilitychange", aoVoltar);
    });
  });

  return null;
}
