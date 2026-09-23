import { For, Show, createMemo, createSignal, onCleanup, onMount } from "solid-js";

import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { IS_DEV, useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { useNavigate } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Avatar, Button, Header, main } from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import {
  AndroidModal,
  AppModal,
  AvisoModal,
  GuiaModal,
  PixModal,
} from "./CalljuModals";
import { HeaderIcon } from "./common/CommonHeader";

// >>> TROQUE AQUI pela sua chave Pix (CPF, telefone, email ou aleatoria)
const CHAVE_PIX = "+5591983673239";

// >>> TROQUE AQUI pelo codigo do convite permanente do servidor principal.
// So o codigo, nao a URL inteira. Ex: se o link e /invite/AbC123, use "AbC123".
const CONVITE_SERVIDOR = "TA4TJ57t";

/** Nome do servidor principal, como aparece nos textos */
const NOME_DO_SERVIDOR = "Salvação";

/** De quanto em quanto tempo a home relê o que esta acontecendo */
const RITMO = 6000;

/* ------------------------------------------------------------------ */
/* Peças                                                               */
/* ------------------------------------------------------------------ */

const Base = styled("div", {
  base: {
    position: "relative",
    width: "100%",
    height: "100%",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    color: "var(--md-sys-color-on-surface)",
  },
});

const content = cva({
  base: {
    ...main.raw(),
    padding: "28px 20px 40px",
    gap: "14px",
    alignItems: "center",
    justifyContent: "center",
  },
});

/**
 * Placa de vidro: desfoque do que esta atras, contorno claro no topo e sombra
 * embaixo. Quem desligou os efeitos de transparencia recebe a placa em cor
 * cheia, sem perder o desenho.
 */
const Vidro = styled("div", {
  base: {
    position: "relative",
    width: "100%",
    maxWidth: "540px",
    overflow: "hidden",
    borderRadius: "20px",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "rgba(255, 255, 255, 0.035)",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 16px 40px rgba(0, 0, 0, 0.4)",
  },
  variants: {
    desfoque: {
      true: { backdropFilter: "blur(20px) saturate(1.2)" },
      false: { background: "var(--md-sys-color-surface-container)" },
    },
  },
});

const Brilho = styled("div", {
  base: {
    position: "absolute",
    top: "4%",
    left: "50%",
    width: "640px",
    height: "360px",
    transform: "translateX(-50%)",
    pointerEvents: "none",
    background:
      "radial-gradient(closest-side, rgba(232, 130, 60, 0.13), transparent)",
  },
});

/* ------------------------------------------------------------------ */
/* Página                                                              */
/* ------------------------------------------------------------------ */

export function HomePage() {
  const { openModal } = useModals();
  const navigate = useNavigate();
  const client = useClient();
  const state = useState();

  const [guiaAberto, setGuiaAberto] = createSignal(false);
  const [pixAberto, setPixAberto] = createSignal(false);
  const [appAberto, setAppAberto] = createSignal(false);
  const [avisoAberto, setAvisoAberto] = createSignal(false);
  const [androidAberto, setAndroidAberto] = createSignal(false);

  // Um relogio lento so pra home reler o que esta acontecendo: quem entrou na
  // call, quem ficou online. Sem isso a tela envelhece parada na frente da
  // pessoa.
  const [tique, setTique] = createSignal(0);
  onMount(() => {
    const r = setInterval(() => setTique((n) => n + 1), RITMO);
    onCleanup(() => clearInterval(r));
  });

  const saudacao = () => {
    const h = new Date().getHours();
    if (h < 5) return "Boa madrugada";
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  };

  /** Canais de voz com gente dentro, em todos os servidores */
  const callsAtivas = createMemo(() => {
    tique();
    const lista = [];
    for (const canal of client().channels.values()) {
      if (!canal.isVoice) continue;
      const gente = [...canal.voiceParticipants.values()];
      if (gente.length) lista.push({ canal, gente });
    }
    return lista;
  });

  const online = createMemo(() => {
    tique();
    let total = 0;
    for (const usuario of client().users.values()) {
      if (usuario.bot) continue;
      // online e o que o proprio cliente calcula a partir da presenca
      if (usuario.online) total += 1;
    }
    return total;
  });

  /** Estado da cruzada de hoje, pra home ter vida mesmo com a call vazia */
  const [cruzada, setCruzada] = createSignal<{
    pendentes: number;
    total: number;
  }>();

  onMount(async () => {
    try {
      const [cabecalho, token] = client().authenticationHeader;
      const r = await fetch("/jogos/cruzada/status", {
        headers: { [cabecalho]: token },
      });
      if (!r.ok) return;
      const dados = await r.json();
      const niveis = Object.values(dados.niveis ?? {}) as {
        terminou: boolean;
      }[];
      setCruzada({
        pendentes: niveis.filter((n) => !n.terminou).length,
        total: niveis.length,
      });
    } catch {
      // Sem os minigames no ar, a home simplesmente nao mostra esse cartao
    }
  });

  const conviteConfigurado =
    CONVITE_SERVIDOR !== "cole-o-codigo-do-convite-aqui";

  return (
    <Base>
      <Header placement="primary">
        <HeaderIcon>
          <Symbol size={22} color="var(--md-sys-color-primary)">
            home
          </Symbol>
        </HeaderIcon>
        Início
      </Header>

      <div use:scrollable={{ class: content() }}>
        <Brilho />

        {/* Saudacao: o nome da pessoa e o que esta acontecendo agora */}
        <Saudacao class="callju-rise">
          <h1>
            {saudacao()}, {client().user?.displayName ?? "pessoa"}
          </h1>
          <p>
            <Show
              when={callsAtivas().length}
              fallback={
                online() > 1
                  ? `${online()} pessoas por aqui, e nenhuma call rolando`
                  : "Tudo quieto por aqui agora"
              }
            >
              Tem call rolando no {NOME_DO_SERVIDOR}
            </Show>
          </p>
        </Saudacao>

        {/* O bloco principal muda conforme o que esta acontecendo: com call
            rolando ele mostra quem esta la; vazio, ele convida a comecar */}
        <Vidro desfoque={state.theme.blur} class="callju-rise">
          <Show
            when={callsAtivas().length}
            fallback={
              <Convite>
                <span>
                  <strong>A call está vazia</strong>
                  <small>
                    Entra e chama a galera. Quem estiver com o Callju aberto
                    recebe um aviso.
                  </small>
                </span>
                <Show when={conviteConfigurado}>
                  <button
                    class="callju-btn"
                    onClick={() => navigate(`/invite/${CONVITE_SERVIDOR}`)}
                    style={{ padding: "11px 18px", "white-space": "nowrap" }}
                  >
                    Entrar no {NOME_DO_SERVIDOR}
                  </button>
                </Show>
              </Convite>
            }
          >
            <For each={callsAtivas()}>
              {({ canal, gente }) => (
                <CallAtiva onClick={() => navigate(canal.path)}>
                  <Pulso />
                  <span style={{ flex: "1", "min-width": "0" }}>
                    <strong>{canal.name}</strong>
                    <small>
                      {gente.length === 1
                        ? "1 pessoa na call"
                        : `${gente.length} pessoas na call`}
                    </small>
                  </span>
                  <Fotos>
                    <For each={gente.slice(0, 5)}>
                      {(p) => (
                        <Avatar
                          size={28}
                          src={client().users.get(p.userId)?.avatarURL}
                          fallback={
                            client().users.get(p.userId)?.displayName ?? "?"
                          }
                        />
                      )}
                    </For>
                  </Fotos>
                  <Symbol size={20}>chevron_right</Symbol>
                </CallAtiva>
              )}
            </For>
          </Show>
        </Vidro>

        {/* Cruzada do dia: a home tem o que mostrar mesmo sem ninguem online */}
        <Show when={cruzada()}>
          <Vidro desfoque={state.theme.blur} class="callju-rise">
            <Linha onClick={() => navigate("/minigames/cruzadas")}>
              <Selo>
                <Symbol size={20}>grid_on</Symbol>
              </Selo>
              <span style={{ flex: "1", "min-width": "0" }}>
                <strong>Cruzada do dia</strong>
                <small>
                  <Show
                    when={cruzada()!.pendentes}
                    fallback="Você fechou as duas de hoje"
                  >
                    {cruzada()!.pendentes === cruzada()!.total
                      ? "Nenhuma feita hoje, o ranking está aberto"
                      : "Falta uma pra fechar o dia"}
                  </Show>
                </small>
              </span>
              <Symbol size={20}>chevron_right</Symbol>
            </Linha>
          </Vidro>
        </Show>

        {/* Novidades e ajuda, em segundo plano */}
        <Atalhos class="callju-rise">
          <Atalho onClick={() => setAppAberto(true)}>
            <Symbol size={18}>desktop_windows</Symbol>
            App pro PC
          </Atalho>
          <Atalho onClick={() => setAndroidAberto(true)}>
            <Symbol size={18}>phone_android</Symbol>
            App pro Android
          </Atalho>
          <Atalho
            onClick={() =>
              openModal({ type: "create_group_or_server", client: client()! })
            }
          >
            <Symbol size={18}>add</Symbol>
            Criar grupo
          </Atalho>
          <Atalho onClick={() => setGuiaAberto(true)}>
            <Symbol size={18}>menu_book</Symbol>
            Como usar
          </Atalho>
          <Atalho onClick={() => setAvisoAberto(true)}>
            <Symbol size={18}>info</Symbol>
            Sobre o Callju
          </Atalho>
        </Atalhos>

        <Apoiar onClick={() => setPixAberto(true)}>
          <Symbol size={18}>favorite</Symbol>
          <span>Apoiar o Callju</span>
        </Apoiar>

        <GuiaModal
          aberto={guiaAberto()}
          fechar={() => setGuiaAberto(false)}
          mostrarBotaoServidor={conviteConfigurado}
          entrarNoServidor={() => navigate(`/invite/${CONVITE_SERVIDOR}`)}
        />
        <PixModal
          aberto={pixAberto()}
          fechar={() => setPixAberto(false)}
          chave={CHAVE_PIX}
        />
        <AppModal aberto={appAberto()} fechar={() => setAppAberto(false)} />
        <AndroidModal
          aberto={androidAberto()}
          fechar={() => setAndroidAberto(false)}
        />
        <AvisoModal
          aberto={avisoAberto()}
          fechar={() => setAvisoAberto(false)}
          abrirPix={() => setPixAberto(true)}
        />

        <Show when={IS_DEV}>
          <Button onPress={() => navigate("/dev")}>
            Open Development Page
          </Button>
        </Show>
      </div>
    </Base>
  );
}

/* ------------------------------------------------------------------ */
/* Estilos                                                             */
/* ------------------------------------------------------------------ */

const Saudacao = styled("div", {
  base: {
    width: "100%",
    maxWidth: "540px",
    marginBottom: "2px",

    "& h1": {
      margin: 0,
      fontSize: "1.6em",
      fontWeight: 800,
      letterSpacing: "-0.03em",
    },

    "& p": {
      margin: "4px 0 0",
      fontSize: "0.9em",
      color: "var(--md-sys-color-on-surface-variant)",
    },
  },
});

const linhaBase = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "12px",

  padding: "16px 18px",
  border: "none",
  background: "transparent",
  color: "var(--md-sys-color-on-surface)",
  textAlign: "start",
  font: "inherit",
  cursor: "pointer",

  transition: "background var(--mov-toque)",
  _hover: { background: "rgba(255, 255, 255, 0.04)" },

  "& strong": {
    display: "block",
    fontSize: "1em",
    fontWeight: 700,
    letterSpacing: "-0.01em",
  },

  "& small": {
    display: "block",
    marginTop: "2px",
    fontSize: "0.82em",
    fontWeight: 400,
    color: "var(--md-sys-color-on-surface-variant)",
  },
} as const;

const CallAtiva = styled("button", { base: linhaBase });
const Linha = styled("button", { base: linhaBase });

const Convite = styled("div", {
  base: {
    ...linhaBase,
    cursor: "default",
    _hover: { background: "transparent" },
    gap: "16px",
  },
});

/** Bolinha que pulsa: a call esta acontecendo agora */
const Pulso = styled("span", {
  base: {
    width: "9px",
    height: "9px",
    flexShrink: 0,
    borderRadius: "99px",
    background: "var(--callju-accent)",
    animation: "callju-pulso 1.6s ease-in-out infinite",
  },
});

const Fotos = styled("div", {
  base: {
    display: "flex",
    paddingInlineStart: "7px",

    "& > *": {
      marginInlineStart: "-7px",
      borderRadius: "99px",
      boxShadow: "0 0 0 2px var(--md-sys-color-surface-container)",
    },
  },
});

const Selo = styled("span", {
  base: {
    width: "38px",
    height: "38px",
    flexShrink: 0,
    display: "grid",
    placeItems: "center",
    borderRadius: "12px",
    color: "#fff",
    background: "var(--callju-grad)",
  },
});

const Atalhos = styled("div", {
  base: {
    width: "100%",
    maxWidth: "540px",
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
});

const Atalho = styled("button", {
  base: {
    flex: "1 1 120px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "7px",

    padding: "10px 12px",
    borderRadius: "12px",
    border: "1px solid rgba(255, 255, 255, 0.07)",
    background: "rgba(255, 255, 255, 0.03)",
    color: "var(--md-sys-color-on-surface-variant)",

    font: "inherit",
    fontSize: "0.83em",
    fontWeight: 600,
    whiteSpace: "nowrap",
    cursor: "pointer",

    transition:
      "background var(--mov-toque), color var(--mov-toque), transform var(--mov-toque)",

    _hover: {
      background: "rgba(255, 255, 255, 0.07)",
      color: "var(--md-sys-color-on-surface)",
      transform: "translateY(-2px)",
    },

    "&:active": { transform: "translateY(0)" },
  },
});

const Apoiar = styled("button", {
  base: {
    position: "fixed",
    right: "20px",
    bottom: "20px",
    zIndex: 3,

    display: "flex",
    alignItems: "center",
    gap: "8px",

    padding: "9px 14px",
    borderRadius: "99px",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    background: "rgba(255, 255, 255, 0.05)",
    backdropFilter: "blur(14px)",
    color: "var(--md-sys-color-on-surface-variant)",

    font: "inherit",
    fontSize: "0.82em",
    fontWeight: 600,
    cursor: "pointer",

    transition:
      "background var(--mov-toque), color var(--mov-toque), transform var(--mov-toque)",

    _hover: {
      background: "var(--callju-accent-soft)",
      color: "var(--callju-accent-claro)",
      transform: "translateY(-2px)",
    },
  },
});
