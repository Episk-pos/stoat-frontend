import { For, Match, Switch } from "solid-js";

import { Trans, useLingui } from "@lingui-solid/solid/macro";
import { useQuery, useQueryClient } from "@tanstack/solid-query";
import { ScheduledEvent, Server } from "stoat.js";

import { useModals } from "@revolt/modal";
import {
  Button,
  CircularProgress,
  Column,
  DataTable,
  Row,
  Text,
} from "@revolt/ui";

import MdDelete from "@material-design-icons/svg/outlined/delete.svg?component-solid";
import MdEdit from "@material-design-icons/svg/outlined/edit.svg?component-solid";

/**
 * List and manage server scheduled events
 */
export function ListServerEvents(props: { server: Server }) {
  const { t } = useLingui();
  const client = useQueryClient();
  const { showError, openModal } = useModals();

  const query = useQuery(() => ({
    queryKey: ["scheduled_events", props.server.id],
    queryFn: () => props.server.fetchScheduledEvents(),
  }));

  async function deleteEvent(event: ScheduledEvent) {
    try {
      await event.delete();
      client.setQueryData(
        ["scheduled_events", props.server.id],
        (query.data ?? []).filter((entry) => entry.id !== event.id),
      );
    } catch (error) {
      showError(error);
    }
  }

  function editEvent(event: ScheduledEvent) {
    openModal({
      type: "edit_scheduled_event",
      event,
    });
  }

  function createEvent() {
    openModal({
      type: "create_scheduled_event",
      server: props.server,
    });
  }

  function formatEntityType(event: ScheduledEvent): string {
    switch (event.entityType) {
      case "Voice":
        return t`Voice`;
      case "StageInstance":
        return t`Stage`;
      case "External":
        return t`External`;
      default:
        return event.entityType;
    }
  }

  function formatStatus(event: ScheduledEvent): string {
    switch (event.status) {
      case "Scheduled":
        return t`Scheduled`;
      case "Active":
        return t`Active`;
      case "Completed":
        return t`Completed`;
      case "Cancelled":
        return t`Cancelled`;
      default:
        return event.status;
    }
  }

  function formatDate(isoString: string): string {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  }

  return (
    <Column>
      <Button group="standard" onPress={createEvent}>
        <Trans>Create Event</Trans>
      </Button>
      <DataTable
        columns={[
          <Trans>Name</Trans>,
          <Trans>Status</Trans>,
          <Trans>Date</Trans>,
          <Trans>Type</Trans>,
          <></>,
        ]}
        itemCount={query.data?.length}
      >
        {(page, itemsPerPage) => (
          <Switch>
            <Match when={query.isLoading}>
              <DataTable.Row>
                <DataTable.Cell colspan={5}>
                  <CircularProgress />
                </DataTable.Cell>
              </DataTable.Row>
            </Match>
            <Match when={query.data?.length === 0}>
              <DataTable.Row>
                <DataTable.Cell colspan={5}>
                  <Text class="body" size="medium">
                    <Trans>No scheduled events yet.</Trans>
                  </Text>
                </DataTable.Cell>
              </DataTable.Row>
            </Match>
            <Match when={query.data}>
              <For
                each={query.data!.slice(
                  page * itemsPerPage,
                  page * itemsPerPage + itemsPerPage,
                )}
              >
                {(item) => (
                  <DataTable.Row>
                    <DataTable.Cell>
                      <Column gap="none">
                        <span>{item.name}</span>
                      </Column>
                    </DataTable.Cell>
                    <DataTable.Cell>
                      {formatStatus(item)}
                    </DataTable.Cell>
                    <DataTable.Cell>
                      {formatDate(item.scheduledStartTime)}
                    </DataTable.Cell>
                    <DataTable.Cell>
                      {formatEntityType(item)}
                    </DataTable.Cell>
                    <DataTable.Cell width="80px">
                      <Row gap="sm">
                        <Button
                          size="icon"
                          variant="filled"
                          use:floating={{
                            tooltip: {
                              placement: "bottom",
                              content: t`Edit Event`,
                            },
                          }}
                          onPress={() => editEvent(item)}
                        >
                          <MdEdit />
                        </Button>
                        <Button
                          size="icon"
                          variant="filled"
                          use:floating={{
                            tooltip: {
                              placement: "bottom",
                              content: t`Delete Event`,
                            },
                          }}
                          onPress={() => deleteEvent(item)}
                        >
                          <MdDelete />
                        </Button>
                      </Row>
                    </DataTable.Cell>
                  </DataTable.Row>
                )}
              </For>
            </Match>
          </Switch>
        )}
      </DataTable>
    </Column>
  );
}
