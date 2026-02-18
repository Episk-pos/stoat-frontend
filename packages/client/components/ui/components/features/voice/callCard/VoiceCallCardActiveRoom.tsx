import {
  Accessor,
  Match,
  Setter,
  Show,
  Switch,
  createContext,
  createEffect,
  createMemo,
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

type CallFullscreenState = {
  isCallFullscreen: Accessor<boolean>;
  toggleCallFullscreen: () => Promise<void>;
};

const callFullscreenContext = createContext<CallFullscreenState>(
  null as unknown as CallFullscreenState,
);

function useCallFullscreen() {
  return useContext(callFullscreenContext);
}

type SpotlightControlsState = {
  hideMembers: Accessor<boolean>;
  toggleHideMembers: () => void;
  hasOtherTiles: Accessor<boolean>;
};

const spotlightControlsContext = createContext<SpotlightControlsState>(
  null as unknown as SpotlightControlsState,
);

function useSpotlightControls() {
  return useContext(spotlightControlsContext);
}

/**
 * Call card (active)
 */
export function VoiceCallCardActiveRoom() {
  let callRef: HTMLDivElement | undefined;
  const [isCallFullscreen, setIsCallFullscreen] = createSignal(false);

  async function toggleCallFullscreen() {
    try {
      if (!callRef) return;
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (callRef.requestFullscreen) {
        await callRef.requestFullscreen();
      }
    } catch {
      // ignore
    }
  }

  createEffect(() => {
    const onFullscreenChange = () => {
      setIsCallFullscreen(!!callRef && document.fullscreenElement === callRef);
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    onCleanup(() =>
      document.removeEventListener("fullscreenchange", onFullscreenChange),
    );
  });

  const callFullscreen: CallFullscreenState = {
    isCallFullscreen,
    toggleCallFullscreen,
  };

  return (
    <callFullscreenContext.Provider value={callFullscreen}>
      <View>
        <Call ref={callRef}>
          <InRoom>
            <Participants />
          </InRoom>
        </Call>

        <VoiceCallCardStatus />
        <VoiceCallCardActions size="sm" />
      </View>
    </callFullscreenContext.Provider>
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
  const [hideMembers, setHideMembers] = createSignal(false);

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

  const getTracks = () =>
    typeof tracks === "function"
      ? (tracks as unknown as () => TrackReference[])()
      : (tracks as unknown as TrackReference[]);

  const spotlightTrack = createMemo(() => {
    const id = maximizedTileId();
    if (!id) return undefined;
    return getTracks().find(
      (t) => `${t.participant.identity}:${t.source}` === id,
    );
  });

  const spotlightTracks = createMemo(() => {
    const t = spotlightTrack();
    return t ? [t] : [];
  });

  const otherTracks = createMemo(() => {
    const id = maximizedTileId();
    const all = getTracks();
    if (!id) return all;
    return all.filter((t) => `${t.participant.identity}:${t.source}` !== id);
  });

  createEffect(() => {
    if (!maximizedTileId()) setHideMembers(false);
  });

  const hasOtherTiles = createMemo(
    () => !!maximizedTileId() && otherTracks().length > 0,
  );

  const spotlightControls: SpotlightControlsState = {
    hideMembers,
    toggleHideMembers: () => setHideMembers((v) => !v),
    hasOtherTiles,
  };

  return (
    <maximizeContext.Provider value={context}>
      <spotlightControlsContext.Provider value={spotlightControls}>
        <Show
          when={maximizedTileId()}
          fallback={
            <Grid>
              <TrackLoop tracks={tracks}>{() => <ParticipantTile />}</TrackLoop>
            </Grid>
          }
        >
          <Spotlight>
            <SpotlightStage>
              <TrackLoop tracks={spotlightTracks}>
                {() => <ParticipantTile />}
              </TrackLoop>
            </SpotlightStage>

            <Show when={!hideMembers() && otherTracks().length > 0}>
              <Filmstrip>
                <TrackLoop tracks={otherTracks}>
                  {() => <ParticipantTile />}
                </TrackLoop>
              </Filmstrip>
            </Show>
          </Spotlight>
        </Show>
      </spotlightControlsContext.Provider>
    </maximizeContext.Provider>
  );
}

const Grid = styled("div", {
  base: {
    width: "100%",
    flex: "1 1 auto",
    minWidth: 0,
    minHeight: 0,

    display: "grid",
    gap: "var(--gap-md)",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    alignContent: "start",

    // Avoid forcing scrollbars in normal cases; only scroll when needed.
    overflowY: "auto",
  },
});

const Spotlight = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-md)",
    width: "100%",
    flex: "1 1 auto",
    minHeight: 0,
  },
});

const SpotlightStage = styled("div", {
  base: {
    flex: "1 1 auto",
    minHeight: 0,
    display: "grid",
    placeItems: "center",
    overflow: "hidden",

    "& .voice-tile": {
      width: "min(100%, 1200px)",
    },
  },
});

const Filmstrip = styled("div", {
  base: {
    flex: "0 0 auto",
    display: "flex",
    gap: "var(--gap-md)",
    overflowX: "auto",
    overflowY: "hidden",
    paddingBottom: "var(--gap-xs)",

    "& .voice-tile": {
      flex: "0 0 240px",
    },
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
  const callFullscreen = useCallFullscreen();
  const spotlightControls = useSpotlightControls();

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

  function toggleSpotlight() {
    setMaximizedTileId(props.isMaximized ? undefined : props.tileId);
  }

  return (
    <div
      class={tile({
        speaking: isSpeaking(),
        spotlighted: props.isMaximized,
      })}
      classList={{ "voice-tile": true, group: true }}
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
      <MediaLayer>
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
            when={
              isTrackReference(track) && !isVideoMuted() && !videoDisabled()
            }
          >
            <VideoTrack
              style={{
                "grid-area": "1/1",
                width: "100%",
                height: "100%",
                "object-fit": "cover",
              }}
              trackRef={track as TrackReference}
              manageSubscription={true}
            />
          </Match>
        </Switch>
      </MediaLayer>

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
              title={props.isMaximized ? "Unspotlight" : "Spotlight"}
              onClick={(event) => {
                event.stopPropagation();
                toggleSpotlight();
              }}
            >
              <Symbol size={16}>push_pin</Symbol>
            </TileActionButton>

            <Show when={props.isMaximized}>
              <Show when={spotlightControls.hasOtherTiles()}>
                <TileActionButton
                  type="button"
                  title={
                    spotlightControls.hideMembers()
                      ? "Show members"
                      : "Hide members"
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    spotlightControls.toggleHideMembers();
                  }}
                >
                  <Symbol size={16}>
                    {spotlightControls.hideMembers() ? "group" : "group_off"}
                  </Symbol>
                </TileActionButton>
              </Show>

              <TileActionButton
                type="button"
                title={
                  callFullscreen.isCallFullscreen()
                    ? "Exit fullscreen"
                    : "Fullscreen call"
                }
                onClick={(event) => {
                  event.stopPropagation();
                  void callFullscreen.toggleCallFullscreen();
                }}
              >
                <Symbol size={16}>
                  {callFullscreen.isCallFullscreen()
                    ? "close_fullscreen"
                    : "open_in_full"}
                </Symbol>
              </TileActionButton>
            </Show>
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
  const callFullscreen = useCallFullscreen();
  const spotlightControls = useSpotlightControls();

  const isMuted = useIsMuted({
    participant,
    source: Track.Source.ScreenShareAudio,
  });

  const watching = () => voice.isScreenshareWatching(participant.identity);

  function toggleSpotlight() {
    setMaximizedTileId(props.isMaximized ? undefined : props.tileId);
  }

  return (
    <div
      class={tile({ spotlighted: props.isMaximized })}
      classList={{ "voice-tile": true, group: true }}
    >
      <MediaLayer>
        <Show
          when={watching()}
          fallback={
            <ScreensharePlaceholder>
              <div>Screen share available</div>
            </ScreensharePlaceholder>
          }
        >
          <VideoTrack
            style={{
              "grid-area": "1/1",
              width: "100%",
              height: "100%",
              "object-fit": "contain",
            }}
            trackRef={track as TrackReference}
            manageSubscription={false}
          />
        </Show>
      </MediaLayer>

      <Overlay showOnHover={watching() && !props.isMaximized}>
        <OverlayInner>
          <OverflowingText>{user().username}</OverflowingText>
          <OverlayActions>
            <Show when={isMuted()}>
              <Symbol size={18}>no_sound</Symbol>
            </Show>

            <Show
              when={watching()}
              fallback={
                <WatchButton
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    voice.setScreenshareWatching(participant.identity, true);
                  }}
                >
                  Watch
                </WatchButton>
              }
            >
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
            </Show>

            <TileActionButton
              type="button"
              title={props.isMaximized ? "Unspotlight" : "Spotlight"}
              onClick={(event) => {
                event.stopPropagation();
                toggleSpotlight();
              }}
            >
              <Symbol size={16}>push_pin</Symbol>
            </TileActionButton>

            <Show when={props.isMaximized}>
              <Show when={spotlightControls.hasOtherTiles()}>
                <TileActionButton
                  type="button"
                  title={
                    spotlightControls.hideMembers()
                      ? "Show members"
                      : "Hide members"
                  }
                  onClick={(event) => {
                    event.stopPropagation();
                    spotlightControls.toggleHideMembers();
                  }}
                >
                  <Symbol size={16}>
                    {spotlightControls.hideMembers() ? "group" : "group_off"}
                  </Symbol>
                </TileActionButton>
              </Show>

              <TileActionButton
                type="button"
                title={
                  callFullscreen.isCallFullscreen()
                    ? "Exit fullscreen"
                    : "Fullscreen call"
                }
                onClick={(event) => {
                  event.stopPropagation();
                  void callFullscreen.toggleCallFullscreen();
                }}
              >
                <Symbol size={16}>
                  {callFullscreen.isCallFullscreen()
                    ? "close_fullscreen"
                    : "open_in_full"}
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

    minWidth: 0,

    position: "relative",
    isolation: "isolate",

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
    spotlighted: {
      true: {
        outlineColor:
          "color-mix(in srgb, var(--md-sys-color-primary) 60%, transparent)",
      },
      false: {},
    },
  },
});

const MediaLayer = styled("div", {
  base: {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    display: "grid",
    width: "100%",
    height: "100%",
  },
});

const Overlay = styled("div", {
  base: {
    minWidth: 0,
    gridArea: "1/1",

    position: "absolute",
    inset: 0,
    zIndex: 2,

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
