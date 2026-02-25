import {
  Component,
  For,
  Match,
  Show,
  Switch,
  createMemo,
  createSignal,
} from "solid-js";

import { createQuery } from "@tanstack/solid-query";
import { type ScheduledEvent, type ScheduledEventStatus } from "stoat.js";
import { css } from "styled-system/css";
import { styled } from "styled-system/jsx";

import { useClient } from "@revolt/client";
import { useModals } from "@revolt/modal";
import { useNavigate, useParams } from "@revolt/routing";
import {
  Button,
  CircularProgress,
  Column,
  Header,
  Row,
  Time,
} from "@revolt/ui";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

import { HeaderIcon } from "./common/CommonHeader";

type Tab = "upcoming" | "active" | "past";

/**
 * Server Events list page
 */
export const ServerEvents: Component = () => {
  const params = useParams();
  const client = useClient();
  const navigate = useNavigate();
  const { openModal } = useModals();

  const server = createMemo(() => client()!.servers.get(params.server)!);

  const query = createQuery(() => ({
    queryKey: ["scheduled_events", params.server],
    queryFn: () => server().fetchScheduledEvents(),
  }));

  const [tab, setTab] = createSignal<Tab>("upcoming");

  const canManageEvents = createMemo(
    () =>
      server()?.havePermission("ManageServer"),
  );

  const upcoming = createMemo(
    () =>
      query.data?.filter(
        (e: ScheduledEvent) => e.status === "Scheduled",
      ) ?? [],
  );

  const active = createMemo(
    () =>
      query.data?.filter(
        (e: ScheduledEvent) => e.status === "Active",
      ) ?? [],
  );

  const past = createMemo(
    () =>
      query.data?.filter(
        (e: ScheduledEvent) => e.status === "Completed" || e.status === "Cancelled",
      ) ?? [],
  );

  const currentList = createMemo(() => {
    switch (tab()) {
      case "upcoming":
        return upcoming();
      case "active":
        return active();
      case "past":
        return past();
    }
  });

  return (
    <Base>
      <Header placement="primary">
        <HeaderIcon>
          <Symbol>calendar_month</Symbol>
        </HeaderIcon>
        Events
        <div style={{ "flex-grow": "1" }} />
        <Show when={canManageEvents()}>
          <Button
            size="xs"
            variant="filled"
            onPress={() =>
              openModal({
                type: "create_scheduled_event",
                server: server(),
              })
            }
          >
            <Symbol size={18}>add</Symbol>
            Create Event
          </Button>
        </Show>
      </Header>

      <ContentArea>
        <Row gap="sm">
          <Button
            size="xs"
            variant={tab() === "upcoming" ? "filled" : "tonal"}
            onPress={() => setTab("upcoming")}
          >
            Upcoming ({upcoming().length})
          </Button>
          <Button
            size="xs"
            variant={tab() === "active" ? "filled" : "tonal"}
            onPress={() => setTab("active")}
          >
            Active ({active().length})
          </Button>
          <Button
            size="xs"
            variant={tab() === "past" ? "filled" : "tonal"}
            onPress={() => setTab("past")}
          >
            Past ({past().length})
          </Button>
        </Row>

        <Switch>
          <Match when={query.isLoading}>
            <Column align justify grow>
              <CircularProgress />
            </Column>
          </Match>
          <Match when={query.isError}>
            <Column align justify grow>
              <Symbol size={48}>error</Symbol>
              <span>Failed to load events.</span>
            </Column>
          </Match>
          <Match when={currentList().length === 0}>
            <EmptyState>
              <Symbol size={48}>event_busy</Symbol>
              <span>
                <Switch fallback="No events to show.">
                  <Match when={tab() === "upcoming"}>
                    No upcoming events scheduled.
                  </Match>
                  <Match when={tab() === "active"}>
                    No events are currently active.
                  </Match>
                  <Match when={tab() === "past"}>
                    No past events.
                  </Match>
                </Switch>
              </span>
            </EmptyState>
          </Match>
          <Match when={currentList().length > 0}>
            <EventGrid>
              <For each={currentList()}>
                {(event) => (
                  <EventCard
                    event={event}
                    onClick={() =>
                      navigate(
                        `/server/${params.server}/events/${event.id}`,
                      )
                    }
                  />
                )}
              </For>
            </EventGrid>
          </Match>
        </Switch>
      </ContentArea>
    </Base>
  );
};

/**
 * Status badge for an event
 */
function StatusBadge(props: { status: ScheduledEventStatus }) {
  const color = () => {
    switch (props.status) {
      case "Scheduled":
        return "var(--md-sys-color-primary)";
      case "Active":
        return "var(--md-sys-color-tertiary)";
      case "Completed":
        return "var(--md-sys-color-on-surface-variant)";
      case "Cancelled":
        return "var(--md-sys-color-error)";
    }
  };

  return (
    <span
      class={statusBadge}
      style={{ background: color() }}
    >
      {props.status}
    </span>
  );
}

const statusBadge = css({
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 8px",
  borderRadius: "var(--borderRadius-full)",
  fontSize: "11px",
  fontWeight: 600,
  color: "white",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
});

/**
 * Entity type badge (Voice, External, etc.)
 */
function EntityBadge(props: { event: ScheduledEvent }) {
  return (
    <Row align gap="xs" class={entityBadgeStyle}>
      <Switch fallback={<Symbol size={14}>location_on</Symbol>}>
        <Match when={props.event.entityType === "Voice"}>
          <Symbol size={14}>headset_mic</Symbol>
        </Match>
        <Match when={props.event.entityType === "StageInstance"}>
          <Symbol size={14}>podcasts</Symbol>
        </Match>
      </Switch>
      <span>
        <Switch fallback={props.event.location ?? "External"}>
          <Match when={props.event.channel}>
            {props.event.channel!.name}
          </Match>
        </Switch>
      </span>
    </Row>
  );
}

const entityBadgeStyle = css({
  fontSize: "12px",
  color: "var(--md-sys-color-on-surface-variant)",
});

/**
 * Single event card
 */
function EventCard(props: { event: ScheduledEvent; onClick: () => void }) {
  return (
    <CardBase onClick={props.onClick}>
      <Show when={props.event.coverImageURL}>
        <CoverImage
          src={props.event.coverImageURL!}
          alt={props.event.name}
        />
      </Show>
      <CardContent>
        <Row align gap="sm">
          <StatusBadge status={props.event.status} />
          <EntityBadge event={props.event} />
        </Row>

        <CardTitle>{props.event.name}</CardTitle>

        <Row align gap="xs" class={metaRow}>
          <Symbol size={14}>schedule</Symbol>
          <Time
            value={props.event.scheduledStartTime}
            format="calendar"
          />
        </Row>

        <Show when={props.event.interestedCount > 0}>
          <Row align gap="xs" class={metaRow}>
            <Symbol size={14}>star</Symbol>
            <span>
              {props.event.interestedCount} interested
            </span>
          </Row>
        </Show>
      </CardContent>
    </CardBase>
  );
}

const metaRow = css({
  fontSize: "12px",
  color: "var(--md-sys-color-on-surface-variant)",
});

/**
 * Page styles
 */
const Base = styled("div", {
  base: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
  },
});

const ContentArea = styled("div", {
  base: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-lg)",
    padding: "var(--gap-lg)",
    marginInline: "var(--gap-md)",
    marginBlockEnd: "var(--gap-md)",
    borderRadius: "var(--borderRadius-xl)",
    background: "var(--md-sys-color-surface-container-lowest)",
    overflow: "auto",
  },
});

const EmptyState = styled("div", {
  base: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--gap-md)",
    color: "var(--md-sys-color-on-surface-variant)",
    padding: "var(--gap-xl)",
  },
});

const EventGrid = styled("div", {
  base: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: "var(--gap-lg)",
  },
});

const CardBase = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    borderRadius: "var(--borderRadius-lg)",
    background: "var(--md-sys-color-surface-container-low)",
    overflow: "hidden",
    cursor: "pointer",
    transition: "var(--transitions-fast) all",

    "&:hover": {
      background: "var(--md-sys-color-surface-container)",
    },
  },
});

const CoverImage = styled("img", {
  base: {
    width: "100%",
    height: "140px",
    objectFit: "cover",
  },
});

const CardContent = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-sm)",
    padding: "var(--gap-md)",
  },
});

const CardTitle = styled("h3", {
  base: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
    color: "var(--md-sys-color-on-surface)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});
