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
              <div
                style={{
                  "font-size": "2.9em",
                  "font-weight": "800",
                  "letter-spacing": "-0.03em",
                  "line-height": "1.05",
                  "text-align": "center",
                  background:
                    "linear-gradient(115deg, #a78bfa 0%, #f0abfc 45%, #7dd3fc 100%)",
                  "-webkit-background-clip": "text",
                  "background-clip": "text",
                  color: "transparent",
                }}
              >
                Lucascord
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
                a casa da turma
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
                  Bem-vindo de volta.
                  <br />
                  Senta que tem lugar. 🛋️
                </span>
              </b>

              <span
                style={{
                  "text-align": "center",
                  opacity: "0.55",
                  "line-height": "1.5",
                }}
              >
                Voz em alta qualidade, tela em 1080p e servidor aqui no Brasil.
                Nosso canto, nossas regras.
              </span>
            </Column>

            <Column>
              <a href="/login/auth">
                <Column>
                  <Button>Entrar</Button>
                </Column>
              </a>
              <a href="/login/create">
                <Column>
                  <Button variant="tonal">Criar conta</Button>
                </Column>
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
