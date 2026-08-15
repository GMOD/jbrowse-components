# @jbrowse/render-core

The HAL, the draw-lifecycle mixin, backend base classes, clip/canvas geometry,
React backend hooks.

Rules for _using_ this package are in `agent-docs/ARCHITECTURE.md` ("What not to
do") and `reference/GPU_RENDERING.md` (lifecycle, the four upload patterns, HAL,
shaders). Don't restate them here. What follows is specific to editing the
package itself.

**@experimental** — third-party plugins should pin an exact version.

- **No barrel — the `exports` map is the API.** New module = new entry +
  `pnpm autogen`.
- **Must not depend on `@jbrowse/core`.** Don't put `Gpu` on a symbol that also
  drives the Canvas2D fallback.
- **Module state must survive duplication, or live on the `globalThis` cell.**
  ADR-030 makes this static-import-only, so two live copies on one page is the
  shipping shape; `GpuDeviceCell`'s shape is a cross-version contract.
- **The WebGL→Canvas2D ladder runs at backend construction only.** Later loss is
  `renderError`; `setGpuOverride` is the page-wide escape.
- **`GpuRenderingBackendBase` / `Canvas2DRenderingBackendBase` own
  `setErrorHandler`**, which turns a HAL over-limit allocation into the "too
  much data, zoom in" banner rather than a blank canvas.
- A shared `.slang` **shape** module needs two real consumers and non-obvious
  math (ADR-040).

## The reversed-block family

Three ways to misplace a mark on a flipped region, all invisible on forward
blocks. Don't hand-roll: per-base cells → `makeCellLeftMapper`, min-width
widening → `spanLeft`, a genomic strand from the worker → `flipX` /
`block.reversed ? -d : d` before it becomes left/right. Each helper's JSDoc says
when to reach for it; `reversedGlyphDirection.test.ts` says why a
Canvas2D-vs-GPU parity gate cannot catch the strand case.
