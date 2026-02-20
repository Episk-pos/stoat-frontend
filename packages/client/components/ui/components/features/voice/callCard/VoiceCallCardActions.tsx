import { For, Show, createMemo, createSignal } from "solid-js";
import { useMediaDeviceSelect } from "solid-livekit-components";

import { useLingui } from "@lingui-solid/solid/macro";
import { useState } from "@revolt/state";
import { styled } from "styled-system/jsx";

import { useVoice } from "@revolt/rtc";
import { Button, IconButton } from "@revolt/ui/components/design";
import { Symbol } from "@revolt/ui/components/utils/Symbol";

export function VoiceCallCardActions(props: { size: "xs" | "sm" }) {
  const voice = useVoice();
  const state = useState();
  const { t } = useLingui();
  const [showDevicePanel, setShowDevicePanel] = createSignal(false);

  const micSelector = useMediaDeviceSelect({
    kind: "audioinput",
  });

  const cameraSelector = useMediaDeviceSelect({
    kind: "videoinput",
  });

  const activeMicId = createMemo(
    () =>
      (micSelector.activeDeviceId() === "default"
        ? state.voice.preferredAudioInputDevice
        : undefined) ?? micSelector.activeDeviceId(),
  );

  const activeCameraId = createMemo(
    () =>
      (cameraSelector.activeDeviceId() === "default"
        ? state.voice.preferredVideoInputDevice
        : undefined) ?? cameraSelector.activeDeviceId(),
  );

  const selectedMicUnavailable = createMemo(
    () =>
      !!activeMicId() &&
      !micSelector
        .devices()
        .some((device) => device.deviceId === activeMicId()),
  );

  const selectedCameraUnavailable = createMemo(
    () =>
      !!activeCameraId() &&
      !cameraSelector
        .devices()
        .some((device) => device.deviceId === activeCameraId()),
  );

  return (
    <Container>
      <Actions>
        <Show when={props.size === "xs"}>
          <a href={voice.channel()?.path}>
            <IconButton variant="standard" size={props.size}>
              <Symbol>arrow_top_left</Symbol>
            </IconButton>
          </a>
        </Show>
        <IconButton
          size={props.size}
          variant={voice.microphone() ? "filled" : "tonal"}
          onPress={() => voice.toggleMute()}
          use:floating={{
            tooltip: voice.speakingPermission
              ? undefined
              : {
                  placement: "top",
                  content: t`Missing permission`,
                },
          }}
          isDisabled={!voice.speakingPermission}
        >
          <Show when={voice.microphone()} fallback={<Symbol>mic_off</Symbol>}>
            <Symbol>mic</Symbol>
          </Show>
        </IconButton>
        <IconButton
          size={props.size}
          variant={
            voice.deafen() || !voice.listenPermission ? "tonal" : "filled"
          }
          onPress={() => voice.toggleDeafen()}
          use:floating={{
            tooltip: voice.listenPermission
              ? undefined
              : {
                  placement: "top",
                  content: t`Missing permission`,
                },
          }}
          isDisabled={!voice.listenPermission}
        >
          <Show
            when={voice.deafen() || !voice.listenPermission}
            fallback={<Symbol>headset</Symbol>}
          >
            <Symbol>headset_off</Symbol>
          </Show>
        </IconButton>
        <IconButton
          size={props.size}
          variant={voice.video() ? "filled" : "tonal"}
          onPress={() => voice.toggleCamera()}
        >
          <Show when={voice.video()} fallback={<Symbol>videocam_off</Symbol>}>
            <Symbol>videocam</Symbol>
          </Show>
        </IconButton>
        <Show when={voice.video()}>
          <IconButton
            size={props.size}
            variant="tonal"
            onPress={() => voice.flipCamera()}
          >
            <Symbol>flip_camera_android</Symbol>
          </IconButton>
        </Show>
        <IconButton
          size={props.size}
          variant={voice.screenshare() ? "filled" : "tonal"}
          onPress={() => voice.toggleScreenshare()}
        >
          <Show
            when={voice.screenshare()}
            fallback={<Symbol>screen_share</Symbol>}
          >
            <Symbol>stop_screen_share</Symbol>
          </Show>
        </IconButton>
        <IconButton
          size={props.size}
          variant={voice.audioOnly() ? "tonal" : "filled"}
          onPress={() => voice.toggleAudioOnly()}
        >
          <Show when={voice.audioOnly()} fallback={<Symbol>visibility</Symbol>}>
            <Symbol>visibility_off</Symbol>
          </Show>
        </IconButton>
        <IconButton
          size={props.size}
          variant={showDevicePanel() ? "filled" : "tonal"}
          onPress={() => setShowDevicePanel((open) => !open)}
          use:floating={{
            tooltip: {
              placement: "top",
              content: t`Device settings`,
            },
          }}
        >
          <Symbol>tune</Symbol>
        </IconButton>
        <Button
          size={props.size}
          variant="_error"
          onPress={() => voice.disconnect()}
        >
          <Symbol>call_end</Symbol>
        </Button>
      </Actions>

      <Show when={showDevicePanel()}>
        <DevicePanel>
          <DeviceSelector>
            <Label>
              <Symbol>mic</Symbol>
              {t`Microphone`}
            </Label>
            <Select
              value={activeMicId() ?? ""}
              onInput={(event) => {
                const deviceId = event.currentTarget.value;
                state.voice.preferredAudioInputDevice = deviceId;
                micSelector.setActiveMediaDevice(deviceId);
              }}
            >
              <For each={micSelector.devices()}>
                {(device) => (
                  <option value={device.deviceId}>
                    {device.label || t`Unknown microphone`}
                  </option>
                )}
              </For>
            </Select>
            <Show when={selectedMicUnavailable()}>
              <WarningText>{t`Selected microphone is unavailable.`}</WarningText>
            </Show>
          </DeviceSelector>

          <DeviceSelector>
            <Label>
              <Symbol>videocam</Symbol>
              {t`Camera`}
            </Label>
            <Select
              value={activeCameraId() ?? ""}
              onInput={(event) => {
                const deviceId = event.currentTarget.value;
                state.voice.preferredVideoInputDevice = deviceId;
                cameraSelector.setActiveMediaDevice(deviceId);
              }}
            >
              <For each={cameraSelector.devices()}>
                {(device) => (
                  <option value={device.deviceId}>
                    {device.label || t`Unknown camera`}
                  </option>
                )}
              </For>
            </Select>
            <Show when={selectedCameraUnavailable()}>
              <WarningText>{t`Selected camera is unavailable.`}</WarningText>
            </Show>
          </DeviceSelector>
        </DevicePanel>
      </Show>
    </Container>
  );
}

const Container = styled("div", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-md)",
    alignItems: "center",
  },
});

const Actions = styled("div", {
  base: {
    flexShrink: 0,
    gap: "var(--gap-md)",
    padding: "var(--gap-md)",

    display: "flex",
    width: "fit-content",
    justifyContent: "center",
    alignSelf: "center",

    borderRadius: "var(--borderRadius-full)",
    background: "var(--md-sys-color-surface-container)",
  },
});

const DevicePanel = styled("div", {
  base: {
    display: "grid",
    gap: "var(--gap-md)",
    width: "min(100%, 620px)",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    padding: "var(--gap-md)",
    borderRadius: "var(--borderRadius-md)",
    background: "var(--md-sys-color-surface-container-low)",
    border: "1px solid var(--md-sys-color-outline-variant)",
  },
});

const DeviceSelector = styled("label", {
  base: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-sm)",
    minWidth: 0,
  },
});

const Label = styled("span", {
  base: {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--gap-sm)",
    fontSize: "var(--font-size-sm)",
    color: "var(--md-sys-color-on-surface-variant)",
  },
});

const Select = styled("select", {
  base: {
    minWidth: 0,
    border: "1px solid var(--md-sys-color-outline-variant)",
    borderRadius: "var(--borderRadius-sm)",
    background: "var(--md-sys-color-surface)",
    color: "var(--md-sys-color-on-surface)",
    padding: "var(--gap-sm) var(--gap-md)",
  },
});

const WarningText = styled("span", {
  base: {
    fontSize: "var(--font-size-xs)",
    color: "var(--md-sys-color-error)",
  },
});
