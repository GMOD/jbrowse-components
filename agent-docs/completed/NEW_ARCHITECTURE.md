# GPU Rendering Architecture (post-MST-migration)

Target architecture for all GPU-accelerated display types. The old
`agent-docs/ARCHITECTURE.md` still describes the pre-refactor React-effect
pattern; this document supersedes its "Upload/render lifecycle" and
"Plugin-level Backend interfaces" sections.

**Status:** 9 of ~9 LGV-family display types use this pattern. Dotplot and
synteny use a related pattern (view-owned canvas + per-display upload) and will
be migrated to share the same util via the geometry-keyed extension; see
`DOTPLOT_REFACTOR.md` and `SYNTENY_REFACTOR.md`.

---

## One-liner

Every GPU display has an MST model that owns an `autorun` which observes MST
views and per-region data, calls the backend's upload/prune/render methods, and
produces a disposable handle. React components are thin bridges that create a
canvas, hand the resulting backend to the model, and render JSX — nothing more.

---

## Layers

```
RPC worker returns data
        │
        ▼ self.setRpcData(n, data)   (or equivalent)
MST model
  ├─ .volatile rpcDataMap: Map<number, Data>
  ├─ .volatile gpuBackendLifecycleHandle, canvasDrawn   (from GpuBackendLifecycleSlotMixin,
  │                                                       which MultiRegionDisplayMixin composes)
  ├─ .views (cached getters):
  │     get renderBlocks()    (inherited from MultiRegionDisplayMixin)
  │     get renderState()     (plugin-specific)
  └─ .actions:
        startGpuBackendLifecycle(backend)
          → self.startMultiRegionGpuLifecycle({...adapters...})
                  (or self.startSingleDataGpuLifecycle({...}) for global-upload)
        stopGpuBackendLifecycle()           (from mixin)
        renderNow()                         (from mixin)
        markCanvasDrawn()                   (from mixin; idempotent)

React component (observer, ~30 lines)
  ├─ useGpuRenderer(canvasRef, RendererFactory, {
  │    onReady: backend => model.startGpuBackendLifecycle(backend),
  │    onDispose: () => model.stopGpuBackendLifecycle(),
  │  })
  ├─ useTabVisibilityRerender(() => model.renderNow())
  └─ JSX (canvas + overlays + error UI)
```

---

## Three backend families, three utilities

### A. Multi-region display (wiggle, canvas, variants pileup, alignments)

Backend shape:

```ts
interface MultiRegionBackend<Data, State> {
  uploadRegion(displayedRegionIndex: number, data: Data): void
  pruneRegions(activeDisplayedRegionIndices: number[]): void
  renderBlocks(blocks: RenderBlock[], state: State): void
  dispose(): void
}
```

Lifecycle utility: `startGpuBackendAutorunLifecycle<Backend, State>`. Runs **one
autorun per upload entry** (reading its data map and calling `upload` for every
region — mobx tracks every observable `upload` reads) and **one render autorun**
(reading `renderBlocks`, `renderState`, and a shared upload counter).
Render-state-only changes (e.g. hover) re-fire only the render autorun.

Plugins call the mixin wrapper, not the util directly — the wrapper auto-wires
`markCanvasDrawn` onto post-commit, owns the handle slot, and disposes any prior
handle:

```ts
self.startMultiRegionGpuLifecycle({
  backend,
  uploads: [
    {
      getData: () => self.rpcDataMap,
      upload: (b, n, data) => b.uploadRegion(n /* plugin-specific args */),
      prune: (b, active) => b.pruneRegions(active), // optional
      deleteOne: (b, n) => b.deleteRegion(n), // optional — for shared backends
    },
  ],
  renderBlocks: () => self.renderBlocks, // or gated: domain ? self.renderBlocks : []
  renderState: () => self.renderState,
  render: (b, blocks, state) => b.renderBlocks(blocks, state),
  // onAfterCommit: optional — only when default markCanvasDrawn isn't right.
  // Wiggle uses this to gate the mark on `self.domain`.
})
```

**Multiple upload pipelines** (alignments: pileup + arcs) are separate entries
in the `uploads` array. Each entry's autorun runs independently. Entries that
share backend region slots (arcs share pileup's prune) can omit `prune`.

**No per-region cache.** Any observable `upload()` reads is tracked — on change
the upload autorun fires and re-uploads every region in the data map. "Mobx is
the cache." Plugins whose upload bytes depend on settings (e.g. wiggle colors,
multi-wiggle sources) read those settings inside `upload` via `self.gpuProps()`
— no separate invalidation token needed.

**Contract:** per-region value objects must be freshly constructed on update
(never mutated in place). Enforced by convention in `setLoadedRegion`
on `MultiRegionDisplayMixin` — plugin setters like `setRpcData` follow
the same spread-then-assign pattern.

### B. Global-upload display (HiC, LD, variant-matrix)

Backend shape:

```ts
interface GlobalBackend<State> {
  /* one or more plugin-specific upload methods */
  render(state: State): void
  dispose(): void
}
```

Lifecycle utility: `startGpuSingleDataBackendAutorunLifecycle<Backend, State>`,
called via the mixin wrapper:

```ts
self.startSingleDataGpuLifecycle({
  backend,
  uploads: [
    { getData: () => self.rpcData,     upload: (b, d) => b.uploadData(...) },
    { getData: () => self.colorScheme, upload: (b, s) => b.uploadColorRamp(...) },
  ],
  renderState: () => self.renderState,
  render: (b, state) => b.render(state),
  // onAfterCommit: optional — default fires markCanvasDrawn once every slot
  // has data.
})
```

Each entry is independently identity-diffed (`lastUploaded[i] !== data`). Render
is only issued after every entry has data. A plugin whose uploads are coupled
(LD: data + color ramp both derive from the same `rpcData` object) can put both
in one entry's `upload`; a plugin whose uploads are independent (HiC: contact
matrix bytes vs. color-ramp bytes) should use separate entries so a colorScheme
change doesn't re-upload contact data.

### C. Geometry-keyed display (dotplot, synteny) — pending migration

Backend shape:

```ts
interface GeometryBackend<Key, Data, State> {
  resize(width: number, height: number): void
  uploadGeometry(key: Key, data: Data): void
  deleteGeometry(key: Key): void
  render(state: State): void
  dispose(): void
}
```

Distinguishing trait: **the canvas + render lifecycle live on the view**, not on
a display. Each display under the view contributes upload geometry keyed by its
track index. The view aggregates per-track render state and issues a single
draw.

Migration path lands without naming overrides on the util — both families
coexist via plugin-supplied callbacks:

- Each display uses `startMultiRegionGpuLifecycle` with `deleteOne` on its
  upload entry (per-key cleanup for shared backends, alongside the active-set
  `prune`). Display's `renderState` returns `undefined` to disable the render
  pass at the display level.
- The view uses `startSingleDataGpuLifecycle` with empty `uploads: []` (the
  empty-entry path treats `allPresent` as true so render fires on state alone)
  and a `renderState` that aggregates each display's per-track render
  parameters.

See `DOTPLOT_REFACTOR.md` and `SYNTENY_REFACTOR.md` for the per-plugin detail.

---

## Shared MST building blocks

### `GpuBackendLifecycleSlotMixin()`

Owned canvas-draw state and the single entry point plugins use to start a
lifecycle. Composed by `MultiRegionDisplayMixin` (so every region display
inherits it) and by any non-region GPU display directly. Provides:

| Provision                                   | Purpose                                                                                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `volatile canvasDrawn: boolean`             | Read by overlays / loading UI. Lives here because it's a property of the GPU draw lifecycle.                                                                 |
| `volatile gpuBackendLifecycleHandle`        | Stores the `{ dispose, renderNow }` handle the utils return. Undefined before lifecycle start and after stop.                                                |
| `setCanvasDrawn(val)` action                | Idempotent — early-returns when value is unchanged.                                                                                                          |
| `markCanvasDrawn()` action                  | Idempotent shortcut for `setCanvasDrawn(true)`. Used by the wrapper's auto-wired post-commit hook.                                                           |
| `stopGpuBackendLifecycle()` action          | Disposes the handle + clears the slot. React component calls this in `useGpuRenderer`'s `onDispose`.                                                         |
| `renderNow()` action                        | Forwards to the handle's `renderNow`. React component calls via `useTabVisibilityRerender`.                                                                  |
| `startMultiRegionGpuLifecycle(args)` action | Wraps `startGpuBackendAutorunLifecycle` — auto-wires `markCanvasDrawn` onto post-commit, assigns the handle. Plugin's `startGpuBackendLifecycle` calls this. |
| `startSingleDataGpuLifecycle(args)` action  | Same, wrapping `startGpuSingleDataBackendAutorunLifecycle`.                                                                                                  |

When a plugin passes its own `onAfterCommit` to either wrapper, the wrapper
defers to it (no default mark). Wiggle uses this to gate `markCanvasDrawn` on
`self.domain`.

### `MultiRegionDisplayMixin` additions (in `plugin-linear-genome-view`)

Every LGV-based display composes this; it composes
`GpuBackendLifecycleSlotMixin` internally so plugins inherit the GPU slot for
free. Provides:

- Cached `renderBlocks` getter = `buildRenderBlocks(view.visibleRegions)`.
  Plugins that want to suppress rendering in some state (e.g. no domain yet) do
  so in the `renderBlocks` callback passed to `startMultiRegionGpuLifecycle` —
  not by overriding the getter. Example:
  `renderBlocks: () => self.domain ? self.renderBlocks : []`.
- `fullyDrawn` getter = `canvasDrawn && !isLoading` (composes the slot mixin's
  `canvasDrawn` with this mixin's RPC fetch state).
- Documented upload-identity contract on `setLoadedRegion`.

---

## Why MST, not React, owns the autorun

Three concerns that were tangled in the old React-effect pattern:

1. **Reactive upload + render** (MobX's job — autorun on observables).
2. **Canvas / WebGL context lifecycle** (React's job — `useGpuRenderer` still).
3. **DOM side effects** (React's job — scroll handlers, tooltips, overlays).

The old pattern had #1 wearing React clothing:
`useEffect(() => autorun(…), [])`, `dataVersion` counters to signal MobX through
React's render cycle, refs to persist across renders. MST-driven autorun moves
#1 where it belongs: in the model, where cached getters memoize derived state
and autoruns react to observable reads without a React round-trip.

Practical benefits:

- **No `useMemo` in display components.** Derived state lives as a cached MST
  view that's observed automatically.
- **No `dataVersion` read ceremony.** The autorun runs inside MobX's
  transaction; there's no React-commit-cycle sync point to synchronize with.
- **No `lastDataMap` / `lastUploaded` refs in components.** The util owns its
  identity-diff cache inside the autorun closure.
- **Consistent dispose semantics** via the mixin, so context-loss and
  component-unmount produce identical tear-down.

The DOM-overlay frame-sync concern that motivated canvas's original
`useLayoutEffect` usage turned out to be benign in practice — MobX fires the
autorun synchronously within the same transaction that triggers the
observer-driven React render, so DOM and GPU commit in the same event loop tick.
Canvas migrated to the MST pattern without visible shear.

---

## Where `renderState` lives

Every display has a cached MST view `get renderState()` that returns the
plugin-specific per-frame state object. The autorun reads this getter, so any
observable read during its computation (view's `bpPerPx`, model's `height`, any
model-owned scrollTop, etc.) automatically participates in the reactive
dependency graph. Returning `undefined` tells the util to skip render this pass
(but still run upload/prune).

Plugin `renderState` shapes vary freely — there's no shared base type. The
util's generic `RenderStateType` keeps each plugin's type local.

---

## Where `displayedRegionIndex` lives

`displayedRegionIndex` is the zero-based index into `view.displayedRegions` — the user's
configured region list. **Not** an index into `dynamicBlocks.contentBlocks`. A
single displayedRegion can produce multiple on-screen render blocks sharing one
GPU buffer (different scissor clips).

See `agent-docs/ARCHITECTURE.md`'s "displayedRegionIndex" section for the full
explanation — that section was rewritten to be accurate.

Pending: rename to `displayedRegionIndex` across ~550 sites (Tier 3 of the
migration plan). The name stays `displayedRegionIndex` for now to minimize churn
mid-migration.

---

## Adding a new GPU display type

1. **Define types** — `MyData`, `MyRenderState`, and (if GPU) `MyBackend`.
   Backend interface follows one of the three families above.

2. **Shaders** — WGSL + GLSL, with `// SYNC:` comments for shared offsets. Same
   as before, no change.

3. **GPU + Canvas2D renderers + factory** — `initDualBackend<MyBackend>` from
   `packages/core/src/gpu/createDualRenderer.ts`. Same as before.

4. **MST model:**
   - Compose `MultiRegionDisplayMixin()` (LGV-family) — that brings the GPU slot
     mixin in. Non-region displays compose `GpuBackendLifecycleSlotMixin()`
     directly.
   - Add cached `renderState` view (and override `renderBlocks` only if you need
     plugin-specific gating — otherwise inherit).
   - Add `startGpuBackendLifecycle(backend)` action calling
     `self.startMultiRegionGpuLifecycle({…})` or
     `self.startSingleDataGpuLifecycle({…})`. No
     `assignGpuBackendLifecycleHandle`, no `canvasReadinessOwner` — the wrapper
     handles both.
   - Per-region setters must produce fresh value objects — never mutate in
     place.

5. **React component** — `observer()`, with:
   - `const canvasRef = useRef<HTMLCanvasElement>(null)`
   - `useGpuRenderer(canvasRef, MyRenderer, { onReady, onDispose })` where
     `onReady: b => model.startGpuBackendLifecycle(b)` and `onDispose` mirrors.
   - `useTabVisibilityRerender(() => model.renderNow())`
   - JSX: canvas + any overlays.

That's the whole template. The upload/render lifecycle is not something the
plugin author touches — it lives in the utility, tested once.

---

## Files

**Core utilities** (in `packages/core/src/gpu/`):

- `startGpuBackendAutorunLifecycle.ts` + test
- `startGpuSingleDataBackendAutorunLifecycle.ts` + test
- `GpuBackendLifecycleSlotMixin.ts`
- `renderBlock.ts` (`buildRenderBlocks`, `RenderBlock` type)
- `createDualRenderer.ts` (`initDualBackend`)
- `hal/` (the HAL — unchanged by this migration)

**Shared mixin** (in
`plugins/linear-genome-view/src/BaseLinearDisplay/models/`):

- `MultiRegionDisplayMixin.ts` (now provides cached `renderBlocks`)

**Exemplar migrated plugins** (study in this order when ramping up):

1. `plugins/wiggle/src/LinearWiggleDisplay/model.ts` — simplest
2. `plugins/wiggle/src/MultiLinearWiggleDisplay/model.ts` — multi-source
3. `plugins/canvas/src/LinearBasicDisplay/baseModel.ts` — uses MST-side
   scrollTop
4. `plugins/hic/src/LinearHicDisplay/model.ts` — multi-slot global-upload
5. `plugins/variants/src/LDDisplay/shared.ts` — single-slot global-upload
6. `plugins/variants/src/MultiVariantMatrixDisplay/model.ts` — composes mixin at
   plugin level (vs. at shared-model level)

---

## The `rpcProps` / `gpuProps` pattern

Every migrated display exposes domain-named getters that name **what affects
rendering output**. Each getter is the **single source of truth** used by both
its data-pipeline consumer and its invalidation mechanism, so adding a field
auto-wires both jobs:

| Getter        | Consumer                                                                    | Invalidation route                                                                                                                                                                |
| ------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rpcProps`    | `rpcManager.call(..., { ...self.rpcProps, ... })` — literal RPC payload     | Mixin-owned `SettingsInvalidate` autorun reads `void self.rpcProps`; on change → `clearAllRpcData` → fetch re-runs                                                                |
| `gpuProps()`  | `buildSourceRenderData(data, self.gpuProps())` (typed input to the encoder) | The upload autorun reads `self.gpuProps()` inside `upload()` — any tracked field change re-fires it, re-uploading every region. No RPC roundtrip and no separate token mechanism. |
| `renderState` | `backend.renderBlocks(blocks, state)` per frame                             | Framework's render autorun fires when `renderState` identity changes                                                                                                              |

`gpuProps` is only present where the main thread does buffer encoding (wiggle).
Canvas's worker pre-builds the GPU buffer, so canvas has only `rpcProps`.
Linear-comparative-view also has only `rpcProps`. Alignments folds every
refetch-invalidating field into a single `rpcProps` (including
`showLinkedReads`, `showArcs`, `drawInter`, `drawLongRange` which are
main-thread post-fetch decision fields rather than literal RPC payload) because
they all need new data when they change — sending the extras to the worker is
harmless.

HiC, LD, and the multi-sample variants family also expose `rpcProps`, but they
don't use `MultiRegionDisplayMixin`'s FetchVisibleRegions pipeline. Their fetch
is a single monolithic `autorun` in `afterAttach.ts` (HiC/LD) or
`getVariantCellDataAutorun.ts` (variants). The autorun reads
`void self.rpcProps` once (so every field participates in the dependency graph)
and the RPC call spreads `...self.rpcProps`. The autorun running IS the refetch.

### Why two mechanisms

Splitting refetch from re-upload removes wasted RPC roundtrips. A wiggle color
change re-encodes the per-instance buffer but the worker output is unchanged —
so it should re-upload, not refetch. The upload autorun calls `upload()` which
reads `self.gpuProps()` — mobx tracks every field read inside, so any gpuProps
change re-fires the autorun and re-uploads every region with no RPC call.

A wiggle `bicolorPivot` change is different — the worker uses it to split
features into pos/neg arrays, so the data itself changes. That goes through the
mixin's `SettingsInvalidate` → `clearAllRpcData` → fetch re-runs.

### The structural guarantee

`rpcProps` is **the** RPC payload — the same object is spread into the RPC call
AND read by the mixin's invalidation autorun. Adding a field auto-flows to both.

`gpuProps()` is **the typed input** to `buildSourceRenderData`. The function's
signature accepts `WiggleGpuProps`, so removing or mistyping a field is a
TypeScript error at the call site. The upload autorun calls `self.gpuProps()`
inside `upload()` — so any observable tracked there participates in the upload
autorun's dependency graph. The chain holds end-to-end without a separate
invalidation token.

## Invalidation via `rpcProps`

`MultiRegionDisplayMixin` owns a single `SettingsInvalidate` autorun:

```ts
// in MultiRegionDisplayMixin.afterAttach
autorun(
  () => {
    void self.rpcProps
    self.clearAllRpcData()
  },
  { name: 'SettingsInvalidate' },
)
```

Plugins (wiggle, canvas, alignments, linear-comparative-view) just override the
`rpcProps` view; the mixin-owned autorun handles the rest. There is no
per-plugin invalidation boilerplate. The chain
`clearAllRpcData → loadedRegions empty → FetchVisibleRegions re-fetches → new rpcDataMap entries → upload autorun re-uploads`
is identical to before — it's just wired at the mixin layer now.

A subclass that never overrides `rpcProps` inherits the default (returns
`undefined`), in which case the autorun tracks no observables — it fires once at
setup on empty data (a no-op) and then never again.

For plugins whose fetch is a monolithic `autorun` (HiC, LD, variants
multi-sample family), the fetch autorun itself reads `void self.rpcProps` and
spreads `...self.rpcProps` into the RPC call. These plugins define their own
`afterAttach()` that does **not** call `superAfterAttach()`, so the mixin's
`FetchVisibleRegions` and `SettingsInvalidate` autoruns never install — their
monolithic autorun does the equivalent job inline, owning both the dep-tracking
and the fetch trigger.

The first run also fires (mobx behavior on creation) and clears an already-empty
`rpcDataMap` — a no-op that just bumps `fetchGeneration` to 1 before the
FetchVisibleRegions delay (300ms) elapses.

For plugins whose post-fetch processing requires RPC data (alignments), also
include `void self.gpuProps` so changes that need different post-fetch data
still refetch.

## Caveats

**Coupled getters.** A getter consumed by both `rpcProps` and `gpuProps` (e.g.
wiggle's `effectiveBicolorPivot` reads `color`) means changing the
"gpuProps-side" field can refetch. This is correct — the worker output genuinely
changes — but it's worth knowing when reasoning about test behavior. Wiggle's
test uses `posColor` (uncoupled) to assert the "no-refetch on gpuProps change"
path.

**Settings consumed only by `renderState` don't go in `rpcProps`/`gpuProps`.**
Things like `scaleType` in wiggle (which only affects a per-frame uniform) are
picked up by the GPU render autorun automatically when `renderState`'s identity
changes — no refetch and no upload needed. `wiggle/.../fetchAutorun.test.ts`
includes a positive test that `setScaleType` does NOT trigger a refetch.

**Don't enumerate by hand-writing a JSON key.** The pre-migration pattern
(`const key = JSON.stringify({...}); if (key !== prev) clearAllRpcData()`)
required maintaining a separate list of fields. The current shape pushes the
list into the domain-named getter that's _already_ the source of truth for the
consumer.

**Don't number autoruns** (`Autorun 1: …, Autorun 2: …`). Give each a
descriptive comment naming its purpose.

## Legacy `renderProps()` / `renderingProps()`

The pre-migration architecture had two getters:

- `renderProps()` — props sent to the worker-side renderer. **Replaced by
  `rpcProps`**.
- `renderingProps()` — props passed to the React Rendering component (e.g.
  `PileupRendering`). Mostly unused in the new architecture: React components
  observe the model directly via mobx instead.

GPU-migrated displays still expose `renderProps()` returning
`{ notReady: true }` for SVG-export compatibility (`svgExportUtil.ts`); do not
add fields to it or rely on it for change detection.

Tested patterns: `fetchAutorun.test.ts` files under
`plugins/wiggle/src/LinearWiggleDisplay/`,
`plugins/canvas/src/LinearBasicDisplay/`, and
`plugins/alignments/src/LinearAlignmentsDisplay/`. Wiggle's suite asserts all
four invalidation behaviors:

- `bicolorPivot` (rpcProps) → refetch
- `resolution` (rpcProps) → refetch
- `summaryScoreMode` (gpuProps) → no refetch
- `posColor` (gpuProps) → no refetch
- `scaleType` (renderState only) → no refetch
- `displayCrossHatches` (UI only) → no refetch

---

## What to NOT do

- Don't put upload/render logic in React `useEffect` or `useLayoutEffect` inside
  display components. It belongs in the MST autorun.
- Don't add `dataVersion` reads at plugin level. The new util doesn't need them;
  `dataVersion` still exists on `MultiRegionDisplayMixin` as a debug counter but
  the autorun doesn't depend on it.
- Don't destructure model methods
  (`const { startGpuBackendLifecycle } = model`). Always call as
  `model.startGpuBackendLifecycle(...)`.
- Don't write explicit TypeScript return types on MST views/actions. Infer.
- Don't use `useMemo` to derive observable-dependent values. Move it to a cached
  MST view.
- Don't mutate per-region values in place. Produce a fresh object so identity
  diffing works.
- Don't call `startGpuBackendAutorunLifecycle` /
  `startGpuSingleDataBackendAutorunLifecycle` directly from a plugin — go
  through `self.startMultiRegionGpuLifecycle` /
  `self.startSingleDataGpuLifecycle`. The mixin owns handle assignment, dispose,
  and `markCanvasDrawn` wiring.
- Don't redefine `canvasDrawn` / `setCanvasDrawn` on a plugin model — the slot
  mixin owns them. Use `markCanvasDrawn()` for "first draw happened" signaling.

---

## See also

- `MST_AUTORUN_MIGRATION.md` — current status, remaining tiers, user
  preferences, non-obvious gotchas encountered during the migration.
- `ARCHITECTURE.md` — original architecture document, still accurate for parts
  not touched by this migration (HAL, shaders, BP-precision handling, renderer
  selection, tab-visibility quirks, etc.). The "Upload/render lifecycle" section
  is stale.
