# ADR-032: Hydrated track-config MST nodes are throwaway views, not authoritative state

## Status

Accepted

## Context

A track config lives in two representations at once:

- **Authoritative, at rest:** a plain frozen object. Admin tracks live in
  `jbrowse.tracks` (`types.frozen`); a non-admin's edits live in
  `trackConfigDeltas` (`types.frozen` map `trackId → partial config`). Neither is
  an MST node — see ADR-031 for why frozen is load-bearing at 10k+ tracks.
- **Ephemeral, on read:** an MST node hydrated lazily the first time
  `track.configuration` is read, via `TrackConfigurationReference`'s custom
  `types.reference.get()` (`configuration/configurationSchema.ts`), cached on
  `PluginManager.trackConfigHydrationCache`. The hydrated node is a **detached
  standalone MST root** — `schemaType.create(ret, env)`, pointed at by the
  reference, never spliced into the session tree. `getSession()` on it therefore
  throws.

The `tracks` getter (`Session/SessionTracks.ts`) resolves the effective config
as a pure function of the two: a base with no delta is returned **by identity**
(keeps the hydration cache warm); a base with a delta returns
`mergeTrackConfig(base, delta)` — a fresh plain object, memoized per
`(base, delta)`, which hydrates to a fresh **merged** node.

Editing does not go through MST's native mutate-and-persist story, because the
node is detached and can't persist itself. Instead `BaseTrackModel`'s debounced
`reaction` observes `getSnapshot(self.configuration)` and calls
`updateTrackConfiguration`, which `diffTrackConfig(base, snapshot)`s into a
delta. So the ~160 `setSlot` call sites across the display models mutate a
detached scratch node; the reaction converts that mutation into delta data.

### The defect this ADR closes off

Mutating the resolved node in place is only safe when that node is
**regenerable**. A merged node is: it is rebuilt whenever the delta changes, so
mutating it is harmless (the old node is discarded). A base node is **not**: it
is the shared, cached, authoritative mirror of its frozen source, and it is what
a no-delta track resolves to. So the *first* edit of a track that has no delta
yet mutates the authoritative mirror in place.

Symptom (`b2cb876263` + `316fb202a1`): edit a slot → reset to default → the
value snaps back to the edited value, because dropping the delta made the
`tracks` getter return the base by identity again and the cache handed back the
still-dirty node. `types.stripDefault` means "write the default" can't erase it
either (a default-valued slot is omitted from the snapshot; merges have no
deletion tombstones).

## Decision

State the invariant the frozen+hydration+delta design has always implied but
never enforced, and make the enforcement structural:

> A hydrated MST config node is a **throwaway view**. It is never authoritative
> and never the edit target of record. The effective config is a **pure
> function of `frozen base + delta`**, resolved on read. Corollary: a hydration
> cache entry is always a faithful, pristine mirror of its frozen source.

Enforcement, given that in-place mutation of the resolved node stays (removing
it is deferred — see below):

- **Every write to `trackConfigDeltas` goes through one choke point**
  (`writeDelta` in `SessionTracks.ts`) that sets/clears the delta **and** re-pins
  that track's base hydration (`PluginManager.invalidateTrackConfigHydration`,
  which drops the stale cache node so the next read re-hydrates clean from the
  untouched frozen object). A delta cannot change without the base being
  re-pinned — the store, implicit-reset, and reset paths can't forget it,
  because none of them touch `trackConfigDeltas` directly.
- The re-pin is a cheap no-op after the first edit: once a delta exists the
  resolved node is the regenerable merged node, so subsequent edits never touch
  the base again.
- **Admin edits** stay in-place on the frozen `jbrowse.tracks` array via
  `updateTrackConf`, which replaces the entry's identity and so drops the
  WeakMap cache node naturally — the same invariant reached by a different
  mechanism, no explicit invalidation needed.

The debounced reaction stays. Within its sub-400ms window the base node is
intentionally the live-edit surface (immediate visual feedback while dragging a
slider); the re-pin happens when the delta is stored, so the cache is pristine
again by the next resolve.

### Consequence for ADR-031

ADR-031's "no manual cache invalidation or teardown hook needed" held only
before in-place non-admin edits existed. To let `invalidateTrackConfigHydration`
iterate the per-type sub-caches, the **outer** level of
`trackConfigHydrationCache` is a `Map` (not a `WeakMap`); its keys are the
registered config schemas, a bounded set already held for the PluginManager's
lifetime, so this adds no retention. The inner level — keyed by 10k+ frozen
configs that must stay GC-eligible — stays a `WeakMap`.

## Deferred: never mutate the base node at all (the structural end state)

The invariant above is enforced by *evicting* the one node that can violate it.
The stronger form — making it impossible to mutate the base node in the first
place — was evaluated and deferred. Both shapes are larger and riskier than the
eviction, and neither is free:

- **Option A — route every edit through a session delta API.** ~160 `setSlot`
  sites, all on detached *display*-config subtrees. Because the node is detached
  and edits are display-scoped, each site would have to reconstruct a nested
  `displays[displayId].slot` delta path, or still mutate a working-copy node and
  diff it — reintroducing "a node to mutate." It discards the elegant
  whole-snapshot diff that currently handles display-nesting for free. Large
  surface, real regression risk on app-wide config code.

- **Option B — session-owned working-copy node.** Resolve a shown editable
  track to a per-track working copy (a clone of `base + delta`) instead of the
  base cache node, keyed in a session-owned map; the base cache stays pristine by
  construction. Cleaner target, but adds machinery, changes the node-identity
  model for every shown track (risk to any identity-based assumption), and still
  needs the working copy regenerated on reset — it is not hook-free either.

Neither prize (removing a bug class already closed by the choke point; possibly
deleting the reaction + its `comparer.structural` churn workaround) justifies
churning load-bearing config code today.

## Revisit if

- The incremental migration toward "config = immutable base + functional
  overlay" continues (it already removed the override-property layer for deltas +
  `getConfResolved`, collapsed slots to bare value props, and added
  `stripDefault`). When the edit path no longer needs a mutable MST node —
  i.e. slot writes compute delta data directly — adopt **Option B**, drop the
  eviction, and delete the debounced `reaction`. That is the natural end state
  this ADR is a waypoint toward, not a permanent design.
- `CustomReferenceType` in the mobx-state-tree fork grows its own
  memoization/invalidation. Re-examine whether the eviction is still the right
  place to re-pin the mirror, or whether the fork's cache should own it.
