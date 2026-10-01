---
name: track-registration
description: The three destinations a track config can land in (sessionTracks, trackConfigDeltas, jbrowse.tracks), the six actions that route between them, and the four values a consumer reads. Read before adding a track-registration action.
audience: internal
kind: spec
---

# Track registration: session, catalog, delta

A track config reaches a session by one of three routes, and which one it takes
depends on who is asking and what already exists.

| Code | Path |
| --- | --- |
| The full routing mixin (session/catalog/delta, web) | `packages/product-core/src/Session/SessionTracks.ts` |
| The base mixin (catalog only, desktop) | `packages/product-core/src/Session/Tracks.ts` |
| Shared track-menu actions and gating | `packages/product-core/src/Session/TrackMenu.ts` |
| Catalog write with no dedupe | `packages/app-core/src/JBrowseModel/index.ts` `addTrackConf` |
| Contract check on every add path; reports through `reportContractViolation`, never throws | `packages/product-core/src/Session/temporaryAssemblyTracks.ts` |
| Capability guards | `isSessionWithAddSessionTrack`, `isSessionWithPublishTrackConf`, `isSessionWithSessionTracks`, `isSessionWithAddTracks` in `packages/core/src/util/types/index.ts` |
| Temporary-assembly refusal | [ADR-084](../architecture-decision-records/adr-084-a-view-local-track-config-rides-on-its-track.md) |
| Working invariants (delta caching, reset-not-delete) | `packages/product-core/src/Session/CLAUDE.md` |

`UpdateTrackConfiguration.test.ts` is the canary named in `Session/CLAUDE.md`,
`TrackConfigWorkingCopy.test.ts` pins a slot reset holding on screen, and
`pluginFacingSessionApi.test.ts` pins the deprecated `addTrackConf` alias that
two prebuilt plugin bundles still call by name.

## The three destinations

- **`jbrowse.tracks`** (the catalog) — what the admin server's config.json hands
  every visitor. Every product has it.
- **`sessionTracks`** — tracks the session added: a non-admin's added and copied
  tracks, and every track a feature, session spec, share link or agent stands
  up. Each entry is the base its edits diff against. It travels with the
  session and never reaches the catalog.
- **`trackConfigDeltas`** — a track's edited slots, stored as a diff against its
  base (a `sessionTracks` or catalog entry) rather than a full shadow, so a
  later change to an untouched base field still flows through
  ([ADR-158](../architecture-decision-records/adr-158-a-session-tracks-entry-is-the-base-its-edits-diff-against.md)).

The base mixin (`TracksManagerSessionMixin`) has one destination, `jbrowse.tracks`,
whichever action runs. `SessionTracksManagerSessionMixin` has all three, and its
routing exists to pick among them.

## The six actions

`addSessionTrackConf`, `publishTrackConf`, `addTrackConf` (deprecated alias of
the first), `updateTrackConfiguration`, `resetTrackConfiguration`,
`deleteTrackConf`. The policy lives in the repo `CLAUDE.md`: `addSessionTrackConf`
is the default and `publishTrackConf` is for Add-track workflows only.

Routing rules that fail silently:

- `addToSession` resolves an existing entry (session, catalog, assembly sequence
  or connection) through `getTrackById` and returns it unchanged. A missing
  `type` throws uncaught; an invalid config is caught into an error snackbar.
- `publishTrackConf` for a non-admin routes to `addToSession`. An admin whose
  config names an assembly the catalog lacks also routes there, with an info
  snackbar naming the assembly.
- `updateTrackConfiguration` on a track with a base stores a delta and clears it
  when the edit nets back to base, reverting the working copy. Unsetting a slot
  the base sets is not a net-back: the delta records a `null`. A connection
  track, or a track with no base, goes to the base mixin's version. The embedded
  products' `jbrowse` (`createConfigModel`) has no `updateTrackConf`, so there
  the catalog write throws.
- `deleteTrackConf` always dereferences the track (closing every open view
  showing it); whether it also removes the catalog entry (`adminMode`), clears a
  leftover delta and splices a `sessionTracks` entry are independent.

## What a consumer reads

- **The `tracks` getter** (what renders): whether a track's live config comes
  from the session, the catalog, a delta merged over its base, or a connection.
- **`isTrackOverride`** (the edited badge): computed from
  `flattenTrackConfigDelta`'s changed-slot count, not from key presence in
  `trackConfigDeltas`, so a delta holding only content-free display stubs reads
  as off.
- **The track menu's `isSessionOverride`** ("Reset track settings"): the same
  `isTrackOverride`. Delete stays beside Reset wherever `canEdit` holds.
- **The snackbar**: none, an invalid-config error, or the missing-assembly info
  notice.

A connection track never carries an edited badge, since only a track with a base
can have a delta. A snackbar only ever pairs with the session-add destination.

## Why three destinations

A catalog write, a per-user addition and a per-user edit of either have three
different persistence and sharing semantics. `Session/CLAUDE.md`'s invariants
(delta caching keyed to the value it mirrors, a reset recorded as a `null`)
exist because getting either wrong loses a keystroke mid-edit or silently undoes
a reset the user just watched land.

## Known gaps

- `jbrowse.addTrackConf` pushes unconditionally with no dedupe. Only
  `publishTrackConf` reaches the bare push, so a repeated or racing admin call
  can leave two catalog entries sharing one `trackId`.
- A non-admin calling `deleteTrackConf` on a catalog-owned track dereferences
  every open view and removes nothing from any store. The track menu's
  `isSessionOverride` gating hides it from the UI, but a plugin can reach it. It
  is a silent no-op where a refusal belongs.
