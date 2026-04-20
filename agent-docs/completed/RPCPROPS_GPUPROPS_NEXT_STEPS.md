# `rpcProps` / `gpuProps` + GPU Lifecycle Refactor — Next Steps

Continuation document for the work that consolidated the GPU upload lifecycle
around two domain-named getters (`rpcProps`, `gpuProps`) and collapsed the
`startGpuBackendAutorunLifecycle` framework to its simplest mobx-native form.

See `NEW_ARCHITECTURE.md` for the canonical description of the resulting
pattern. This file is the ledger of what's done, what's deferred, and the known
sharp edges.

---

## What landed

### Framework (`packages/core/src/gpu/`)

- `startGpuBackendAutorunLifecycle.ts` — rewritten to ~170 lines.
  - One autorun per `RegionUpload`. Reads `getData()` and calls `upload()` for
    every region. mobx auto-tracks anything `upload()` reads (data + whatever
    `gpuProps()` reads + …); on any change the autorun re-fires and re-uploads
    every region.
  - One render autorun. Reads `renderBlocks()` + `renderState()` + a shared
    upload counter that every upload bumps. Hover-only state changes re-fire
    only render.
  - **Removed**: per-region cache, `identityOf`, `getUploadInvalidationToken`,
    `gpuProps` option, `INITIAL_TOKEN` sentinel, single-stream sugar.
- `startGpuSingleDataBackendAutorunLifecycle.ts` — renamed for symmetry:
  `uploadSlots`→`uploads`, `readData`→`getData`, `commitUpload`→`upload`,
  `getRenderState`→`renderState`, `renderWithState`→`render`.
- `GpuBackendLifecycleSlotMixin.ts` — generic param signature simplified
  (`StartGpuBackendAutorunLifecycleArgs<BackendType, RenderStateType>`; no more
  `RegionDataType`).
- All five tests in this directory updated and passing (170/170).

### Plugin migrations

All seven multi-region GPU display plugins migrated to the new framework shape
(`uploads: [{getData, upload, prune?, deleteOne?}]`, `renderBlocks`,
`renderState`, `render`):

- `plugins/wiggle/src/LinearWiggleDisplay/model.ts` — also has `rpcProps`
  - `gpuProps` getters/methods with `WiggleGpuProps` typed interface.
- `plugins/wiggle/src/MultiLinearWiggleDisplay/model.ts` — same pattern;
  `gpuProps` includes `sources` array; `MultiWiggleGpuProps` interface.
- `plugins/canvas/src/LinearBasicDisplay/baseModel.ts` — `rpcProps` consolidates
  `displayConfigOverrides + extraRpcArgs` (extension hooks retained for subclass
  composition); `settingsCacheKey` getter removed.
- `plugins/alignments/src/LinearAlignmentsDisplay/model.ts` — `rpcProps`
  consolidates filterBy/colorBy/sortedBy/etc. for both pileup + chain RPC;
  `gpuProps` covers showLinkedReads/showArcs/drawInter/drawLongRange and routes
  through `SettingsInvalidate` (refetch) — see "alignments" caveat below.
- `plugins/linear-comparative-view/src/MultiLGVSyntenyDisplay/model.ts` —
  `rpcProps` (just `resolution`); `SettingsInvalidate` autorun simplified to
  `void self.rpcProps; clearAllRpcData()`.
- `plugins/linear-comparative-view/src/LinearSyntenyViewHelper/stateModelFactory.ts`
  — wired to new `uploads:` array shape with `deleteOne` for shared backend.
- `plugins/dotplot-view/src/DotplotDisplay/stateModelFactory.tsx` — upload-only
  stream (no prune; backend shared with sibling displays).
- `plugins/variants/src/MultiVariantDisplay/model.ts` — wired to new shape. **No
  `identityOf` anymore** — variant cell data re-uploads on every wholesale Map
  replacement (see "variants" caveat).
- `plugins/variants/src/MultiVariantMatrixDisplay/model.ts`,
  `plugins/variants/src/LDDisplay/shared.ts`,
  `plugins/hic/src/LinearHicDisplay/model.ts`,
  `plugins/dotplot-view/src/DotplotView/model.ts` — single-data variants updated
  to renamed API.

### `SettingsInvalidate` autorun shape

Every plugin's `SettingsInvalidate` autorun is now identical in structure: read
the relevant getter(s), call `clearAllRpcData()`, no JSON key, no `prev`
variable, no comparison. mobx fires on tracked changes; the fire IS the
invalidation signal.

### Tests

- New: `plugins/wiggle/src/LinearWiggleDisplay/fetchAutorun.test.ts` — 6 tests
  asserting:
  - `bicolorPivot` (rpcProps) → refetch
  - `resolution` (rpcProps) → refetch
  - `summaryScoreMode` (gpuProps) → no refetch
  - `posColor` (gpuProps) → no refetch (uses `posColor` not `color` to avoid the
    `effectiveBicolorPivot` coupling)
  - `scaleType` (renderState only) → no refetch
  - `displayCrossHatches` (UI only) → no refetch

### Docs

- `agent-docs/NEW_ARCHITECTURE.md` — section rewritten:
  - Added `rpcProps`/`gpuProps`/`renderState` table.
  - Documented two-mechanism split (refetch vs re-upload).
  - Documented the `effectiveBicolorPivot`-style coupled-getter caveat.
  - Documented legacy `renderProps()`/`renderingProps()` status.
- This file (`RPCPROPS_GPUPROPS_NEXT_STEPS.md`) created.

---

## Trade-offs accepted (potential perf regressions)

The framework now has **zero per-region cache**. When any tracked observable
changes, the upload autorun fires and re-uploads **every region in the data
map**. This is the deliberate "mobx is the cache" choice, requested explicitly:

> "the better our architecture the less manual 'identity diffing' we will need
> to do (ideally zero); that should be handled by react and mobx itself"

**Where it's fine:**

- wiggle: 3–10 visible regions, small typed-array buffers per region.
- canvas: same.
- linear-comparative-view, synteny: small geometry.

**Where it could bite:**

- **alignments**: pileup data per region can be MB-sized. When one new region's
  pileup data arrives, all visible regions re-upload. Could introduce
  ~tens-of-ms hitches on scroll-into-new-region.
- **variants**: previously used `identityOf: d => d.inputKey` to skip re-uploads
  when cellData was wholesale-replaced with the same content. Without
  `identityOf`, every cellData replacement re-uploads everything.

**Mitigation if it bites:** add per-region autoruns back to the framework (I
prototyped this earlier in the session — it's a ~30-line addition to
`startGpuBackendAutorunLifecycle.ts` that spawns one inner autorun per key
tracked by the outer key-tracker autorun). Decision: defer until benchmarks show
it's needed.

---

## Known sharp edges & deferred work

### 1. Plugins still using JS-Map-reassignment, not `observable.map`

Every plugin's `rpcDataMap` is currently a plain JS `Map<number, T>` stored as
MST `volatile`. Updates use the
`self.rpcDataMap = new Map(self.rpcDataMap); next.set(...)` pattern. This works
under the new framework but means **every set/delete causes the whole map's
identity to change**, which fires every per-region read inside the upload
autorun (i.e. all regions re-upload regardless).

If/when we add per-region autoruns back as an optimization, plugins should
migrate to mobx `observable.map<number, T>()` and mutate in place
(`self.rpcDataMap.set(n, data)`). This is what enables true per-key reactivity.

**Rough scope per plugin**: 2–3 lines (volatile declaration +
`setRpcData` action body). Not done in this PR.

### 2. Alignments — all refetch fields now in `rpcProps` (resolved)

`showLinkedReads`, `showArcs`, `drawInter`, `drawLongRange` were folded into
`rpcProps` so the mixin-owned `SettingsInvalidate` picks them up uniformly.
`showArcs/drawInter/drawLongRange` still refetch when they only need arcs
recomputation from the existing pileup data — the known inefficiency remains.
Fixing requires splitting the arcs pipeline into its own invalidation path (or
extending the existing `recomputeArcColors` autorun to cover these fields
without refetching). Still a TODO but not urgent.

### 3. `effectiveBicolorPivot` cross-getter coupling

In wiggle, `effectiveBicolorPivot` (in `rpcProps`) reads `color` (in
`gpuProps`):

```ts
get effectiveBicolorPivot() {
  return isDefaultBicolor(this.color) ? this.bicolorPivot : -Infinity
}
```

Result: changing `color` away from the default refetches RPC because the
worker's pos/neg split changes. Correct behavior, but counter- intuitive when
reasoning about the rpcProps/gpuProps split. Test intentionally uses `posColor`
(uncoupled) to assert "gpuProps changes don't refetch."

**Possible cleanup**: route the bicolor-mode flag through the GPU buffer
encoding (main thread) instead of via the worker, eliminating the coupling
entirely. Larger refactor.

### 4. Legacy `renderProps()` getter

GPU-migrated displays still expose a `renderProps()` method returning
`{ notReady: true }` — used only by `svgExportUtil.ts` for "is the display
ready" gating. Should probably be replaced with `canvasDrawn` checks and the
method removed entirely. See `agent-docs/ARCHITECTURE_REVIEW.md:167`.

### 5. `gpuProps` is a method, but subclass override path is untested

`gpuProps` was changed from a getter to a method specifically so subclasses can
use the standard `super`-capture pattern in composed views:

```ts
.views(self => {
  const superGpuProps = self.gpuProps
  return {
    gpuProps() {
      return { ...superGpuProps(), newField: self.newField }
    }
  }
})
```

No subclass currently overrides `gpuProps`. If/when one does (e.g. `gccontent`
extending wiggle), this should Just Work but isn't tested.

### 6. Other plugins (`hic`, `LDDisplay`, `dotplot`) don't have `gpuProps`

The `gpuProps` concept hasn't been introduced to single-data displays that don't
need it (their settings are baked into the worker output or into `renderState`).
If any future global-data plugin needs main-thread GPU encoding settings, follow
the wiggle pattern (typed `XGpuProps` interface + method on the model + read
inside `upload`).

### 8. `SettingsInvalidate` is now owned by `MultiRegionDisplayMixin` (follow-up landed)

Removed from every plugin. The mixin installs a single
`autorun(() => { void self.rpcProps; self.clearAllRpcData() })` in its own
`afterAttach`. Plugins that override `rpcProps` (wiggle, canvas, alignments,
linear-comparative-view) get invalidation for free. Plugins that don't override
inherit the default (returns `undefined`) and the autorun tracks nothing — fires
once at setup as a no-op.

Plugins whose `afterAttach()` does NOT call `superAfterAttach()` (HiC, LD,
variants) don't install the mixin autoruns; their monolithic fetch autorun reads
`void self.rpcProps` directly.

### 9. Coverage extended to HiC, LD, and variants (follow-up landed)

HiC (`plugins/hic/src/LinearHicDisplay/model.ts`), LD
(`plugins/variants/src/LDDisplay/shared.ts`), and the multi-sample variants base
model (`plugins/variants/src/shared/MultiSampleVariantBaseModel.ts`) now expose
an `rpcProps` getter. Their fetch autoruns (previously hand-enumerated a list of
tracked fields with
`/* eslint-disable @typescript-eslint/no-unused-expressions */`) now do a single
`void self.rpcProps` and spread `...self.rpcProps` into the RPC call.

No separate `SettingsInvalidate` autorun for these — their fetch path is a
single monolithic autorun in `afterAttach.ts` / `getVariantCellDataAutorun.ts`,
so the fetch autorun IS the invalidation signal. Documented in
`NEW_ARCHITECTURE.md`.

Dead code purged at the same time: `identityOf` in
`MultiVariantDisplay/model.ts` and an inner `gpuProps: () => ...` in
`MultiLinearWiggleDisplay/model.ts` — both removed from the framework interface
and silently ignored.

Not yet migrated: `dotplot-view/DotplotDisplay`. Its only RPC is
`CoreGetFeatures` (regions + adapterConfig, no tunable fields), so an `rpcProps`
getter would be empty. `makeAbortableReaction` already tracks the exact set of
inputs that matter. Leaving as-is.

`MultiLGVSyntenyDisplay` migrated to `startMultiRegionGpuLifecycle`. Two upload
entries (geometry + coverage/snps/indicators), framework drives render via
`syntenyRenderState` cached getter. Removed: `gpuRenderer`/`setGpuRenderer`
volatile + action, `tabVisibilityVersion` counter + `bumpTabVisibility` action,
all three hand-written autoruns (`uploadGeometry`, `uploadCoverage`, `draw`).
Component uses `useTabVisibilityRerender(() => model.renderNow())` and the
standard `onReady: startGpuBackendLifecycle` /
`onDispose: stopGpuBackendLifecycle` pattern.

With synteny migrated, `dataVersion` on `MultiRegionDisplayMixin` has no readers
— deleted (both the volatile and the `setLoadedRegion` increment).

### 7. Many tests have pre-existing failures unrelated to this work

`Canvas2DWiggleRenderer.test.ts` had pre-existing failures on `main`. Confirmed
by `git stash` test before any changes. Not addressed.

---

## Files changed in this work

### Core framework

- `packages/core/src/gpu/startGpuBackendAutorunLifecycle.ts` — rewritten
- `packages/core/src/gpu/startGpuBackendAutorunLifecycle.test.ts` — rewritten
- `packages/core/src/gpu/startGpuSingleDataBackendAutorunLifecycle.ts` — renamed
  API
- `packages/core/src/gpu/startGpuSingleDataBackendAutorunLifecycle.test.ts` —
  updated
- `packages/core/src/gpu/GpuBackendLifecycleSlotMixin.ts` — generic params
  simplified
- `packages/core/src/gpu/GpuBackendLifecycleSlotMixin.test.ts` — updated

### Plugins

- `plugins/wiggle/src/LinearWiggleDisplay/model.ts`
- `plugins/wiggle/src/LinearWiggleDisplay/components/buildSourceRenderData.ts` —
  `WiggleGpuProps` interface
- `plugins/wiggle/src/LinearWiggleDisplay/components/WiggleComponent.tsx` —
  `COORD0` hoist
- `plugins/wiggle/src/LinearWiggleDisplay/components/WiggleComponent.test.ts` —
  drop `dataVersion`
- `plugins/wiggle/src/LinearWiggleDisplay/fetchAutorun.test.ts` — NEW
- `plugins/wiggle/src/MultiLinearWiggleDisplay/model.ts`
- `plugins/wiggle/src/MultiLinearWiggleDisplay/components/buildMultiSourceRenderData.ts`
  — `MultiWiggleGpuProps` interface
- `plugins/wiggle/src/MultiLinearWiggleDisplay/components/MultiWiggleComponent.tsx`
  — `COORD0` hoist + drop `dataVersion`
- `plugins/canvas/src/LinearBasicDisplay/baseModel.ts`
- `plugins/canvas/src/LinearBasicDisplay/model.ts` — drop `settingsCacheKey`
- `plugins/alignments/src/LinearAlignmentsDisplay/model.ts`
- `plugins/linear-comparative-view/src/MultiLGVSyntenyDisplay/model.ts`
- `plugins/linear-comparative-view/src/LinearSyntenyViewHelper/stateModelFactory.ts`
- `plugins/variants/src/MultiVariantDisplay/model.ts`
- `plugins/variants/src/MultiVariantMatrixDisplay/model.ts`
- `plugins/variants/src/LDDisplay/shared.ts`
- `plugins/hic/src/LinearHicDisplay/model.ts`
- `plugins/dotplot-view/src/DotplotView/model.ts`
- `plugins/dotplot-view/src/DotplotDisplay/stateModelFactory.tsx`

### Docs

- `agent-docs/NEW_ARCHITECTURE.md` — `rpcProps`/`gpuProps` +
  `SettingsInvalidate` sections rewritten
- `agent-docs/RPCPROPS_GPUPROPS_NEXT_STEPS.md` — this file

---

## Test status

- Core framework: **170/170 passing** (`yarn jest packages/core/src/gpu`)
- All affected plugins: **1061/1061 passing**
  (`yarn jest plugins/wiggle plugins/canvas plugins/alignments plugins/linear-comparative-view plugins/variants plugins/hic plugins/dotplot-view`)
- TypeScript: clean for `plugins/wiggle` and `plugins/canvas` (other plugins not
  yet tsc-verified individually)

---

## Suggested next session

In rough priority order:

1. **Audit alignments perf** — instrument or eyeball whether re-uploading all
   pileup regions on every change causes visible hitches. If yes, implement
   per-region autoruns in the framework (~30 lines).
2. **Migrate one plugin to `observable.map`** as proof of concept (wiggle Linear
   is smallest). Verify per-key reactivity actually flows through cleanly.
3. **Move alignments' `showLinkedReads` into `rpcProps`** and split the
   arc-related fields into a separate invalidation path on the arcs upload
   pipeline.
4. **Delete the legacy `renderProps()` method** across GPU-migrated displays
   once `svgExportUtil.ts` is updated to use `canvasDrawn`.
5. **Run a full jbrowse test suite** (not just the plugins touched) to find any
   cross-plugin breakage I missed.
6. **Verify in browser** — the test suite covers correctness but not visual
   regressions. Should manually exercise color/scaleType/ summaryScoreMode
   toggles in the dev server before merging.
