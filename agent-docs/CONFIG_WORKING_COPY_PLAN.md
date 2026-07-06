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
dirtied. Status: **DONE (9f20c072d5)**. `programmatic` updateTrackConfiguration
calls (not driven by the working copy's own edits) are synced into the copy via
`syncEditableTrackConfig`.

Identity note: the working copy is **stable across edits** (was: a new merged
node per delta change). Reactions key on content (`comparer.structural`), not
identity, so this is fine; verified against the hydration/identity tests.

## Phase 3 — delete the now-dead invalidation machinery — DONE

Base is never dirtied, so removed `PluginManager.invalidateTrackConfigHydration`,
`SessionTracks.invalidateBaseHydration`, and the `writeDelta` re-pin; reverted
the outer `trackConfigHydrationCache` to a `WeakMap`; updated ADR-031/032.

## Phase 2 — drop the persist reaction — RECONSIDERED, not done

Moving the persist reaction off `BaseTrackModel` was evaluated and **not done**:
the reaction is the idiomatic MST way to persist a node's edits and it must stay
for the **admin** path (which replaces the node each write and needs the
re-resolving-reference reaction + its `comparer.structural`). Splitting it into
"admin reaction + per-working-copy reaction" is two systems, not simpler, and
setting a reaction up inside the resolver-called factory is an impurity smell.
So the unified reaction + the store-branch idempotency skip stay.

The **only** way to truly delete the reaction is to stop storing
`trackConfigDeltas` as the live source and derive it from the working copies (a
snapshot processor round-trips copies ↔ deltas on save/load). That re-plumbs
every delta consumer and is a larger, separate change — recorded in ADR-032
"Revisit if", not pursued here.

## Guardrails (keep green every phase)

`UpdateTrackConfiguration.test.ts` (web + embedded), `ConfigHydration.test.tsx`,
`rootModel.test.ts`, plus `packages/product-core` + `packages/web-core`. Browser
smoke (per ADR-032 verify note): drag a point-size slider, then reset.
