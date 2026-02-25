import { createFormControl, createFormGroup } from "solid-forms";
import { For, Match, Show, Switch, createMemo, createSignal } from "solid-js";

import { Trans, useLingui } from "@lingui-solid/solid/macro";
import { styled } from "styled-system/jsx";
import type {
  DataCreateScheduledEvent,
  ScheduledEventEntityType,
} from "stoat.js";

import {
  Column,
  Dialog,
  DialogProps,
  Form2,
  MenuItem,
  Row,
  Text,
} from "@revolt/ui";

import MdHeadphones from "@material-design-icons/svg/outlined/headphones.svg?component-solid";
import MdLocationOn from "@material-design-icons/svg/outlined/location_on.svg?component-solid";

import { useModals } from "..";
import { Modals } from "../types";

type CreateScheduledEventProps = DialogProps &
  Modals &
  ({ type: "create_scheduled_event" } | { type: "edit_scheduled_event" });

/**
 * Modal to create or edit a scheduled event.
 * 3-step wizard: event type -> details -> preview + create.
 */
export function CreateScheduledEventModal(props: CreateScheduledEventProps) {
  const { t } = useLingui();
  const { showError } = useModals();

  const isEditing = () => props.type === "edit_scheduled_event";
  const existingEvent = () =>
    props.type === "edit_scheduled_event" ? props.event : undefined;
  const server = () =>
    props.type === "create_scheduled_event"
      ? props.server
      : props.type === "edit_scheduled_event"
        ? props.event.server!
        : undefined;

  // Step management: 0 = type selection, 1 = details, 2 = preview
  const [step, setStep] = createSignal(isEditing() ? 1 : 0);
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  // Entity type selection
  const [entityType, setEntityType] = createSignal<"Voice" | "External">(
    existingEvent()?.entityType === "External" ? "External" : "Voice",
  );

  // Form group for step 2
  const group = createFormGroup({
    name: createFormControl(existingEvent()?.name ?? "", { required: true }),
    description: createFormControl(existingEvent()?.description ?? ""),
    scheduledStartTime: createFormControl(
      existingEvent()?.scheduledStartTime
        ? toLocalDatetimeString(new Date(existingEvent()!.scheduledStartTime))
        : "",
      { required: true },
    ),
    scheduledEndTime: createFormControl(
      existingEvent()?.scheduledEndTime
        ? toLocalDatetimeString(new Date(existingEvent()!.scheduledEndTime))
        : "",
    ),
    channelId: createFormControl(existingEvent()?.channelId ?? ""),
    location: createFormControl(existingEvent()?.location ?? ""),
  });

  // Voice channels for the channel selector
  const voiceChannels = createMemo(() =>
    (server()?.channels ?? []).filter((ch) => ch.type === "VoiceChannel"),
  );

  // Step 2 validation
  const canProceedToPreview = createMemo(() => {
    const name = group.controls.name.value.trim();
    if (!name || name.length < 1 || name.length > 100) return false;
    if (!group.controls.scheduledStartTime.value) return false;
    if (
      entityType() === "Voice" &&
      !group.controls.channelId.value
    )
      return false;
    if (
      entityType() === "External" &&
      !group.controls.location.value.trim()
    )
      return false;
    return true;
  });

  function formatDateForPreview(isoString: string): string {
    if (!isoString) return "";
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  }

  /**
   * Get the channel name for preview display
   */
  function getChannelName(channelId: string): string {
    const channel = server()
      ?.channels.find((ch) => ch.id === channelId);
    return channel?.name ?? t`Unknown Channel`;
  }

  async function onSubmit() {
    if (isSubmitting()) return;
    setIsSubmitting(true);

    try {
      const data: DataCreateScheduledEvent = {
        name: group.controls.name.value.trim(),
        entity_type: entityType() as ScheduledEventEntityType,
        scheduled_start_time: new Date(
          group.controls.scheduledStartTime.value,
        ).toISOString(),
      };

      if (group.controls.description.value.trim()) {
        data.description = group.controls.description.value.trim();
      }

      if (group.controls.scheduledEndTime.value) {
        data.scheduled_end_time = new Date(
          group.controls.scheduledEndTime.value,
        ).toISOString();
      }

      if (entityType() === "Voice") {
        data.channel_id = group.controls.channelId.value;
      } else {
        data.location = group.controls.location.value.trim();
      }

      if (isEditing() && existingEvent()) {
        await existingEvent()!.edit(data);
      } else if (server()) {
        await server()!.createScheduledEvent(data);
      }

      props.onClose();
    } catch (error) {
      showError(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Dialog actions change per step
  const actions = createMemo(() => {
    switch (step()) {
      case 0:
        return [{ text: <Trans>Cancel</Trans> }];
      case 1:
        return [
          {
            text: <Trans>Back</Trans>,
            onClick: () => {
              if (!isEditing()) setStep(0);
              return false;
            },
          },
          {
            text: <Trans>Next</Trans>,
            onClick: () => {
              setStep(2);
              return false;
            },
            isDisabled: !canProceedToPreview(),
          },
        ];
      case 2:
        return [
          {
            text: <Trans>Back</Trans>,
            onClick: () => {
              setStep(1);
              return false;
            },
          },
          {
            text: isEditing() ? (
              <Trans>Save Changes</Trans>
            ) : (
              <Trans>Create Event</Trans>
            ),
            onClick: () => {
              onSubmit();
              return false;
            },
            isDisabled: isSubmitting(),
          },
        ];
      default:
        return [{ text: <Trans>Cancel</Trans> }];
    }
  });

  const title = createMemo(() => {
    if (isEditing()) {
      switch (step()) {
        case 1:
          return <Trans>Edit Event</Trans>;
        case 2:
          return <Trans>Review Changes</Trans>;
        default:
          return <Trans>Edit Event</Trans>;
      }
    }
    switch (step()) {
      case 0:
        return <Trans>Create Event</Trans>;
      case 1:
        return <Trans>Event Details</Trans>;
      case 2:
        return <Trans>Review Event</Trans>;
      default:
        return <Trans>Create Event</Trans>;
    }
  });

  return (
    <Dialog
      minWidth={460}
      show={props.show}
      onClose={props.onClose}
      title={title()}
      actions={actions()}
      isDisabled={isSubmitting()}
    >
      <Switch>
        {/* Step 0: Entity Type Selection */}
        <Match when={step() === 0}>
          <Column gap="md">
            <Text class="body" size="medium">
              <Trans>What type of event would you like to create?</Trans>
            </Text>
            <TypeCard
              selected={entityType() === "Voice"}
              onClick={() => {
                setEntityType("Voice");
                setStep(1);
              }}
            >
              <Row align gap="md">
                <IconWrapper>
                  <MdHeadphones />
                </IconWrapper>
                <Column gap="none">
                  <Text class="title" size="small">
                    <Trans>Voice Channel</Trans>
                  </Text>
                  <Text class="body" size="small">
                    <Trans>
                      Host the event in a voice channel on your server
                    </Trans>
                  </Text>
                </Column>
              </Row>
            </TypeCard>
            <TypeCard
              selected={entityType() === "External"}
              onClick={() => {
                setEntityType("External");
                setStep(1);
              }}
            >
              <Row align gap="md">
                <IconWrapper>
                  <MdLocationOn />
                </IconWrapper>
                <Column gap="none">
                  <Text class="title" size="small">
                    <Trans>External Location</Trans>
                  </Text>
                  <Text class="body" size="small">
                    <Trans>Host the event somewhere outside of your server</Trans>
                  </Text>
                </Column>
              </Row>
            </TypeCard>
          </Column>
        </Match>

        {/* Step 1: Event Details */}
        <Match when={step() === 1}>
          <Column gap="md">
            <Form2.TextField
              name="name"
              control={group.controls.name}
              label={t`Event Name`}
              placeholder={t`Give your event a name`}
            />

            <Form2.TextField
              autosize
              min-rows={3}
              name="description"
              control={group.controls.description}
              label={t`Description`}
              placeholder={t`What is this event about?`}
            />

            <Column gap="sm">
              <Text class="label">
                <Trans>Start Time</Trans>
              </Text>
              <NativeInput
                type="datetime-local"
                value={group.controls.scheduledStartTime.value}
                onInput={(e) =>
                  group.controls.scheduledStartTime.setValue(
                    e.currentTarget.value,
                  )
                }
              />
            </Column>

            <Column gap="sm">
              <Text class="label">
                <Trans>End Time (optional)</Trans>
              </Text>
              <NativeInput
                type="datetime-local"
                value={group.controls.scheduledEndTime.value}
                onInput={(e) =>
                  group.controls.scheduledEndTime.setValue(
                    e.currentTarget.value,
                  )
                }
              />
            </Column>

            <Show when={entityType() === "Voice"}>
              <Column gap="sm">
                <Text class="label">
                  <Trans>Voice Channel</Trans>
                </Text>
                <Form2.TextField.Select
                  control={group.controls.channelId}
                >
                  <MenuItem value="">
                    <Trans>Select a channel</Trans>
                  </MenuItem>
                  <For each={voiceChannels()}>
                    {(channel) => (
                      <MenuItem value={channel.id}>
                        {channel.name}
                      </MenuItem>
                    )}
                  </For>
                </Form2.TextField.Select>
              </Column>
            </Show>

            <Show when={entityType() === "External"}>
              <Form2.TextField
                name="location"
                control={group.controls.location}
                label={t`Location`}
                placeholder={t`Where is this event taking place?`}
              />
            </Show>
          </Column>
        </Match>

        {/* Step 2: Preview + Create */}
        <Match when={step() === 2}>
          <Column gap="md">
            <PreviewSection>
              <PreviewLabel>
                <Trans>Name</Trans>
              </PreviewLabel>
              <PreviewValue>{group.controls.name.value}</PreviewValue>
            </PreviewSection>

            <Show when={group.controls.description.value.trim()}>
              <PreviewSection>
                <PreviewLabel>
                  <Trans>Description</Trans>
                </PreviewLabel>
                <PreviewValue>
                  {group.controls.description.value}
                </PreviewValue>
              </PreviewSection>
            </Show>

            <PreviewSection>
              <PreviewLabel>
                <Trans>Type</Trans>
              </PreviewLabel>
              <PreviewValue>
                <Show
                  when={entityType() === "Voice"}
                  fallback={<Trans>External Location</Trans>}
                >
                  <Trans>Voice Channel</Trans>
                </Show>
              </PreviewValue>
            </PreviewSection>

            <Show when={entityType() === "Voice"}>
              <PreviewSection>
                <PreviewLabel>
                  <Trans>Channel</Trans>
                </PreviewLabel>
                <PreviewValue>
                  {getChannelName(group.controls.channelId.value)}
                </PreviewValue>
              </PreviewSection>
            </Show>

            <Show when={entityType() === "External"}>
              <PreviewSection>
                <PreviewLabel>
                  <Trans>Location</Trans>
                </PreviewLabel>
                <PreviewValue>
                  {group.controls.location.value}
                </PreviewValue>
              </PreviewSection>
            </Show>

            <PreviewSection>
              <PreviewLabel>
                <Trans>Start Time</Trans>
              </PreviewLabel>
              <PreviewValue>
                {formatDateForPreview(
                  group.controls.scheduledStartTime.value,
                )}
              </PreviewValue>
            </PreviewSection>

            <Show when={group.controls.scheduledEndTime.value}>
              <PreviewSection>
                <PreviewLabel>
                  <Trans>End Time</Trans>
                </PreviewLabel>
                <PreviewValue>
                  {formatDateForPreview(
                    group.controls.scheduledEndTime.value,
                  )}
                </PreviewValue>
              </PreviewSection>
            </Show>

            <Show when={isSubmitting()}>
              <Text class="label">
                <Trans>Creating event...</Trans>
              </Text>
            </Show>
          </Column>
        </Match>
      </Switch>
    </Dialog>
  );
}

/**
 * Convert a Date to a local datetime string suitable for datetime-local input
 */
function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const TypeCard = styled("button", {
  base: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px",
    borderRadius: "12px",
    border: "2px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container)",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s ease",
    color: "var(--md-sys-color-on-surface)",
    width: "100%",

    _hover: {
      borderColor: "var(--md-sys-color-primary)",
      background: "var(--md-sys-color-surface-container-high)",
    },
  },
  variants: {
    selected: {
      true: {
        borderColor: "var(--md-sys-color-primary)",
        background: "var(--md-sys-color-surface-container-high)",
      },
    },
  },
});

const IconWrapper = styled("div", {
  base: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    background: "var(--md-sys-color-primary-container)",
    color: "var(--md-sys-color-on-primary-container)",
    flexShrink: 0,

    "& svg": {
      width: "24px",
      height: "24px",
      fill: "currentColor",
    },
  },
});

const NativeInput = styled("input", {
  base: {
    padding: "12px",
    borderRadius: "8px",
    border: "1px solid var(--md-sys-color-outline-variant)",
    background: "var(--md-sys-color-surface-container)",
    color: "var(--md-sys-color-on-surface)",
    fontSize: "14px",
    fontFamily: "inherit",
    width: "100%",
    boxSizing: "border-box",

    "&::-webkit-calendar-picker-indicator": {
      filter: "invert(0.7)",
    },
  },
});

const PreviewSection = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
});

const PreviewLabel = styled("span", {
  base: {
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const PreviewValue = styled("span", {
  base: {
    fontSize: "14px",
    color: "var(--md-sys-color-on-surface)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
});
