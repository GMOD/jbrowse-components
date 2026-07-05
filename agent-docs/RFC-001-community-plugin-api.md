# RFC-001: Community plugin API for the WebGPU/WebGL2/Canvas2D era

**Status:** Historical proposal. The mixin/lifecycle rename pass in §4
was adopted with different names than this RFC proposed. As-shipped
mapping (RFC → adopted): `GpuRenderingBackendLifecycleSlotMixin` →
`RenderLifecycleMixin` (kept "Gpu" prefix); `installGpuDisplay` →
`attachRenderingBackend`; `stopGpuRenderingBackendLifecycle` → `stopRenderingBackend`;
`useGpuModelLifecycle` → `useRenderingBackend`; `initDualRenderingBackend` →
`createRenderingBackend`. The Canvas2D-as-first-class proposal (§3, §4) is not
yet implemented — current Canvas2D paths use the same
`attachRenderingBackend({ upload, render })` shape as GPU.

**Branch:** `webgl-poc`
**Scope:** Core, plugin-linear-genome-view, plugin-wiggle, plugin-canvas, all built-in LGV-family plugins still using `FeatureRendererType`. Linear Genome View only — circular, dotplot-shape, and custom views are out of scope.

---

## 1. Problem

The webgl-poc rendering architecture (Slang shaders, HAL, MST autorun lifecycle, RPC = data not pixels) has stabilized for built-in plugins. Community plugins are still expressed in JBrowse-1 shape:

- They `extends FeatureRendererType` (worker-side render, return bitmap).
- They compose `linearWiggleDisplayModelFactory(pluginManager, configSchema)` to inherit y-axis scaling.
- They reach across plugins via `pluginManager.getPlugin('WigglePlugin').exports`.
- They have no first-class GPU path.

Two external plugins are immediate forcing functions — both must port to webgl-poc:

- `jbrowse-plugin-gwas` — Manhattan plot scatter. Currently composes `linearWiggleDisplayModelFactory` (broken on webgl-poc since wiggle's factory now installs the GPU lifecycle expecting bigwig-shaped data) and extends `FeatureRendererType` (worker-side render-to-bitmap, doesn't fit the data-not-pixels worker boundary).
- `jbrowse-plugin-mafviewer` — multi-sample MAF/sequence rendering with phylogenetic tree. Currently extends `FeatureRendererType` and uses `pluginManager.getPlugin('LinearGenomeViewPlugin').exports` for `BaseLinearDisplay`. Has three distinct data flows (samples + tree at init, sequences on demand, MAF features per region) which the RFC's "one RPC method" framing wouldn't have covered without §3c's multi-flow note.

Common gaps both plugins hit:

- No clean composition path that gives community plugins LGV-display behavior without inheriting wiggle's GPU lifecycle (or vice versa).
- No public surface for plugins to use Slang-authored shader passes without authoring shaders themselves.
- No prescribed pattern for plugins with multiple data flows (one-time-at-init metadata + per-region viewport data).

This RFC specifies the target plugin API and the work to land it. Prior decisions captured in memory: design the *ideal future* (don't preserve legacy plugin abstractions); GPU must be first-class for plugins (Canvas2D-only would impose a real performance ceiling); MST `bpPerPx` stays the single source of truth (out of scope); no glyph/spec DSL (premature).

---

## 2. Goals & non-goals

### Goals

1. A community plugin author can ship a new LGV display type by composing exported mixins, defining one RPC method, writing a backend renderer class (for the GPU path) or a render callback (for the Canvas2D path), and writing a React component. The architectural shape mirrors core plugins.
2. Both Canvas2D and GPU are first-class peer render paths. Same MST shape; same RPC shape; same lifecycle; same shared shader-pass library.
3. Cross-plugin coupling uses static imports backed by an explicit, typed public surface per `@jbrowse/plugin-*`. The runtime `pluginManager.getPlugin().exports` pattern is removed for new plugin code.
4. Built-in plugins still using `FeatureRendererType` migrate to the new shape. After migration, `pluggableElementTypes/renderers/*` is deleted.
5. `jbrowse-plugin-gwas` ports to the new shape with no inheritance from `linearWiggleDisplayModelFactory`.

### Non-goals

- A glyph-registration / spec-grammar / DSL layer. Rejected as unmotivated: the simple "BED-like rect/arrow/line" case is already handled by the canvas plugin's existing config (color, displayMode, gene-glyph-mode); the complex case (Manhattan plots, methylation matrices, etc.) needs the full mixin/RPC/render shape regardless. A registration API would only replace the render-callback layer, lose flexibility (per-feature batching, conditional paths, custom hit-testing), and add a layer of indirection that doesn't earn its keep.
- Decoupling MST from `bpPerPx` for animation. Out of scope per prior decision.
- Replacing the existing dual-backend HAL.
- **Backwards compatibility for plugins built against the legacy API.** Old UMD-loaded plugins built against `linearWiggleDisplayModelFactory`, `FeatureRendererType`, or `pluginManager.getPlugin().exports` will break when upgrading to a JBrowse release that lands this RFC. There are very few external plugins; the breakage is accepted in exchange for getting the API right once.
- **Non-LGV display types.** Circular view, dotplot-shape, and custom views are out. The renderer-class hierarchy used by `CircularChordRendererType` is retired alongside the LGV-family legacy.
- **Minimizing plugin-author boilerplate.** Plugin authors write a backend class, an RPC method, an MST model, and a render function — same architectural shape and roughly the same line count as core plugins. The goal is *consistency* and *shared primitives*, not effortlessness. We don't want plugins inventing their own rendering architecture; we accept that this means they write low-level code matching what core plugins write.

---

## 3. Target plugin shape

### 3a. Picking Canvas2D or GPU

Both paths are first-class. The decision is data-volume driven:

| Features per frame | Canvas2D | GPU |
|---|---|---|
| ≤ ~50K | comfortable 60fps | overkill but fine |
| ~50K-200K | acceptable; pan/zoom may stutter | comfortable |
| ~200K-1M | not viable | comfortable |
| ≥ 1M | not viable | designed for this |

For Manhattan plots at whole-genome GWAS scale (millions of points), GPU is required. For a typical custom annotation track at gene-scale (hundreds to thousands of features), Canvas2D is fine and the simpler choice.

**Text-heavy rendering is currently Canvas2D-only.** Plugins that draw DNA/AA letters (MAF, sequence views at high zoom, character annotations) cannot use the GPU path until a `LetterPass` exists (§5c). Performance is acceptable in practice: text only kicks in at high zoom (small viewports → few glyphs per frame).

A plugin can ship one path or both. Plugins that ship GPU **must also ship a Canvas2D draw function** for SVG export — that's an invariant covered in §6a, not optional.

The architectural shape between the two paths is the same: same MST composition, same RPC method, same `RenderingBackendLifecycleSlotMixin`. The differences are local:

- **Canvas2D**: plugin's MST model calls `self.installCanvas2DDisplay(canvas, { render })`. The render callback receives a 2D context and plugin state, calls plugin-defined `drawXxxToCtx`, returns `true`.
- **GPU**: plugin authors a backend class wrapping `GpuHal`, similar to `GpuCanvasFeatureRenderer`. Plugin's MST model calls `self.installGpuDisplay(backend, { upload, render })`. The backend uses passes from the shared library (§5).

### 3b. MST display model

```ts
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  RenderingBackendLifecycleSlotMixin,
  MultiRegionDisplayMixin,
  TrackHeightMixin,
} from '@jbrowse/plugin-linear-genome-view'
import { ScaleAxisMixin } from '@jbrowse/plugin-wiggle'
import { types } from '@jbrowse/mobx-state-tree'

export function stateModelFactory(configSchema) {
  return types
    .compose(
      'LinearManhattanDisplay',
      BaseDisplay,
      TrackHeightMixin(),
      MultiRegionDisplayMixin(),
      ScaleAxisMixin(),                 // numeric y-axis with autoscale
      types.model({
        type: types.literal('LinearManhattanDisplay'),
        configuration: ConfigurationReference(configSchema),
      }),
    )
    .volatile(() => ({
      rpcDataMap: observable.map<number, ManhattanData>(),
      hitTestIndex: undefined as Flatbush | undefined,
    }))
    .views(self => ({
      rpcProps() { return { /* user-controlled settings only */ } },
      // Cached; rebuilt when rpcDataMap changes
      get hitTestEntries() { /* derive from rpcDataMap */ },
    }))
    .actions(self => ({
      fetchNeeded(needed) {
        self.fetchRegions(needed, async ctx => { /* RPC + populate rpcDataMap */ })
      },
      // Canvas2D path:
      startCanvas2DLifecycle(canvas) {
        self.installCanvas2DDisplay(canvas, {
          render: ctx => { drawManhattanToCtx(ctx, self.renderState); return true },
        })
      },
      // GPU path (alternative):
      startGpuRenderingBackendLifecycle(backend) {
        self.installGpuDisplay(backend, {
          upload(b) { /* iterate rpcDataMap, b.uploadRegion(...) */ },
          render(b) { return b.renderBlocks(self.renderBlocks, self.renderState) },
        })
      },
    }))
}
```

A plugin chooses one of `startCanvas2DLifecycle` / `startGpuRenderingBackendLifecycle` based on its rendering choice. Both can coexist — a plugin can implement both and pick at runtime based on `?renderer=` URL param or device detection.

### 3c. RPC method(s)

A plugin can have one or many RPC methods — one per data flow, not one per plugin. Each is a `RpcMethodType` subclass:

```ts
import { RpcMethodType } from '@jbrowse/core/pluggableElementTypes'

export class FetchManhattanData extends RpcMethodType {
  name = 'FetchManhattanData'
  async execute(args: ManhattanRpcArgs): Promise<ManhattanData> {
    const features = await fetchFeatures(args.adapterConfig, args.region, args.stopToken)
    return packPointsAsTypedArrays(features)  // transferable typed data
  }
}
```

Worker returns typed data. No bitmaps cross threads. Mirrors `plugins/canvas/src/RenderFeatureDataRPC/`.

**Multiple data flows.** Plugins routinely need more than one fetch shape:

- **Per-region viewport-driven** — drives via `MultiRegionDisplayMixin.fetchNeeded` → `fetchRegions(needed, work)`. Refetches as the viewport moves; covered by the four mixin autoruns (`DisplayedRegionsChange`, `FetchVisibleRegions`, `SettingsInvalidate`, `ClearBlockingStateOnViewportChange`). This is what the canvas/wiggle/alignments plugins use.
- **One-time-at-init** — track-level metadata that doesn't depend on the viewport (e.g., MAF samples + phylogenetic tree, variant-track sample lists). Plugin defines a separate RPC method type and an `afterAttach` autorun that calls it once and stores the result on a volatile.
- **Settings-driven** — fetched in response to a user setting change but not per-region. Same pattern as one-time-at-init but the autorun reads the setting observable.

Mafviewer (a real plugin) has all three: `MafGetSamples` and `MafGetTree` are one-time-at-init; `FetchMafFeatures` is per-region. Each is a distinct `RpcMethodType`. Plugins should not try to bundle these into a single method.

### 3d. React component

```tsx
// Canvas2D
const { canvasRef } = useCanvas2DModelLifecycle(model)
return <canvas ref={canvasRef} />

// GPU
const { canvasRef } = useGpuModelLifecycle(ManhattanRenderer, model)
return <canvas ref={canvasRef} />
```

Both hooks ship from `@jbrowse/core/util`.

---

## 4. Mixin & lifecycle surface

### 4a. Rename: `GpuRenderingBackendLifecycleSlotMixin` → `RenderingBackendLifecycleSlotMixin`

The mixin in `packages/core/src/gpu/GpuRenderingBackendLifecycleSlotMixin.ts` is already backend-agnostic except for naming. Renames:

| Before | After |
|---|---|
| `GpuRenderingBackendLifecycleSlotMixin` | `RenderingBackendLifecycleSlotMixin` |
| `currentGpuRenderingBackend` | `currentRenderingBackend` |
| `gpuAutorunsInstalled` | `autorunsInstalled` |
| `stopGpuRenderingBackendLifecycle` | `stopRenderingBackendLifecycle` |
| `installGpuDisplay` | (kept as-is — GPU-specific) |

`canvasDrawn`, `renderBump`, `markCanvasDrawn`, `resetCanvasDrawn`, `renderNow` already have generic names; no changes.

Add a new install action alongside the existing one:

```ts
installGpuDisplay<B>(backend: B, cbs: { upload(b): void; render(b): boolean }): void
installCanvas2DDisplay(
  canvas: HTMLCanvasElement,
  cbs: { render(ctx: CanvasRenderingContext2D): boolean },
): void
```

`installCanvas2DDisplay` spawns one autorun (no upload/render split — Canvas2D has no buffer phase). Inside the autorun:

1. Read `self.currentRenderingBackend` (the canvas reference, stored as a volatile by `startCanvas2DLifecycle`).
2. Get the 2D context via `canvas.getContext('2d')` (browser-cached; same object every call).
3. Call `cbs.render(ctx)`.
4. `markCanvasDrawn()` if render returns `true`.

The render callback reads observables (model views, volatiles) **from closure**. MobX auto-tracks every read; the autorun re-fires when any observable changes. This is the same pattern as `installGpuDisplay`'s `render(b)` callback, which reads `self.renderState` from closure rather than receiving it as a parameter. The plugin handles canvas resize-to-DPR and clear inside its render — typically via a shared utility like `resizeAndClearCanvas2D(ctx, cssWidth, cssHeight)`. The mixin doesn't read plugin-specific dimensions; that would be a leaky abstraction.

### 4b. `MultiRegionDisplayMixin` composes the renamed mixin

`MultiRegionDisplayMixin.ts:30` composes `GpuRenderingBackendLifecycleSlotMixin()` today. It composes `RenderingBackendLifecycleSlotMixin()` after the rename. Both `installGpuDisplay` and `installCanvas2DDisplay` are present on the resulting model; plugins call exactly one. `isReady = canvasDrawn && !isLoading` works identically for both paths.

### 4c. Hook surface

Add `packages/core/src/util/useCanvas2DModelLifecycle.ts` parallel to `useGpuModelLifecycle.ts`:

```ts
export interface Canvas2DLifecycleModel {
  startCanvas2DLifecycle: (canvas: HTMLCanvasElement) => void
  stopRenderingBackendLifecycle: () => void
  renderNow: () => void
}

export function useCanvas2DModelLifecycle(model: Canvas2DLifecycleModel) {
  // Creates 2D canvas, calls model.startCanvas2DLifecycle, wires tab visibility.
}
```

`useGpuModelLifecycle` keeps its current shape; the rename of `stopGpuRenderingBackendLifecycle` → `stopRenderingBackendLifecycle` is a one-line sweep.

---

## 5. Shader-pass library

### 5a. Promotion

Move the canvas plugin's proven passes from `plugins/canvas/src/LinearBasicDisplay/components/shaders/` to `packages/core/src/gpu/passes/`. Passes are infrastructure; they belong with `slangPass()`, `hpmath.slang`, and `colorPack.slang` in core.

### 5b. Library shape

The library exposes building blocks for plugin renderer classes — not a higher-level abstraction over them. Each pass exports:

```ts
// packages/core/src/gpu/passes/rect.ts
export const RECT_PASS_ID = 'rect'
export const RectPass: PassDescriptor = slangPass({ id: RECT_PASS_ID, mod: rectShader })
export function packRects(
  positions: Uint32Array, ys: Float32Array, heights: Float32Array,
  colors: Uint32Array, count: number,
): ArrayBuffer { /* the existing interleaveRects body */ }
```

A plugin's GPU renderer class then has the same shape as `GpuCanvasFeatureRenderer`:

```ts
import {
  RECT_PASS_ID, RectPass, packRects,
  CIRCLE_PASS_ID, CirclePass, packCircles,
} from '@jbrowse/core/gpu/passes'

export const MANHATTAN_PASSES = [CirclePass, RectPass]
export const MANHATTAN_UNIFORM_BYTE_SIZE = circleShader.UNIFORMS_SIZE_BYTES

export class GpuManhattanRenderer implements ManhattanRenderingBackend {
  constructor(private hal: GpuHal) {}

  uploadRegion(idx: number, data: ManhattanData) {
    this.hal.uploadBuffer(idx, CIRCLE_PASS_ID, packCircles(...), data.count)
  }

  renderBlocks(blocks: Block[], state: RenderState) {
    this.hal.beginFrame(0, 0, 0, 0)
    for (const block of blocks) {
      // scissor + uniforms + drawPass(CIRCLE_PASS_ID, idx)
    }
    this.hal.endFrame()
    return true
  }

  pruneRegions(active: number[]) { /* ... */ }
  dispose() { this.hal.dispose() }
}
```

This is intentionally not less work than the canvas plugin's renderer — same shape, same primitives, same coding style. **The point is shared primitives, not easier rendering.** External plugins using GPU compose the same low-level surface core plugins use.

The plugin's `MyPluginRenderer(canvas)` factory uses `initDualRenderingBackend` to pick GPU or Canvas2D at construction:

```ts
export function ManhattanRenderer(canvas: HTMLCanvasElement) {
  return initDualRenderingBackend<ManhattanRenderingBackend>(
    canvas,
    MANHATTAN_PASSES,
    MANHATTAN_UNIFORM_BYTE_SIZE,
    hal => new GpuManhattanRenderer(hal),
    c => new Canvas2DManhattanRenderer(c),
  )
}
```

Same shape as canvas plugin's `CanvasFeatureRenderer.ts`.

### 5c. Initial passes shipped

| Pass | Source | Status |
|---|---|---|
| `RectPass` | existing `rect.slang` | move from canvas plugin |
| `LinePass` | existing `line.slang` | move from canvas plugin |
| `ArrowPass` | existing `arrow.slang` | move from canvas plugin |
| `ChevronPass` | existing `chevron.slang` | move from canvas plugin |
| `CirclePass` | new — quad with SDF circle | author for Manhattan; ~30 lines of `.slang` |

`CirclePass` is the first of a likely-growing point-shape family. As variant glyph plugins, custom annotation displays, and other point-shape needs accumulate, expect Square / Diamond / Triangle to follow. Once 3-4 point-shape passes exist, consider whether they fold into a single `PointPass` with an SDF-shape uniform. **Don't pre-design the family now** — add primitives only when the next plugin needs one.

**Text rendering is not in the library and is currently Canvas2D-only.** Plugins that render DNA/AA letters (MAF tracks, sequence views at high zoom, character-based annotations) cannot use the GPU path with the current pass library — text in shaders requires SDF font atlases or texture-based glyphs, neither of which is built. A `LetterPass` is deferred until at least one plugin's needs justify the work. In the interim, text-heavy plugins use `installCanvas2DDisplay` and `ctx.fillText`; performance is acceptable because text rendering only kicks in at high zoom (small viewports → few glyphs per frame).

### 5d. The canvas plugin migrates to consume the library

After the move, `GpuCanvasFeatureRenderer` imports `RectPass`, `LinePass`, `ArrowPass`, `ChevronPass` from `@jbrowse/core/gpu/passes` rather than its private folder. Internal refactor only; no behavioral change. Visual regression CI catches any pixel-level drift.

### 5e. Custom shaders for exotic plugins

A plugin that needs a shader not in the library authors `.slang` and runs `pnpm gen:shaders` at the plugin's own build time. The slangc binary fetch is one-shot per platform; the script in `packages/shader-tools/src/build-shaders.ts` is portable to plugin repos.

This is acceptable friction — only the unusual minority of plugins needs custom shaders. The 80%+ case composes from the library.

---

## 6. Plugin invariants

These apply equally to Canvas2D and GPU paths and are not optional.

### 6a. Plugins ship both on-screen render and SVG export

Every plugin exposes a `drawXxxToCtx(ctx, ...)` function that takes a generic `Ctx2D = CanvasRenderingContext2D | SvgCanvas`. SVG export (`@jbrowse/core/util/paintLayer`) calls this with an `SvgCanvas` and emits vector output.

- **Canvas2D-primary plugins**: `installCanvas2DDisplay`'s render callback calls `drawXxxToCtx`. SVG export calls the same function. One implementation, two surfaces.
- **GPU-primary plugins**: still ship `drawXxxToCtx` for SVG export — shaders cannot run against an `SvgCanvas`. This mirrors the core pattern: `Canvas2DAlignmentsRenderer` exists alongside `GpuAlignmentsRenderer`; SVG export goes through the Canvas2D path. The plugin's render output between paths must be visually consistent. Visual regression CI enforces.

A GPU-only plugin without a Canvas2D draw function fails review.

### 6b. Hit-testing is plugin-owned, main-thread, observable-driven

Both render paths handle hit-testing identically:

- The plugin defines a cached MST view (or volatile populated by an autorun) that builds a hit-test index (Flatbush, k-d tree, whatever fits the data shape) from `rpcDataMap`.
- The view re-runs when `rpcDataMap` changes; reads are auto-tracked by MobX.
- React mouse handlers call into the model to query the index against (x, y) cursor coordinates.
- Hit-testing is decoupled from rendering. It does not go through `GpuHal`, does not require GPU readback, does not use off-screen color-picking.

This matches what core plugins (canvas, alignments) do today.

### 6c. State ownership

`RenderingBackendLifecycleSlotMixin` owns `canvasDrawn`, `currentRenderingBackend`, `renderBump`, `autorunsInstalled`, and the autoruns themselves. Plugins own everything else: `rpcDataMap`, derived layout maps, hit-test indices, view-specific volatiles. The lifecycle mixin must not grow plugin-specific state.

---

## 7. API stability policy (deferred)

A formal stability policy is deferred until the new API has settled across multiple plugin migrations. The substantive design decision is already in §2 goal #3 and §4: cross-plugin coupling uses static imports + esbuild `globalExternals`; the `pluginManager.getPlugin('X').exports` pattern is removed for new plugin code. Beyond that, committing now to formal semver discipline, `api-extractor` tooling, or versioned mixin coexistence (`MixinV1`/`V2`) would be premature for an experimental phase that still expects large changes. We can establish stability conventions when there are stable surfaces to protect.

---

## 8. Wiggle refactor

### 8a. Current shape

`plugins/wiggle/src/shared/WiggleCommonMixin.ts` (110 lines) is mostly clean. It owns:

- **Numeric scale primitives**: `scaleType`, `minScore`, `maxScore`, `autoscaleType`, `displayCrossHatches`, `loadedBpPerPx`, `isCacheValid`, plus their setters. Generic — useful to any plugin with a numeric y-axis.
- **Wiggle-bicolor specifics**: `posColor`, `negColor`, `bicolorPivot`. Wiggle-only.
- **Wiggle-summary specifics**: `summaryScoreMode`, `renderingType`. BigWig zoom-level summary semantics.
- **Wiggle-UI specifics**: `scalebarOverlapLeft`. Track-label-overlap measurement specific to wiggle's scalebar layout.

### 8b. The split

```ts
// plugins/wiggle/src/shared/ScaleAxisMixin.ts (new)
export function ScaleAxisMixin() { /* the generic numeric-axis subset */ }

// plugins/wiggle/src/shared/WiggleCommonMixin.ts (refactored)
export function WiggleCommonMixin() {
  return types.compose(
    'WiggleCommonMixin',
    ScaleAxisMixin(),
    /* the wiggle-bicolor + wiggle-summary + wiggle-UI subset */,
  )
}
```

`ScaleAxisMixin` is exported from `@jbrowse/plugin-wiggle`'s public surface (per §7a). `WiggleCommonMixin` continues to compose it internally; no behavior change for existing wiggle code.

### 8c. ConfigOverrideMixin dependency

> **Superseded:** `ConfigOverrideMixin` has since been removed. Settings that
> override a config default now write the config slot directly via `setSlot`
> (read via `getConf`), with read-time tier resolution handled by promotable
> slots / `getConfResolved` (see `agent-docs/CONFIG_PATTERN.md`). This
> subsection no longer applies — the extracted mixins have no override-mixin
> dependency to carry.

~~Both mixins compose `ConfigOverrideMixin` from `@jbrowse/plugin-linear-genome-view`. That stays — already exported.~~

### 8d. What this enables for community plugins

Any LGV plugin with a numeric y-axis (Manhattan, custom score tracks, methylation profiles, etc.) composes `ScaleAxisMixin` directly. Inherits y-axis scale, autoscale, min/max, crosshatches. Doesn't inherit posColor/negColor/bicolor or summary-mode. Doesn't inherit wiggle's GPU lifecycle.

---

## 9. Legacy renderer audit

### 9a. Current callsites (webgl-poc, non-test)

| Plugin | File | Pattern |
|---|---|---|
| arc | `plugins/arc/src/ArcRenderer/ArcRenderer.ts` | `extends FeatureRendererType {}` (empty subclass) |
| variants/LD | `plugins/variants/src/LDRenderer/LDRenderer.tsx` | `extends ServerSideRendererType` (with overrides) |

Plus the core class hierarchy itself:

- `BoxRendererType extends FeatureRendererType extends ServerSideRendererType`
- `CircularChordRendererType extends ServerSideRendererType`

### 9b. Migration plan per plugin

- **arc**: empty subclass hasn't been migrated to the GPU lifecycle yet. Port: define an RPC method, define a display model that composes `MultiRegionDisplayMixin`, write a render callback. Simple enough for the Canvas2D path; no performance pressure that demands GPU.
- **variants/LD**: extends `ServerSideRendererType` with non-trivial overrides. LD already has a GPU compute path on webgl-poc (`ldComputeShader.ts`); the *render* still goes through `LDRenderer.tsx`. Migration: compute output feeds a new `installGpuDisplay` lifecycle.
- **CircularChordRendererType**: out of scope per RFC scope (LGV only). After audit confirms no active LGV-family use, retire the class entirely along with the rest of the renderer hierarchy.

### 9c. After migration

Once the four migrations land, delete:

- `packages/core/src/pluggableElementTypes/renderers/ServerSideRendererType.ts`
- `packages/core/src/pluggableElementTypes/renderers/FeatureRendererType.ts`
- `packages/core/src/pluggableElementTypes/renderers/BoxRendererType.ts`
- `packages/core/src/pluggableElementTypes/renderers/CircularChordRendererType.tsx`
- The corresponding `ReExports/list.ts` and `ReExports/modules.ts` entries

After the cut, the only renderer-type abstraction in core is `RpcMethodType` for the RPC shape.

---

## 10. GWAS migration walkthrough

The estimates below are order-of-magnitude based on reading the existing `LinearManhattanRenderer.ts` (~250 LOC) and projecting the new shape; they're not measurements.

### 10a. Before (current jbrowse-plugin-gwas, JBrowse 4.x shape)

- `LinearManhattanRenderer extends FeatureRendererType` — worker-side render, Flatbush built in worker, returns bitmap + clickMap.
- `stateModelFactory` composes `linearWiggleDisplayModelFactory(pluginManager, configSchema)`.
- Cross-plugin coupling via `pluginManager.getPlugin('WigglePlugin').exports`.
- Rendering: `ctx.arc()` per feature in a 2D canvas.

### 10b. After — Canvas2D path (~plugin code on the order of ~80 LOC)

- New `FetchManhattanData extends RpcMethodType` returns `{ positions: Uint32Array, scores: Float32Array }` per region. No bitmap, no Flatbush in worker.
- `stateModelFactory` composes `BaseDisplay + TrackHeightMixin + MultiRegionDisplayMixin + ScaleAxisMixin` plus own model props.
- `fetchNeeded` calls the RPC method via `self.fetchRegions`, populates `rpcDataMap`.
- `drawManhattanToCtx(ctx, blocks, state)` is the shared draw function — consumed by both the on-screen Canvas2D render and SVG export (per §6a).
- `startCanvas2DLifecycle(canvas)` calls `installCanvas2DDisplay({ render: ctx => { drawManhattanToCtx(ctx, self.renderState); return true } })`. The render callback reads `self.renderState` from closure; MobX auto-tracks.
- Hit testing per §6b: cached view builds Flatbush from `rpcDataMap`; React handlers query it.
- React component: `useCanvas2DModelLifecycle(model)`.

### 10c. After — GPU path (plugin code on the order of ~120 LOC)

Same RPC, same MST model, same fetch, same hit-test pattern. Differences are local to the renderer:

- New `GpuManhattanRenderer` class wrapping `GpuHal` (per §5b). Imports `CirclePass`, `packCircles` from `@jbrowse/core/gpu/passes`.
- `Canvas2DManhattanRenderer` calls `drawManhattanToCtx` (same one as 10b) — SVG export reuses it automatically.
- `ManhattanRenderer(canvas)` factory uses `initDualRenderingBackend<ManhattanRenderingBackend>` to pick GPU or Canvas2D.
- `startGpuRenderingBackendLifecycle(backend)` calls `installGpuDisplay({ upload, render })`.
- Performance: GPU path handles millions of points; Canvas2D fallback handles smaller datasets and SVG export.
- React component: `useGpuModelLifecycle(ManhattanRenderer, model)`.

### 10d. What's not in either path

- No `FeatureRendererType` extension.
- No `linearWiggleDisplayModelFactory` inheritance.
- No `pluginManager.getPlugin('WigglePlugin').exports`.
- No worker-side bitmap return.
- No invented rendering architecture — same primitives core plugins use.

---

## 11. Implementation plan

| Step | Scope | Cost (estimated) |
|---|---|---|
| **0. Land RFC** | Review, debate, commit to direction | — |
| **1. Mixin rename + Canvas2D action** | `RenderingBackendLifecycleSlotMixin` rename, sweep callers, add `installCanvas2DDisplay`, add `useCanvas2DModelLifecycle` | ~3-4 days (rename touches every GPU plugin and tests stubbing the mixin) |
| **2. Promote shader passes** | Move `rect/line/arrow/chevron` to `packages/core/src/gpu/passes/`; canvas plugin re-imports | ~1-2 days |
| **3. Author CirclePass** | New `circle.slang` + generated.ts + packer | ~1-2 days |
| **4. Wiggle refactor** | Extract `ScaleAxisMixin`, update wiggle public surface | ~2 days |
| **5. API stability ADR** | ADR-024 documenting §7 | ~half-day |
| **6. Reference plugin in-tree** | Small example display in both Canvas2D and GPU paths, mirroring GWAS shape; doubles as documentation | ~3-4 days |
| **7. Migrate arc** | RPC method + MST model + Canvas2D render; delete old renderer | ~3-5 days |
| **8. Migrate variants/LD render** | Audit, port render to `installGpuDisplay` | ~3-5 days |
| **9. Delete legacy renderer classes** | Remove `ServerSideRendererType`, `FeatureRendererType`, `BoxRendererType`, `CircularChordRendererType`; update ReExports | ~half-day |
| **10. Port jbrowse-plugin-gwas** | External plugin against new API; both paths (Canvas2D and GPU) | ~3-5 days |
| **11. Port jbrowse-plugin-mafviewer** | External plugin against new API; Canvas2D path only (text rendering); validates multi-RPC data flows | ~5-7 days (more complex than GWAS — phylogenetic tree, multi-flow fetch, row-based layout) |

Total estimate: **~7-9 weeks calendar** of focused work for one engineer. The estimates are order-of-magnitude and assume the wiggle split, mixin rename, and visual regression all behave; any of those can balloon individually.

Steps 1-5 unblock 6-11. Within 6-11, the migrations (7, 8, 10, 11) can run in parallel since they touch different plugins.

---

## 12. Cross-cutting work, independent of this RFC

These don't depend on the RFC's outcome and can land in parallel with any step. Most surfaced during the holistic architecture review preceding this RFC.

### 12a. Render correctness / consistency

- **Visual regression gate on paired Canvas2D/GPU output** (essential for §5d, §6a, §10 — should land before step 2). Render each plugin under both backends with fixed-seed datasets, diff PNGs with small tolerance, fail CI on divergence. Without this, the 30+ paired renderers will accumulate silent drift between paths over time. ADR-005 already acknowledges that drift between Canvas2D and GPU was a historical bug source; without the gate, it returns.
- **Document MSAA quality difference between backends.** WebGPU uses 4x MSAA (`webgpuHal.ts:29`); WebGL2 uses `antialias: true` (`webgl2Hal.ts:158`). The two paths produce visually similar but not pixel-identical AA edges. Set the visual-regression tolerance accordingly and document the caveat in `ARCHITECTURE.md`; otherwise the gate above produces false positives.
- **Data-version invariant test for context-loss recovery.** If a user gesture races with WebGL/WebGPU device-lost-and-restored, the rebuilt backend re-uploads from committed MST state but transient state may have moved on. Add a test asserting the uniform-buffer state matches `bpPerPx` at frame end, including a forced mid-gesture device-loss path. `renderNow()` covers most cases but a one-frame mismatch is plausible without an explicit invariant.

### 12b. HAL hardening

- **`writeUniforms` outside-frame contract** (`webgpuHal.ts:497-514`). The current path allows calls outside `beginFrame`/`endFrame` and writes to slot 0 directly via `device.queue.writeBuffer`. Consistent under careful reading (the inside-frame path resets `uniformSlot = 0` in `beginFrame`) but fragile to mis-modify. Either make outside-frame writes a hard error with a clear message, or add documented invariants plus a boundary-case test.
- **`Promise.all` → `Promise.allSettled` in `webgpuHal.ts:compilePipelines:129`.** Pipeline compilation in parallel reports the first error and masks subsequent ones. When porting a new shader, you want all compile errors at once. ~10-line change; aggregate via `allSettled` and throw an aggregate `ShaderCompileError`.
- **`MAX_UNIFORM_SLOTS = 512` cap exhaustion test.** Currently the cap is undocumented to the rest of the codebase and silently `console.error`s on overflow without preventing draw corruption. Drive a frame past the cap and assert clean failure. A dense synteny view or whole-genome canvas with many small blocks could conceivably hit it.
- **WebGL context-leak guardrail test.** The HAL tracks live contexts (`totalCreated - totalDisposed` in `webgl2Hal.ts:87-88`); Firefox caps live contexts around 16, Chrome around 8. Open 16 displays sequentially and confirm the live-count caps cleanly. Protects against context-leak regressions, which are otherwise hard to surface in tests until a user hits the cap.

### 12c. Performance

- **Canvas / alignments O(N²) upload fix.** Documented in `agent-docs/ARCHITECTURE.md` "Per-region streamed: per-key autoruns" — wiggle has the fix (ADR-017); canvas and alignments still re-upload all N regions on each new arrival because `laidOutDataMap` / `laidOutPileupMap` invalidate as wholes. Make `computeLaidOutData` / `computeLaidOutPileup` return stable references for unchanged region keys so per-key autoruns can detect no-ops. Whole-genome canvas (24 chromosomes → 576 vs. 24 uploads) is the most user-visible case.

### 12d. Slang migration completeness

- **Migrate compute shaders to Slang.** `plugins/variants/src/VariantRPC/ldComputeShader.ts` and `ldPhasedComputeShader.ts` are still hand-written WGSL (WebGPU-only). Migrate to `.slang` with `//! targets: wgsl` to inherit reflection-derived TS layout and the codegen invariants the rest of the codebase already relies on. Not urgent — they work — but completes the Slang-everywhere story and removes the last hand-maintained WGSL strings.

---

## 13. Deferred / future directions

Items considered during the design of this RFC and explicitly deferred. None are blocked; each can be picked up independently if and when conditions arise.

### 13a. Eventual WebGL2 retirement

Keep WebGL2 until either (a) the `vulkanGlslToWebgl2.ts` post-processor requires frequent maintenance from Slang regressions, or (b) WebGPU coverage on the genomics user base (academic/biomed, including non-HTTPS deployments and aging Linux/Mesa stacks) exceeds ~97%. Neither is true today. Estimate: 3-5 years out. When both are true, the WebGL2 HAL retires and the Slang GLSL target follows; the Slang investment doesn't depend on retiring WebGL2.

### 13b. Streaming worker→main render

The legacy `FeatureRendererType` pattern in some plugins (e.g. mafviewer) streams features from the adapter and renders incrementally — peak memory bounded to "one feature at a time" rather than "all features in the typed-array buffer." The new architecture loses this: workers collect-then-return typed data, so peak memory in the typed arrays is the limiting factor. For most plugins this is fine; for very-wide multi-sample tracks (100 samples × 1Mbp viewport at 1bp/px = 100M cells) it's a real cost.

Possible future approaches: chunked typed-array delivery (worker emits multiple "data ready" events; main re-renders per chunk), or a streaming RPC primitive on top of the existing one-shot RPC. Neither is built. Plugins hitting the memory ceiling today can: (a) reduce typed-array sizes by aggregating server-side, (b) chunk by sub-region, or (c) stay on the legacy renderer path until streaming is built. None of these are great. Add a streaming-RPC mechanism if and when a plugin's memory ceiling proves limiting in production.

### 13c. 60fps zoom animation decoupled from MST commit

Three approaches were considered: (1) volatile `pendingBpPerPx` driving uniforms during gesture with debounced MST commit at gesture end; (2) animate the `bpRangeX` / `viewBp` uniform only during gesture, leaving `bpPerPx` static; (3) discrete fetch-level tile model with continuous GPU transform between levels. All three rejected as wrong targets to attack now — `bpPerPx`-as-MST-single-source-of-truth is load-bearing for many downstream synchronizations (scalebar, gridlines, ruler, RPC fetch invalidation, react-rendered overlays), and the cost of a wrong fix exceeds the cost of imperfect zoom feel. Performance work in this area is acceptable *inside* the MST-as-truth invariant (cheaper writes, fewer downstream observers, more aggressive debouncing); decoupling requires its own ADR and explicit go-ahead, not a casual refactor.

---

## 14. Open questions for review

1. **Pass library home: `@jbrowse/core` vs. dedicated package.** RFC recommends core. Counter-argument: core has resisted rendering-specific code historically. Counter-counter: passes aren't plugin-specific — they're rendering primitives, alongside the HAL and shared shader modules already in core.
2. **`stopGpuRenderingBackendLifecycle` → `stopRenderingBackendLifecycle` rename**: separate sweep PR ahead of the rest, or part of step 1? Affects reviewability of step 1 either way.

---

## 15. References

- `agent-docs/ARCHITECTURE.md` — current architecture, autorun lifecycle, RPC patterns
- `agent-docs/architecture-decision-records/adr-005-shader-codegen-slang.md` — Slang adoption rationale
- `agent-docs/architecture-decision-records/adr-008-wiggle-strict-bpperpx-equality.md` — wiggle's `isCacheValid` strict equality
- `agent-docs/architecture-decision-records/adr-009-canvas-drawn-reliability.md` — `canvasDrawn` semantics
- `agent-docs/architecture-decision-records/adr-016-bicolorpivot-stays-in-worker.md` — `rpcProps` vs. `gpuProps` rule
- `agent-docs/architecture-decision-records/adr-017-wiggle-per-key-autoruns.md` — per-key autorun pattern
- `~/src/jbrowse-plugin-gwas` — Manhattan plot, design fixture for §10
- `~/src/jbrowse-plugin-mafviewer` — multi-sample MAF rendering with phylogenetic tree, design fixture for §3c (multiple RPC flows) and §5c (text rendering)
