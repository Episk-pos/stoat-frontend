import {
  Match,
  Show,
  Switch,
  createEffect,
  createSignal,
  on,
  onCleanup,
} from "solid-js";

import { cva } from "styled-system/css";
import { styled } from "styled-system/jsx";
import { decodeTime, ulid } from "ulid";

import { DraftMessages, Messages } from "@revolt/app";
import { useClient } from "@revolt/client";
import { Keybind, KeybindAction, createKeybind } from "@revolt/keybinds";
import { useNavigate, useSmartParams } from "@revolt/routing";
import { useVoice } from "@revolt/rtc";
import { useState } from "@revolt/state";
import { LAYOUT_SECTIONS } from "@revolt/state/stores/Layout";
import {
  BelowFloatingHeader,
  Header,
  NewMessages,
  Text,
  TypingIndicator,
  main,
} from "@revolt/ui";
import { VoiceChannelCallCardMount } from "@revolt/ui/components/features/voice/callCard/VoiceCallCard";

import { ChannelHeader } from "../ChannelHeader";
import { ChannelPageProps } from "../ChannelPage";

import { MessageComposition } from "./Composition";
import { MemberSidebar } from "./MemberSidebar";
import { TextSearchSidebar } from "./TextSearchSidebar";

/**
 * State of the channel sidebar
 */
export type SidebarState =
  | {
      state: "search";
      query: string;
    }
  | {
      state: "pins";
    }
  | {
      /** Voice-only: show the channel message timeline in the right panel. */
      state: "voice_chat";
    }
  | {
      state: "default";
    };

/**
 * Channel component
 */
export function TextChannel(props: ChannelPageProps) {
  const state = useState();
  const client = useClient();
  const voice = useVoice();

  /**
   * Whether to show the voice layout (call card in main area, messages in sidebar).
   * For DMs/Groups: only when actively in a call for this channel OR others are in the call.
   * For server voice channels: always (original behavior).
   */
  const showVoiceLayout = () => {
    if (!props.channel.isVoice) return false;
    // Server voice channels always use voice layout
    if (props.channel.type === "TextChannel") return true;
    // DMs/Groups: voice layout only when a call is active
    const inCall = voice.channel()?.id === props.channel.id;
    const hasParticipants = props.channel.voiceParticipants.size > 0;
    return inCall || hasParticipants;
  };

  // Last unread message id
  const [lastId, setLastId] = createSignal<string>();

  // Read highlighted message id from parameters
  const params = useSmartParams();
  const navigate = useNavigate();

  /**
   * Message id to be highlighted
   * @returns Message Id
   */
  const highlightMessageId = () => params().messageId;

  // Get a reference to the message box's load latest function
  let jumpToBottomRef: ((nearby?: string) => void) | undefined;

  // Get a reference to the message list's "end status"
  let atEndRef: (() => boolean) | undefined;

  // Store last unread message id
  createEffect(
    on(
      () => props.channel.id,
      (id) =>
        setLastId(
          props.channel.unread
            ? (client().channelUnreads.get(id)?.lastMessageId as string)
            : undefined,
        ),
    ),
  );

  // Mark channel as read whenever it is marked as unread
  createEffect(
    on(
      // must be at the end of the conversation
      () => props.channel.unread && (atEndRef ? atEndRef() : true),
      (unread) => {
        if (unread) {
          if (document.hasFocus()) {
            // acknowledge the message
            props.channel.ack();
          } else {
            // otherwise mark this location as the last read location
            if (!lastId()) {
              // (taking away one second from the seed)
              setLastId(ulid(decodeTime(props.channel.lastMessageId!) - 1));
            }
          }
        }
      },
    ),
  );

  // Mark as read on re-focus
  function onFocus() {
    if (props.channel.unread && (atEndRef ? atEndRef() : true)) {
      props.channel.ack();
    }
  }

  document.addEventListener("focus", onFocus);
  onCleanup(() => document.removeEventListener("focus", onFocus));

  // Register ack/jump latest
  createKeybind(KeybindAction.CHAT_JUMP_END, () => {
    // Mark channel as read if not already
    if (props.channel.unread) {
      props.channel.ack();
    }

    // Clear the last unread id
    if (lastId()) {
      setLastId(undefined);
    }

    // Scroll to the bottom
    jumpToBottomRef?.();
  });

  // Sidebar scroll target
  let sidebarScrollTargetElement!: HTMLDivElement;

  // Sidebar state
  const [sidebarState, setSidebarState] = createSignal<SidebarState>({
    state: "default",
  });

  // todo: in the future maybe persist per ID?
  createEffect(
    on(
      () => props.channel.id,
      () => {
        setSidebarState({ state: "default" });
        if (props.channel.type === "DirectMessage") {
          state.layout.setSectionState(LAYOUT_SECTIONS.MEMBER_SIDEBAR, false, true);
        }
      },
    ),
  );

  // Reset voice_chat sidebar when voice layout turns off (e.g. call ends)
  createEffect(
    on(showVoiceLayout, (isVoice) => {
      if (!isVoice && sidebarState().state === "voice_chat") {
        setSidebarState({ state: "default" });
      }
    }),
  );

  return (
    <>
      <Header placement="primary">
        <ChannelHeader
          channel={props.channel}
          sidebarState={sidebarState}
          setSidebarState={setSidebarState}
          showVoiceLayout={showVoiceLayout}
        />
      </Header>
      <Content>
        <main class={main()}>
          <Show when={showVoiceLayout()}>
            <VoiceChannelCallCardMount channel={props.channel} />
          </Show>

          <Show when={!showVoiceLayout()}>
            <BelowFloatingHeader>
              <div>
                <NewMessages
                  lastId={lastId}
                  jumpBack={() => navigate(lastId()!)}
                  dismiss={() => setLastId()}
                />
              </div>
            </BelowFloatingHeader>

            <Messages
              channel={props.channel}
              lastReadId={lastId}
              pendingMessages={(pendingProps) => (
                <DraftMessages
                  channel={props.channel}
                  tail={pendingProps.tail}
                  sentIds={pendingProps.ids}
                />
              )}
              typingIndicator={
                <TypingIndicator
                  users={props.channel.typing}
                  ownId={client().user!.id}
                />
              }
              highlightedMessageId={highlightMessageId}
              clearHighlightedMessage={() => navigate(".")}
              atEndRef={(ref) => (atEndRef = ref)}
              jumpToBottomRef={(ref) => (jumpToBottomRef = ref)}
            />

            <MessageComposition
              channel={props.channel}
              onMessageSend={() => jumpToBottomRef?.()}
            />
          </Show>
        </main>
        <Show
          when={
            (state.layout.getSectionState(
              LAYOUT_SECTIONS.MEMBER_SIDEBAR,
              true,
            ) &&
              props.channel.type !== "SavedMessages") ||
            sidebarState().state !== "default"
          }
        >
          <Show
            when={
              showVoiceLayout() && sidebarState().state === "voice_chat"
            }
            fallback={
              <div
                ref={sidebarScrollTargetElement}
                use:scrollable={{
                  direction: "y",
                  showOnHover: true,
                  class: sidebar(),
                }}
                style={{
                  width: sidebarState().state !== "default" ? "360px" : "",
                }}
              >
                <Switch
                  fallback={
                    <MemberSidebar
                      channel={props.channel}
                      scrollTargetElement={sidebarScrollTargetElement}
                    />
                  }
                >
                  <Match when={sidebarState().state === "search"}>
                    <WideSidebarContainer>
                      <SidebarTitle>
                        <Text class="label" size="large">
                          Search Results
                        </Text>
                      </SidebarTitle>
                      <TextSearchSidebar
                        channel={props.channel}
                        query={{
                          query: (sidebarState() as { query: string }).query,
                        }}
                      />
                    </WideSidebarContainer>
                  </Match>
                  <Match when={sidebarState().state === "pins"}>
                    <WideSidebarContainer>
                      <SidebarTitle>
                        <Text class="label" size="large">
                          Pinned Messages
                        </Text>
                      </SidebarTitle>
                      <TextSearchSidebar
                        channel={props.channel}
                        query={{ pinned: true, sort: "Latest" }}
                      />
                    </WideSidebarContainer>
                  </Match>
                </Switch>

                <Show when={sidebarState().state !== "default"}>
                  <Keybind
                    keybind={KeybindAction.CLOSE_SIDEBAR}
                    onPressed={() => setSidebarState({ state: "default" })}
                  />
                </Show>
              </div>
            }
          >
            <div
              class={sidebar()}
              style={{
                width: "360px",
                display: "flex",
                "flex-direction": "column",
                "min-height": 0,
              }}
            >
              <div style={{ flex: "1 1 auto", "min-height": 0 }}>
                <Messages
                  channel={props.channel}
                  lastReadId={lastId}
                  pendingMessages={(pendingProps) => (
                    <DraftMessages
                      channel={props.channel}
                      tail={pendingProps.tail}
                      sentIds={pendingProps.ids}
                    />
                  )}
                  typingIndicator={
                    <TypingIndicator
                      users={props.channel.typing}
                      ownId={client().user!.id}
                    />
                  }
                  highlightedMessageId={highlightMessageId}
                  clearHighlightedMessage={() => navigate(".")}
                  atEndRef={(ref) => (atEndRef = ref)}
                  jumpToBottomRef={(ref) => (jumpToBottomRef = ref)}
                />
              </div>

              <MessageComposition
                channel={props.channel}
                onMessageSend={() => jumpToBottomRef?.()}
              />

              <Keybind
                keybind={KeybindAction.CLOSE_SIDEBAR}
                onPressed={() => setSidebarState({ state: "default" })}
              />
            </div>
          </Show>
        </Show>
      </Content>
    </>
  );
}

/**
 * Main content row layout
 */
const Content = styled("div", {
  base: {
    display: "flex",
    flexDirection: "row",
    flexGrow: 1,
    minWidth: 0,
    minHeight: 0,
  },
});

/**
 * Base styles
 */
const sidebar = cva({
  base: {
    flexShrink: 0,
    width: "var(--layout-width-channel-sidebar)",
    // margin: "var(--gap-md)",
    borderRadius: "var(--borderRadius-lg)",
    // color: "var(--colours-sidebar-channels-foreground)",
    // background: "var(--colours-sidebar-channels-background)",
  },
});

/**
 * Container styles
 */
const WideSidebarContainer = styled("div", {
  base: {
    paddingRight: "var(--gap-md)",
    width: "360px",
  },
});

/**
 * Sidebar title
 */
const SidebarTitle = styled("div", {
  base: {
    padding: "var(--gap-md)",
    color: "var(--md-sys-color-on-surface)",
  },
});
