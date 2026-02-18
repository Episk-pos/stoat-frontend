import {
  Accessor,
  Match,
  Setter,
  Show,
  Switch,
  createContext,
  createEffect,
  createSignal,
  onCleanup,
  useContext,
} from "solid-js";
import {
  TrackLoop,
  TrackReference,
  VideoTrack,
  isTrackReference,
  useEnsureParticipant,
  useIsMuted,
  useIsSpeaking,
  useMaybeTrackRefContext,
  useTrackRefContext,
  useTracks,
} from "solid-livekit-components";

import { Track } from "livekit-client";
import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { UserContextMenu } from "@revolt/app";
import { useUser } from "@revolt/markdown/users";
import { InRoom, useVoice } from "@revolt/rtc";
import { Avatar } from "@revolt/ui/components/design";
import { OverflowingText } from "@revolt/ui/components/utils";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { VoiceStatefulUserIcons } from "../VoiceStatefulUserIcons";

import { VoiceCallCardActions } from "./VoiceCallCardActions";
import { VoiceCallCardStatus } from "./VoiceCallCardStatus";

type MaximizeState = {
  maximizedTileId: Accessor<string | undefined>;
  setMaximizedTileId: Setter<string | undefined>;
};

const maximizeContext = createContext<MaximizeState>(
  null as unknown as MaximizeState,
);

function useMaximize() {
  return useContext(maximizeContext);
}

/**
 * Call card (active)
 */
export function VoiceCallCardActiveRoom() {
  return (
    <View>
      <Call>
        <InRoom>
          <Participants />
        </InRoom>
      </Call>

      <VoiceCallCardStatus />
      <VoiceCallCardActions size="sm" />
    </View>
  );
}

const View = styled("div", {
  base: {
    minHeight: 0,
    height: "100%",
    width: "100%",

    gap: "var(--gap-md)",
    padding: "var(--gap-md)",

    display: "flex",
    flexDirection: "column",
  },
});

const Call = styled("div", {
  base: {
    flexGrow: 1,
    minHeight: 0,
    display: "flex",
    overflow: "hidden",
    padding: "var(--gap-md)",
  },
});

/**
 * Show a grid of participants
 */
function Participants() {
  const [maximizedTileId, setMaximizedTileId] = createSignal<string>();

  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const context: MaximizeState = {
    maximizedTileId,
    setMaximizedTileId,
  };

  createEffect(() => {
    if (!maximizedTileId() && document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
    }
  });

  return (
    <maximizeContext.Provider value={context}>
      <Grid single={tracks.length <= 1}>
        <TrackLoop tracks={tracks}>{() => <ParticipantTile />}</TrackLoop>
      </Grid>
    </maximizeContext.Provider>
  );
}

const Grid = styled("div", {
  base: {
    display: "grid",
    flexGrow: 1,
    minHeight: 0,
    overflowY: "auto",

    gap: "var(--gap-md)",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  },
  variants: {
    single: {
      true: {
        gridTemplateColumns: "minmax(0, 1fr)",
        gridAutoRows: "1fr",
        overflow: "hidden",
        alignContent: "stretch",

        // Let a single tile fill the available space instead of keeping 16:9.
        "& > div": {
          height: "100%",
          aspectRatio: "auto",
        },
      },
    },
  },
  defaultVariants: {
    single: false,
  },
});

/**
 * Individual participant tile
 */
function ParticipantTile() {
  const track = useTrackRefContext();
  const { maximizedTileId } = useMaximize();
  const tileId = () => `${track.participant.identity}:${track.source}`;

  return (
    <Switch
      fallback={
        <UserTile
          tileId={tileId()}
          isMaximized={maximizedTileId() === tileId()}
        />
      }
    >
      <Match when={track.source === Track.Source.ScreenShare}>
        <ScreenshareTile
          tileId={tileId()}
          isMaximized={maximizedTileId() === tileId()}
        />
      </Match>
    </Switch>
  );
}

/**
 * Shown when the track source is a camera or placeholder
 */
function UserTile(props: { tileId: string; isMaximized: boolean }) {
  const participant = useEnsureParticipant();
  const track = useMaybeTrackRefContext();
  const { setMaximizedTileId } = useMaximize();
  let tileRef: HTMLDivElement | undefined;

  const isMicMuted = useIsMuted({
    participant,
    source: Track.Source.Microphone,
  });

  const isVideoMuted = useIsMuted(
    track ?? { participant, source: Track.Source.Camera },
  );

  const isSpeaking = useIsSpeaking(participant);

  const user = useUser(participant.identity);
  const voice = useVoice();
  const videoDisabled = () => voice.isVideoWatchDisabled(participant.identity);

  async function toggleMaximize() {
    const shouldOpen = !props.isMaximized;
    setMaximizedTileId(shouldOpen ? props.tileId : undefined);

    if (!tileRef) return;
    if (!shouldOpen && document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }

    if (
      shouldOpen &&
      !document.fullscreenElement &&
      tileRef.requestFullscreen
    ) {
      await tileRef.requestFullscreen().catch(() => {});
    }
  }

  createEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setMaximizedTileId((current) =>
          current === props.tileId ? undefined : current,
        );
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMaximizedTileId((current) =>
          current === props.tileId ? undefined : current,
        );
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("keydown", onKeyDown);
    onCleanup(() => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("keydown", onKeyDown);
    });
  });

  return (
    <div
      ref={tileRef}
      class={tile({
        speaking: isSpeaking(),
        maximized: props.isMaximized,
      })}
      use:floating={{
        userCard: {
          user: user().user!,
          member: user().member,
        },
        contextMenu: () => (
          <UserContextMenu user={user().user!} member={user().member} inVoice />
        ),
      }}
    >
      <Switch
        fallback={
          <AvatarOnly>
            <Avatar
              src={user().avatar}
              fallback={user().username}
              size={48}
              interactive={false}
            />
          </AvatarOnly>
        }
      >
        <Match
          when={isTrackReference(track) && !isVideoMuted() && !videoDisabled()}
        >
          <VideoTrack
            style={{ "grid-area": "1/1" }}
            trackRef={track as TrackReference}
            manageSubscription={true}
          />
        </Match>
      </Switch>

      <Overlay>
        <OverlayInner>
          <OverflowingText>{user().username}</OverflowingText>
          <OverlayActions>
            <VoiceStatefulUserIcons
              userId={participant.identity}
              muted={isMicMuted()}
            />
            <TileActionButton
              type="button"
              title={props.isMaximized ? "Restore" : "Maximize"}
              onClick={(event) => {
                event.stopPropagation();
                void toggleMaximize();
              }}
            >
              <Symbol size={16}>
                {props.isMaximized ? "close_fullscreen" : "open_in_full"}
              </Symbol>
            </TileActionButton>
          </OverlayActions>
        </OverlayInner>
      </Overlay>
    </div>
  );
}

const AvatarOnly = styled("div", {
  base: {
    gridArea: "1/1",
    display: "grid",
    placeItems: "center",
  },
});

const ScreensharePlaceholder = styled("div", {
  base: {
    gridArea: "1/1",
    display: "grid",
    placeItems: "center",
    textAlign: "center",
    padding: "var(--gap-lg)",
    color: "var(--md-sys-color-on-surface)",
  },
});

/**
 * Shown when the track source is a screenshare
 */
function ScreenshareTile(props: { tileId: string; isMaximized: boolean }) {
  const participant = useEnsureParticipant();
  const track = useMaybeTrackRefContext();
  const user = useUser(participant.identity);
  const voice = useVoice();
  const { setMaximizedTileId } = useMaximize();
  let tileRef: HTMLDivElement | undefined;

  const isMuted = useIsMuted({
    participant,
    source: Track.Source.ScreenShareAudio,
  });

  const watching = () => voice.isScreenshareWatching(participant.identity);

  // If the share ends (tile unmounts), clear watch state.
  onCleanup(() => {
    voice.setScreenshareWatching(participant.identity, false);
  });

  async function toggleMaximize() {
    const shouldOpen = !props.isMaximized;
    setMaximizedTileId(shouldOpen ? props.tileId : undefined);

    if (!tileRef) return;
    if (!shouldOpen && document.fullscreenElement) {
      await document.exitFullscreen().catch(() => {});
      return;
    }

    if (
      shouldOpen &&
      !document.fullscreenElement &&
      tileRef.requestFullscreen
    ) {
      await tileRef.requestFullscreen().catch(() => {});
    }
  }

  createEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setMaximizedTileId((current) =>
          current === props.tileId ? undefined : current,
        );
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMaximizedTileId((current) =>
          current === props.tileId ? undefined : current,
        );
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("keydown", onKeyDown);
    onCleanup(() => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("keydown", onKeyDown);
    });
  });

  return (
    <div
      ref={tileRef}
      class={tile({ maximized: props.isMaximized }) + " group"}
    >
      <Show
        when={watching()}
        fallback={
          <ScreensharePlaceholder>
            <div>Screen share available</div>
          </ScreensharePlaceholder>
        }
      >
        <VideoTrack
          style={{ "grid-area": "1/1" }}
          trackRef={track as TrackReference}
          manageSubscription={true}
        />
      </Show>

      <Overlay showOnHover={watching()}>
        <OverlayInner>
          <OverflowingText>{user().username}</OverflowingText>
          <OverlayActions>
            <Show when={isMuted()}>
              <Symbol size={18}>no_sound</Symbol>
            </Show>

            <Show when={!watching()}>
              <WatchButton
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  voice.setScreenshareWatching(participant.identity, true);
                }}
              >
                Watch
              </WatchButton>
            </Show>

            <Show when={watching()}>
              <TileActionButton
                type="button"
                title="Stop watching"
                onClick={(event) => {
                  event.stopPropagation();
                  voice.setScreenshareWatching(participant.identity, false);
                }}
              >
                <Symbol size={16}>visibility_off</Symbol>
              </TileActionButton>
              <TileActionButton
                type="button"
                title={props.isMaximized ? "Restore" : "Maximize"}
                onClick={(event) => {
                  event.stopPropagation();
                  void toggleMaximize();
                }}
              >
                <Symbol size={16}>
                  {props.isMaximized ? "close_fullscreen" : "open_in_full"}
                </Symbol>
              </TileActionButton>
            </Show>
          </OverlayActions>
        </OverlayInner>
      </Overlay>
    </div>
  );
}

const tile = cva({
  base: {
    display: "grid",
    aspectRatio: "16/9",
    transition: ".3s ease all",
    borderRadius: "var(--borderRadius-lg)",

    color: "var(--md-sys-color-on-surface)",
    background: "#0002",

    overflow: "hidden",
    outlineWidth: "3px",
    outlineStyle: "solid",
    outlineOffset: "-3px",
    outlineColor: "transparent",
  },
  variants: {
    speaking: {
      true: {
        outlineColor: "var(--md-sys-color-primary)",
      },
    },
    maximized: {
      true: {
        gridColumn: "1 / -1",
        minHeight: "min(70vh, 920px)",
      },
      false: {},
    },
  },
});

const Overlay = styled("div", {
  base: {
    minWidth: 0,
    gridArea: "1/1",

    padding: "var(--gap-md) var(--gap-lg)",

    opacity: 1,
    display: "flex",
    alignItems: "end",
    flexDirection: "row",

    transition: "var(--transitions-fast) all",
    transitionTimingFunction: "ease",
  },
  variants: {
    showOnHover: {
      true: {
        opacity: 0,

        _groupHover: {
          opacity: 1,
        },
      },
      false: {
        opacity: 1,
      },
    },
  },
  defaultVariants: {
    showOnHover: false,
  },
});

const OverlayInner = styled("div", {
  base: {
    minWidth: 0,

    display: "flex",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",

    _first: {
      flexGrow: 1,
    },
  },
});

const OverlayActions = styled("div", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
  },
});

const TileActionButton = styled("button", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "26px",
    height: "26px",
    borderRadius: "9999px",
    border: "none",
    cursor: "pointer",
    color: "var(--md-sys-color-on-surface)",
    background:
      "color-mix(in srgb, var(--md-sys-color-surface) 70%, transparent)",
    transition: "var(--transitions-fast) background-color",
    _hover: {
      background:
        "color-mix(in srgb, var(--md-sys-color-surface) 92%, transparent)",
    },
  },
});

const WatchButton = styled("button", {
  base: {
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 600,
    height: "28px",
    paddingInline: "12px",
    borderRadius: "9999px",
    color: "var(--md-sys-color-on-surface)",
    background:
      "color-mix(in srgb, var(--md-sys-color-surface) 82%, transparent)",
    transition: "var(--transitions-fast) background-color",
    _hover: {
      background:
        "color-mix(in srgb, var(--md-sys-color-surface) 92%, transparent)",
    },
  },
});
