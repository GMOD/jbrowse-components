---
status: Accepted
summary: "A track the session owns edits the way a config.json track does: its `sessionTracks` entry is the base, and an edit is a `trackConfigDeltas` delta over it. `tracks` hands out each entry as a snapshot merged with its delta, so a shown session track resolves to a working copy, and one base lookup (the session entry, else the config.json entry) feeds `baseTrackConfig`, the changes list, `updateTrackConfiguration` and the reset. The edited badge, the changes table, Reset track settings and a row display's Reset row order reach a session track with no display code, in every product that composes the session-tracks mixin. A working copy is stamped with the resolved config it mirrors rather than the delta, since a session entry can be replaced under an unchanged delta. Promote is unchanged: a session track's delta stays in the session"
---

# ADR-158: A session track's entry is the base its edits diff against

## Status

Accepted (2026-09-23). Amends
[ADR-032](adr-032-track-config-nodes-are-throwaway-views.md)'s working-copy
stamp, and
[ADR-157](adr-157-a-row-displays-arrangement-is-the-rows-config-object.md)'s
reset on a track the session owns.

## Context

ADR-157 made a row display's arrangement and `rowColor` config members, and
"Reset row order" returns them to the base the session hands back through
`baseTrackConfig(trackId)`. A track the session owns had no base.
`addSessionTrackConf`, a session spec's tracks, a share link's tracks, the
embedded products' `openTracks` and every track an agent builds through the jb
API land in `sessionTracks`, and `updateTrackConfiguration` edited that entry in
place. Such a track had no delta, no changes table and no "Reset track
settings", and `baseTrackConfig` answered undefined. Reset row order there
cleared the arrangement and colours the track was added with, and the
multi-row palette, dealt over the base's `rows.domain`, ignored the order it
was added with. A track an agent builds is exactly the one that arrives with
an arrangement.

Giving the entry the role of base needed more than a lookup. `tracks` returned
the live `sessionTracks` nodes, and `TrackConfigurationReference.get` hands a
node back as-is, so a display's `configuration` was the entry itself: `setConf`
mutated the base, and a diff of the base against itself is empty.

## Decision

**The `sessionTracks` entry is the base.** `tracks` hands out each entry as its
snapshot, merged with its delta through `mergeTrackConfig` and cached per
(base, delta) as a config track's merge is. A shown session track then resolves
through `getEditableTrackConfig` to a working copy like any other, and the
persist reaction diffs the copy into `trackConfigDeltas`. The in-place branch of
`updateTrackConfiguration` is gone.

**One base lookup**, the session entry and otherwise the config.json entry,
feeds `baseTrackConfig`, `getTrackConfigChanges`, `updateTrackConfiguration`
and the revert a reset runs. The session entry wins because `tracks` shows the
session entry when an id is in both, so what a track shows and what its edit
diffs against stay one config.

**A working copy is stamped with the resolved config it mirrors**, not the
delta. A session entry can be replaced while its delta stays the same: a track
deleted and added again under its id (the two-step `assertNotReaddedDifferently`
names for a recomputed track), or `jb.setSession`, which is `applySnapshot`.
Stamped with the delta, both kept the old copy on screen. Every write the mixin
makes re-stamps the copy with what its track now resolves to, so the copy an
edit is being typed into still stays. The connection-track branch of
`updateTrackConfiguration` re-stamps and syncs as the delta branch does, since
the new stamp would otherwise rebuild a connection track's copy on each save.

**A re-add compares against the entry by id.** `addToSession` checked
`sessionTracks.includes(existing)`, an identity read that would have skipped
`assertNotReaddedDifferently` in silence once `tracks` handed out plain
objects. Comparing against the entry, not the merged config, means an edit
made since the add is no difference.

**Promote is unchanged.** `promoteTrackConfigDeltas` writes config.json-track
deltas into `jbrowse.tracks`, and a session track has no file to write, so its
delta stays in the session.

## Consequences

- A session track takes the edited badge, the changes table and "Reset track
  settings" with no display code. In the web and desktop track menus Reset
  joins Delete, since `canEdit` holds for a track the session owns.
- The embedded products compose the same mixin, so a host's `openTracks`
  tracks take the badge in the track selector, whose changes dialog resets,
  and a row display's Reset row order. Their track menu,
  `TrackMenuSessionMixin`, offers no Reset track settings.
- On a row display `baseDisplayConfig` is the entry's display: Reset row order
  returns to the arrangement and `rowColor` the track was added with, and the
  multi-row palette is dealt over its `rows.domain`. A session spec writing
  `rows.domain` on a session track writes the base, so the order it declares is
  not custom.
- A share link carries the entry and the delta. So does a desktop web export
  under either strategy (`planWebExport` keeps the prior `trackConfigDeltas`),
  and a self-contained export, which turns desktop's config tracks into session
  tracks, now applies an unpromoted desktop delta over one where the web
  session carried it and ignored it.
- A session-track edit costs what a config-track edit costs. Every delta
  write rebuilds `tracks` and the trackId index over the whole catalog, about
  6 ms a write at 10,000 config tracks in jsdom, where the in-place write
  reconciled the entry and rebuilt nothing (1.5 ms); at 500 tracks the two
  are equal. In exchange no resolved config reads `trackConfigDeltas`, so a
  delta write re-resolves the edited track alone where it re-resolved every
  shown config track, and `baseTrackConfig` is a per-id lookup (0.5 µs)
  where it scanned `jbrowse.tracks` (430 µs at 10,000 tracks). Making a delta
  write cost nothing per catalog track needs `getTrackById` to resolve from
  the bases rather than from the merged `tracks` array.
- Admin → Save track settings to config is enabled by any delta, so a session
  whose only deltas are over session tracks offers a promote that writes
  nothing.
- The legacy `afterAttach` upgrade, `deleteTrackConf` (which already drops the
  delta), the `&sessionTracks=` URL form and the session migrations are
  unchanged. Settings a migration lifts into a session track land in its entry,
  which is now its base.

## Rejected alternatives

- **A hidden base snapshot beside the live entry**, taken at the add. Two
  stores for one track, and a share link carrying both, where the delta
  machinery already keeps a base and an edit apart.
- **`baseTrackConfig` answering the live entry.** The display's config was the
  entry, so every comparison came out equal and a reset wrote nothing.
