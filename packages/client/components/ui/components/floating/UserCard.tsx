import { useQuery } from "@tanstack/solid-query";
import { JSX, onMount, Show } from "solid-js";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useDevice } from "@revolt/common";
import { useModals } from "@revolt/modal";

import { Profile } from "../features";

/**
 * Base element for the card
 */
const base = cva({
  base: {
    // padding: "var(--gap-md)",

    color: "var(--md-sys-color-on-surface)",
    // Mesma placa de vidro da home
    background: "rgba(22, 22, 26, 0.9)",
    backdropFilter: "blur(20px) saturate(1.2)",
    border: "1px solid rgba(255, 255, 255, 0.09)",
    boxShadow:
      "inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 20px 46px rgba(0, 0, 0, 0.5)",

    width: "340px",
    height: "400px",

    borderRadius: "20px",
  },
});

/**
 * User Card
 */
export function UserCard(
  props: JSX.Directives["floating"]["userCard"] &
    object & { onClose: () => void },
) {
  const { isMobile } = useDevice();
  const { openModal } = useModals();
  const query = useQuery(() => ({
    queryKey: ["profile", props.user.id],
    queryFn: () => props.user.fetchProfile(),
  }));

  function openFull() {
    openModal({ type: "user_profile", user: props.user, member: props.member });
    props.onClose();
  }

  onMount(() => {
    if (isMobile) openFull();
  });

  return (
    <Show when={!isMobile}>
      <div
        use:invisibleScrollable={{ class: base() }}
        on:pointerdown={(e) => {
          e.preventDefault();
        }}
      >
        <Grid>
          <Profile.Banner
            width={2}
            user={props.user}
            member={props.member}
            bannerUrl={query.data?.animatedBannerURL}
            onClick={openFull}
          />
          <Profile.Actions
            user={props.user}
            member={props.member}
            onClose={props.onClose}
            width={2}
          />
          <Profile.Roles member={props.member} />
          <Profile.Badges user={props.user} />
          <Profile.Status user={props.user} />
          <Profile.Joined user={props.user} member={props.member} />{" "}
          <Show when={props.bot}>
            <Profile.Owner bot={props.bot!} />
          </Show>
          <Profile.Bio content={query.data?.content} onClick={openFull} />
        </Grid>
      </div>
    </Show>
  );
}

const Grid = styled("div", {
  base: {
    display: "grid",
    gap: "var(--gap-md)",
    padding: "var(--gap-md)",
    gridTemplateColumns: "repeat(2, 1fr)",
  },
});
