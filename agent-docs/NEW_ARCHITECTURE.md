# GPU Rendering Architecture (post-MST-migration)

Target architecture for all GPU-accelerated display types. The old
`agent-docs/ARCHITECTURE.md` still describes the pre-refactor React-effect
pattern; this document supersedes its "Upload/render lifecycle" and
"Plugin-level Backend interfaces" sections.

**Status:** 9 of ~9 LGV-family display types use this pattern. Dotplot
and synteny use a related pattern (view-owned canvas + per-display
upload) and will be migrated to share the same util via the
geometry-keyed extension; see `DOTPLOT_REFACTOR.md` and
`SYNTENY_REFACTOR.md`.

---

## One-liner

Every GPU display has an MST model that owns an `autorun` which observes MST
views and per-region data, calls the backend's upload/prune/render methods,
and produces a disposable handle. React components are thin bridges that
create a canvas, hand the resulting backend to the model, and render JSX —
nothing more.

---

## Layers

```
RPC worker returns data
        │
        ▼ self.setRpcDataForRegion(n, data)   (or equivalent)
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
  uploadRegion(regionNumber: number, data: Data): void
  pruneRegions(activeRegionNumbers: number[]): void
  renderBlocks(blocks: RenderBlock[], state: State): void
  dispose(): void
}
```

Lifecycle utility: `startGpuBackendAutorunLifecycle<Backend, Data, State>`.
Runs **two independent autoruns** — one for upload/prune, one for render.
Render-state-only changes (e.g. hover) re-fire only the render autorun,
skipping the upload cache walk.

Plugins call the mixin wrapper, not the util directly — the wrapper
auto-wires `markCanvasDrawn` onto post-commit, owns the handle slot, and
disposes any prior handle:

```ts
self.startMultiRegionGpuLifecycle({
  backend,
  // Single stream — sugar for uploadStreams: [{ … }]
  getDataByRegionNumber: () => self.rpcDataMap,
  uploadOneRegion: (b, n, data) => b.uploadRegion(n, /* plugin-specific args */),
  pruneRegionsNotIn: (b, active) => b.pruneRegions(active),
  identityOf: d => d.inputKey,                     // optional, defaults to ref
  getUploadInvalidationToken: () => self.sources,  // optional
  // Render
  getRenderBlocks: () => self.renderBlocks,        // or gated
  getRenderState: () => self.renderState,
  renderAllBlocks: (b, blocks, state) => b.renderBlocks(blocks, state),
  // onAfterCommit: optional — only when default markCanvasDrawn isn't right.
  // Wiggle uses this to gate the mark on `self.domain`.
})
```

**Multiple upload streams** (alignments: pileup + arcs) use the
`uploadStreams: [{ … }, { … }]` array form. Each stream has its own
identity-diff cache. Streams that share backend region slots can omit
`pruneRegionsNotIn` (arcs share pileup's prune).

**Contract:** per-region value objects must be freshly constructed on update
(never mutated in place) so identity diffing can detect change. This is
enforced by convention in `setLoadedRegionForRegion` on
`MultiRegionDisplayMixin` — plugin setters like `setRpcDataForRegion` follow
the same spread-then-assign pattern.

When a plugin needs to force a full re-upload because upload bytes depend on
non-region state (e.g. multi-wiggle's `sources` array reorders row indices
packed into the instance buffer), pass `getUploadInvalidationToken: () =>
self.sources`. When the token value changes (`Object.is` comparison), the
per-region cache clears.

**`identityOf`** lets plugins use a content-hash instead of reference for
the identity diff — e.g. variants' `cellData` is replaced wholesale on every
RPC result so reference-diff would re-upload everything, but per-region
`inputKey` strings stay stable when content is unchanged.

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
  uploadSlots: [
    { readData: () => self.rpcData,    commitUpload: (b, d) => b.uploadData(...) },
    { readData: () => self.colorScheme, commitUpload: (b, s) => b.uploadColorRamp(...) },
  ],
  getRenderState: () => self.renderState,
  renderWithState: (b, state) => b.render(state),
  // onAfterCommit: optional — default fires markCanvasDrawn once every slot
  // has data.
})
```

Each slot is independently identity-diffed. Render is only issued after every
slot has data. A plugin whose uploads are coupled (LD: data + color ramp both
derive from the same `rpcData` object) can put both in one slot's
`commitUpload`; a plugin whose uploads are independent (HiC: contact matrix
bytes vs. color-ramp bytes) should use separate slots so a colorScheme change
doesn't re-upload contact data.

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

Distinguishing trait: **the canvas + render lifecycle live on the
view**, not on a display. Each display under the view contributes upload
geometry keyed by its track index. The view aggregates per-track render
state and issues a single draw.

Migration path lands without naming overrides on the util — both
families coexist via plugin-supplied callbacks:

- Each display uses `startMultiRegionGpuLifecycle` with
  `deleteOneRegion` (a small extension to the multi-region util — adds
  per-deletion dispatch alongside the existing active-set
  `pruneRegionsNotIn`). Display's `getRenderState` returns `undefined`
  to disable the render pass at the display level.
- The view uses `startSingleDataGpuLifecycle` with empty
  `uploadSlots: []` (a small extension — empty-slot path treats
  `allPresent` as true so render fires on state alone) and a
  `getRenderState` that aggregates each display's per-track render
  parameters.

See `DOTPLOT_REFACTOR.md` and `SYNTENY_REFACTOR.md` for the per-plugin
detail.

---

## Shared MST building blocks

### `GpuBackendLifecycleSlotMixin()`

Owned canvas-draw state and the single entry point plugins use to start
a lifecycle. Composed by `MultiRegionDisplayMixin` (so every region
display inherits it) and by any non-region GPU display directly.
Provides:

| Provision | Purpose |
|---|---|
| `volatile canvasDrawn: boolean` | Read by overlays / loading UI. Lives here because it's a property of the GPU draw lifecycle. |
| `volatile gpuBackendLifecycleHandle` | Stores the `{ dispose, renderNow }` handle the utils return. Undefined before lifecycle start and after stop. |
| `setCanvasDrawn(val)` action | Idempotent — early-returns when value is unchanged. |
| `markCanvasDrawn()` action | Idempotent shortcut for `setCanvasDrawn(true)`. Used by the wrapper's auto-wired post-commit hook. |
| `stopGpuBackendLifecycle()` action | Disposes the handle + clears the slot. React component calls this in `useGpuRenderer`'s `onDispose`. |
| `renderNow()` action | Forwards to the handle's `renderNow`. React component calls via `useTabVisibilityRerender`. |
| `startMultiRegionGpuLifecycle(args)` action | Wraps `startGpuBackendAutorunLifecycle` — auto-wires `markCanvasDrawn` onto post-commit, assigns the handle. Plugin's `startGpuBackendLifecycle` calls this. |
| `startSingleDataGpuLifecycle(args)` action | Same, wrapping `startGpuSingleDataBackendAutorunLifecycle`. |

When a plugin passes its own `onAfterCommit` to either wrapper, the
wrapper defers to it (no default mark). Wiggle uses this to gate
`markCanvasDrawn` on `self.domain`.

### `MultiRegionDisplayMixin` additions (in `plugin-linear-genome-view`)

Every LGV-based display composes this; it composes
`GpuBackendLifecycleSlotMixin` internally so plugins inherit the GPU
slot for free. Provides:

- Cached `renderBlocks` getter = `buildRenderBlocks(view.visibleRegions)`.
  Plugins that want to suppress rendering in some state (e.g. no domain yet)
  do so in the autorun's `getRenderBlocks` callback — not by overriding the
  getter. Example: `() => self.domain ? self.renderBlocks : []`.
- `fullyDrawn` getter = `canvasDrawn && !isLoading` (composes the slot
  mixin's `canvasDrawn` with this mixin's RPC fetch state).
- Documented upload-identity contract on `setLoadedRegionForRegion`.

---

## Why MST, not React, owns the autorun

Three concerns that were tangled in the old React-effect pattern:

1. **Reactive upload + render** (MobX's job — autorun on observables).
2. **Canvas / WebGL context lifecycle** (React's job — `useGpuRenderer` still).
3. **DOM side effects** (React's job — scroll handlers, tooltips, overlays).

The old pattern had #1 wearing React clothing: `useEffect(() => autorun(…), [])`,
`dataVersion` counters to signal MobX through React's render cycle, refs to
persist across renders. MST-driven autorun moves #1 where it belongs: in the
model, where cached getters memoize derived state and autoruns react to
observable reads without a React round-trip.

Practical benefits:

- **No `useMemo` in display components.** Derived state lives as a cached
  MST view that's observed automatically.
- **No `dataVersion` read ceremony.** The autorun runs inside MobX's
  transaction; there's no React-commit-cycle sync point to synchronize with.
- **No `lastDataMap` / `lastUploaded` refs in components.** The util owns its
  identity-diff cache inside the autorun closure.
- **Consistent dispose semantics** via the mixin, so context-loss and
  component-unmount produce identical tear-down.

The DOM-overlay frame-sync concern that motivated canvas's original
`useLayoutEffect` usage turned out to be benign in practice — MobX fires the
autorun synchronously within the same transaction that triggers the
observer-driven React render, so DOM and GPU commit in the same event loop
tick. Canvas migrated to the MST pattern without visible shear.

---

## Where `renderState` lives

Every display has a cached MST view `get renderState()` that returns the
plugin-specific per-frame state object. The autorun reads this getter, so any
observable read during its computation (view's `bpPerPx`, model's `height`,
any model-owned scrollTop, etc.) automatically participates in the reactive
dependency graph. Returning `undefined` tells the util to skip render this
pass (but still run upload/prune).

Plugin `renderState` shapes vary freely — there's no shared base type. The
util's generic `RenderStateType` keeps each plugin's type local.

---

## Where `regionNumber` lives

`regionNumber` is the zero-based index into `view.displayedRegions` — the
user's configured region list. **Not** an index into
`dynamicBlocks.contentBlocks`. A single displayedRegion can produce multiple
on-screen render blocks sharing one GPU buffer (different scissor clips).

See `agent-docs/ARCHITECTURE.md`'s "regionNumber" section for the full
explanation — that section was rewritten to be accurate.

Pending: rename to `displayedRegionIndex` across ~550 sites (Tier 3 of the
migration plan). The name stays `regionNumber` for now to minimize churn
mid-migration.

---

## Adding a new GPU display type

1. **Define types** — `MyData`, `MyRenderState`, and (if GPU) `MyBackend`.
   Backend interface follows one of the three families above.

2. **Shaders** — WGSL + GLSL, with `// SYNC:` comments for shared offsets.
   Same as before, no change.

3. **GPU + Canvas2D renderers + factory** — `initDualBackend<MyBackend>` from
   `packages/core/src/gpu/createDualRenderer.ts`. Same as before.

4. **MST model:**
   - Compose `MultiRegionDisplayMixin()` (LGV-family) — that brings the
     GPU slot mixin in. Non-region displays compose
     `GpuBackendLifecycleSlotMixin()` directly.
   - Add cached `renderState` view (and override `renderBlocks` only if you
     need plugin-specific gating — otherwise inherit).
   - Add `startGpuBackendLifecycle(backend)` action calling
     `self.startMultiRegionGpuLifecycle({…})` or
     `self.startSingleDataGpuLifecycle({…})`. No `assignGpuBackendLifecycleHandle`,
     no `canvasReadinessOwner` — the wrapper handles both.
   - Per-region setters must produce fresh value objects — never mutate in
     place.

5. **React component** — `observer()`, with:
   - `const canvasRef = useRef<HTMLCanvasElement>(null)`
   - `useGpuRenderer(canvasRef, MyRenderer, { onReady, onDispose })` where
     `onReady: b => model.startGpuBackendLifecycle(b)` and `onDispose`
     mirrors.
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

**Shared mixin** (in `plugins/linear-genome-view/src/BaseLinearDisplay/models/`):
- `MultiRegionDisplayMixin.ts` (now provides cached `renderBlocks`)

**Exemplar migrated plugins** (study in this order when ramping up):
1. `plugins/wiggle/src/LinearWiggleDisplay/model.ts` — simplest
2. `plugins/wiggle/src/MultiLinearWiggleDisplay/model.ts` — uses invalidation token
3. `plugins/canvas/src/LinearBasicDisplay/baseModel.ts` — uses MST-side scrollTop
4. `plugins/hic/src/LinearHicDisplay/model.ts` — multi-slot global-upload
5. `plugins/variants/src/LDDisplay/shared.ts` — single-slot global-upload
6. `plugins/variants/src/MultiVariantMatrixDisplay/model.ts` — composes mixin at plugin level (vs. at shared-model level)

---

## What to NOT do

- Don't put upload/render logic in React `useEffect` or `useLayoutEffect`
  inside display components. It belongs in the MST autorun.
- Don't add `dataVersion` reads at plugin level. The new util doesn't need
  them; `dataVersion` still exists on `MultiRegionDisplayMixin` as a debug
  counter but the autorun doesn't depend on it.
- Don't destructure model methods (`const { startGpuBackendLifecycle } =
  model`). Always call as `model.startGpuBackendLifecycle(...)`.
- Don't write explicit TypeScript return types on MST views/actions. Infer.
- Don't use `useMemo` to derive observable-dependent values. Move it to a
  cached MST view.
- Don't mutate per-region values in place. Produce a fresh object so identity
  diffing works.
- Don't call `startGpuBackendAutorunLifecycle` /
  `startGpuSingleDataBackendAutorunLifecycle` directly from a plugin — go
  through `self.startMultiRegionGpuLifecycle` / `self.startSingleDataGpuLifecycle`.
  The mixin owns handle assignment, dispose, and `markCanvasDrawn` wiring.
- Don't redefine `canvasDrawn` / `setCanvasDrawn` on a plugin model — the
  slot mixin owns them. Use `markCanvasDrawn()` for "first draw happened"
  signaling.

---

## See also

- `MST_AUTORUN_MIGRATION.md` — current status, remaining tiers, user
  preferences, non-obvious gotchas encountered during the migration.
- `ARCHITECTURE.md` — original architecture document, still accurate for
  parts not touched by this migration (HAL, shaders, BP-precision handling,
  renderer selection, tab-visibility quirks, etc.). The "Upload/render
  lifecycle" section is stale.
