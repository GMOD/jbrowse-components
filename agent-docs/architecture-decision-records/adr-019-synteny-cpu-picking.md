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
- `SyntenyBackend.pick` becomes synchronous (`(x, y) => SyntenyPickResult |
  undefined`). The async-callback overload is removed.

Deleted:

- `syntenyPicking.slang` and its generated WGSL/GLSL.
- `GpuHal.drawPickingPass`, `readPickingPixel`, `readPickingPixelAsync`
  on the interface and all three implementations (`webgpuHal`, `webgl2Hal`,
  `mockHal`).
- `pickingTexture` / `pickingStagingBuffer` allocations in `webgpuHal`,
  `pickingFbo` / `pickingTex` in `webgl2Hal`, and the `picking?: boolean`
  flag on `PassDescriptor` / `slangPass`.
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
