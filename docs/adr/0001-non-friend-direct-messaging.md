# ADR-0001: Allow Direct Messaging of Non-Friend Users

**Status:** Accepted
**Date:** 2026-02-22
**Deciders:** Bryan White

## Context

Stoat (forked from Revolt) gates direct messaging behind the friend relationship. Users must first send a friend request and have it accepted before the "Message" button appears on a user's profile. This creates friction for new communities where users want to communicate but haven't established friend connections.

The upstream Revolt codebase enforces this via the `UserPermission.SendMessage` permission, which the `User.permission` getter only grants to users with `relationship === "Friend"`. The UI checks this permission before rendering the "Message" button in profile cards and context menus.

## Decision

Allow direct messaging of non-friend users by default, with an opt-out (`friendOnlyDms`) for users who want to restrict DMs to friends only.

### Changes Made

**stoat.js SDK** (`packages/stoat.js`):
- `src/classes/User.ts`: Rewrote the `permission` getter to grant `SendMessage` by default for all relationships except `Blocked`/`BlockedOther`. Added `friendOnlyDms` getter that reads the user's preference.
- `src/hydration/user.ts`: Added `friendOnlyDms` field with `friend_only_dms` API mapping and `false` default.

**No backend changes required** — the backend already supports the `friend_only_dms` field; the restriction was purely a frontend permission check.

## Consequences

- Users can now click "Message" on any non-blocked user's profile to open a DM
- The `friendOnlyDms` user preference is respected (if set to true, non-friends cannot DM that user)
- Group messaging of non-friends was already supported; this change aligns DM behavior with group behavior
- The stoat.js submodule is now sourced from a fork (`episk-pos/javascript-client-sdk`) since we don't have push access to the upstream repo

## Related

- ADR-0002: DM channel UX improvements (members sidebar, text-first layout)
