---
status: Accepted
summary: "A track the session owns edits the way a config.json track does: its `sessionTracks` entry is the base, and an edit is a `trackConfigDeltas` delta over it. `tracks` hands out each entry as a snapshot merged with its delta, so a shown session track resolves to a working copy, and one base lookup (the session entry, else the config.json entry) feeds `getTrackById`, `baseTrackConfig`, the changes list, `updateTrackConfiguration` and the reset. The edited badge, the changes table, Reset track settings and a row display's Reset row order reach a session track with no display code, in every product that composes the session-tracks mixin. A working copy is stamped with the resolved config it mirrors rather than the delta, since a session entry can be replaced under an unchanged delta. An edit re-resolves one track and rebuilds no index over the catalog, so a persist of either kind costs less than main's and a search-box keystroke no more. A working copy is per track type, so an id re-added as another type resolves. Promote writes only the edits over a config.json entry, into the last entry of a repeated trackId"
---

# ADR-158: A session track's entry is the base its edits diff against

## Status

Accepted (2026-09-23). Amends
[ADR-032](adr-032-track-config-nodes-are-throwaway-views.md)'s working-copy
stamp,
[ADR-157](adr-157-a-row-displays-arrangement-is-the-rows-config-object.md)'s
reset on a track the session owns, and
[ADR-100](adr-100-an-index-every-reader-shares-is-kept-alive.md)'s held index,
which `getTrackById` no longer reads.

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

**One base lookup**, `trackBasesById`: the session entry, otherwise the
config.json entry, with no delta applied. It feeds `getTrackById`,
`baseTrackConfig`, `getTrackConfigChanges`, `updateTrackConfiguration` and the
revert a reset runs. The session entry wins because `tracks` shows the session
entry when an id is in both, so what a track shows and what its edit diffs
against stay one config.

**An edit re-resolves one track.** `getTrackById`'s per-id computed lays the
track's delta over its base (`withTrackEdits`), so a delta write re-evaluates
the per-id computeds something observes, each in constant time, and rebuilds
no index over the catalog. `tracks` is held beside the indexes, so a reader
outside any reaction — the search box's adapter list on every keystroke, the jb
API's track list — reads it as it stands, as on main. An edit copies the list
of bases, 5 µs at 10,000 tracks, and lays each delta at its track's position,
so past that copy an edit costs the count of edited tracks. `getTracksById`, deprecated and read by no
in-tree code, is kept against the two lists it was built from and rebuilt on
its first read after a change. `getEditableTrackConfig` is a per-id computed on the
working copy, so a display's config reads depend on which node its track
resolves to and not on the config that node mirrors: persisting the copy they
read recomputes none of them, where main recomputed every one on each
config-track persist. A persist handing in the working copy's own snapshot
skips re-hydrating it, since it is already in the schema's form.

**A working copy is stamped with the resolved config it mirrors**, not the
delta. A session entry can be replaced while its delta stays the same: a track
deleted and added again under its id (the two-step `assertNotReaddedDifferently`
names for a recomputed track), or `jb.setSession`, which is `applySnapshot`.
Stamped with the delta, both kept the old copy on screen. Every write the mixin
makes re-stamps the copy with what its track now resolves to, so the copy an
edit is being typed into still stays. The connection-track branch of
`updateTrackConfiguration` re-stamps and syncs as the delta branch does, since
the new stamp would otherwise rebuild a connection track's copy on each save.

**A working copy is per track type as well as per id.** Each track type's
config reference resolves through its own schema, and an id deleted and added
again as another type — a FeatureTrack re-added as a VariantTrack — resolves
through the new type's reference. A computed keyed on the id alone kept the
first caller's schema and failed to convert the new entry.

**A re-add compares against the entry by id.** `addToSession` checked
`sessionTracks.includes(existing)`, an identity read that would have skipped
`assertNotReaddedDifferently` in silence once `tracks` handed out plain
objects. Comparing against the entry, not the merged config, means an edit
made since the add is no difference.

**Promote writes the edits over a config.json entry.** `promotableTrackIds`
lists the ids whose delta has a config.json base and no session entry, and
both `promoteTrackConfigDeltas` and web's Admin → Save track settings to config
read it. A session track has no file to write, so its delta stays in the
session, and a delta diffed against a session entry is never merged into a
config.json entry of the same id. The menu item is disabled while only session
tracks carry edits.

**A repeated trackId is a config error, resolved last-wins.** The base lookup
answers the last config.json entry of an id, so that entry is what shows and
what an edit diffs against. `jbrowse.updateTrackConf`, which a promote writes
through, replaces the last entry too; it replaced the first, and a promoted
edit vanished behind the entry that still resolved.

## Consequences

- A session track takes the edited badge, the changes table and "Reset track
  settings" with no display code (`OverrideBadge.test.tsx` renders the badge
  for both kinds). In the web and desktop track menus Reset
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
- A persist costs less than main's for either kind of track. Measured in
  jsdom as the mean of 150 persists of one shown track's name, beside 200
  session tracks:

  | config.json tracks | track edited | main | this ADR |
  | --- | --- | --- | --- |
  | 500 | config.json | 1.53 ms | 0.20 ms |
  | 500 | session | 0.18 ms | 0.16 ms |
  | 10,000 | config.json | 6.04 ms | 0.16 ms |
  | 10,000 | session | 0.54 ms | 0.14 ms |

  Main rebuilt `tracks` and the trackId index over the catalog on each
  config-track persist and scanned it on each session-track one. A persist
  here is a diff, a merge, one per-id re-resolve and a copy of the list of
  bases. `baseTrackConfig` is a per-id lookup, 0.3 µs at 10,000 tracks where
  main scanned `jbrowse.tracks` in 216 µs.
- A search-box keystroke costs no more than main's. `relevantAdapters`, which
  reads `tracks` outside any reaction, as the mean of 40 calls over the same
  sessions:

  | config.json tracks | main | this ADR |
  | --- | --- | --- |
  | 500 | 0.55 ms | 0.22 ms |
  | 10,000 | 3.1 ms | 2.9 ms |

- A session-track persist followed by a `getTracksById` read costs 1.8 ms at
  10,000 tracks, where main's costs 0.6 ms: the record is rebuilt on that
  first read, and main rebuilt it only on a config-track persist, which cost
  6 ms there. No in-tree code reads it, and the two plugins known to call it
  try `getTrackById` first.
- The legacy `afterAttach` upgrade, `deleteTrackConf` (which already drops the
  delta), the `&sessionTracks=` URL form and the session migrations are
  unchanged. Settings a migration lifts into a session track land in its entry,
  which is now its base.

## Rejected alternatives

- **A hidden base snapshot beside the live entry**, taken at the add. Two
  stores for one track, and a share link carrying both, where the delta
  machinery already keeps a base and an edit apart.
- **Patching the previous `tracks` array on a delta write** instead of
  resolving per id. Finding the changed entry is a pass over the catalog, and
  the trackId index rebuilt on any new array.
- **`baseTrackConfig` answering the live entry.** The display's config was the
  entry, so every comparison came out equal and a reset wrote nothing.
