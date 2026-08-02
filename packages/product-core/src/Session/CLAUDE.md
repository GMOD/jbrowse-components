# Session mixins

A non-admin's edits to an admin config track are stored in `trackConfigDeltas`
as a **delta** against the base, not a full same-id shadow — so a later admin
change to an untouched field still flows through. `sessionTracks` holds only
genuinely user-added tracks.

- A base entry with no delta is returned **unchanged by identity**, and merged
  objects are memoized per (base, delta), so the config hydration cache stays
  warm.
- **An admin edit drops the track's delta.** Deltas ride along in a shared
  session, so an admin can open a non-admin's session and edit the very tracks
  it overrides; left in place the delta merges back over the new base and the
  admin's edit silently reverts. Canary: `UpdateTrackConfiguration.test.ts`.
- A save that nets no change isn't stored, so editing a slot back to its base
  value is an implicit reset.

## Reset, not delete

A delta can't be deleted (the admin track remains), so the menu swaps Delete for
**Reset track settings**. `isTrackOverride` tests for _changed slots_, not mere
presence in `trackConfigDeltas` — a delta can hold only content-free display
stubs, and a raw key count lights the "edited" badge on tracks nobody edited.
`resetTrackConfiguration` drops the key **without** dereferencing, so an open
track stays open; plain `deleteTrackConf` closes it.

Settings is always enabled now that edits land as a delta; `canEditTrack` still
gates Delete.
