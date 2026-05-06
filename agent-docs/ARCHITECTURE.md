# Architecture

## Coordinate system

JBrowse uses **0-based half-open intervals** `[start, end)` internally for
all genomic features and regions. This matches BED/BAM convention. Adapters
that read 1-based formats (VCF `POS`, GFF `start`) subtract 1 on ingest;
exporters that write 1-based formats add 1 on output.

---

## Data fetching pipeline

`MultiRegionDisplayMixin` (in `plugins/linear-genome-view/src/BaseLinearDisplay/`)
drives RPC fetches for all LGV displays (alignments, canvas, wiggle,
variants) via four autoruns:

| Autorun | Trigger | Action |
| --- | --- | --- |
| `DisplayedRegionsChange` | `view.displayedRegions` change | `clearAllRpcData()` |
| `FetchVisibleRegions` | viewport / `fetchGeneration` (600ms debounce) | `fetchNeeded(needed)` for uncovered buffered regions; gated by `error`/`regionTooLarge` |
| `SettingsInvalidate` | `rpcProps` change | `clearAllRpcData()` |
| `ClearBlockingStateOnViewportChange` | viewport change while `regionTooLarge` or `error` is set | `clearAllRpcData()` to unblock retry (no-op for canvas's derived `regionTooLarge`) |

Subclasses override `fetchNeeded` to call `self.fetchRegions(needed, work)`,
where `fetchRegions` runs an optional pre-flight byte estimate
(via `getByteEstimateConfig`) before invoking the work callback. Oversize
regions surface a banner via `regionCannotBeRendered()`. `error`/`regionTooLarge`
reads in `ClearBlockingStateOnViewportChange` are `untracked` for correctness —
tracking either would let `set...` re-fire the autorun and wipe the flag
before any viewport change.

### regionTooLarge: imperative vs. derived

There are two implementations of `regionTooLarge` in the codebase, both
expressed through the `regionTooLarge` getter so consumers
(`regionCannotBeRendered()`, `regionCannotBeRenderedText()`, the
`FetchVisibleRegions` gate) work with either.

- **Imperative** (`RegionTooLargeMixin` default; used by wiggle, alignments,
  hic): `setRegionTooLarge(true)` flips a volatile flag inside `fetchRegions`
  when the byte estimate exceeds the limit. `ClearBlockingStateOnViewportChange`
  clears the flag on viewport change so `FetchVisibleRegions` can retry.
- **Derived** (canvas's `LinearCanvasBaseDisplay`): a pure function of cached
  stats × current `bpPerPx` + visible regions, mirroring `FeatureDensityMixin`.
  - `bytesEstimateTooLarge` reads `featureDensityStats.bytes` (set by the
    byte-estimate RPC) against `userByteSizeLimit ?? adapter limit ?? config`.
  - `densityTooLarge` walks `view.visibleRegions`, looks up
    `densityStatsPerRegion[idx]` (populated for both successful fetches and
    worker-side too-large responses), and tests
    `(featureCount/regionWidthBp) × bpPerPx > maxFeatureDensity`. Scoping to
    currently-visible regions means panning past too-large areas naturally
    releases the gate.
  - `regionTooLarge = bytesEstimateTooLarge || densityTooLarge`.
  - `laidOutDataMap` returns empty when `regionTooLarge` is true, so the GPU
    upload pushes nothing — no stale-feature flash through the banner.
  - `isCacheValid` keeps too-large regions cached while the threshold still
    trips at the current zoom; flips invalid (forces refetch) when it doesn't.
  - A canvas-level autorun on `view.displayedRegions` clears
    `densityStatsPerRegion`/`featureDensityStats` on chromosome navigation
    (`displayedRegionIndex` gets reused, so stale entries would otherwise gate
    against the wrong region's stats and could permanently block refetch).

The derived approach removes the imperative clear-and-reset cycle that caused
the banner to flicker off and back on during small zoom or pan moves that
didn't actually cross the threshold. Both `featureDensityStats` and
`densityStatsPerRegion` survive `clearAllRpcData()` (they aren't in
`clearDisplaySpecificData`'s clearing path), so
`ClearBlockingStateOnViewportChange` is a no-op for the derived banner —
state recomputes the same value before and after.

`regionCannotBeRendered()` and `regionCannotBeRenderedText()` in
`RegionTooLargeMixin` read through `self.regionTooLarge` (the getter) rather
than `self.regionTooLargeState` (the volatile) so subclass overrides flow
into the banner UI and SVG export text.

Variants are monolithic: `MultiSampleVariantGetCellData` returns one batched
payload covering all visible regions, so variants' `fetchNeeded` expands
`needed` to all `bufferedVisibleRegions` and marks them all loaded together
when the work callback returns.

### `rpcProps` loop trap and how to break it

Including any fetch-result derivative in `rpcProps` creates an infinite loop:

```
setCellData → <derived value> changes → rpcProps changes
  → SettingsInvalidate → clearAllRpcData → cellData cleared
  → <derived value> changes → rpcProps changes → …
```

The fix is to split the computation: `rpcProps` gets a cache-key version
computed from user-controlled inputs only; any part that needs fetch-result
data is kept in a separate view used only for rendering or passed directly
to the server.

In the variant case, `rpcProps.sources` calls `getSources` with
`renderingMode: 'alleleCount'` internally so haplotype expansion (which
needs `sampleInfo`) is never triggered. The client's `sources` view still
reads `sampleInfo` for rendering — safe because it is not in `rpcProps`.
The server receives the unexpanded sources and expands them after computing
`sampleInfo` from features; sources from clustering already carry `HP` and
pass through unchanged.

**Rule**: `rpcProps` must contain only user-controlled settings. Never
include `cellData`, `sampleInfo`, or any getter that reads them.

See `plugins/linear-genome-view/src/BaseLinearDisplay/CLAUDE.md` for the
overridable hook list and test-file mapping.

---

# GPU Rendering Architecture

Canonical reference for the GPU rendering lifecycle across all display types.
Read `PRD.md` first for invariants and active priorities.

## Glossary

- HAL — hardware abstraction layer; abstracts WebGL2 and WebGPU calls.

---

## One-liner

Each GPU display is an MST model that composes `GpuBackendLifecycleSlotMixin`
and calls `self.installGpuDisplay(backend, { upload, render })` in its
`startGpuBackendLifecycle(backend)` action. The mixin spawns two autoruns tied
to the model's lifetime — one that runs `upload(backend)`, one that runs
`render(backend)`. MobX auto-tracks every observable read inside each callback,
so changes re-fire the right autorun with no manual dependency declarations.
React components are thin bridges: create a canvas, hand the backend to the
model via `useGpuModelLifecycle`, render JSX.

---

## The API

```ts
interface Backend {
  // plugin-defined upload/render methods
  dispose(): void
}

// In the plugin's MST model:
startGpuBackendLifecycle(backend: Backend) {
  self.installGpuDisplay<Backend>(backend, {
    upload: b => {
      // Read plugin observables, push bytes to the GPU.
      // Re-fires on any observable change.
    },
    render: b => {
      const state = self.renderState
      if (!state) return false              // renderState not ready
      return b.renderBlocks(self.renderBlocks, state)
      // return true only when real content was drawn;
      // mixin calls markCanvasDrawn() → canvasDrawn flips true →
      // MultiRegionDisplayMixin.isReady becomes true once isLoading also clears
    },
  })
}
```

---

## What the mixin owns

```
GpuBackendLifecycleSlotMixin
  .volatile
    canvasDrawn: boolean          set true only after render() returns true with real data
    currentGpuBackend: unknown    stored backend; autoruns read it each tick
    renderBump: number            bumped by renderNow() and after every upload
    gpuAutorunsInstalled: boolean guards installGpuDisplay (idempotent)
  .actions
    markCanvasDrawn()             idempotent flip to true
    resetCanvasDrawn()            flip to false (called by clearAllRpcData)
    stopGpuBackendLifecycle()     clears currentGpuBackend + resets canvasDrawn → autoruns idle
    renderNow()                   bumps renderBump → render autorun re-fires
    installGpuDisplay(b, cbs)     spawns upload + render autoruns (once)

MultiRegionDisplayMixin  (composes GpuBackendLifecycleSlotMixin)
  .views
    isReady: boolean              canvasDrawn && !isLoading — drives loading overlay
```

Loading overlays read `!model.isReady`. This keeps the overlay visible from
the moment the track opens (before GPU init and the 600ms `FetchVisibleRegions`
debounce) through the entire fetch cycle, hiding exactly once when the first
real frame is painted. `stopGpuBackendLifecycle` resets `canvasDrawn` so the
overlay reappears correctly during WebGL context-loss recovery.

All backend-specific plumbing lives in the plugin. All reactivity plumbing
lives in the mixin.

---

## Life of a frame

1. React hook (`useGpuModelLifecycle`) mounts, creates the HAL, resolves a
   backend, calls `model.startGpuBackendLifecycle(backend)`.
2. Mixin sets `currentGpuBackend = backend`, spawns two autoruns via
   `addDisposer(self, autorun(...))`.
3. Upload autorun fires: reads `currentGpuBackend`, calls `cbs.upload(b)`,
   bumps `renderBump` so render re-fires after any upload.
4. Render autorun fires: reads `currentGpuBackend` + `renderBump`, calls
   `cbs.render(b)`. If it returns `true`, flips `canvasDrawn` to `true`.
   `clearAllRpcData` resets `canvasDrawn = false` so the flag is only set
   after the canvas has real content.
5. Any observable touched by `upload` or `render` becomes a dep — when it
   changes, MobX re-fires that autorun. No manual invalidation.

### Context-loss recovery

GPU contexts can be lost. `useGpuRenderer` listens for
`webglcontextlost`/`restored` and `device.lost`, rebuilds the backend, and
calls `model.startGpuBackendLifecycle(newBackend)`. The mixin sees
`gpuAutorunsInstalled === true`, skips re-installation, just reassigns
`currentGpuBackend`. Both autoruns re-fire against the new backend. No special
code path.

### Tab visibility

`useTabVisibilityRerender` calls `model.renderNow()` on `visibilitychange`,
bumping `renderBump`. WebGPU swap-chain textures are reissued by the `render`
callback.

---

## Backend interfaces per plugin

Each plugin defines its own `Backend` interface and a factory that produces
either a GPU or Canvas 2D implementation:

```ts
export function XxxRenderer(canvas: HTMLCanvasElement) {
  return initDualBackend<XxxBackend>(
    canvas,
    XXX_PASSES,
    XXX_UNIFORM_BYTE_SIZE,
    hal => new GpuXxxRenderer(hal),
    c => new Canvas2DXxxRenderer(c),
  )
}
```

`initDualBackend` calls `createGpuHal`; if a HAL is returned, the GPU backend
is constructed, otherwise Canvas 2D.

### Three upload patterns

Per-LGV displays use one of three upload shapes; pick the one that matches
the data shape, not the one your neighbour copied:

| Pattern | Upload methods | Render | Use when | Examples |
|---|---|---|---|---|
| **Per-region streamed** | `uploadRegion(idx, data)` + `pruneRegions(active)` | `renderBlocks(blocks, state)` | each region's data is independent, reactive per-region updates | canvas, wiggle, multi-variant |
| **Whole-map synced** | `sync(sources)` | `renderBlocks(blocks, state)` | encoder settings drive packing, or multiple per-region streams must rebuild coherently | alignments, multi-LGV synteny |
| **Monolithic** | `uploadX(data)` | `render(state)` (no blocks) | display has no region partitioning (heatmaps spanning the whole view) | LD, multi-variant matrix |

All three patterns expose the same lifecycle (`installGpuDisplay({ upload,
render })`); the difference is how the upload callback shovels bytes.

#### Per-region streamed: per-key autoruns (wiggle only)

**Plain English:** The naive implementation re-uploads every chromosome to the
GPU each time any chromosome finishes loading — 300 uploads instead of 24 for
a whole-genome wiggle track. The fix gives each chromosome its own tiny MobX
watcher. When chromosome 5 arrives, only chromosome 5's watcher fires and
uploads. When the user changes a color setting, all 24 watchers fire and all
24 re-upload — which is the right behavior.

Naive per-region upload iterates the full `rpcDataMap` inside the upload
callback. Because `for (const [k, v] of rpcDataMap)` makes MobX track the
entire map, every `rpcDataMap.set(key, data)` call re-fires the autorun and
re-uploads all N regions — O(N²) total GPU uploads when N regions arrive
sequentially.

**Fix (wiggle, multi-wiggle):** replace the single full-map loop with a
key-manager that spawns one per-key autorun per `rpcDataMap` entry:

```ts
upload: b => {
  // keys() tracks structural changes (add/remove) but NOT value changes.
  const active: number[] = []
  for (const key of self.rpcDataMap.keys()) {
    active.push(key)
    if (!perKeyDisposers.has(key)) {
      perKeyDisposers.set(key, autorun(() => {
        const data = self.rpcDataMap.get(key)   // per-key value atom
        const props = self.gpuProps()
        const bCurrent = self.currentGpuBackend as WiggleBackend | undefined
        if (data !== undefined && bCurrent !== undefined) {
          bCurrent.uploadRegion(key, buildSourceRenderData(data, props))
          self.renderNow()
        }
      }))
    }
  }
  const activeSet = new Set(active)
  for (const [key, dispose] of perKeyDisposers) {
    if (!activeSet.has(key)) { dispose(); perKeyDisposers.delete(key) }
  }
  b.pruneRegions(active)
}
```

Key MobX fact (verified in mobx@6.15.0 source): `ObservableMap.get(existingKey)`
tracks `hasMap_.get(key)` (per-key existence atom), not `keysAtom_`. Adding a
new key fires `keysAtom_` (waking the key-manager only) and that new key's
`hasMap_` entry. Existing per-key autoruns are **not** re-fired. Net result:
O(1) GPU upload per new region, O(N) when `gpuProps()` or backend changes.

Use `addDisposer(self, () => { for (const d of perKeyDisposers.values()) d() })`
to clean up per-key autoruns when the MST node is destroyed.

**Plain English on why the wiggle fix doesn't apply here:** Wiggle uploads
each chromosome independently — chromosome 5's data has nothing to do with
chromosome 1's. Canvas and alignments lay out features into Y-rows across all
loaded regions together (so a gene spanning two adjacent regions ends up on
the same row in both). That means any new arrival could in principle change
the layout of everything already loaded, so the code recomputes and re-uploads
everything. In practice this cross-region coupling rarely matters (different
chromosomes never share Y-rows), but the architecture doesn't exploit that yet.

**Canvas and alignments have the same O(N²) structure** — both route through a
whole-map MobX computed (`laidOutDataMap` / `laidOutPileupMap`) that invalidates
whenever any `rpcDataMap` entry changes, causing the upload autorun to re-fire
and re-upload all N entries. Per-key autoruns cannot help here: reading
`laidOutDataMap.get(key)` or `laidOutPileupMap.get(key)` in a per-key autorun
still tracks the whole-map computed as a dependency, so all per-key autoruns
re-fire on every new arrival.

The practical difference is N:

- **Canvas** is commonly shown as a whole-genome gene track with N=24
  chromosomes → N²=576 uploads vs. 24. Perceptible. Fix: make
  `computeLaidOutData` incremental — return stable references for entries whose
  input data didn't change, so per-key autoruns can detect no-ops.
- **Alignments/synteny** are never shown at whole-genome scale (data density
  forces gene-level zoom, or synteny is pairwise). N is typically 4–8 buffered
  regions → N²=16–64. Not perceptible in practice. Same fix would apply if N
  ever grew.

---

## SVG export pipeline (single source of truth)

SVG export and on-screen rendering share the same draw pipeline per plugin.
Each plugin exposes two top-level pure functions:

- `drawXxxBlocks(ctx, regions, blocks, state)` — paints a pre-built regions
  map. Used by the on-screen `Canvas2DXxxRenderer.renderBlocks`.
- `drawXxxToCtx(ctx, sources, blocks, state)` — one-shot wrapper that
  builds the regions map from observable sources and calls
  `drawXxxBlocks`. Used by `renderSvg.tsx`.

Both take any 2D-context-shaped surface: real `CanvasRenderingContext2D` for
on-screen, `SvgCanvas` for vector export. `Canvas2DXxxRenderer` is bound
(canvas required at construction) — SVG export does *not* instantiate the
renderer. It calls `drawXxxToCtx` directly.

SVG export in `renderSvg.tsx` follows this recipe:

```tsx
await when(() => model.rpcDataMap.size > 0 || !!model.error || model.regionTooLarge)
if (model.error) return <SVGErrorBox …/>
const renderBlocks = buildRenderBlocks(view.visibleRegions)
const node = paintLayer(totalWidth, height, opts, ctx => {
  drawXxxToCtx(ctx, sources, renderBlocks, state)
})
```

`paintLayer` (in `@jbrowse/core/util/paintLayer`) decides between a 2× DPR
raster canvas (when `opts.rasterizeLayers`) or an `SvgCanvas`, and returns
one `ReactNode` (`<image xlinkHref=…>` or `<g dangerouslySetInnerHTML=…>`).

This kills the older "SVG-only `renderToCtx`" pattern that drifted out of
sync with the on-screen renderer (different bicolor handling, different
Y-axis offsets, different bezier curves, different palettes — each plugin
had its own flavor of drift). The canonical reference implementation is
`plugins/alignments/src/LinearAlignmentsDisplay/components/Canvas2DAlignmentsRenderer.ts`
(`drawAlignmentsToCtx` + `drawAlignmentBlocks`); other plugins follow the
same shape.

**Sashimi exception.** Sashimi arcs are deliberately rendered as vector SVG
on both paths via a shared `computeSashimiArcs(opts) → SashimiArc[]`
function: arc counts are low, vector performance is fine, and SVG `<path>`
elements give native hover/tooltip behavior the rasterized pipeline cannot
match. The on-screen `SashimiArcsOverlay` and the SVG export consume the
same arc array, so geometry and colors stay in sync. This is the *only*
draw path that intentionally avoids `paintLayer`; treat the same.

**Shared utilities** (in `@jbrowse/core/util/`):
- `createSvgRasterCanvas(width, height, opts)` — the 2× DPR canvas + `opts.createCanvas` fallback ritual.
- `paintLayer(width, height, opts, paint) → ReactNode` — raster-vs-vector dispatch.
- `Ctx2D = CanvasRenderingContext2D | SvgCanvas` — shared type alias used by every `drawXxxBlocks` signature.

---

## `rpcProps` / `gpuProps` pattern

Domain-named getters that enumerate **what affects rendering output**.

| Getter             | Consumer                                                        | Invalidation route                                                                          |
| ------------------ | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `rpcProps`         | `rpcManager.call(..., { ...self.rpcProps, ... })` — RPC payload | Mixin `SettingsInvalidate` autorun reads `void self.rpcProps` → `clearAllRpcData` → refetch |
| `gpuProps()`       | `buildSourceRenderData(data, self.gpuProps())` — encoder input  | Upload callback reads it — MobX re-uploads without an RPC roundtrip                         |
| Derived region map | Upload callback iterates it in place of raw `rpcDataMap`        | Upload autorun reads it — MobX re-uploads without an RPC roundtrip                          |
| `renderState`      | `backend.render(state)` per frame                               | Render callback reads it — re-fires when deps shift                                         |

`gpuProps` exists wherever the main thread encodes the GPU buffer (wiggle,
multi-wiggle, multi-LGV synteny). Canvas's worker pre-builds the buffer, so
canvas has only `rpcProps`. This splits refetch from re-upload: wiggle color
change → re-encode only; `bicolorPivot` change → worker output differs →
`rpcProps` → refetch.

Derived region maps apply when upload needs whole fresh per-region payloads,
not just encoder parameters. Alignments' `laidOutPileupMap` returns shallow
clones of `rpcDataMap` entries with freshly-allocated Y arrays from
main-thread layout (+ connecting-line / Flatbush in chain mode). Raw
`rpcDataMap` is never mutated. Use derived maps when settings change the
shape/contents of per-region data; use `gpuProps` for scalars fed to an
encoder.

---

## Per-region zoom-staleness

All worker position output is **absolute genomic uint32** — no pixel
coordinates cross the worker boundary, so data stays valid under zoom. Two
exceptions for zoom-dependent *content* (not coords):

- **Wiggle**: BigWig has discrete zoom levels; the worker picks one based on
  `bpPerPx / resolution`. `isCacheValid` uses strict equality
  (`view.bpPerPx === loadedBpPerPx`) — any zoom change refetches all visible
  regions together. See `architecture-decision-records/adr-008-wiggle-strict-bpperpx-equality.md`.
- **Canvas**: the amino-acid overlay is the only `bpPerPx`-dependent worker
  decision. `isCacheValid` refetches only when the viewport crosses
  `shouldRenderPeptideBackground`'s discrete threshold.

All other plugins leave the default `() => true`.

`MultiRegionDisplayMixin`'s `FetchVisibleRegions` autorun calls the override
per region and refetches stale ones.

---

## HAL (Hardware Abstraction Layer)

Hides the WebGPU/WebGL2 difference. Lives in `packages/core/src/gpu/hal/`.

```
createGpuHal(canvas, passes, uniformByteSize): Promise<GpuHal | null>
  ?renderer=canvas2d     → return null
  else                   → try WebGPU → fallback WebGL2 → fallback null
```

**Key methods:** `uploadBuffer(regionKey, passId, data, count)`,
`drawPass(passId, regionKey, bufferPassId?)`, `writeUniforms(data)`,
`setScissor`, `setViewport`, `setRegionMeta` / `getRegionMeta`, `dispose()`.

**Implementations:** `WebGPUHal` (4× MSAA, device-lost recovery),
`WebGL2Hal` (`antialias: true`, VAO + UBO, context-loss recovery),
`MockHal` (tests).

**Backend override** (query param `?renderer=`): `webgpu` / `webgl` /
`canvas2d` / `canvas`; omitted → auto-detect WebGPU → WebGL2 → Canvas 2D.

---

## Shaders (Slang codegen)

Production draw shaders are authored as `.slang`, compiled to WGSL (WebGPU)
and GLSL ES 3.00 (WebGL2) by `scripts/build-shaders.ts`. See ADR-005.

**Layout:** display-specific shaders in
`plugins/<plugin>/src/<display>/shaders/<name>.slang`; per-plugin shared in
`plugins/<plugin>/src/shared/shaders/`; cross-plugin modules
(`hpmath.slang`, `colorPack.slang`) in `packages/core/src/gpu/shaders/`.
Codegen emits `<name>.generated.ts`.

**Wire-up:** `slangPass()` turns a generated module into a `PassDescriptor`,
with overrides for `topology`, `blendState`, `textures`, and buffer sharing.

Authoring conventions and gotchas: ADR-005.

---

## BP precision: why both uint32 storage AND hi/lo float math

Genomic positions exceed 3×10⁹ on T2T assemblies; float32's 24-bit mantissa
can't represent every integer past 2²⁴ ≈ 16.7 Mbp, causing ~256 bp precision
loss at 3 Gbp. GPU clip-space is unavoidably float32, so the question is
*where* precision loss happens without corrupting output.

The answer is a **two-stage representation**:

### Stage 1 — storage as uint32

Absolute genomic positions are stored as `uint32` vertex attributes. Uint32 is
exact for `[0, 2³²)` = 4.29 Gbp.

### Stage 2 — conversion to clip-space via hi/lo split

In the shader the uint32 is split into a **high** half (bits 12..31, aligned
to 4096-bp boundaries) and a **low** half (bits 0..11, values 0..4095):

```wgsl
uint lo = value & 0xFFFu;
uint hi = value - lo;
float2 split = float2(float(hi), float(lo));
```

Both halves are exact in float32 — `hi` is always an exact multiple of 4096;
`lo` is always in `[0, 4096)`.

`clippedBpStart` is split the same way on the CPU (`splitPositionWithFrac`)
and uploaded as `bpHi`/`bpLo`. The shader subtracts hi-from-hi and
lo-from-lo separately:

```wgsl
float dHi = split.x - u.bpHi;  // exact: large-large = small
float dLo = split.y - u.bpLo;  // exact: small-small = small
float clipX = (dHi + dLo) / bpLen * 2.0 - 1.0;
```

### Why we need both representations

- **uint32 only (no split)**: shader would convert uint32 → float directly,
  losing precision at 3 Gbp. Works only below ~16 Mbp.
- **float hi/lo pre-split (no uint32)**: doubles per-vertex memory (8 vs 4
  bytes) and pushes split logic onto every CPU packer.
- **uint32, split in shader (current)**: 4 bytes per vertex, precision
  preserved, CPU packers copy absolute positions unchanged. Split is 2 integer
  ops in the shader.

`hpmath.slang` provides `hpSplitUint`, `hpToClipX`, `hpScaleLinear`.
`blockClipUtils.clipBlock` emits `[bpStartHi, bpStartLo]` for the visible
window; `splitPositionWithFrac` is the CPU equivalent for UBO fields.

### Synteny: pre-split Float32 hi/lo cumulative-bp

Synteny corner storage takes a different shape than the LGV-family uint32
attributes above. A synteny ribbon connects two views with independent
`bpPerPx` and independent inter-region paddings; per-corner positions are
**cumulative-bp across all regions of the corner's view**, not single-region
absolute bp. So:

- The vertex attribute is `(bpHi, bpLo)` Float32 pairs, pre-split on the CPU
  via `splitPositionWithFrac` against 4096-bp buckets — same hi/lo math as
  the LGV path, just split up-front instead of in the shader.
- The view origin uniform `viewBp = offsetPx * bpPerPx` is also hi/lo split
  (`viewBp{0,1}{Hi,Lo}`). This is **padded-bp at canvas left** — not pure
  cumulative genomic bp; it includes the padding-as-bp contribution, which
  is what lets the per-instance `pad` cancel out the padding-at-canvas-left
  term in the shader formula `(cumBp − viewBp)/bpPerPx + pad`. No companion
  `viewPad` uniform is needed.
- Inter-region padding pixels stay as a per-instance Float32 attribute
  (`padTop`, `padBottom`), accumulated up to the corner's region.

Storing as cumBp instead of regional bp + region index avoids the
per-region uniform table / per-(region-pair) draw call concerns that ruled
out earlier hp-math attempts; padding per-instance plus a single per-view
origin uniform handles inter-region offsets without any `MAX_REGIONS` cap.
See ADR-010 for the rejected per-region-table alternatives, ADR-018 for
why this shape works.

Dotplot currently stays on pre-projected Float32 pixel offsets per
ADR-010. Its geometry-buffer layout (line endpoints) differs from
synteny's parallelogram corners and would need its own migration.

---

## Coordinate convention (alignments and wiggle data)

**Every** position array emitted by the alignments or wiggle worker is
**absolute genomic uint32** — reads, gaps, mismatches, interbase (ins/soft/
hardclip), softclip bases, modifications, SNP/noncov/indicator/modCov
segments, sashimi junctions, chain connecting lines, `coverageStartPos`,
`readNextPositions`, and wiggle `featurePositions`.

**Why absolute, not regionStart-relative:**

1. Region boundaries change on zoom-out. Anything keyed to `regionStart` is
   silently invalidated when the anchor shifts.
2. No signed offsets needed — genomic positions are always ≥0.
3. Reversed regions are transformed by the drawing layer (`bpToX` on Canvas2D,
   `flipX` on GPU), not the coord convention. Reversal is orthogonal.
4. All consumers (SVG export, Canvas2D, hit testing, tooltips,
   `findFeatureInRpcData`, main-thread layout) compare against absolute bp
   values. No `regionStart +` arithmetic anywhere.

**Precision across the GPU boundary:**

Every shader consumes absolute uint32 positions and converts to clip space via
hp-math.

| Shader group | Attribute | Precision technique |
|---|---|---|
| Point/edge shaders (read, gap, mismatch, insertion, modification, clip, connectingLine, arcLine, coverage, snpCoverage, noncovHistogram, indicator, modCoverage) | `uint position` | `hpClipX(hpSplitUint(absPos), u)` — hi/lo split against `bpHi`/`bpLo`. Exact at 3 Gbp. |
| arc (paired-end bezier curves) | `uint x1, x2` | `hpLinear(hpSplitUint(absPos), u)` → normalized [0,1]; bezier runs on small floats. Same precision floor. |

The alignments UBO has **no `regionStart`**, **no `domainStart`/`domainEnd`**.

**Reversed regions:** Both shader families call `flipX(sx, u)` after
computing clip-space x. `flipX(x) = lerp(x, -x, u.reversed)` maps
left-edge=`region.end`, right-edge=`region.start`.

---

## Uniforms & canvas scaling

Shader uniforms use **CSS pixels**. The HAL sets the canvas backing store to
`css × dpr`, so `N / canvas_width` in clip space equals `N` CSS pixels at any
DPR. **Do not manually scale by `devicePixelRatio`.**

---

## `displayedRegionIndex`

Zero-based index into `view.displayedRegions`. Stable unless regions are
added, removed, or reordered. **Not** an index into
`dynamicBlocks.contentBlocks` — one displayedRegion can produce multiple
render blocks that share one GPU buffer and draw with different scissor clips.

The join key across `model.rpcDataMap`, `hal.uploadBuffer(regionKey, ...)`,
and `RenderBlock.displayedRegionIndex`. Multi-LGV displays (dotplot, synteny)
key on a tuple of two displayedRegion indices.

---

## Adding a new GPU display type

- **Types** — `MyData`, `MyRenderState`, `MyBackend`.
- **Shader** — author `my.slang`; `pnpm gen:shaders` emits `my.generated.ts`.
- **Renderers + factory** — `initDualBackend<MyBackend>` from
  `packages/core/src/gpu/createDualRenderer.ts`. Use `slangPass()` to build
  the `PassDescriptor`.
- **MST model:**
  - Compose `MultiRegionDisplayMixin()` for LGV-family displays (brings in
    `GpuBackendLifecycleSlotMixin`, `FetchMixin`, fetch autorun, and
    `rpcProps`→refetch wiring); non-region displays compose
    `GpuBackendLifecycleSlotMixin()` directly.
  - Add a cached `renderState` view.
  - Define `startGpuBackendLifecycle(backend)` calling
    `self.installGpuDisplay(backend, { upload, render })`.
  - Expose `rpcProps`; add `gpuProps()` only when main thread encodes GPU
    buffers from settings.
- **React component** — `observer()`:
  ```tsx
  const { canvasRef, error, retry } = useGpuModelLifecycle(MyRenderer, model)
  return <>{error && <ErrorBar action={retry} …/>}<canvas ref={canvasRef}/></>
  ```
- **Tests** — unit (`MockHal`); browser (Puppeteer, `--backend=webgl|webgpu|canvas2d`).

---

## What NOT to do

- Don't put upload/render logic in React `useEffect`/`useLayoutEffect` —
  it belongs in the MST autorun pair spawned by `installGpuDisplay`.
- Don't destructure model methods; call on the model.
- Don't use `useMemo` for observable-dependent values; use a cached MST view.
- Don't mutate per-region values in place; emit fresh objects.
- Don't add or redefine volatiles/actions owned by the slot mixin
  (`canvasDrawn`, `renderBump`, `currentGpuBackend`, `markCanvasDrawn`,
  `resetCanvasDrawn`, `renderNow`, `stopGpuBackendLifecycle`, etc.) or the
  `isReady` view owned by `MultiRegionDisplayMixin`.
- Don't hand-maintain WGSL/GLSL/offset tables next to generated modules;
  consume the generated constants.
- Don't put fetch-result derivatives (`cellData`, `sampleInfo`, etc.) into
  `rpcProps` — `SettingsInvalidate` watches `rpcProps` and calls
  `clearAllRpcData`, which clears the very data `rpcProps` just read, creating
  an infinite fetch loop.
