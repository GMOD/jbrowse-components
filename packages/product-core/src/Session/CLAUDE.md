# Session mixins

## Editing track configs: admin vs. session-track overrides

Tracks come from two places, combined by the `#getter tracks` in
`SessionTracks.ts` (and inherited by the web session):

- `jbrowse.tracks` — admin-owned config tracks. A `types.frozen` array of plain
  objects; not serialized into a shared/saved session.
- `sessionTracks` — a typed MST array that **is** persisted and shared with the
  session.

`tracks` lists `sessionTracks` first and **shadows** any `jbrowse.tracks` entry
with the same `trackId` (filtered out), so a session track of the same id
_replaces_ the config track everywhere it resolves (`tracksById`, the track
selector, open displays via `TrackConfigurationReference`) with no duplicate.

### How a config edit is saved

`ConfigurationEditorWidget` debounce-saves through the session
`#action updateTrackConfiguration(snapshot)`:

- **Admin** (`adminMode`, and desktop, which only has the base
  `TracksManagerSessionMixin`) → `jbrowse.updateTrackConf` edits the config in
  place.
- **Everyone else** → upsert the full snapshot into `sessionTracks` under the
  **same trackId**. This same-id entry is an _override_: it shadows the admin
  track, so the edit persists with the session and is shareable instead of being
  a throwaway in-memory mutation of an admin-owned track.

A second edit updates the existing override (matched by trackId) rather than
adding another.

### Reset (not delete)

An override can't be "deleted" (the underlying admin track remains), so the
track menu swaps **Delete track** for **Reset track settings** when
`#method isTrackOverride(trackId)` is true (web session). Reset calls
`#action resetTrackConfiguration(trackId)`, which splices the override out of
`sessionTracks` **without** dereferencing the track from open views — the
same-id config track re-resolves in place, so an open track stays open and
simply reverts to the admin default. (Plain `#action deleteTrackConf`
dereferences and closes; don't use it for reset.)

`isTrackOverride` also drives an "edited" badge on the track row in the
hierarchical selector (`TrackLabel.tsx`), so users can see which tracks differ
from the admin defaults.

### Why Settings is always enabled

`trackActionItems` (`TrackMenu.ts`) no longer gates **Settings** on `canEdit` —
any user can open the editor, because a non-admin's edits now land safely as a
session override. `#method canEditTrack` still gates Delete.
