# @jbrowse/render-core

The HAL, the draw-lifecycle mixin, backend base classes, clip/canvas geometry,
React backend hooks.

`agent-docs/ARCHITECTURE.md` ("What not to do") and `reference/GPU_RENDERING.md`
(lifecycle, the four upload patterns and the three installers that drive them,
backend parity, HAL, shaders) own the rules those two state; don't restate them.
What follows is this package's own.

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
- **A backend subclass implements `draw`, never `render`/`renderBlocks`.** Both
  families' bases own the frame scaffold — `resize` + paired
  `beginFrame`/`endFrame` on GPU, `prepareCanvas` on Canvas2D — and own the "did
  real content reach the canvas" answer `RenderLifecycleMixin` flips
  `canvasDrawn` from. A display that re-derives that answer from its own data is
  answering a different question than the renderer's guard.
- **HAL parity**: a behavior change to one HAL lands in the other and in
  `MockHal`. The gates are `browser-tests/compare-backends.ts` and
  `hal/regionRegistry.test.ts` — not the attribute layout, which
  `assertVertexInputsMatch` settles at `pnpm gen:shaders` time.
- A shared `.slang` **shape** module needs two real consumers and non-obvious
  math (ADR-040).

## The reversed-block family

Three ways to misplace a mark on a flipped region, all invisible on forward
blocks. Don't hand-roll: per-base cells → `makeCellLeftMapper`, min-width
widening → `spanLeft`, a genomic strand from the worker → `flipX` /
`block.reversed ? -d : d` before it becomes left/right. Each helper's JSDoc says
when to reach for it; `reversedGlyphDirection.test.ts` says why a
Canvas2D-vs-GPU parity gate cannot catch the strand case.

## Upload

- **A display installs a lifecycle; it never calls `attachRenderingBackend`.**
  Three installers are the whole taxonomy — `installPerRegionLifecycle` (a keyed
  map of per-region payloads, streamed or from a whole-map computed),
  `installKeyedLifecycle` (one canvas shared by sibling displays) and
  `installGlobalLifecycle` (one whole-view payload, with named slots when its
  uploads have independent inputs). A display fitting none of them wants a
  fourth installer here, not a hand-rolled attach. `noHandRolledAttach` in
  `eslint.config.mjs` is the check; ADR-079 is the why.
- **Whatever an installer's callbacks close over goes inside the setup thunk**,
  which `attachRenderingBackend` runs once. A second call swaps the backend and
  keeps the first call's callbacks, so state allocated outside it is rebuilt and
  dropped on every context-loss recovery — silently, because the original copy
  is still doing the work.
- **`createInstanceCache` for a buffer reused across recolors.** Declare its
  options beside the `interleave` whose lanes they name, not in the renderer —
  the one way this breaks is a patch landing in a different lane than the pack.
  Its geometry token must be a **coordinate** array (replaced atomically on
  refetch); a color array would never invalidate.
- **An `installPerRegionLifecycle` declares a narrow `inputs` getter
  (`gpuProps()`), never the display's `renderState`.** Its identity re-encodes
  _every_ region, and a `renderState` carries the canvas box and row geometry,
  which move on each frame of a height drag — rebuilding byte-identical output
  at tens of MB per frame. Omitting `inputs` is the other safe shape, for an
  encode that needs nothing (`encode: data => data`). Reading an observable
  inside `encode` is no longer the trap it was (ADR-078: it invalidates
  nothing), but state the dependency in `inputs` or a settings change will not
  reach the buffer.
- **Don't guard an empty upload.** Every HAL deletes the pass's prior buffer
  before it looks at the count, so an empty pack IS the release.

## Drawing

- **A scrolling GPU canvas and its DOM overlays must share one scroll source
  (`model.scrollTop`)** — wrap overlays in `ScrollLockedOverlay`. A native
  `overflow:auto` container is a second, compositor-driven scroll space, so on a
  fast scroll labels tear away from their glyphs.
- **Every drawing path gets its ratio from `getDpr()`**, never a bare
  `devicePixelRatio` — it caps at 2, so a canvas sized by one with geometry from
  the other is scaled wrong. Analytics is not a drawing path. The cap's own
  consequences are in `reference/ARCHITECTURAL_LIMITS.md`.
- **Two uniform-write patterns, don't invent a third**: the generated
  object-packer (`writeUniforms`) when every field is set in one place, or
  offset-pokes when writes are incremental. Every per-region and global renderer
  but alignments is now the first — the packer makes the set _total_, and the
  scratch buffer outlives the frame, so a poke left out silently redraws with
  last frame's value. Alignments is the second and stays: it writes the palette
  once ahead of the block loop, then per section.
- **The `bpRangeX` triple never gets hand-rolled** — `bpRangeXTuple` as a packer
  field, or `writeBpRangeUniforms` if you are poking. Both carry the reversed
  pivot, which is the part that goes wrong.
- **Per-block Canvas2D clipping goes through `forEachClippedBlock`.** Its
  `select` callback is the single skip gate, and the `finally`-paired restore is
  what keeps a throwing painter from leaving every later frame clipped.
