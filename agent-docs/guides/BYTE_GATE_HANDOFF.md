# Byte-gate handoff — what changed, what's left

Follows the 2026-07 simplification pass on the region-too-large / byte-estimate
system. Read [REGION_TOO_LARGE.md](../reference/REGION_TOO_LARGE.md) first for how
the gate works; this file is only the delta and the open items.

## What the pass changed

The gate is now two names a display writes and nothing else:

- **`byteGateEnabled`** — a boolean getter. True means "measure this fetch and
  gate on it". MAF turns it off in summary mode, LD for pre-computed adapters.
- **`byteGateBlocksFetch(regions, ctx)`** — one action on `RegionTooLargeMixin`
  that measures, commits the estimate with the span it covers, and answers
  "abandon this fetch?". `MultiRegionDisplayMixin.fetchRegions` calls it for that
  whole family; LD and arc call it directly because they fetch through
  `GlobalFetchMixin`.

Gone: `getByteEstimateConfig()`, `ByteEstimateConfig`, `checkByteEstimate`, the
hand-rolled four-step gate blocks in LD and arc, and the canvas-local
`gateInactive`. Added: **`gateActive`**, the single getter answering "may anything
gate right now" (opted in, not exempt, view measured, span above
`AUTO_FORCE_LOAD_BP`) — read by the verdict, by the pre-flight RPC skip, and by
both worker budgets. `evaluateRegionTooLarge` is now purely a comparison and knows
nothing about the floor or force-load.

## Second pass (same month): one estimate, one budget, one adapter method

- `RegionByteEstimate` is **gone from core**, and with it
  `getMultiRegionByteEstimate`. `getRegionByteSize(regions)` is the single adapter
  byte-estimate method, called by both the pre-flight RPC and canvas's in-fetch
  gate, and `CoreGetRegionByteEstimate` now returns bare `number | undefined`.
- `fetchSizeLimit` no longer rides back on the estimate. BAM/CRAM/VCF filled it
  with `this.getConf('fetchSizeLimit')` — the same static slot the main thread can
  read — so it was one value with two spellings plus a precedence rule
  (`resolvedAdapterByteLimit`, also gone). The budget is now resolved once, on the
  main thread, in `gateByteLimit`.
- `alwaysRender` deleted (four adapter overrides, one core field, one term in
  `byteGateExempt`): the flag could only arrive on an estimate, and no adapter that
  reported it produces one. Behavior is unchanged because "no estimate" already
  keeps the byte axis out of the verdict.
- **Bug found and fixed on the way:** `adapterFetchSizeLimit` read the slot off the
  display's `adapterConfig`, which is a default-stripped *snapshot* — so an
  adapter's declared limit was invisible unless a config restated it. It now reads
  a slot path off the live track config. Pinned by the alignments test, which
  passes the adapter's default value deliberately. The general trap is closed —
  that spelling no longer compiles, and a snapshot reaching `readConfObject`
  through a cast throws instead of answering `undefined`
  ([CONFIG_PATTERN.md §"Reading a slot: node, not snapshot"](../reference/CONFIG_PATTERN.md)).
- `resolvedByteLimit()` moved from `CanvasFeatureGateMixin` to
  `RegionTooLargeMixin` (both its terms were the byte mixin's), so the canvas gate
  is purely the density axis. `measureRegionBytes`
  (`RenderFeatureDataRPC/byteGate.ts`) replaces the block that was copy-pasted into
  both canvas feature RPCs. The byte estimate and the span it covers are one
  volatile, `gateVisibleBp` is the mixin's only view read, and
  `RegionTooLargeMixin.tsx` became `.ts` (no JSX in it).

Two bugs fixed on the way, both instances of
[ADR-044](../architecture-decision-records/adr-044-reactive-display-hooks-are-getters-or-pinned-views.md):
MultiSampleVariant's gate was dead (its opt-in method sat in an `.actions()`
block), and multi-row's `isCacheValid` had been an action for a long time,
masked. Seven display families now pin the declaration site.

Seven gate internals also left the LGV plugin's export surface
(`resolveByteLimit`, `evaluateRegionTooLarge`,
`rescaleByteEstimateToVisibleSpan`, `bytesTooLargeReason`,
`TOO_MANY_FEATURES_REASON`, `getDisplayStr`, `RegionTooLargeStatus`) — none had a
consumer outside the plugin. `regionTooLargeUtils.ts` is internal now.

## Open items, most valuable first

### Move the gate out of the plugin

`RegionTooLargeMixin` + `regionTooLargeUtils` + `AUTO_FORCE_LOAD_BP` are
display-foundation code living in a plugin and reached by five others.
`packages/render-core` already owns `RenderLifecycleMixin` / `displayPhase` /
`renderBlock`, so they belong there.

- The mixin needs only `{ initialized, visibleBp }` from the view — make it a
  duck-typed interface, per the "structural types across lazy boundaries"
  invariant, rather than importing `LinearGenomeViewModel`.
- `AUTO_FORCE_LOAD_BP` has to move with them (it lives in
  `LinearGenomeView/model.ts` today); MAF's `showSummary` reads it too.
- The config-slot reads (`fetchSizeLimit`, `forceLoad`) go by name through
  `getConf`, so no schema import follows.
- Removing the names from `@jbrowse/plugin-linear-genome-view` is an ABI
  reduction — see [PLUGIN_ABI_STABILITY.md](../reference/PLUGIN_ABI_STABILITY.md).
  A re-export shim would defeat the point; prefer the clean break.
- Costs a `pnpm gen-tsconfig-refs` run and touches every import site. Do it in a
  quiet tree, not alongside other agents editing the same plugins.

### Trim the remaining unused plugin exports

Fourteen names exported from `plugins/linear-genome-view/src/index.ts` have no
consumer outside the plugin and appear in no hand-written guide:
`GlobalDataDisplayMixinType`, `LinearDisplayModel`, `MultiLevelRubberbandModel`,
`MultiRegionDisplayMixinType`, `NavLocation`, `RenderTransform`,
`RenderTransformInputs`, `SVGGridlines`, `SVGRuler`,
`StaleViewportRescaleMixinType`, `SyncableViewAction`, `VolatileGuide`,
`drawCanvasImageData`, `getTrackSizingMenuItem`.

The implementations are used internally — only the exports are dead. Mechanical
and compiler-verified, but decide first which are intentional external-plugin API
(`SVGRuler` / `SVGGridlines` / `drawCanvasImageData` / `getTrackSizingMenuItem`
are the plausible ones). Regenerate the list rather than trusting this one:

```
# names exported from the index with no reference elsewhere in the monorepo
grep -rlwE '<names>' --include=*.ts --include=*.tsx plugins packages products \
  | grep -v linear-genome-view | grep -v /esm/
```

### The multi-region rescale mixes denominators

`commitGateMeasurements` stores the per-region **max** bytes but anchors to the
**total** `visibleBp` across visible regions. Right at capture time (it reproduces
the worker's per-region verdict), wrong on a later zoom: in a whole-genome view,
zooming into one chromosome shrinks the total span far faster than that
chromosome's own bytes shrink, so the banner releases earlier than it should.

The download stays protected (the worker re-gates per region on the next fetch and
the banner returns), which is why this has been left alone. Two ways forward:

- Store bytes-per-bp for the canvas path instead of bytes + span, so the rescale
  has a per-region denominator. Now cheaper than before, since `gateActive`
  centralized everything else — but it gives canvas a different estimate semantic
  from the pre-flight path, which genuinely measures a region *set* in one call.
- Or pin the current accepted behavior in a test so nobody "fixes" it by accident.

Either is better than the status quo, which is a comment in
REGION_TOO_LARGE.md § "Known limitation".

### Not worth doing

Passing `ctx.stopToken` into the pre-flight RPC. `getRegionByteSize` bottoms out
in a tabix index lookup (`bytesForRegions`), so there is nothing meaningful to
cancel. The unused `stopToken` / `headers` / `statusCallback` fields on
`CoreGetRegionByteEstimate`'s arg type are RPC-base boilerplate, not a gap.

## Housekeeping

`pnpm gendocs` output for this pass is **not** committed. The renames change
`website/docs/models/*.md` for every display composing the mixin, and the shared
worktree had several agents' uncommitted source in flight, so a regenerated tree
here would be `f(everyone's dirty tree)` and would fail the CI check (which
regenerates from committed source). Run `pnpm autogen` on a clean tree and commit
it separately. The same trap applies to any CI-checked generated aggregate: a
temp worktree does not escape it either, because symlinking the real
`node_modules` in makes pnpm's workspace entries resolve back to the dirty main
checkout.
