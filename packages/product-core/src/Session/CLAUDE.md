# Session mixins

A track edit is a **delta** in `trackConfigDeltas` against its base (the
`sessionTracks` entry or the config.json entry, ADR-158), so later changes to
untouched base fields still flow through. An admin's deltas reach
`jbrowse.tracks` only through `promoteTrackConfigDeltas` (ADR-032).

- **A base with no delta is returned unchanged by identity**, and merges are
  memoized per (base, delta), so the hydration cache stays warm. An edit wakes
  only its own track's readers (`trackWorkCensus.test.ts`).
- **Unsetting a slot the base sets is a `null` in the delta** (ADR-146); a save
  netting no change is an implicit reset. Both sides of the diff must be
  post-`stripDefault` snapshots (`hydratedForms.ts`).
- **A stored delta goes through `deltaInCurrentSpelling` before it merges or
  lists its changes.** A bare `mergeTrackConfig` lets a retired spelling lose to
  the base's current spelling of the same member, and drops its `null`.
- **The working copy is cached against the resolved config it came from**, so an
  undo, a session restore or a re-added track rebuilds it.
- **The config editor holds a trackId, never a working copy**
  (`getEditableTrackConfigById`); a held node goes stale on undo and saves the
  undone value back.
- **A config.json track offers Reset, not Delete.** `isTrackOverride` tests for
  changed slots, not key presence; `resetTrackConfiguration` keeps the track
  open, `deleteTrackConf` closes it.

Canaries: `UpdateTrackConfiguration.test.ts`, `ConfigEditorWorkingCopy.test.ts`.
