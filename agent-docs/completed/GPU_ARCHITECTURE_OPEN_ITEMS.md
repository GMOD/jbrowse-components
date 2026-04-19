# GPU architecture — open items

Remaining cleanup after the `rpcProps` / `gpuProps` / framework-consolidation
work captured in `NEW_ARCHITECTURE.md` and `RPCPROPS_GPUPROPS_NEXT_STEPS.md`.
Each item below has a concrete plan, risk assessment, and test strategy so they
can be picked up independently.

Order is rough priority: #1 is the highest architectural-simplification value;
#4 is a targeted perf fix.

---

## 1. Canvas layout as a derived MST view

### Status quo

Canvas (`plugins/canvas/src/LinearBasicDisplay/baseModel.ts`) holds `rpcDataMap`
as _post-layout_ data. Layout is applied imperatively:

- `applyFetchResults` copies `rpcDataMap`, calls `computeAndAssignLayout`
  (mutates entries in place), then calls `self.setRpcDataMap(new map)`.
- `relayoutForCurrentZoom` is a separate action that does the same thing when
  `bpPerPx` / labels change.
- A `RelayoutOnZoomOrLabelChange` autorun invokes `relayoutForCurrentZoom` when
  its tracked inputs change.

The autorun reads `rpcDataMap.size` inside `untracked` to avoid a circular
trigger (the autorun's effect writes to `rpcDataMap`). This is the **only
remaining `untracked` in the refactored code**, and it's a symptom of imperative
layout.

### Target

Split raw fetch data from layout output. Make layout a cached MST view that
derives from raw data + viewport inputs. The upload autorun reads the derived
view; changing any input invalidates the cache; the
`RelayoutOnZoomOrLabelChange` autorun and `relayoutForCurrentZoom` action both
go away.

```ts
.volatile(() => ({
  rawRpcDataMap: new Map<number, RawFeatureDataResult>(),  // pre-layout
  layoutBpPerPxMap: new Map<number, number>(),
}))
.views(self => ({
  // Derived: laid-out data, recomputed when any input changes.
  get rpcDataMap(): Map<number, FeatureDataResult> {
    const view = getContainingView(self) as LGV
    if (!view.initialized) return new Map()
    const out = new Map<number, FeatureDataResult>()
    for (const [n, raw] of self.rawRpcDataMap) {
      out.set(n, {
        ...raw,
        // applyLayout is pure: takes raw + inputs, returns laid-out copy.
        ...applyLayout(raw, view.bpPerPx, self.showLabels,
                       self.effectiveShowDescriptions),
      })
    }
    return out
  },
}))
```

### Steps

1. Extract `applyLayout(raw, bpPerPx, showLabels, showDescriptions) → LaidOut`
   as a pure function (refactor `layout.ts`'s `computeAndAssignLayout` /
   `relayoutAllRegions`).
2. Rename the existing `rpcDataMap` volatile → `rawRpcDataMap`; rename
   `setRpcDataMap` → `setRawRpcDataMap`. Store raw results, not laid-out.
3. Add the derived `rpcDataMap` view shown above. Upload autorun keeps reading
   `rpcDataMap` — now it sees the derived map.
4. Delete `relayoutForCurrentZoom` action.
5. Delete the `RelayoutOnZoomOrLabelChange` autorun in `afterAttach`.
6. Delete the `untracked` call inside it (now removed — untracked is gone from
   the refactor's scope).

### Risk

- `computeAndAssignLayout` is currently **in-place mutation**. Rewriting it as
  pure (returns new objects) may allocate more — check flatbush-array-building
  perf for "all regions at once" mode.
- `maxY` is computed from laid-out data and drives `autoHeight`. Moving it from
  `setRpcDataMap` body into a separate cached view on `rpcDataMap` is
  straightforward but needs care around `setHeight` side effects (use a
  dedicated auto-height autorun that watches `maxY` + `autoHeight`).
- Subclasses (`LinearBasicDisplay/model.ts` etc.) may read `rpcDataMap` via
  action bodies expecting post-layout. Audit those.

### Test strategy

Existing canvas `fetchAutorun.test.ts` should still pass unchanged — it asserts
observable behavior (fetch fires, regionTooLarge handling), not internal state
shape. Add a single test that asserts `bpPerPx` change triggers an upload
re-fire **without** a refetch (complement to the existing settings-invalidate
tests).

---

## 2. Rename `renderProps() { notReady: true }` → explicit opt-out

### Status quo

`MultiRegionDisplayMixin` defaults `renderProps()` to `{ notReady: true }`.
Consumers (`svgExportUtil`, `serverSideRenderedBlock`, `SVGLinearGenomeView`)
check `.notReady` to decide whether to use the legacy block-rendering pipeline.
The name is misleading — it's not actually communicating "the display isn't
ready to render." It's saying "don't use the block renderer; use the display's
own `renderSvg` method."

### Target

Add a dedicated `useBlockRenderer` boolean (or similar) to the base display
model. GPU-family displays set it to `false` via the mixin; block-renderer
displays (chord-variant, arc, lollipop, bare) keep the default `true`.

Callers switch from `if (!display.renderProps().notReady)` to
`if (display.useBlockRenderer)`. The misleading `renderProps()` method on GPU
displays can be deleted entirely once all consumers migrate.

### Steps

1. Add `get useBlockRenderer() { return true }` to `BaseDisplayModel` (or the
   nearest block-rendering-opt-in ancestor).
2. Override `useBlockRenderer: false` in `MultiRegionDisplayMixin`.
3. Replace `isReadyOrHasError(display)` in svgExportUtil — it checks
   `renderProps().notReady || error`. Split into `display.useBlockRenderer` and
   the ready/error check it actually means.
4. Update the 3 call sites:
   - `plugins/linear-genome-view/src/LinearGenomeView/svgExportUtil.ts`
   - `plugins/linear-genome-view/src/LinearGenomeView/svgcomponents/SVGLinearGenomeView.tsx`
   - `plugins/linear-genome-view/src/BaseLinearDisplay/models/serverSideRenderedBlock.ts`
5. Delete `renderProps() { return { notReady: true } }` from the mixin. (The
   block-using displays' real `renderProps` is untouched — they still need it
   for the worker payload.)

### Risk

- `renderProps` on BaseDisplay also returns `rpcDriverName`, adapter config
  bits, `getParentRenderProps(self)` etc. — it's the legitimate payload for
  block-rendering plugins. Don't remove that; only remove the mixin's
  `{ notReady: true }` override.
- `serverSideRenderedBlock.ts:319` passes `renderProps` into RPC — that path
  only matters for block-rendering plugins. If `useBlockRenderer` is false, the
  block path never runs, so the renderProps call never happens.

### Test strategy

SVG export tests exercise `isReadyOrHasError`. Migrate those to the new shape.
No new behavior tests — this is a name change.

---

## 3. Migrate `rpcDataMap` to `observable.map`

### Status quo

Every plugin's per-region data map is a **plain JS `Map`** stored as MST
volatile. Updates construct a new Map on every insert:

```ts
setRpcDataForRegion(regionNumber, data) {
  const next = new Map(self.rpcDataMap)
  next.set(regionNumber, data)
  self.rpcDataMap = next
}
```

This triggers whole-map identity change on every write. The upload autorun's
single walk over `dataMap.entries()` re-uploads every region on every per-region
write.

### Target

Use `observable.map<number, T>()` and mutate in place:

```ts
setRpcDataForRegion(regionNumber, data) {
  self.rpcDataMap.set(regionNumber, data)
}
```

Combined with `observable.map`'s per-key reactivity, this is the foundation for
per-region upload autoruns — plugins would re-upload only changed regions, not
the whole map. **Currently the framework doesn't exploit per-key reactivity**,
but this change makes it possible without a follow-up rewrite of every plugin
setter.

### Steps

Per plugin (wiggle, multi-wiggle, canvas, alignments, variants,
linear-comparative-view synteny — 6+ plugins):

1. Change volatile declaration from `new Map<…, …>()` to
   `observable.map<…, …>()`.
2. Change setter bodies from "copy-then-set" to `self.map.set(…, val)`.
3. Change clear methods to `self.map.clear()` instead of `= new Map()`.
4. Verify the upload autorun's read of `self.rpcDataMap.size` and `.entries()`
   still tracks correctly — mobx's observable-map has proper per-key tracking
   baked in.

### Risk

- MST `volatile` with `observable.map` — verify MST's reactivity behaves
  correctly. MST volatile is already a mobx observable box, so wrapping a map
  inside should be fine, but worth verifying in isolation.
- Per-region cache contract: the framework's upload autorun walks
  `dataMap.entries()` and re-uploads every region on every fire. observable.map
  tracks per-key reads — if the autorun only reads the one key that changed (not
  all keys), per-key reactivity kicks in. Currently the framework walks all
  keys, so **this change alone doesn't speed anything up** — the framework also
  needs to evolve.

### Follow-up (beyond this item)

Add per-region upload tracking to `startGpuBackendAutorunLifecycle`: one outer
autorun watching the set of keys, spawning/disposing inner autoruns per key.
Each inner autorun reads one entry and calls `upload()` for just that region.
Documented as `#1` in `RPCPROPS_GPUPROPS_NEXT_STEPS.md`.

### Test strategy

Existing fetch/upload tests should pass unchanged. Add one regression test:
write to one region's entry, assert that `rpcDataMap.get(other)` returns the
unchanged value (not a new reference).

---

## 4. Canvas `showLabels` / `showDescriptions` — relayout, don't refetch

### Status quo

`showLabels` and `showDescriptions` flow through `display.displayConfigSnapshot`
→ `rpcProps.displayConfig`. Changing either triggers `SettingsInvalidate` →
`clearAllRpcData` → full refetch. But the worker's output (`FeatureDataResult`'s
flatbush + geometry) doesn't depend on label placement — it's a pure
viewport-space derivation that the main thread redoes in
`relayoutForCurrentZoom`.

**Today both paths fire**: refetch (clears rpcDataMap, fetch re-runs with
`showLabels=true`) AND the relayout autorun fires on the label change. After
refetch, new data overwrites whatever relayout produced on the cleared map.
Wasted RPC roundtrip.

### Target

Remove `showLabels` / `showDescriptions` from the RPC payload. They become
main-thread-only, driven by the existing relayout autorun.

### Steps

1. In `baseModel.ts`, extract the label fields out of the `displayConfig` spread
   into `rpcProps`. Either:
   - Override `displayConfigSnapshot` for `rpcProps` purposes to exclude these
     fields, or
   - Build `displayConfig` for RPC from a reduced set.
2. Audit the worker (`RenderFeatureDataRPC`) to confirm it doesn't read
   `showLabels` / `showDescriptions`. If it does, move that logic to the
   main-thread layout.
3. Verify that the relayout autorun (or the derived layout view from item #1)
   still fires on label changes.

### Risk

- Worker may use these for layout decisions (e.g. glyph sizing accommodating
  labels). If so, this item blocks until worker logic moves to main thread —
  which is also item #1's direction.
- Fixing this cleanly probably wants to be done **after** item #1, since the
  derived-layout architecture makes label-driven relayout declarative rather
  than requiring an autorun.

### Test strategy

Add a fetchAutorun test: `setShowLabels(!showLabels)` does NOT trigger an RPC
call (asserting the refetch-elimination).

---

## Dependencies / suggested order

```
#2 (renderProps rename) ─── independent, low risk, do first
#1 (derived layout) ─── unlocks #4
#4 (label-relayout-only) ─── depends on #1
#3 (observable.map) ─── independent, but only valuable alongside
                         a follow-up framework rewrite to per-key
                         upload autoruns
```

`#2` is the cleanest quick win. `#1` + `#4` should likely be one PR — they share
the "layout is derived" mental model. `#3` is infrastructure that only pays off
with the follow-up framework work, so schedule them together.

---

## Invariants to preserve (tested)

When doing any of the above, existing tests lock in the refactor contract:

- `plugins/wiggle/src/LinearWiggleDisplay/fetchAutorun.test.ts`
- `plugins/canvas/src/LinearBasicDisplay/fetchAutorun.test.ts`
- `plugins/alignments/src/LinearAlignmentsDisplay/fetchAutorun.test.ts`

Each asserts which field changes trigger refetch vs re-upload vs render-only.
Items above should not weaken those assertions.
