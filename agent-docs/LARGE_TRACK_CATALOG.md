# Lazy track catalogs for very large track lists

Notes from a design discussion. Motivating context: the
**genomes.jbrowse.org** portal has very large track lists (human is **100k+
tracks** if everything is included). Today we cope by **manually deleting**
tracks from the config to avoid overload. We want a real mechanism.

Starting point was [issue #4988](https://github.com/GMOD/jbrowse-components/issues/4988):
encode connection membership into the trackId (`conn-${connectionId}-...`) so
JBrowse can lazily load just that connection / just that track on demand instead
of eagerly dumping all of a connection's tracks into the session.

## The real problem is two different overloads

"Overload" turned out to be two distinct axes, and conflating them sent the
early design discussion down the wrong path:

- **Machine overload** — at 100k tracks you cannot ship every full config in
  `config.json` and instantiate 100k nodes into the MST tree. Forced
  conclusion: discovery metadata must live **outside** the config tree.
- **Human / UI overload** — 100k tracks can't be browsed; dumping them on a user
  is worse UX, not better. The hand-pruning we do today is really **editorial
  curation**, and deletion is currently our only curation tool.

Lazy loading (#4988) only addresses the machine axis. On its own it would make
the **human** axis *worse*: it removes the forcing function (deletion) that
keeps the UI clean, so without a discovery layer you just dump 100k lazily.

Also a hard constraint: **every JBrowse desktop user shouldn't have to care
about this.** Whatever we build must be **opt-in plumbing a deployment plugs
in**, not a change to how tracks work for everyone.

## Why "uniformly async track resolution" is the wrong frame

A tempting "single right path" is to make trackId → config resolution async
everywhere (connections become lazy config providers). This is wrong:

- **MST can't await.** Configs live in the MST tree; views resolve them via
  synchronous `types.reference`. You cannot await in a view getter, a reference
  resolver, or a snapshotProcessor. So async resolution can only live *before* a
  config enters the tree — i.e. the real shape is **async hydrate → sync forever
  after**, a two-phase lifecycle, not one uniform path.
- **"Inline track is a promise that settles immediately" is a lie about cost.**
  Inline = no network, cannot fail. Connection = network, slow, auth, can fail.
  A uniform `Promise<Config>` interface pushes loading/partial-failure handling
  into hundreds of sync call sites that never needed it. Contagion, not
  unification.
- It destabilizes the most-trafficked code (track lookup) to serve a power-user
  feature — directly against the "desktop shouldn't care" constraint.

## Why the self-describing trackId is OK *in a curated portal* (but not in general)

General objections to `conn-${connectionId}-...`: connectionId is instance-local
runtime state, so two users adding the same hub get different IDs → sessions
don't dedup/merge; renaming a connection breaks saved URLs; the string grammar
leaks (plugins/power users *will* write `trackId.startsWith('conn-')`).

These mostly **dissolve on a curated portal** because the deployment controls
identity and reproducibility: stable authored trackIds, a catalog that changes
only on *our* data releases. So `?tracks=<stableId>` resolving against a catalog
is safe and powerful **here**, even though it would be fragile as a general
mechanism. Don't generalize it to arbitrary user sessions.

The bloat-vs-reproducibility tension (a live remote pointer can change under a
shared session) also dissolves on the portal: we version our catalog
operationally. The hard general question — *"is a connection-backed track a
persisted snapshot or a live pointer to a remote that can change underneath
you?"* — has an easy portal answer: **live pointer into a catalog we control.**

## The shape that fits all three constraints

The key separation is **discovery metadata vs full track config** — different
size, different lifecycle:

- **Discovery** (id, name, assembly, category, facets): lightweight, must be
  searchable across all 100k, **never enters the MST config tree**. This is all
  the track *selector* needs.
- **Full config** (adapter, renderer, display sub-configs): heavy, only needed
  for tracks actually **turned on**.

Today both are the same object, so we pay full-config cost just to populate a
selector — which is why hand-pruning was the only relief.

Proposed: a self-contained **lazy catalog** abstraction (connection/adapter-
shaped, opt-in per deployment) that

- serves a **searchable metadata index** for the selector, and
- **materializes exactly one full config on demand** when a track is activated.

Activation is already an async UI action ending in a synchronous `addTrackConf`,
so this needs **zero** change to core reference resolution — the MST-can't-await
problem never arises. #4988's `conn-…` trackId trick degenerates to just "how
`?tracks=X` names which catalog to ask" — an activation-time hydration detail,
not a core grammar everyone depends on. Curation becomes a `featured: true` flag
(default tier surfaced; long tail search-only) instead of deletion.

## The decision 100k forces that 10k didn't

At ~10k you can ship all *metadata* to the client and facet locally. At 100k you
probably can't even do that — 100k metadata rows + client-side facet indexing is
its own overload. So the catalog likely needs to be **server-queried**. This is
the real fork that decides the whole shape:

- **Static catalog blob + client-side faceting** — simple, no backend, works to
  ~10–20k, probably breaks at 100k.
- **Server-side query API** — selector sends facet+text queries, gets pages
  back; scales to 100k+, but it's a backend contract plus a selector that can
  talk to it. Pairs naturally with curation (server marks the featured tier).

## Open / next

- Read how the **faceted track selector** sources its data today and how the
  **connection model** materializes tracks, to gauge how far either is from
  "query an external catalog + materialize one config on activate" — i.e.
  whether this is a contained new adapter/connection type or something deeper.
- Decide static-blob vs server-query (the 100k fork above).
- Formalize curation as a `featured`/default-tier flag rather than deletion.
