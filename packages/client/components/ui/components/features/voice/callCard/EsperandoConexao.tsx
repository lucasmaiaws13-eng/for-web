import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { Avatar } from "@revolt/ui/components/design";

/**
 * O que aparece entre o clique e a call de verdade.
 *
 * Entrar leva alguns segundos: o servidor precisa autorizar, a conexao precisa
 * fechar e o microfone precisa abrir. Antes disso a tela ficava vazia e dava a
 * impressao de que o clique nao tinha pegado. Agora a pessoa ja se ve dentro
 * da chamada, piscando. O aviso de "Conectando" fica no canto do card, que ja
 * basta: escrever de novo no meio da tela era repeticao.
 */
export function EsperandoConexao() {
  const client = useClient();

  return (
    <Espera>
      <Piscando>
        <Avatar
          size={64}
          src={client().user?.avatarURL}
          fallback={client().user?.displayName ?? "?"}
        />
      </Piscando>
    </Espera>
  );
}

const Espera = styled("div", {
  base: {
    position: "relative",
    overflow: "hidden",
    height: "100%",
    minHeight: "120px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
});

const Piscando = styled("div", {
  base: {
    borderRadius: "50%",
    animation: "callju-pulso 1.4s ease-in-out infinite",
  },
});

