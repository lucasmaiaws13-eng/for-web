import { Match, Show, Switch } from "solid-js";

import { Trans } from "@lingui/solid/macro";

import { useClientLifecycle } from "@revolt/client";
import { TransitionType } from "@revolt/client/Controller";
import { Navigate } from "@revolt/routing";
import { Button, Column } from "@revolt/ui";

import { useState } from "@revolt/state";

/**
 * Flow for logging into an account
 */
export default function FlowHome() {
  const state = useState();
  const { lifecycle, isLoggedIn, isError } = useClientLifecycle();

  return (
    <Switch
      fallback={
        <>
          <Show when={isLoggedIn()}>
            <Navigate href={state.layout.popNextPath() ?? "/app"} />
          </Show>

          <Column gap="xl">
            <div
              style={{
                display: "flex",
                "flex-direction": "column",
                "align-items": "center",
                gap: "10px",
              }}
            >
              {/* O emoji fica FORA do elemento com degrade de proposito.
                  background-clip:text nao pinta elementos filhos, e o filho
                  ainda herda color:transparent, entao o emoji sumia. */}
              <div
                style={{
                  display: "flex",
                  "align-items": "center",
                  "justify-content": "center",
                  gap: "0.2em",
                  "font-size": "2.9em",
                  "font-weight": "800",
                  "line-height": "1.05",
                }}
              >
                <span style={{ transform: "translateY(-0.06em)" }}>🥭</span>
                <span
                  style={{
                    "letter-spacing": "-0.03em",
                    background: "var(--callju-grad)",
                    "-webkit-background-clip": "text",
                    "background-clip": "text",
                    color: "transparent",
                  }}
                >
                  Callju
                </span>
              </div>

              <div
                style={{
                  "font-size": "0.78em",
                  "letter-spacing": "0.22em",
                  "text-transform": "uppercase",
                  opacity: "0.45",
                  "text-align": "center",
                }}
              >
                call + caju
              </div>
            </div>

            <Column>
              <b
                style={{
                  "font-weight": "800",
                  "font-size": "1.35em",
                  display: "flex",
                  "flex-direction": "column",
                  "align-items": "center",
                  "text-align": "center",
                  "line-height": "1.3",
                }}
              >
                <span>
                  Chega mais.
                  <br />
                  A call já tá rolando.
                </span>
              </b>

              <span
                style={{
                  "text-align": "center",
                  opacity: "0.55",
                  "line-height": "1.5",
                }}
              >
                Voz nítida, tela em 1080p e nenhum anúncio no meio do papo.
                Nosso canto, nossas regras.
              </span>
            </Column>

            <Column>
              <a href="/login/auth" style={{ "text-decoration": "none" }}>
                <button
                  class="callju-btn"
                  style={{
                    width: "100%",
                    padding: "13px 20px",
                    "font-size": "0.98em",
                  }}
                >
                  Entrar
                </button>
              </a>
              <a href="/login/create" style={{ "text-decoration": "none" }}>
                <button
                  class="callju-btn-ghost"
                  style={{
                    width: "100%",
                    padding: "13px 20px",
                    "font-size": "0.98em",
                    "font-weight": "600",
                  }}
                >
                  Criar conta
                </button>
              </a>

              {/* Link do app, discreto de proposito: quem chega aqui ainda nao
                  tem conta, entao entrar vem primeiro. O endereco /latest/ do
                  GitHub aponta sempre para a versao mais nova, entao nao
                  precisa ser trocado a cada lancamento. */}
              <a
                href="https://github.com/lucasmaiaws13-eng/for-desktop/releases/latest/download/callju-setup.exe"
                style={{
                  "text-align": "center",
                  "font-size": "0.86em",
                  opacity: "0.55",
                  "text-decoration": "none",
                  color: "inherit",
                  "margin-top": "4px",
                }}
              >
                🖥️ Baixe o app para Windows
              </a>
            </Column>
          </Column>
        </>
      }
    >
      <Match when={isError()}>
        <Switch fallback={"an unknown error occurred"}>
          <Match when={lifecycle.permanentError === "InvalidSession"}>
            <h1>
              <Trans>You were logged out!</Trans>
            </h1>
          </Match>
        </Switch>

        <Button
          variant="filled"
          onPress={() =>
            lifecycle.transition({
              type: TransitionType.Dismiss,
            })
          }
        >
          <Trans>OK</Trans>
        </Button>
      </Match>
    </Switch>
  );
}
