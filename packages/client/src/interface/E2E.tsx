import { onMount } from "solid-js";

import { styled } from "styled-system/jsx";

import { useVoice } from "@revolt/rtc";
import { VoiceCallCardActiveRoom } from "@revolt/ui/components/features/voice/callCard/VoiceCallCardActiveRoom";

/**
 * Minimal stub channel for the mock RTC path.
 *
 * The mock code path in Voice.connect() only uses channel for:
 * - Setting the channel signal via this.#setChannel(channel)
 * - Checking channel.havePermission("Listen" | "Speak")
 *
 * We provide a stub that grants all permissions so the mock
 * connection proceeds without needing a real authenticated channel.
 */
const mockChannel = {
  havePermission: () => true,
} as any;

/**
 * E2E test page.
 *
 * Renders a minimal voice call UI backed by the mock RTC layer
 * (enabled via VITE_MOCK_RTC=true). On mount it triggers a mock
 * connection so the VoiceCallCard tiles become visible for E2E
 * screenshot / interaction tests.
 */
export default function E2EPage() {
  const voice = useVoice();

  onMount(() => {
    void voice.connect(mockChannel);
  });

  return (
    <Container>
      <p>E2E Voice Test Page</p>
      <p>State: {voice.state()}</p>
      <VoiceCallCardActiveRoom />
    </Container>
  );
}

const Container = styled("div", {
  base: {
    padding: "var(--gap-lg)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--gap-md)",
  },
});
