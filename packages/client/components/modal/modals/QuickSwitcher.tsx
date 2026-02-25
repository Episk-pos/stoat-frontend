import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  onMount,
} from "solid-js";
import { Portal } from "solid-js/web";
import { Motion, Presence } from "solid-motionone";

import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useNavigate } from "@revolt/routing";
import { useState } from "@revolt/state";
import { Avatar } from "@revolt/ui";

import { useModals } from "..";
import type { Modals } from "../types";

import type { DialogProps } from "@revolt/ui";
import type { Channel, Server } from "stoat.js";

type ResultItem = {
  id: string;
  type: "channel" | "dm" | "group" | "server";
  name: string;
  subtitle?: string;
  iconUrl?: string;
  fallback: string;
  path: string;
  unread?: boolean;
  mentions?: number;
};

/**
 * Quick Switcher modal — Discord-style Ctrl+K navigation
 */
export function QuickSwitcherModal(
  props: DialogProps & Modals & { type: "quick_switcher" },
) {
  const client = useClient();
  const state = useState();
  const navigate = useNavigate();
  const { closeAll } = useModals();

  const [query, setQuery] = createSignal("");
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;

  onMount(() => inputRef?.focus());

  // Reset selection when query changes
  createEffect(() => {
    query();
    setSelectedIndex(0);
  });

  /**
   * Build result items from channels
   */
  function channelToResult(ch: Channel): ResultItem | undefined {
    if (!ch.displayName) return undefined;
    const server = ch.serverId ? client().servers.get(ch.serverId) : undefined;
    return {
      id: ch.id,
      type:
        ch.type === "DirectMessage"
          ? "dm"
          : ch.type === "Group"
            ? "group"
            : "channel",
      name: ch.displayName,
      subtitle: server?.name,
      iconUrl: ch.iconURL,
      fallback: ch.displayName,
      path: ch.path,
      unread: ch.unread,
      mentions: ch.mentions?.size,
    };
  }

  /**
   * Build result items from servers
   */
  function serverToResult(srv: Server): ResultItem {
    return {
      id: srv.id,
      type: "server",
      name: srv.name,
      iconUrl: srv.iconURL,
      fallback: srv.name,
      path: state.layout.getLastActiveServerPath(srv.id),
    };
  }

  /**
   * Default results when no query: recent conversations + unread channels
   */
  const defaultResults = createMemo(() => {
    const c = client();
    const results: { label: string; items: ResultItem[] }[] = [];

    // Recent conversations (DMs/Groups sorted by updatedAt)
    const recent = state.ordering
      .orderedConversations(c)
      .slice(0, 8)
      .map(channelToResult)
      .filter(Boolean) as ResultItem[];
    if (recent.length) results.push({ label: "Recent Conversations", items: recent });

    // Unread channels
    const unread = c.channels
      .toList()
      .filter((ch) => ch.unread && ch.type !== "DirectMessage" && ch.type !== "Group")
      .slice(0, 8)
      .map(channelToResult)
      .filter(Boolean) as ResultItem[];
    if (unread.length) results.push({ label: "Unread Channels", items: unread });

    // Mentions
    const mentions = c.channels
      .toList()
      .filter((ch) => ch.mentions && ch.mentions.size > 0)
      .slice(0, 5)
      .map(channelToResult)
      .filter(Boolean) as ResultItem[];
    if (mentions.length) results.push({ label: "Mentions", items: mentions });

    return results;
  });

  /**
   * Search results when query is non-empty
   */
  const searchResults = createMemo(() => {
    const q = query().toLowerCase().trim();
    if (!q) return [];

    const c = client();
    const results: { label: string; items: ResultItem[] }[] = [];

    // Search DMs & Groups
    const dms = c.channels
      .toList()
      .filter(
        (ch) =>
          (ch.type === "DirectMessage" || ch.type === "Group") &&
          ch.displayName?.toLowerCase().includes(q),
      )
      .slice(0, 8)
      .map(channelToResult)
      .filter(Boolean) as ResultItem[];
    if (dms.length) results.push({ label: "Direct Messages", items: dms });

    // Search server channels
    const channels = c.channels
      .toList()
      .filter(
        (ch) =>
          ch.type !== "DirectMessage" &&
          ch.type !== "Group" &&
          ch.type !== "SavedMessages" &&
          ch.displayName?.toLowerCase().includes(q),
      )
      .slice(0, 8)
      .map(channelToResult)
      .filter(Boolean) as ResultItem[];
    if (channels.length) results.push({ label: "Channels", items: channels });

    // Search servers
    const servers = state.ordering
      .orderedServers(c)
      .filter((srv) => srv.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map(serverToResult);
    if (servers.length) results.push({ label: "Servers", items: servers });

    return results;
  });

  const activeGroups = createMemo(() =>
    query().trim() ? searchResults() : defaultResults(),
  );

  const flatItems = createMemo(() =>
    activeGroups().flatMap((g) => g.items),
  );

  function navigateTo(item: ResultItem) {
    closeAll();
    navigate(item.path);
  }

  function onKeyDown(e: KeyboardEvent) {
    const items = flatItems();
    if (!items.length) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % items.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + items.length) % items.length);
        break;
      case "Enter":
        e.preventDefault();
        navigateTo(items[selectedIndex()]);
        break;
    }
  }

  function typeIcon(type: ResultItem["type"]) {
    switch (type) {
      case "dm":
        return "person";
      case "group":
        return "group";
      case "channel":
        return "tag";
      case "server":
        return "dns";
    }
  }

  return (
    <Portal mount={document.getElementById("floating")!}>
      <Presence>
        <Show when={props.show}>
          <Scrim onClick={props.onClose}>
            <Motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.2, easing: [0.05, 0.7, 0.1, 1.0] }}
              class={containerClass}
              onClick={(e) => e.stopPropagation()}
            >
              <SearchInput
                ref={inputRef!}
                type="text"
                placeholder="Where would you like to go?"
                value={query()}
                onInput={(e) => setQuery(e.currentTarget.value)}
                onKeyDown={onKeyDown}
              />

              <ResultsArea>
                <Show
                  when={flatItems().length > 0}
                  fallback={
                    <EmptyState>
                      {query().trim()
                        ? "No results found"
                        : "Start typing to search..."}
                    </EmptyState>
                  }
                >
                  <For each={activeGroups()}>
                    {(group) => (
                      <>
                        <SectionLabel>{group.label}</SectionLabel>
                        <For each={group.items}>
                          {(item) => {
                            const globalIndex = () =>
                              flatItems().findIndex((i) => i.id === item.id);

                            return (
                              <ResultRow
                                selected={selectedIndex() === globalIndex()}
                                onClick={() => navigateTo(item)}
                                onMouseEnter={() =>
                                  setSelectedIndex(globalIndex())
                                }
                              >
                                <Show
                                  when={item.iconUrl}
                                  fallback={
                                    <span class="material-symbols-rounded">
                                      {typeIcon(item.type)}
                                    </span>
                                  }
                                >
                                  <Avatar
                                    src={item.iconUrl}
                                    fallback={item.fallback}
                                    size={24}
                                    shape={
                                      item.type === "server"
                                        ? "rounded-square"
                                        : "circle"
                                    }
                                  />
                                </Show>
                                <ResultName>{item.name}</ResultName>
                                <Show when={item.subtitle}>
                                  <ResultSubtitle>
                                    {item.subtitle}
                                  </ResultSubtitle>
                                </Show>
                                <Show when={item.mentions && item.mentions > 0}>
                                  <MentionBadge>{item.mentions}</MentionBadge>
                                </Show>
                                <Show
                                  when={item.unread && !(item.mentions && item.mentions > 0)}
                                >
                                  <UnreadDot />
                                </Show>
                              </ResultRow>
                            );
                          }}
                        </For>
                      </>
                    )}
                  </For>
                </Show>
              </ResultsArea>

              <Footer>
                <span class="material-symbols-rounded" style={{ "font-size": "14px" }}>
                  keyboard
                </span>
                <span>
                  <kbd>↑↓</kbd> navigate <kbd>↵</kbd> select <kbd>esc</kbd>{" "}
                  close
                </span>
              </Footer>
            </Motion.div>
          </Scrim>
        </Show>
      </Presence>
    </Portal>
  );
}

const containerClass = css({
  width: "480px",
  maxWidth: "calc(100vw - 32px)",
  borderRadius: "16px",
  overflow: "hidden",
  background: "var(--md-sys-color-surface-container-high)",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.3)",
  display: "flex",
  flexDirection: "column",
});

const Scrim = styled("div", {
  base: {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    display: "flex",
    justifyContent: "center",
    paddingTop: "80px",
    background: "rgba(0, 0, 0, 0.6)",
    animationName: "scrimFadeIn",
    animationDuration: "0.1s",
    animationFillMode: "forwards",
  },
});

const SearchInput = styled("input", {
  base: {
    width: "100%",
    padding: "16px 20px",
    fontSize: "16px",
    fontFamily: "inherit",
    border: "none",
    outline: "none",
    color: "var(--md-sys-color-on-surface)",
    background: "transparent",
    borderBottom: "1px solid var(--md-sys-color-outline-variant)",
    _placeholder: {
      color: "var(--md-sys-color-on-surface-variant)",
    },
  },
});

const ResultsArea = styled("div", {
  base: {
    maxHeight: "400px",
    overflowY: "auto",
    padding: "4px 0",
  },
});

const SectionLabel = styled("div", {
  base: {
    padding: "8px 16px 4px",
    fontSize: "11px",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const ResultRow = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 16px",
    cursor: "pointer",
    color: "var(--md-sys-color-on-surface)",
    transition: "background 0.1s",
    "& .material-symbols-rounded": {
      fontSize: "20px",
      color: "var(--md-sys-color-on-surface-variant)",
      width: "24px",
      textAlign: "center",
    },
  },
  variants: {
    selected: {
      true: {
        background: "var(--md-sys-color-surface-container-highest)",
      },
    },
  },
  defaultVariants: {
    selected: false,
  },
});

const ResultName = styled("span", {
  base: {
    fontSize: "14px",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flex: 1,
  },
});

const ResultSubtitle = styled("span", {
  base: {
    fontSize: "12px",
    color: "var(--md-sys-color-on-surface-variant)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    flexShrink: 0,
    maxWidth: "140px",
  },
});

const MentionBadge = styled("span", {
  base: {
    fontSize: "11px",
    fontWeight: 700,
    minWidth: "18px",
    height: "18px",
    padding: "0 5px",
    borderRadius: "9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--md-sys-color-error)",
    color: "var(--md-sys-color-on-error)",
    flexShrink: 0,
  },
});

const UnreadDot = styled("div", {
  base: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "var(--md-sys-color-primary)",
    flexShrink: 0,
  },
});

const EmptyState = styled("div", {
  base: {
    padding: "24px 16px",
    textAlign: "center",
    fontSize: "14px",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const Footer = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    fontSize: "12px",
    color: "var(--md-sys-color-on-surface-variant)",
    borderTop: "1px solid var(--md-sys-color-outline-variant)",
    "& kbd": {
      padding: "1px 4px",
      borderRadius: "3px",
      fontSize: "11px",
      background: "var(--md-sys-color-surface-container-highest)",
      border: "1px solid var(--md-sys-color-outline-variant)",
    },
  },
});
