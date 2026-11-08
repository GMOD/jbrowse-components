# @jbrowse/render-core

Lifecycle, upload cells, backend parity, HAL and shaders:
`agent-docs/reference/GPU_RENDERING.md`. **@experimental** — third-party plugins
pin an exact version.

- **Keep module state duplication-safe, or put it on the `globalThis` cell.**
  Old plugins bundle their own copy, so `GpuDeviceCell`'s shape is a
  cross-version contract.
- **The WebGL→Canvas2D ladder runs at backend construction only.** Later loss is
  `renderError`; `setGpuOverride` is the page-wide escape.
- **A backend subclass implements `draw`, never `render`/`renderBlocks`.** The
  bases own the frame scaffold and the `canvasDrawn` answer; a display never
  re-derives it from its own data.
- **Land a behavior change to one HAL in the other and in `MockHal`**, including
  the per-backend leaf hooks under `GpuHalBase`.
- Put `//! coverage: analytic` only on a shader whose fragments compute their
  own edge coverage; it drops the display's MSAA to 1 sample.

## Reversed blocks

Hand-rolled placement goes wrong only on flipped regions, where parity gates
still pass. Min-width widening → `spanLeft`'s pivot (`cellPlacement` for cells);
a worker strand → `flipX` before it becomes left/right; `bpRangeX` →
`bpRangeXTuple` or `writeBpRangeUniforms`.

## Upload

- **A cell keyed on a value reads that value from its own computed**, not
  through render state, or it re-uploads on every render-state change; only an
  upload-count test (`outlineUploadSchedule.test.ts`) sees that.
- **Observe a `createEncodeMemo` that the hit test or SVG export reads from an
  `afterAttach` autorun**, or it re-encodes every region per read.
- **Upload an empty pack unguarded** — an empty pack is the release.

## Drawing

- **Position DOM overlays from `model.scrollTop`, as the GPU canvas does**
  (`ScrollLockedOverlay`); a native `overflow:auto` tears labels from glyphs.
- **Take the pixel ratio from `getDpr()`** (capped at 2), not bare
  `devicePixelRatio`.
- **Write uniforms with the `writeUniforms` packer, or offset-pokes** where
  writes are incremental (alignments only). A poke left out redraws last frame's
  value.
- **Clip Canvas2D per block through `forEachClippedBlock`.**
- **A sampled color ramp is `textures` on `defineMark`**; a textured pass
  missing a texture draws nothing on either GPU HAL.
- **Stacked strips are `band` on `defineMark`**, a clip, not an offset. A
  display with its own frame scaffold (alignments' sections) scissors around
  `mark.drawRegion` itself and declares none.
