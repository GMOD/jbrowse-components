# Config quick-edits mutate shared hydrated nodes (handoff)

Status: **proposal, not implemented.** A compensating fix is shipped (see
"What's shipped" below); this doc describes the deeper fix that removes the whole
bug class.

## The problem in one paragraph

Non-admin track-menu quick-edits (`setSlot`, e.g. the scatter point-size slider)
mutate the **shared, cached, hydrated MST node** of a track's base config *in
place*. That node is the `trackConfigHydrationCache` entry
(`PluginManager` → `configurationSchema.ts`), which is assumed to be an immutable
mirror of its frozen `jbrowse.tracks` source. Mutating it violates that
invariant. The bug surfaced as: edit a slot → **reset to default** briefly shows
the default, then snaps back to the edited value — because dropping the delta
makes `SessionTracks.tracks` return the base by identity again and the cache
hands back the still-dirty node. `types.stripDefault` (a default-valued slot is
omitted from the snapshot; merges have no deletion tombstones) means "write the
default" can't erase it either. See
`[[key_pattern_config_hydration_dirty_node_on_reset]]` in agent memory for the
full trace.

Origin: `b2cb876263` ("Remove config-override layer; store display settings as
direct config-slot mutations") switched edits from a separate override-property
layer to direct in-place `setSlot`. Before that, the base node was never
dirtied. `316fb202a1` (delta system + `tracks`-by-identity) and the inline
point-size slider then made the latent defect reachable.

## What's shipped (compensating fix — keep it)

- `PluginManager.invalidateTrackConfigHydration(frozen)` — drops a frozen
  config's cached node so it re-hydrates clean. Outer cache is now a `Map` (so it
  can iterate sub-caches); inner stays a `WeakMap`.
- `SessionTracks.updateTrackConfiguration` (clear branch) + `resetTrackConfiguration`
  call it whenever a delta is dropped.
- Regression test:
  `products/jbrowse-web/src/tests/UpdateTrackConfiguration.test.ts`
  ("reset reverts a live in-place setSlot edit …"). Must drive an **in-place
  `setSlot`** then reset — the pre-existing snapshot-driven reset test never
  dirtied the cached node, so it didn't catch this.

This is correct but treats the symptom: it evicts the dirtied node at the moment
it would resurface, rather than preventing the dirtying. A dirtied shared base
node also lingers in the cache (unused) until its delta is dropped.

## The more ideal solution: never mutate the shared base node

Route non-admin quick-edits so the resolved, editable config is **never the
shared base-cache node**, and the effective config is a pure function of
`base + delta`. Then the cache invariant ("hydrated node mirrors its frozen
source") holds by construction, and `invalidateTrackConfigHydration` +
`stripDefault`-reset gymnastics become unnecessary.

Two shapes to evaluate (pick after spiking):

### Option A — edits compute a delta directly (no in-place mutation)

Today `setSlot` mutates the node and `BaseTrackModel`'s debounced `reaction`
observes `getSnapshot(self.configuration)` and converts it to a delta. Instead,
for a non-admin session, a quick-edit would compute-and-store the delta directly
(`session.updateTrackConfiguration({trackId, <slot>: value})`) and the resolved
config (`self.configuration`) would resolve to the merged node — read-only from
the edit's perspective. The base node is never touched.

- Pro: eliminates the class; removes the debounced reaction and its
  `comparer.structural` identity-churn workaround (`BaseTrackModel.ts`).
- Con: broad. Every `setX` action across the config mixins
  (`WiggleScoreConfigMixin.setScatterPointSize/setMinScore/…`, color setters,
  etc.) currently calls `configuration.setSlot`. They'd need to route through a
  session delta API. The admin path (in-place `updateTrackConf`) can stay as-is.

### Option B — copy-on-write working node

Keep `setSlot` mutating a node, but ensure that node is a per-track **working
copy**, not the base-cache entry. On first edit of a track without a delta,
fork a session-owned editable node; the reference resolves to it; the base cache
stays pristine.

- Pro: smaller change to the edit call sites (they still `setSlot`).
- Con: introduces a second node identity per edited track and a fork point;
  needs care that the reaction still persists and that reset discards the fork.

## Affected code

- `packages/core/src/pluggableElementTypes/models/BaseTrackModel.ts` — the
  debounced persist `reaction` (read its comment on identity churn first).
- `packages/product-core/src/Session/SessionTracks.ts` — `tracks` getter
  (base-by-identity fast path), `updateTrackConfiguration`,
  `resetTrackConfiguration`, `trackConfigDeltas`.
- `packages/core/src/configuration/configurationSchema.ts` —
  `TrackConfigurationReference` / `DisplayConfigurationReference` + the hydration
  cache (`frozenTrackHydrationCache`). See
  `packages/core/src/configuration/CLAUDE.md` (frozen + hydration section) and
  ADR-031.
- `packages/core/src/PluginManager.ts` — `trackConfigHydrationCache` (+ the
  shipped `invalidateTrackConfigHydration`).
- Every non-admin `setSlot` call site (Option A): the wiggle/gwas config mixins,
  color/height setters, etc.

## Risks & canaries

- Config editing is app-wide and load-bearing. Regression surface: admin vs
  non-admin edits, session export/reload (deltas must survive), the "edited"
  badge / `isTrackOverride`, embedded/product-core (MST-node bases, no
  `updateTrackConf`).
- Keep green: `products/jbrowse-web/src/tests/UpdateTrackConfiguration.test.ts`,
  `products/jbrowse-react-linear-genome-view/src/UpdateTrackConfiguration.test.ts`,
  `ConfigHydration.test.tsx`, `rootModel.test.ts`.

## How to verify (the actual bug)

Jest catches the mechanism, but verify in a real browser too — the bug only
reproduces with a live in-place slider drag + reset:

1. `PORT=8996 BROWSER=none pnpm --filter @jbrowse/web start`
2. Load `?config=test_data/config_gwas.json` (opens `sle_gwas_ld` on chr2).
3. Track menu → Point size → drag the slider (temp-log
   `WiggleScoreConfigMixin.setScatterPointSize` and the manhattan `renderState`
   `pointDiameterPx`), then "Reset to default size".
4. Bug present ⇒ render logs `4` then reverts to the dragged value. Fixed ⇒
   stays at the default (4).

The point-size slider carries `data-testid="point-size-slider"` /
`aria-label="point size"` for puppeteer targeting; a repro driver approach is in
this session's scratchpad history if useful.
