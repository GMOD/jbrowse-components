---
name: gpu-backends
description: What does a display's rendering backend look like — the per-plugin mark lists, why Canvas2D is the floor, how the two backends stay in parity, the shared per-region contract, hit testing and the wiggle-family package split?
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
- **Scalar decisions live in the shader too.** `//! js-export: fnA, fnB` emits
  `<base>.js.generated.ts`, TypeScript twins transliterated from slangc's WGSL,
  so Canvas2D and SVG run the shader's math. The subset is **scalar only** (no
  vectors, swizzles, loops or indexing); any gap an export reaches throws at
  `pnpm gen:shaders`. Author the scalar core pure and wrap the colour or struct
  conversion around it. Retire a hand-written twin only behind a differential
  sweep (`alphaShaderParity.test.ts`).
  [ADR-051](../architecture-decision-records/adr-051-shader-js-codegen-is-scalar-only.md)
  says why it stops at scalars; [SHADER_JS_CODEGEN.md](SHADER_JS_CODEGEN.md) says
  how to add an export.
- **A hit test consumes those scalars too**, rather than being a third
  description of the mark. The pileup strand arrowhead picks through
  `chevronContains` under the same generated `showChevron` gate the painters use;
  the dotplot pick measures with `capsuleDistPx`. Hover slack is a named
  tolerance against the shader's own distance. A Canvas2D-vs-GPU pixel diff
  cannot see a divergent hit shape, since it draws nothing. A predicate no draw
  path reaches must live in a `module` shader, or slangc eliminates it.
- **One draw helper, both consumers.** Geometry and colour math both paths (or
  overlay and SVG export) need lives in one function: `drawMafInsertionMarker`,
  `appendPointMarker`, `normalizeScore`, `syntenyRibbonPath`, `canvasEdgeFlags`.
  Change the shared function, not one caller.
- **One registry, exhaustively keyed.** Multi-layer displays list layers,
  z-order and gating once and map each id per backend through a
  `Record<LayerId, …>`, so a half-added layer is a compile error rather than a
  layer in one backend only, which also loses it from SVG export. Two bands with
  different draw signatures warrant a second mark list, never a second backend
  registry.

  **A pass drawn but never uploaded fails silently and on the GPU only**, since
  Canvas2D still paints it and the result reads as a GPU bug. Make the pass and
  its packer one object, `{ ...slangPass({…}), pack }` (`InstancePass`,
  `@jbrowse/render-core/instancePass`), so registration is not a wiring point and
  `ALIGNMENTS_PASSES` is derived. **The instance count comes with it:**
  `uploadPass` derives it as `buf.byteLength / pass.instanceStride`, because a
  separate count is a second expression for a number the buffer states, and a
  count past the bytes reads off the end with no throw. Where a worker packs the
  buffer and the main thread counts a parallel array, pin the two where they are
  joined (`packCoverageArea.test.ts`).

  **A pass `id` names a slot**: the descriptor a draw uses, the buffer in
  `RegionRegistry` and the pass's texture. Two passes sharing one collide in all
  three. The id does not key the compile, so a second id over one shader
  (`withPassId`, a ring view's eight rings) costs a descriptor and no pipeline.
  `assertUniquePassIds` runs in `createRenderingBackend` and `MockHal`.
- **A per-instance vertex budget is a cap the other backend lacks.** Where one
  instance draws an unbounded number of marks (canvas's chevron pass), the
  pipeline's `verticesPerInstance` fixes how many the shader can address and
  every instance pays for every slot. Raise it and all pay; leave it and a large
  input silently loses marks past it while Canvas2D keeps drawing them. No other
  mechanism here catches this, so state **the input range the budget covers where
  the number is**, measured. `MAX_VISIBLE_CHEVRONS_PER_LINE`
  (`sharedRendererConstants.ts`) is the worked example; read its figures there.
- **`SYNC:` comments are the fallback.** Use one only where a value must match
  across files and neither `export-consts`, `js-export` nor a numeric oracle test
  (`syntenyShaderParity.test.ts`) applies. **The tag means an unshared
  duplication and only that**: grepping it finds where we gave up, so a tag on a
  shared function is over-reporting.

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

Every mark-list display, whether per-region, whole-view or shared-canvas, gets
both backends from `createMarkBackend`. A display whose x axis is not the
block's bp span builds blocks with `canvasWideBlock` / `canvasWideBlocks`
(`render-core/renderBlock`); its marks read screen x off the payload through the
display's own transform.

**Hit testing.** A box-instance shape declares `ink(...)`, and `defineMark`
derives `hitNearest` from it (`shapeHitNearest`); the same `ink` drives the
chrome's highlight (`inkOfInstances`, ADR-110). A shape whose ink is not a box
keeps its own `hitNearest`.

Both halves extend abstract bases in `@jbrowse/render-core/perRegionRenderingBackend`.
**Overriding `Canvas2DPerRegionRenderingBackend.renderBlocks` silently drops**
the hi-DPI `prepareCanvas` sizing and the `painted` answer; subclass `draw`
instead. `GpuPerRegionRenderingBackend` uploads over the `regionPasses` the
subclass declares, and a pass that draws off a sibling's buffer is absent from
it (`createMarkBackend` derives that from marks with no `bufferOf`).
`renderBlocks` receives the model's data map, so the renderer holds none, and
`hal.drawPass` short-circuits on a missing buffer, so renderers draw
unconditionally.

Whole-map synced plugins (alignments) define their own backend interface; see
[GPU_DISPLAY_LIFECYCLE.md](GPU_DISPLAY_LIFECYCLE.md) §"Upload patterns".

## Wiggle-family contract

`@jbrowse/wiggle-core` is the cross-plugin contract for score-axis displays
(wiggle, Manhattan, marks); importing it avoids a dependency on the wiggle
plugin's MST factories or RPC methods. **Chrome and SVG frame are subpaths
(`ScorePlotChrome`, `ScorePlotSvgFrame`), not the barrel**: a config schema
imports the barrel at plugin install, and `index.eager.test.ts` fails if the
barrel reaches them.

`@jbrowse/plugin-wiggle`'s `linearWiggleDisplayConfigSchema` comes off the
barrel; the model factory **cannot**, because a value edge from the eager barrel
undoes the state model loader. Import
`@jbrowse/plugin-wiggle/LinearWiggleDisplay/stateModel` from the composing
display's own lazy loader. The zoom rule is the adapter's `zoomRange`
([ADR-125](../architecture-decision-records/adr-125-the-adapter-declares-the-zoom-range-its-answer-serves.md)).
GWAS's Manhattan is the mark display with a default plot
([ADR-178](../architecture-decision-records/adr-178-manhattan-is-the-mark-display-with-a-default-plot.md)).

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

Anything the upload callback knows from observable inputs can be looked up at
render time too, and less local state means fewer divergence points.

**The one legal renderer-held region map** is a private `regions` map written
**exclusively by the upload callback** and never mutated in place:
`RenderLifecycleMixin` bumps `renderTick` after every upload, so the cache cannot
stale. Alignments is the one display built that way. Still forbidden: a cache
populated elsewhere, entries patched in place, and mirroring the HAL's region map.

