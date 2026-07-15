# Session mixins

## Editing track configs: admin vs. non-admin deltas

Tracks come from two places, combined by the `#getter tracks` in
`SessionTracks.ts` (and inherited by the web session):

- `jbrowse.tracks` — admin-owned config tracks. A `types.frozen` array of plain
  objects; not serialized into a shared/saved session.
- `sessionTracks` — a typed MST array of **user-added** tracks (no matching
  admin base). Persisted and shared with the session.
- `trackConfigDeltas` — a `types.frozen` map `trackId → partial config`. A
  non-admin's **edits to an admin config track** are stored here as a _delta_
  against the base, keyed by trackId.

`tracks` lists `sessionTracks` first, then every `jbrowse.tracks` base entry
with its delta (if any) `mergeTrackConfig`'d over it. A base entry with no delta
is returned **unchanged by identity** so the config hydration cache stays warm
(see `configuration/CLAUDE.md`); merged objects are memoized per
`(base frozen object, delta value)` pair for the same reason.

### Why a delta, not a full-config shadow

The delta records only the slots the user changed. Everything else resolves from
the live base, so a later admin change to an **untouched** field (e.g. a
corrected adapter URL) still flows through — a full same-id shadow would mask
it. See `packages/core/src/util/trackConfigDelta.ts` (`diffTrackConfig` /
`mergeTrackConfig`) for the merge rules (displays by `displayId`, nested configs
recurse, value arrays replace wholesale, no deletion tombstones).

### How a config edit is saved

Both `ConfigurationEditorWidget` and `BaseTrackModel`'s debounced `reaction`
persist through `#action updateTrackConfiguration(snapshot)`:

- **Admin** (`adminMode`, and desktop, which only has the base
  `TracksManagerSessionMixin`) → `jbrowse.updateTrackConf` edits the config in
  place, **and drops any `trackConfigDeltas` entry for that track**. Deltas ride
  along in a shared session, so an admin can open a non-admin's session and edit
  the very tracks it overrides; an admin edit rewrites the base itself, so it
  supersedes the delta. Left in place, the delta merges straight back over the
  new base in the `tracks` getter and the admin's edit silently reverts. Canary:
  `UpdateTrackConfiguration.test.ts` ("an admin's edit clears a shared session's
  delta").
- **Everyone else** → `diffTrackConfig(base, snapshot)` and store the delta in
  `trackConfigDeltas[trackId]`. A second edit recomputes the delta against the
  same base. If the edited track has **no** admin base (a user-added
  `sessionTracks` entry), it's updated in place there instead.

Because the delta is recomputed against the base each save, a save that nets no
change (`diffTrackConfig` returns only the self-identifying `trackId`) is
**not** stored — and editing a slot back to its base value drops the delta
entirely (implicit reset). This keeps `isTrackOverride` / the "edited" badge
honest. The base is snapshotted first (`toPlainConfig`) so the diff/merge work
whether `jbrowse.tracks` holds `types.frozen` plain objects (app-core,
web/desktop) or live MST config nodes (product-core, embedded react views).

### Reset (not delete)

A delta can't be "deleted" (the underlying admin track remains), so the track
menu swaps **Delete track** for **Reset track settings** when
`#method isTrackOverride(trackId)` is true (web session). This checks
`getTrackConfigChanges(trackId).length > 0`, **not** merely
`trackId in trackConfigDeltas`: a delta can hold only content-free
`{type, displayId}` display stubs (see below) that record no real edit, and
those must not read as an override. Reset calls
`#action resetTrackConfiguration(trackId)`, which drops the delta key
**without** dereferencing the track from open views — the base config
re-resolves in place, so an open track stays open and simply reverts to the
admin default. (Plain `#action deleteTrackConf` dereferences and closes; don't
use it for reset.)

`isTrackOverride` also drives an "edited" badge on the track row in the
hierarchical and faceted selectors, which opens `TrackSettingsChangesDialog`
listing each changed slot vs its default (`OverrideBadge.tsx`).

### Stub-only deltas are not real overrides

A track config that omits `displays` diffs against the hydrated snapshot's
injected `{type, displayId}` display stubs to yield
`{trackId, displays: [...stubs]}` — nonzero keys but no changed slot.
`deltaHasChanges` (gating storage in `updateTrackConfiguration`) and
`isTrackOverride` therefore both test
`flattenTrackConfigDelta(base, delta).length > 0` (which drops identity keys and
empty stubs), **not** a raw key count — otherwise the "edited" badge lights up
on tracks the user never edited.

### Legacy migration

Older sessions stored a non-admin's edits as a full same-id `sessionTracks`
entry shadowing the admin track. `SessionTracks.ts`'s `afterAttach` performs a
one-time upgrade on load: any `sessionTracks` entry whose id matches a
`jbrowse.tracks` base is `diffTrackConfig`'d into `trackConfigDeltas` and
removed from `sessionTracks`. Genuinely-added session tracks (no base) are left
alone.

### Why Settings is always enabled

`trackActionItems` (`TrackMenu.ts`) no longer gates **Settings** on `canEdit` —
any user can open the editor, because a non-admin's edits now land safely as a
delta. `#method canEditTrack` still gates Delete.
