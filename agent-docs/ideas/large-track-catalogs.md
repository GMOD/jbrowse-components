---
name: large-track-catalogs
description: Splitting discovery metadata from full config so a 100k-track catalog stays navigable.
---

# Large track catalogs (100k+ tracks)

Motivating context: the genomes.jbrowse.org portal has 100k+ tracks for human if
everything is included; today we cope by *manually deleting* tracks from the config.
"Overload" is really two axes: **machine** (can't ship 100k full configs in
`config.json` or instantiate 100k MST nodes → discovery metadata must live *outside* the
config tree) and **human** (100k tracks can't be browsed; the hand-pruning is editorial
curation, and deletion is our only curation tool). Lazy loading (issue #4988) addresses
only the machine axis; alone it makes the human axis worse.

"Uniformly async track resolution" is the wrong frame: MST can't await (configs resolve
via synchronous `types.reference`), so the real shape is **async hydrate → sync forever
after**, not one uniform path; and a uniform `Promise<Config>` interface pushes
loading/partial-failure handling into hundreds of sync call sites that never needed it.
Hard constraint: every desktop user shouldn't have to care — this must be **opt-in
plumbing a deployment plugs in**.

The shape that fits: separate **discovery metadata** (id/name/assembly/category/facets —
lightweight, searchable across all 100k, never enters the MST tree; all the *selector*
needs) from **full config** (adapter/renderer/display — heavy, only for tracks turned
on). Today both are one object, which is why hand-pruning was the only relief. Proposed:
a self-contained **lazy catalog** abstraction (connection/adapter-shaped, opt-in per
deployment) that serves a searchable metadata index and materializes exactly one full
config on demand at activation (already an async UI action ending in a synchronous
`addTrackConf` — zero change to core reference resolution). Curation becomes a
`featured: true` flag (default tier surfaced, long tail search-only) instead of deletion.
The self-describing `conn-${connectionId}-…` trackId (#4988) is fragile in general
(instance-local IDs, rename breaks URLs, grammar leaks) but fine *in a curated portal*
that controls identity and versions its catalog. The 100k fork that decides the whole
shape: **static metadata blob + client-side faceting** (simple, no backend, breaks
~10–20k) vs **server-side query API** (selector sends facet+text queries, scales to
100k+, pairs naturally with server-marked curation). Next: read how the faceted track
selector sources data + how the connection model materializes tracks, to gauge whether
this is a contained new adapter/connection type or something deeper.
