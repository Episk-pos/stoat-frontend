# ADR-0002: DM Channel UX Improvements

**Status:** Accepted (Phase 1); Proposed (Phase 2)
**Date:** 2026-02-23
**Deciders:** Bryan White

## Context

After enabling non-friend DMs (ADR-0001), QA testing revealed several UX friction points in the DM channel view:

1. **"View Members" icon in DM header** — The people/group icon appeared in the DM header bar, but a 1:1 DM has no concept of "members" to view. `MemberSidebar.tsx` already renders nothing for `DirectMessage` channels, so the button opened an empty panel.

2. **Empty members sidebar on DM entry** — The `MEMBER_SIDEBAR` layout section defaults to `true` (open). When navigating to a DM, this produced an empty right sidebar panel since the member list has no `Match` branch for `DirectMessage`.

3. **Voice-first DM layout** — The fundamental issue: `Channel.isVoice` returns `true` for ALL DMs and Groups (hardcoded in `Channel.ts`). When `isVoice` is true, `TextChannel.tsx` replaces the message list with a `VoiceCallCardMount` ("Join the voice channel" / "Start the call" card). Messages are only accessible via a collapsible right sidebar toggle. This means clicking "Message" on a user's profile opens a voice-call-oriented view, not a messaging view.

## Decision

### Phase 1 (Implemented)

- Hide the "View Members" icon for `DirectMessage` channels in `ChannelHeader.tsx`
- Auto-close the `MEMBER_SIDEBAR` when navigating to a DM channel in `TextChannel.tsx`

### Phase 2 (Proposed)

Switch DM channels to a **text-first layout** with voice as an opt-in:

- **No active call**: Show the standard text channel layout (messages + compose box in main area). Add a "Start Voice Call" button in the header bar.
- **Active call**: Switch to the current voice layout (call card in main area, messages in sidebar).
- **Call ends**: Automatically revert to text layout.

The `isVoice` getter remains unchanged (DMs still *support* voice). Only the layout rendering logic in `TextChannel.tsx` becomes conditional on call state rather than voice capability.

Key files for Phase 2:
- `TextChannel.tsx` — Layout swap condition: `isVoice && isCallActive()` instead of just `isVoice`
- `ChannelHeader.tsx` — Add "Start Call" icon; conditionally show "View Chat" toggle
- Voice state from `components/rtc/state.tsx` (`useVoice()`) and `channel.voiceParticipants`

## Consequences

### Phase 1
- DMs feel cleaner without the irrelevant members icon
- No empty sidebar panel on DM entry
- No behavioral change for Group or server channels

### Phase 2 (Expected)
- DMs become messaging-first, matching user intent when clicking "Message"
- Voice calling is still accessible but not the default presentation
- Layout dynamically adapts to call state (text <-> voice)
- Groups would benefit from the same treatment (also `isVoice === true`)

## UX Trajectory

The broader direction: Stoat DMs and Groups should behave like **text channels with integrated voice**, not like **voice channels with a text sidebar**. The current upstream Revolt design assumes voice is the primary use case for DMs, which doesn't match typical chat platform expectations (Discord, Slack, etc. all default to text).

## Related

- ADR-0001: Non-friend direct messaging
