# Config working-copy refactor — staged plan

Goal: make the frozen base config **immutable by construction** so the whole
"quick-edit scribbles on the shared base node" bug class disappears, rather than
being guarded (ADR-032). Target end-state: a **session-owned working copy per
shown non-admin track**; edits mutate the working copy; the base is never
touched; the debounced reaction + both `comparer.structural` guards + the
hydration re-pin all delete themselves.

See ADR-032 for the invariant and why this is the right target. This doc is the
implementation order; each phase keeps the full test suite green.

## Mechanics that make it work (verified)

- A track/display state model holds its config via `ConfigurationReference` →
  `TrackConfigurationReference.get(id, parent)`. For a non-admin, `tracksById[id]`
  is a **plain frozen** object (base, or base+delta merged), so `get()` hydrates
  it into a detached MST node. That hydrated node is what edits mutate — and for
  a no-delta track it's the *shared* base cache node. That is the sole leak.
- Config nodes are **detached** (created via `schemaType.create(frozen, env)`),
  so `setSlot` can't reach the session — which is why edits are captured by a
  reaction diffing the snapshot, not written directly.
- The `SessionTracksManagerSessionMixin` closure already has `pluginManager`, so
  it can `schemaType.create(frozen, { pluginManager })` itself.
- `applySnapshot` + `onPatch` are exported by the fork.
- `ConfigHydration.test.tsx` runs in **admin** mode (default `adminMode = true`),
  so it never exercises the non-admin working-copy path.

## Phase 1 — resolve non-admin shown tracks to a session working copy

Smallest change that makes the base immutable; keeps the existing per-model
reaction untouched (still persists via `updateTrackConfiguration`).

- **Session** (`SessionTracks.ts`):
  - volatile plain `Map<trackId, node>` (`editableTrackConfigs`) — not observable
    (mirrors the pluginManager WeakMap), not persisted.
  - `getEditableTrackConfig(trackId, frozen, schemaType)` — **undefined in admin
    mode**; else create-and-cache `schemaType.create(frozen, { pluginManager })`
    seeded from the current frozen (base+delta) value, return the cached node.
  - `revertEditableTrackConfig(trackId)` — `applySnapshot(node, base)` so a reset
    reverts the *live* node in place (observers update); called whenever a delta
    is cleared (folded into `writeDelta(trackId, undefined)`).
- **Resolver** (`configurationSchema.ts`, `TrackConfigurationReference.get`): in
  the `!isStateTreeNode(ret)` branch, prefer `session.getEditableTrackConfig?.(id,
  ret, schemaType)`; fall back to the existing pluginManager frozen cache when it
  returns undefined (admin/embedded).

Result: non-admin edits mutate the working copy; the frozen base is never
dirtied. `invalidateTrackConfigHydration` becomes a no-op for non-admin (nothing
populates that cache), but is left in place until Phase 3.

Identity note: the working copy is now **stable across edits** (was: a new merged
node per delta change). Reactions key on content (`comparer.structural`), not
identity, so this is fine; verified against the hydration/identity tests.

## Phase 2 — one persist listener per working copy (drop the per-model reaction)

- Set up a single `onPatch`/reaction on each working copy when created (session
  side), driving `updateTrackConfiguration`. Remove `BaseTrackModel`'s
  `afterAttach` reaction.
- With exactly one writer per trackId: remove the store-branch idempotency
  `comparer.structural` guard (two views no longer double-fire) and the reaction's
  own loop-guard `comparer.structural` (no re-fire — the working copy isn't
  recreated on delta change).

## Phase 3 — cleanup

- Remove `invalidateTrackConfigHydration` + the `writeDelta` re-pin (base is never
  dirtied); outer `trackConfigHydrationCache` can revert to a `WeakMap`.
- Fold ADR-032's "deferred" section into "done"; update ADR-031.

## Guardrails (keep green every phase)

`UpdateTrackConfiguration.test.ts` (web + embedded), `ConfigHydration.test.tsx`,
`rootModel.test.ts`, plus `packages/product-core` + `packages/web-core`. Browser
smoke (per ADR-032 verify note): drag a point-size slider, then reset.
