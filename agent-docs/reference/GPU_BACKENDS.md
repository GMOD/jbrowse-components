---
name: gpu-backends
description: What does a display's rendering backend look like — the per-plugin mark lists, why Canvas2D is the floor, how the two backends stay in parity, and the shared per-region contract?
kind: spec
---

# GPU rendering backends

What each plugin declares so one mark list becomes both a GPU and a Canvas2D
backend, and how the two stay pixel-compatible. [GPU_RENDERING.md](GPU_RENDERING.md)
is the hub; the uploads and lifecycle that call these backends are in
[GPU_DISPLAY_LIFECYCLE.md](GPU_DISPLAY_LIFECYCLE.md).

## RenderingBackend interfaces per plugin

Each plugin declares what it draws as a mark list (`defineMark`) and builds the
backend with `createMarkBackend(canvas, XXX_MARKS)`, which is
`createRenderingBackend` over `GpuMarkBackend` and `Canvas2DMarkBackend`, walking
the same list. `example-plugins/score-example` is the third-party form.
Alignments calls `createRenderingBackend` with renderer classes of its own, for
the sectioned frame its pileup needs.

### Canvas2D is the floor; GPU is the optional accelerator

Every canvas-drawing display **must** ship a Canvas2D painter, because SVG export
goes through it ([SVG_EXPORT.md](SVG_EXPORT.md)). A shape's `paintBlock` is that
painter. A drawing that is not instances of a shape (the reference sequence's
letters) is **Canvas2D-only** via `createCanvas2DBackend`; `plugins/sequence`'s
`SequenceRenderer` is the last hand-written one.

### Keeping the two backends in parity

A dual-path display renders the same pixels two ways, and SVG export runs the
Canvas2D path, so a shader-only tweak silently diverges the export. Parity is
kept by construction. Preserve whichever of these the display uses:

- **Constants live in the shader, TS re-exports them.** `//! export-consts:`
  emits the value into the `*.generated.ts`; the Canvas2D side imports it
  (`sharedRendererConstants.ts`). Never retype a shader constant as a TS literal.
- **One registry, exhaustively keyed.** Multi-layer displays list layers,
  z-order and gating once and map each id per backend through a
  `Record<LayerId, …>`, so a half-added layer is a compile error rather than a
  layer in one backend only, which also loses it from SVG export. Two bands with
  different draw signatures warrant a second mark list, never a second backend
  registry.
- **A per-instance vertex budget is a cap the other backend lacks.** Where one
  instance draws an unbounded number of marks (canvas's chevron pass), the
  pipeline's `verticesPerInstance` fixes how many the shader can address and
  every instance pays for every slot. Raise it and all pay; leave it and a large
  input silently loses marks past it while Canvas2D keeps drawing them. No other
  mechanism here catches this, so state **the input range the budget covers where
  the number is**, measured. `MAX_VISIBLE_CHEVRONS_PER_LINE`
  (`sharedRendererConstants.ts`) is the worked example; read its figures there.

**Intentional divergences — do NOT "fix" these into parity.** GPU rasterization
is watertight while Canvas2D antialiases each primitive independently.

- Canvas2D adds a sub-pixel *overdraw* to close seams (`CANVAS_SEAM_PX`, the
  variant-matrix `f2`) and swaps a thin fill for a 1px centerline stroke
  (synteny sub-pixel ribbons); the shader scales coverage alpha instead.
  Porting a Canvas2D fudge factor into a shader over-widens GPU glyphs.
  Min-width floors, by contrast, are mirrored and must stay in step.
- A `band` on `defineMark` differs at the sub-device-pixel edge: the GPU scissor
  rounds each edge to a device row independently and skips the mark when both
  land on one, where Canvas2D's clip paints an antialiased sliver
  (`{top: 10.6, height: 0.3}` at dpr 1). Every other band edge agrees.
- Synteny: `perpCoverage` measures a per-fragment width from the two edges'
  foreshortenings where `ribbonPerpWidth` measures the whole ribbon from its
  corners, each right for its own decision. The clicked outline is **GPU-only as
  a mark**: `drawSyntenyTrack` strokes it inside its own loop, so the
  `edgeStraight`/`edgeCurve` marks paint nothing on Canvas2D.

### Shared per-region streamed contract

Both halves extend abstract bases in `@jbrowse/render-core/perRegionRenderingBackend`.
**Overriding `Canvas2DPerRegionRenderingBackend.renderBlocks` silently drops**
the hi-DPI `prepareCanvas` sizing and the `painted` answer; subclass `draw`
instead. `GpuPerRegionRenderingBackend` uploads over the `regionPasses` the
subclass declares, and a pass that draws off a sibling's buffer is absent from
it (`createMarkBackend` derives that from marks with no `bufferOf`).
`renderBlocks` receives the model's data map, so the renderer holds none, and
`hal.drawPass` short-circuits on a missing buffer, so renderers draw
unconditionally.

## Renderers stay stateless

A GPU renderer owns only the `GpuHal` reference, pre-allocated uniform scratch,
and save/restore UBO scratch where a pass mutates uniforms. Do NOT keep:

- **Region-lifecycle bookkeeping.** `installUpload` releases each departed key
  through `hal.deleteRegion(key)`; the HAL is the authority on which regions
  have buffers.
- **Per-region metadata derivable from `rpcDataMap`** (`hasRects`, `outlineColor`).
  `drawPass` skips missing buffers, and per-region scalars reach uniforms through
  a mark's `params(state, region)` (`outlineColor` in `canvasFeatureMarks.ts`).
- **Write-only mirror copies** of upload data.

**The one legal renderer-held region map** is a private `regions` map written
**exclusively by the upload callback** and never mutated in place:
`RenderLifecycleMixin` bumps `renderTick` after every upload, so the cache cannot
stale. Alignments is the one display built that way. Still forbidden: a cache
populated elsewhere, entries patched in place, and mirroring the HAL's region map.

