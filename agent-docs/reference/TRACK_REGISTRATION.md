---
name: track-registration
description: Which destination does a track config land in (sessionTracks, trackConfigDeltas, jbrowse.tracks), who owns the routing, and which routing rules fail silently? Read before adding a track-registration action.
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

- **`jbrowse.tracks`** (the catalog): the admin server's config.json. Every
  product has it.
- **`sessionTracks`**: tracks the session added, and the base its edits diff
  against. It travels with the session and never reaches the catalog.
- **`trackConfigDeltas`**: a track's edited slots, stored as a diff against its
  base rather than a full shadow, so a later change to an untouched base field
  still flows through
  ([ADR-158](../architecture-decision-records/adr-158-a-session-tracks-entry-is-the-base-its-edits-diff-against.md)).

The base mixin (`TracksManagerSessionMixin`) has one destination, `jbrowse.tracks`,
whichever action runs. `SessionTracksManagerSessionMixin` has all three. The
policy for which action to call lives in the repo `CLAUDE.md`.

## Routing rules that fail silently

- `addToSession` resolves an existing entry (session, catalog, assembly sequence
  or connection) through `getTrackById` and returns it unchanged. A missing
  `type` throws uncaught; an invalid config is caught into an error snackbar.
- `publishTrackConf` for a non-admin routes to `addToSession`. An admin whose
  config names an assembly the catalog lacks also routes there, with an info
  snackbar naming the assembly.
- `updateTrackConfiguration` on a track with a base stores a delta and clears it
  when the edit nets back to base. Unsetting a slot the base sets is not a
  net-back: the delta records a `null`. A connection track, or a track with no
  base, goes to the base mixin's version. The embedded products' `jbrowse`
  (`createConfigModel`) has no `updateTrackConf`, so there the catalog write
  throws.
- `deleteTrackConf` always dereferences the track (closing every open view
  showing it); whether it also removes the catalog entry (`adminMode`), clears a
  leftover delta and splices a `sessionTracks` entry are independent.
- `isTrackOverride` (the edited badge, and the track menu's `isSessionOverride`)
  counts changed slots through `flattenTrackConfigDelta`, not key presence in
  `trackConfigDeltas`, so a delta holding only content-free display stubs reads
  as off.
