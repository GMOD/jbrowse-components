# Config-delta track overrides — handoff

## Context

Recent webgl-poc work (commit `b2cb876263`, "Remove config-override layer")
replaced the `ConfigOverrideMixin`/`heightOverride` layer with **direct
`self.configuration.setSlot(...)` writes**. A debounced `reaction` in
`BaseTrackModel.afterAttach` persists the mutated config back to the session via
`session.updateTrackConfiguration(snapshot)`. For a non-admin, that upserts the
**entire track config snapshot** into `sessionTracks` under the same `trackId`,
shadowing the admin-owned config track (see
`packages/product-core/src/Session/CLAUDE.md`).

Two problems were identified with that design. One is a hard bug (fixed here);
the other is the architectural weakness this handoff exists to finish.

## What's DONE (committed to the working tree, verified)

### 1. 🔴 Critical bugfix — unbounded save loop in admin/desktop mode

**File:** `packages/core/src/pluggableElementTypes/models/BaseTrackModel.ts`

The reaction watched `getSnapshot(self.configuration)` where `self.configuration`
is a **re-resolving `TrackConfigurationReference`**. Persisting a save swaps the
resolved node identity:

- **admin/desktop** → `jbrowse.updateTrackConf` replaces the whole frozen
  `jbrowse.tracks` array; the hydration cache (keyed by frozen-object identity,
  see `configuration/CLAUDE.md`) misses and rehydrates a **brand-new MST node**
  every write.
- The reaction's referential comparison sees a new snapshot identity → re-fires
  the debounced save → replaces the frozen array again → new node again →
  **forever** (one save per 400 ms, unbounded).

Non-admin didn't loop because `sessionTracks` is a typed MST array that
reconciles by `trackId` identifier **in place** (stable identity after the first
push). The `ConfigurationEditorWidget` autorun didn't loop because it watches a
**pinned volatile `target`** node, not a re-resolving reference — replicating
that pattern on the track model's live reference is what introduced the loop.

**Proven** with a throwaway repro (open a track, one `setSlot('name',…)`, advance
fake timers): admin fired **62 and climbing** `updateTrackConf` calls; after the
fix, **1**.

**Fix:** `{ equals: comparer.structural }` on the reaction (import `comparer`
from mobx). Once content stops changing, node-identity churn is structurally
equal and the reaction settles. Load-bearing, not an optimization — documented
in the code comment. Also removes the redundant second save on the non-admin
path.

**Regression test:** `products/jbrowse-web/src/tests/UpdateTrackConfiguration.test.ts`
→ `'a live setSlot edit persists exactly once and does not loop (admin)'`
(asserts `updateTrackConf` called exactly once after 20 timer ticks). Whole file
8/8 green.

### 2. ✅ Proven delta core (pure functions + exhaustive tests, UNWIRED)

**Files:** `packages/core/src/util/trackConfigDelta.ts` (+ `.test.ts`, 11 green).
Lint/type clean.

- `diffTrackConfig(base, edited)` → minimal delta (adds/changes only)
- `mergeTrackConfig(base, delta)` → reconstruct effective config

Design decided and tested:

- **`displays` merged by `displayId`** so editing one display doesn't pin the
  others; a display present only in `edited` is carried whole.
- **Nested config objects (`adapter`, …) recurse** — so an admin's later change
  to an untouched nested field flows through (the divergence fix; there's a test
  `'admin change to an untouched field flows through the delta'`).
- **Value arrays (`jexlFilters`, `category`, `assemblyNames`) replaced
  wholesale** when changed (not element-merged).
- **No tombstones (deliberate).** A delta records adds/changes, not deletions. If
  a user *resets* a slot the admin had customized (base has it, edited omits it
  via `stripDefault`), the delta can't express "drop below the admin value" and
  the field keeps following the base. Rare case; keeps the merge trivial and the
  shared JSON free of deletion sentinels. Covered by
  `'no-tombstone limitation…'`.
- **Legacy full overrides collapse cleanly:** `diffTrackConfig(base,
  fullOverride)` keeps only differing fields → migration is just a diff.

Empirically grounded: `stripDefault` already prunes default slots from
`getSnapshot(track.configuration)`, so an edited display stub is a superset of
the base stub → the realistic edit path round-trips `merge(base, diff(base,
edited)) === edited` exactly.

## ✅ WIRING DONE (2026-07-01)

The delta is now wired into the session end-to-end; **clean-migrate** strategy
chosen (single mechanism, legacy full-overrides converted on load).

- `SessionTracks.ts`: new frozen `trackConfigDeltas` prop; `tracks` getter merges
  deltas over base with a per-`(base,delta)` `WeakMap` memo (stable identity →
  hydration cache stays warm); `updateTrackConfiguration` non-admin branch stores
  `diffTrackConfig(base, snapshot)` (falls back to in-place `sessionTracks` edit
  for a user-added track with no base); `resetTrackConfiguration` drops the delta
  key; `afterAttach` migrates legacy same-id `sessionTracks` overrides → deltas.
- `BaseWebSession/index.ts`: `isTrackOverride` = `trackId in trackConfigDeltas`.
- `core/util/types`: `trackConfigDeltas?` added to `AbstractSessionModel`;
  `BaseTrackModel.canConfigure` recognizes a delta as configurable.
- Docs: `Session/CLAUDE.md` rewritten for the delta model.
- Tests: `UpdateTrackConfiguration.test.ts` (10) rewritten for delta storage +
  admin-field-flow-through + legacy migration; `trackConfigDelta.test.ts` (11)
  unchanged. `ConfigHydration`/`rootModel`/`product-core` (88) still green.

Original plan retained below for reference.

## What was LEFT — wire the delta into the session

Goal: store a non-admin override as a **delta against the live base config**,
merged at resolution, so admin updates to untouched fields flow through and
shared sessions shrink. **Admin/desktop path is unchanged** (still
`jbrowse.updateTrackConf`, full, in place — no delta needed).

### Storage decision (unresolved — pick before coding)

The delta MUST be stored as a **frozen partial**, NOT in the typed
`sessionTracks` array:
- a typed `trackSchema.create(partial)` fills defaults, erasing the "unset vs
  default" distinction the merge relies on (a materialized default would
  overwrite the base's non-default value), and
- it would reject a partial missing required fields.

So add a new session prop, e.g.
`trackConfigDeltas: types.frozen<Record<string, Record<string, unknown>>>({})`.

Two transition strategies (this is what the user should confirm):

- **Migrate to deltas (clean):** single mechanism; on session load convert legacy
  full-config `sessionTracks` overrides → deltas (`diffTrackConfig` against the
  base). Existing shared links start tracking admin updates to untouched fields
  (intended, but a behavior change).
- **Dual-path (additive):** new edits → deltas; leave existing `sessionTracks`
  full-overrides shadowing exactly as today. Zero behavior change for old
  sessions; two mechanisms coexist.

### Integration points

- `packages/product-core/src/Session/SessionTracks.ts`
  - **`tracks` getter:** for each `jbrowse.tracks` base entry, if a delta exists →
    `mergeTrackConfig(base, delta)`; else return the base object **unchanged by
    identity** (don't rebuild — preserves the hydration cache). `sessionTracks`
    remains for genuinely-added tracks (no matching base id).
  - **`updateTrackConfiguration` (non-admin branch):** compute `diffTrackConfig`
    of the incoming snapshot against the current base entry and store it in
    `trackConfigDeltas[trackId]` instead of pushing the full snapshot.
  - **`resetTrackConfiguration`:** delete the delta key.
- `packages/web-core/src/BaseWebSession/index.ts` — `isTrackOverride(trackId)`:
  delta exists (drives the "Reset track settings" menu swap + the edited badge in
  `TrackLabel.tsx`).

### ⚠️ Gotchas

- **Merged-object identity / churn:** `mergeTrackConfig` returns a fresh object.
  If the `tracks` getter rebuilds merged objects on every recompute, every
  delta'd track rehydrates a new MST node whenever *any* unrelated dep changes →
  open displays lose state + needless work. **Memoize** merged objects per
  `(base frozen obj, delta value)` pair (both have stable identity until they
  actually change): e.g. a `WeakMap<baseObj, { delta, merged }>`. Base identity
  changes only on `jbrowse.tracks` writes; a track's delta identity changes only
  when that track's delta changes.
- **Loop safety is already handled** by the `comparer.structural` fix — the
  delta-write → merged-object-swap → rehydrate → reaction cycle settles because
  content is structurally equal. Keep that fix.
- **Reference resolver is unchanged.** The merged object is still a plain frozen
  object hydrated lazily by `TrackConfigurationReference` via the hydration
  cache. Don't touch `configurationSchema.ts` resolution — just feed it merged
  objects from `tracks`/`tracksById`.
- **Validation:** an invalid merged config throws on hydration. The existing
  choke points (`showTrackGeneric`, `filterSessionInPlace`) already defend; make
  sure a bad delta surfaces as a snackbar, not a crash (mirror the try/catch in
  `updateTrackConfiguration`).

### Tests to add / update

- Extend `products/jbrowse-web/src/tests/UpdateTrackConfiguration.test.ts`:
  override stored as a delta (not full copy); untouched base field flows through
  after a simulated admin base change; reset deletes the delta; export+reload
  fidelity; migration of a legacy full-override session (if that strategy).
- `products/jbrowse-web/src/tests/ConfigHydration.test.tsx` and
  `rootModel/rootModel.test.ts` — confirm merged tracks hydrate once and keep
  stable identity across unrelated recomputes (guards the memoization).
- Run: `pnpm test products/jbrowse-web/src/tests` and
  `pnpm test packages/product-core`.

### Docs to update when done

- `packages/product-core/src/Session/CLAUDE.md` ("Editing track configs" section
  — currently describes the full-override shadow model).
- `packages/core/src/configuration/CLAUDE.md` if resolution semantics shift.
