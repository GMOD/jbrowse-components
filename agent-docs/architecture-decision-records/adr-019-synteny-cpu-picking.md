---
status: Accepted
summary: "Synteny picking moves from GPU framebuffer readback to CPU (supersedes ADR-012 picking)"
---

# ADR-019: Synteny picking moves from GPU framebuffer readback to CPU

## Status

Accepted. Supersedes the picking-related portions of ADR-012.

## Context

`LinearSyntenyDisplay` lets users hover over alignment trapezoids to highlight
a feature and click to open the feature widget. Both interactions need a fast
"which feature is under (x, y)" lookup.

The original implementation used a third GPU pass:

- `syntenyPicking.slang` rendered each instance's `instanceFeatureIdx + 1` into
  an offscreen RGB888 framebuffer, encoded as a 24-bit color (0 reserved for
  "no hit").
- On hover, `GpuSyntenyRenderer.pick` ran the picking pass and read back a
  single pixel via `gl.readPixels` (WebGL2, sync) or
  `mapAsync(GPUMapMode.READ)` (WebGPU, async).
- The async readback required: an `inFlight` Promise to serialize concurrent
  picks (the WebGPU staging buffer is single-use), a `nextPick` slot to
  coalesce rapid hover requests, and a `hoverGeneration` counter to discard
  stale results when the mouse left mid-flight.

A `Canvas2DSyntenyRenderer` was already implemented as the SVG-export and
no-WebGL fallback path. It already did pure CPU picking using a Flatbush
bbox index plus `ctx.isPointInPath` for refinement — the same geometry math
as the shader, just executed in JS.

## Problem

On Firefox + WebGPU, `mapAsync` consistently took ~50–100 ms per pick.
Hover felt visibly laggy because every mouse move queued a readback before
the highlight could update. Chrome WebGPU was substantially faster but still
not free; WebGL2's sync `readPixels` was fine.

The latency is structural to WebGPU's GPU-to-CPU fence model, not a Firefox
bug per se — `mapAsync` waits on prior queue submissions to drain. Browser
optimizations may improve it, but a synchronous CPU path is unconditionally
faster for the data sizes synteny renders (typically <100k instances).

A Canvas2D-style overlay was considered (draw the hover highlight on a
separate Canvas2D layer so the GPU render never re-fires for hover state).
Rejected: it adds a second canvas, DPR/resize sync, and a parallel
highlight-draw path that must stay in sync with the GPU shader. The original
problem (slow pick) is independent of the re-render cost; an overlay
addresses the wrong bottleneck.

## Decision

Replace the GPU readback path with CPU picking shared between both backends.

- `syntenyPickEngine.ts` exports `pickFeatureAtPoint` plus the geometry
  helpers (`projectCorners`, `widenCorners`, `isEdgeCulled`,
  `buildFeaturePath`, `computeTransform`). Both `Canvas2DSyntenyRenderer` and
  `GpuSyntenyRenderer` use it.
- `GpuSyntenyRenderer` keeps a reference to each region's
  `SyntenyInstanceData` (previously thrown away after `interleaveInstances`)
  and creates a 1×1 `OffscreenCanvas` solely for `isPointInPath` evaluation.
- `SyntenyRenderingBackend.pick` becomes synchronous (`(x, y) => SyntenyPickResult |
  undefined`). The async-callback overload is removed.

Deleted:

- `syntenyPicking.slang` and its generated WGSL/GLSL.
- `GpuHal.drawPickingPass`, `readPickingPixel`, `readPickingPixelAsync`
  on the interface and all three implementations (`webgpuHal`, `webgl2Hal`,
  `mockHal`).
- `pickingTexture` / `pickingStagingBuffer` allocations in `webgpuHal`,
  `pickingFbo` / `pickingTex` in `webgl2Hal`, and the `picking?: boolean`
  flag on `PipelineDescriptor` / `slangPass`.
- `inFlight` queue, `nextPick` coalescing slot, and `hoverGeneration`
  counter in `GpuSyntenyRenderer`.
- The cancel-pick workaround in `LevelSyntenyCanvas.handleMouseLeave`
  (`dispatchHoverPick({ x: -99999, y: -99999 })`), which only existed to
  bump the generation counter.

Net: roughly −900 lines, including a full shader pipeline and an
async-readback codepath that had been the source of staging-buffer race
bugs.

## Tradeoff: shader/JS geometry duplication

CPU picking duplicates `projectCorners`, `widenCorners`, and `isEdgeCulled`
between the Slang shader (`syntenyTypes.slang`) and the JS engine
(`syntenyPickEngine.ts`). Visual drift between the two would mean clicks
land on a different feature than the user sees.

This duplication was already required because `Canvas2DSyntenyRenderer` is
the SVG-export path — `renderSvg.tsx` reuses `drawSyntenyTrack`, so the JS
geometry math must already match the shader. Picking just consumes the
existing duplicate. The `// SYNC:` comment markers flag the matched pairs
explicitly. ADR-018 (cumulative-bp + hp-math storage) already documented
the bp-space contract that both paths honor.

## When this might not generalize

CPU picking is appropriate here because synteny instance counts are
bounded (typically 10²–10⁵; tens of thousands at the high end). Tracks
that render millions of independent primitives (e.g. dense wiggle bins,
pileup mismatches) cannot afford O(N) per-pixel JS geometry work even
once per pan/zoom to build the index.

For those tracks, GPU picking still makes sense — but the cost should be
amortized differently: render the picking buffer **once per view change**
and read it back once (eat the 100 ms), then per-mouse-move picks become
texture lookups in CPU-resident pixel data instead of new GPU passes. The
synteny refactor doesn't apply that pattern because Flatbush + N≈10k JS
loops are simply faster than a single mapAsync round-trip.

## Later refinement: the index survives a pan (2026-07)

As first written, `PickIndex` cached the whole `ComputedTransform` and rebuilt
whenever it changed. That included `viewBp0`/`viewBp1`, so **any pan
invalidated it** and the next `mousemove` rebuilt the index — measured at ~25 ms
per 100k instances and ~90–120 ms at 500k (per-instance projection plus the
Flatbush build), landing as a main-thread stall on the first hover after every
scroll. The "once per pan/zoom" cost this ADR assumed was therefore being paid
far more often than the section above implies.

Two changes remove it:

- **The build-time pan is recorded and the query shifts instead.** Panning by
  `(d0, d1)` since the boxes were projected moves an instance's top corners by
  `d0` and its bottom corners by `d1`, so its true hull satisfies
  `trueMin >= storedMin + min(d)` and `trueMax <= storedMax + max(d)`. Stabbing
  `[x - max(d), x - min(d)]` is therefore a conservative superset of the
  instances covering `x`. When both views move together — which includes the
  synteny canvas's own drag-pan, since `LevelSyntenyCanvas.dragPan` scrolls
  every view by the same `dx` — `d0 == d1` and the stab is a *point*, exactly
  as precise as a freshly built index, for zero rebuild cost.
- **Every per-instance predicate moved into the candidate loop.** The viewport
  cull and the sub-pixel `perpW < 1` pickability test both depend on the live
  pan (`perpW` keys on the ribbon's slope, which changes when the two views pan
  by different amounts), so neither can be baked into the index without
  breaking the "pickable ⟺ drawn as a solid fill" invariant. They are cheap on
  the handful of candidates a query returns.

### Why the reuse is capped rather than unconditional

The first cut of this built the boxes with the pan removed entirely, making the
index depend on nothing but zoom. Benchmarking the widened query killed that:
the interval grows by the axis *skew*, and on a dense whole-genome index
candidate counts grow with it. At 500k instances (5% long diagonals, the shape
that makes hulls wide) a synthetic sweep measured:

| skew   | ms/query | candidates/query |
| ------ | -------- | ---------------- |
| 0px    | 0.33     | 4.7k             |
| 100px  | 0.49     | 11k              |
| 1000px | 2.7      | 66k              |
| 2000px | 6.3      | 125k             |

A whole-genome view can accumulate thousands of px of skew before a refetch
resets the bases, so an uncapped index traded a 90 ms stall on the first hover
for ~6 ms on *every* hover — plus the per-candidate rejection loop over 125k
candidates. `MAX_PAN_SKEW_PX = 250` bounds the worst query near 1 ms and
rebuilds past that. Since skew only accrues when one view is panned alone, and
the pointer is over that LGV (not the synteny canvas) while it happens, the
rebuild lands at most once on the next hover — never mid-drag.

### Cleanups that landed with it

The geometry helpers this ADR lists as
living in `syntenyPickEngine.ts` (`projectCorners`, `isEdgeCulled`,
`buildFeaturePath`, `computeTransform`, `ribbonPerpWidth`, plus the stroke
helpers) moved to **`syntenyRibbonPath.ts`** — they are shared draw/SVG-export
geometry that picking merely consumes, and they were two thirds of the file.
And `SyntenyGeometryCache.set` now invalidates the index only when the geometry
arrays actually change (keyed on `bp1` identity, the same `geomToken` reasoning
as `GpuSyntenyRenderer.interleaveCache`), so a colorBy or opacity toggle — which
re-uploads the same geometry with a fresh `colors` lane — no longer throws the
index away. `widenCorners`, named in the Decision section, no longer exists.

`ComputedTransform` also changed shape: it now carries `panPx0`/`panPx1` rather
than `viewBp0`/`viewBp1`, i.e. exactly the four numbers the shader's `Uniforms`
carry, and `projectCorners` evaluates the identical `bpRel * bpPerPxInv + panPx`
expression as `computeCorners` in `syntenyTypes.slang`.
`GpuSyntenyRenderer.writeUniforms` now feeds its uniforms from
`computeTransform` instead of recomputing the same formula, so the CPU and GPU
projections cannot drift.
