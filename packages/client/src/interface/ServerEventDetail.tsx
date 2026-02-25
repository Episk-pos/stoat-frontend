import { Component, Match, Show, Switch, createMemo, createSignal } from "solid-js";

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

/**
 * Server Event Detail page
 */
export const ServerEventDetail: Component = () => {
  const params = useParams();
  const client = useClient();
  const navigate = useNavigate();
  const { openModal } = useModals();

  const server = createMemo(() => client()!.servers.get(params.server)!);

  const query = createQuery(() => ({
    queryKey: ["scheduled_events", params.server],
    queryFn: () => server().fetchScheduledEvents(),
  }));

  const event = createMemo(() =>
    query.data?.find((e: ScheduledEvent) => e.id === params.event),
  );

  const canManageEvents = createMemo(
    () =>
      server()?.havePermission("ManageServer"),
  );

  const [deleting, setDeleting] = createSignal(false);

  async function handleDelete() {
    const ev = event();
    if (!ev) return;

    // Simple confirmation
    if (!confirm("Are you sure you want to delete this event?")) return;

    setDeleting(true);
    try {
      await ev.delete();
      navigate(`/server/${params.server}/events`);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <Base>
      <Header placement="primary">
        <HeaderIcon>
          <Symbol>calendar_month</Symbol>
        </HeaderIcon>
        <BackLink
          onClick={() => navigate(`/server/${params.server}/events`)}
        >
          <Symbol size={20}>arrow_back</Symbol>
          Events
        </BackLink>
      </Header>

      <ContentArea>
        <Switch>
          <Match when={query.isLoading}>
            <Column align justify grow>
              <CircularProgress />
            </Column>
          </Match>
          <Match when={query.isError}>
            <Column align justify grow>
              <Symbol size={48}>error</Symbol>
              <span>Failed to load event.</span>
            </Column>
          </Match>
          <Match when={!event()}>
            <Column align justify grow>
              <Symbol size={48}>event_busy</Symbol>
              <span>Event not found.</span>
            </Column>
          </Match>
          <Match when={event()}>
            {(ev) => (
              <EventDetailContent>
                <Show when={ev().coverImageURL}>
                  <DetailCoverImage
                    src={ev().coverImageURL!}
                    alt={ev().name}
                  />
                </Show>

                <DetailBody>
                  <Row align gap="sm" wrap>
                    <StatusBadge status={ev().status} />
                    <EntityTypeBadge>
                      <Switch fallback={<Symbol size={16}>location_on</Symbol>}>
                        <Match when={ev().entityType === "Voice"}>
                          <Symbol size={16}>headset_mic</Symbol>
                        </Match>
                        <Match when={ev().entityType === "StageInstance"}>
                          <Symbol size={16}>podcasts</Symbol>
                        </Match>
                      </Switch>
                      {ev().entityType}
                    </EntityTypeBadge>
                  </Row>

                  <EventTitle>{ev().name}</EventTitle>

                  <Show when={ev().description}>
                    <EventDescription>{ev().description}</EventDescription>
                  </Show>

                  <DetailSection>
                    <DetailLabel>
                      <Symbol size={18}>schedule</Symbol>
                      Date & Time
                    </DetailLabel>
                    <DetailValue>
                      <Time
                        value={ev().scheduledStartTime}
                        format="calendar"
                      />
                      <Show when={ev().scheduledEndTime}>
                        <span class={metaText}>
                          {" "} to{" "}
                          <Time
                            value={ev().scheduledEndTime!}
                            format="calendar"
                          />
                        </span>
                      </Show>
                    </DetailValue>
                  </DetailSection>

                  <DetailSection>
                    <DetailLabel>
                      <Switch fallback={<Symbol size={18}>location_on</Symbol>}>
                        <Match when={ev().entityType === "Voice" || ev().entityType === "StageInstance"}>
                          <Symbol size={18}>headset_mic</Symbol>
                        </Match>
                      </Switch>
                      Location
                    </DetailLabel>
                    <DetailValue>
                      <Switch fallback={ev().location ?? "Unknown"}>
                        <Match when={ev().channel}>
                          # {ev().channel!.name}
                        </Match>
                      </Switch>
                    </DetailValue>
                  </DetailSection>

                  <DetailSection>
                    <DetailLabel>
                      <Symbol size={18}>star</Symbol>
                      Interested
                    </DetailLabel>
                    <DetailValue>
                      {ev().interestedCount} {ev().interestedCount === 1 ? "person" : "people"}
                    </DetailValue>
                  </DetailSection>

                  <Show when={ev().creator}>
                    <DetailSection>
                      <DetailLabel>
                        <Symbol size={18}>person</Symbol>
                        Created by
                      </DetailLabel>
                      <DetailValue>
                        {ev().creator!.displayName}
                      </DetailValue>
                    </DetailSection>
                  </Show>

                  <Show when={canManageEvents()}>
                    <ActionRow>
                      <Button
                        size="xs"
                        variant="tonal"
                        onPress={() =>
                          openModal({
                            type: "edit_scheduled_event",
                            event: ev(),
                          })
                        }
                      >
                        <Symbol size={16}>edit</Symbol>
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="_error"
                        isDisabled={deleting()}
                        onPress={handleDelete}
                      >
                        <Symbol size={16}>delete</Symbol>
                        Delete
                      </Button>
                    </ActionRow>
                  </Show>
                </DetailBody>
              </EventDetailContent>
            )}
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
      class={statusBadgeStyle}
      style={{ background: color() }}
    >
      {props.status}
    </span>
  );
}

const statusBadgeStyle = css({
  display: "inline-flex",
  alignItems: "center",
  padding: "2px 10px",
  borderRadius: "var(--borderRadius-full)",
  fontSize: "12px",
  fontWeight: 600,
  color: "white",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
});

const metaText = css({
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

const BackLink = styled("a", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    cursor: "pointer",
    color: "var(--md-sys-color-on-surface)",
    textDecoration: "none",

    "&:hover": {
      color: "var(--md-sys-color-primary)",
    },
  },
});

const ContentArea = styled("div", {
  base: {
    flexGrow: 1,
    display: "flex",
    flexDirection: "column",
    padding: "var(--gap-lg)",
    marginInline: "var(--gap-md)",
    marginBlockEnd: "var(--gap-md)",
    borderRadius: "var(--borderRadius-xl)",
    background: "var(--md-sys-color-surface-container-lowest)",
    overflow: "auto",
  },
});

const EventDetailContent = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    maxWidth: "720px",
    width: "100%",
    margin: "0 auto",
  },
});

const DetailCoverImage = styled("img", {
  base: {
    width: "100%",
    maxHeight: "280px",
    objectFit: "cover",
    borderRadius: "var(--borderRadius-lg)",
    marginBottom: "var(--gap-lg)",
  },
});

const DetailBody = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-md)",
  },
});

const EventTitle = styled("h1", {
  base: {
    margin: 0,
    fontSize: "28px",
    fontWeight: 700,
    color: "var(--md-sys-color-on-surface)",
  },
});

const EventDescription = styled("p", {
  base: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.6,
    color: "var(--md-sys-color-on-surface-variant)",
    whiteSpace: "pre-wrap",
  },
});

const EntityTypeBadge = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "2px 10px",
    borderRadius: "var(--borderRadius-full)",
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--md-sys-color-on-surface-variant)",
    background: "var(--md-sys-color-surface-container)",
  },
});

const DetailSection = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-xs)",
    padding: "var(--gap-sm) 0",
    borderTop: "1px solid var(--md-sys-color-outline-variant)",
  },
});

const DetailLabel = styled("span", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--md-sys-color-on-surface-variant)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
});

const DetailValue = styled("span", {
  base: {
    fontSize: "14px",
    color: "var(--md-sys-color-on-surface)",
    paddingLeft: "26px",
  },
});

const ActionRow = styled("div", {
  base: {
    display: "flex",
    gap: "var(--gap-md)",
    paddingTop: "var(--gap-lg)",
    borderTop: "1px solid var(--md-sys-color-outline-variant)",
  },
});
