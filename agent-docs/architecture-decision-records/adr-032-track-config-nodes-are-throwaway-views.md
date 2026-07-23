---
status: Accepted
summary: "Hydrated track-config MST nodes are throwaway views, not authoritative state"
---

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

The base is made immutable **by construction** (Option B below, now shipped), so
there is nothing to guard: no eviction, no re-pin, no "keep the mirror pristine"
gymnastics. The mechanism:

- **A non-admin resolves each shown track to a private working copy.**
  `TrackConfigurationReference.get()` asks the session for
  `getEditableTrackConfig(trackId, frozen, schemaType)` (SessionTracks.ts): a
  per-track MST node, seeded once from the current `base + delta`, cached by
  trackId in a session-owned (volatile, non-persisted) `Map`. In-place quick
  edits (`setSlot`) mutate **that** copy; the frozen `jbrowse.tracks` node is
  never handed out to a non-admin and so is never mutated. The delta is still
  computed the same way (`diffTrackConfig(base, workingCopy)` via
  `updateTrackConfiguration`), from a node that was never the base.
- **Reset reverts the working copy in place** (`applySnapshot(node, base)`),
  keeping node identity so open views just re-render.
- **Admin/embedded are unchanged.** `getEditableTrackConfig` returns undefined in
  admin mode, so the resolver falls through to the frozen hydration cache
  (ADR-031); admin edits the frozen entry in place, replacing its identity.

Because the base is never dirtied, `PluginManager.invalidateTrackConfigHydration`
and the `writeDelta` re-pin were **deleted**, and the outer
`trackConfigHydrationCache` reverted from a `Map` to a `WeakMap` (ADR-031).

The debounced `BaseTrackModel` reaction stays — it is the idiomatic MST way to
persist a node's edits (now a *stable* working copy, not the shared base). Its
`comparer.structural` guard remains (the admin path still replaces the node on
each write), as does the store-branch idempotency skip (two views of one track
run two persist reactions against the one shared working copy).

## Rejected: route every edit through a delta API (Option A)

The alternative — make the ~160 `setSlot` call sites write delta data directly,
deleting the reaction — was rejected. The sites are all on detached
*display*-config subtrees, so each would reconstruct a nested
`displays[displayId].slot` delta path (or still mutate a node and diff it,
reintroducing a node to mutate), discarding the whole-snapshot diff that handles
display-nesting for free. Large surface, poor cost/benefit versus the working
copy, which fixes the same bug class with no edit-site changes.

## Revisit if

- You want to delete the persist `reaction` entirely. The remaining step is to
  stop storing `trackConfigDeltas` as the live source and instead **derive** it
  from the working copies: the working-copy nodes become the sole live edit
  state, `getTrackConfigChanges`/`isTrackOverride` diff them on demand (already
  reactive — they read the node), and a snapshot processor converts working
  copies ↔ persisted deltas on save/load. That removes the reaction and both
  `comparer.structural` guards, but re-plumbs every delta consumer and the
  persistence round-trip (unshown-but-edited tracks included), so it is a
  larger, separate change, not pursued.
- `CustomReferenceType` in the mobx-state-tree fork grows its own
  memoization/invalidation. Re-examine whether `getEditableTrackConfig`'s
  session-owned cache should move into the fork's reference cache.
