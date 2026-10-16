# @jbrowse/render-core

Lifecycle, upload cells, backend parity, HAL and shaders:
`agent-docs/reference/GPU_RENDERING.md`. **@experimental** — third-party plugins
pin an exact version.

- **Must not depend on `@jbrowse/core`.**
- **Module state survives duplication or lives on the `globalThis` cell.** Old
  plugins bundle their own copy, so `GpuDeviceCell`'s shape is a cross-version
  contract.
- **The WebGL→Canvas2D ladder runs at backend construction only.** Later loss is
  `renderError`; `setGpuOverride` is the page-wide escape.
- **A backend subclass implements `draw`, never `render`/`renderBlocks`.** The
  bases own the frame scaffold and the "did content reach the canvas" answer
  `canvasDrawn` reads; a display must not re-derive it from its own data.
- **HAL parity**: a behavior change to one HAL lands in the other and in
  `MockHal`, including in the per-backend leaf hooks under `GpuHalBase`. Gates:
  `browser-tests/compare-backends.ts`, `hal/regionRegistry.test.ts`.
- `//! coverage: analytic` only on a shader whose fragments compute their own
  edge coverage; it drops the display's MSAA to 1 sample.

## Reversed blocks

Hand-rolled placement goes wrong only on flipped regions, where parity gates
still pass. Min-width widening → `spanLeft`'s pivot (`cellPlacement` for cells);
a worker strand → `flipX` before it becomes left/right; `bpRangeX` →
`bpRangeXTuple` or `writeBpRangeUniforms`.

## Upload

- **Whatever the installer's callbacks close over goes inside the setup thunk.**
  A second attach keeps the first call's callbacks, so state allocated outside
  is rebuilt and dropped on every context-loss recovery.
- **`inputs` is a narrow getter (`gpuProps()`), never `renderState`.** Its
  identity re-encodes every region, and `renderState` moves on every frame of a
  height drag.
- **A cell keyed on a value reads that value from its own computed**, not
  through render state. Synteny's outline cell read `clickedFeatureId` off
  `renderParams` and re-uploaded per pointermove; only an upload-count test
  (`outlineUploadSchedule.test.ts`) sees that.
- **`createInstanceCache`'s token is a coordinate array**, replaced on refetch;
  a color array never invalidates. Its options sit beside the `interleave` whose
  lanes they name.
- **A memo the hit test or SVG export reads (`createEncodeMemo`) needs an
  `afterAttach` autorun observing it**, or it re-encodes every region per read.
- **Don't guard an empty upload** — an empty pack is the release.
- A display with nothing to upload leaves the key out rather than storing
  `undefined`.

## Drawing

- **GPU canvas and DOM overlays share `model.scrollTop`**
  (`ScrollLockedOverlay`); a native `overflow:auto` tears labels from glyphs.
- **Ratio comes from `getDpr()`** (capped at 2), never bare `devicePixelRatio`.
- **Uniforms: `writeUniforms` packer, or offset-pokes** where writes are
  incremental (alignments only). A poke left out silently redraws last frame's
  value.
- **Per-block Canvas2D clipping goes through `forEachClippedBlock`.**
- **A box shape declares `ink` and no `hitNearest`**; `defineMark` derives the
  hit test (ADR-110).
- **A sampled color ramp is `textures` on `defineMark`**; a textured pass
  missing a texture draws nothing on either GPU HAL.
- **Stacked strips are `band` on `defineMark`**, a clip, not an offset. A
  display with its own frame scaffold (alignments' sections) scissors around
  `mark.drawRegion` itself and declares none.
