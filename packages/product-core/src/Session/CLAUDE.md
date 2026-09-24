# Session mixins

Edits to a track are stored in `trackConfigDeltas` as a **delta** against its
base, not a full same-id shadow — so a later change to an untouched field of the
base still flows through. The base is the track's `sessionTracks` entry, or its
config.json entry (ADR-158). An admin's edits are deltas too, and reach
`jbrowse.tracks` only through `promoteTrackConfigDeltas` (ADR-032); a session
track's stay in the session.

- A base entry with no delta is returned **unchanged by identity**, and merged
  objects are memoized per (base, delta), so the config hydration cache stays
  warm.
- **An edit wakes only its own track's readers and rebuilds no index**; the
  index is rebuilt when a list of bases changes. `trackWorkCensus.test.ts` in
  `products/jbrowse-react-linear-genome-view` snapshots what an edit, an add, a
  show and a reset cost at 500 catalog and 50 session tracks.
- **A promote merges the delta into the base and drops it**, so an admin who
  opens a non-admin's shared session and edits a track it overrides extends that
  delta rather than fighting it. Canary: `UpdateTrackConfiguration.test.ts`.
- A save that nets no change isn't stored, so editing a slot back to its base
  value is an implicit reset. **Unsetting a slot the base sets is a change**:
  the delta records it as a `null` (ADR-146), which survives a reload and a
  share link. That rests on both sides of the diff being post-`stripDefault`
  snapshots, which is why a base and an edit both go through the track schema
  first (`hydratedForms.ts`), and why the desktop web export diffs a hub config
  the same way.

- **A working copy is cached against the resolved config it was built from**,
  not by trackId alone. Every write the mixin makes re-stamps it, so the copy a
  value is still being typed into is never swapped out mid-keystroke; nothing
  else can, so a delta or base replaced from outside the mixin — an undo's
  `applySnapshot`, a session restore, a session track deleted and added again
  under its id — makes the next read rebuild it. Without that, an undone edit
  stayed on screen against a snapshot that said default, and the next edit
  re-diffed the stale copy and put the undone change back. Both directions are
  canaries in `UpdateTrackConfiguration.test.ts`.

## Reset, not delete

A delta over a config.json track can't be deleted (the admin track remains), so
the menu swaps Delete for **Reset track settings**; a session track, which its
user can delete, offers both. `isTrackOverride` tests for _changed slots_, not
mere presence in `trackConfigDeltas` — a delta can hold only content-free
display stubs, and a raw key count lights the "edited" badge on tracks nobody
edited. `resetTrackConfiguration` drops the key **without** dereferencing, so an
open track stays open; plain `deleteTrackConf` closes it.

Settings is always enabled now that edits land as a delta; `canEditTrack` still
gates Delete.
