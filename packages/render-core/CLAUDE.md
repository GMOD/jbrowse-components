# @jbrowse/render-core

GPU/Canvas2D rendering primitives: the HAL, the MST draw-lifecycle mixin,
per-region / global backend base classes, clip / canvas geometry utilities and
the React backend hooks. Conceptual reference is
`agent-docs/reference/GPU_RENDERING.md`; this is what bites when editing _this
package_.

**@experimental** — a third-party plugin should pin an exact version.

**There is no barrel — the `exports` map is the API, one subpath per module.**
Adding a module means adding its `exports` entry and running `pnpm autogen`, not
adding a re-export.

**It must not depend on `@jbrowse/core`** — keeping this a leaf is what lets a
third-party display use it without pulling in core. Don't put `Gpu` on a symbol
that also drives the Canvas2D fallback.

The WebGL→Canvas2D ladder runs at **backend construction only**. A context lost
afterwards surfaces as `renderError`, with the page-wide `setGpuOverride` as the
escape.

**Module state must survive being duplicated, or live on the `globalThis`
cell.** ADR-030 makes this package static-import-only, so two live instances on
one page is the shipping shape. A class or memo per copy is fine; anything
page-wide is not — `gpuDevice` holds one physical device and the override the
_host_ writes, so per-copy state meant a plugin silently ignoring both.
`GpuDeviceCell`'s shape is a cross-version contract.

## The reversed-block family

Three ways to place a mark wrong on a flipped region, all invisible on forward
blocks. Don't hand-roll any of them: per-base cells take `makeCellLeftMapper`,
min-width widening takes `spanLeft`, and a **genomic** strand from the worker
takes a `block.reversed ? -d : d` / `flipX` before it becomes a left/right
decision. Each helper's JSDoc says when to reach for it, and
`reversedGlyphDirection.test.ts`'s header explains why a Canvas2D-vs-GPU parity
gate cannot catch the strand case.

## Other invariants

- **A scrolling GPU canvas and its DOM overlays must share one scroll source
  (`model.scrollTop`).** A native `overflow:auto` container is a second,
  compositor-driven scroll space, so on a fast scroll labels tear away from
  their glyphs. Wrap overlays in `ScrollLockedOverlay`.
- **HAL parity**: a behavior change to one HAL lands in the other and in
  `MockHal`. The gates are `browser-tests/compare-backends.ts` and
  `hal/regionRegistry.test.ts` — not the attribute layout, which
  `assertVertexInputsMatch` settles at `pnpm gen:shaders` time.
- **Every drawing path gets its ratio from `getDpr()`**, never a bare
  `devicePixelRatio` — it caps at 2, so a canvas sized by one with geometry from
  the other is scaled wrong. Analytics is not a drawing path.
- **Two uniform-write patterns, don't invent a third**: the generated
  object-packer when every field is set each frame, or offset-pokes when writes
  are incremental. The `bpRangeX` triple always goes through
  `writeBpRangeUniforms`.
- **Per-block Canvas2D clipping goes through `forEachClippedBlock`.** Its
  `select` callback is the single skip gate, and the `finally`-paired restore is
  what keeps a throwing painter from leaving every later frame clipped.
- **Don't redefine lifecycle state** (`canvasDrawn`, `renderTick`,
  `renderError`, …) — compose `RenderLifecycleMixin`.
- **Every backend extends `GpuRenderingBackendBase` /
  `Canvas2DRenderingBackendBase`, and its contract extends `RenderingBackend`.**
  The base is where `setErrorHandler` lives, which routes a HAL over-limit
  allocation to `renderError` and so raises the "too much data, zoom in" banner
  instead of a blank canvas. When it was optional, the three standalone backends
  — alignments, dotplot, synteny, the largest allocators in the app — were
  exactly the three whose OOMs reached nobody. A plugin's own backend interface
  should be the shared contract, not a member-for-member re-declaration.
- **Renderers stay stateless.** The one exception is a cache written exclusively
  by the upload callback and never patched in place.
- **Upload memos are helpers, not hand-rolled `let`s** —
  `createRegionUploadSync` / `createGlobalUploadSync` / `createKeyedUploadSync`.
  They drop their memos on a backend swap, which a hand-rolled version forgets,
  since context-loss recovery hands back empty GPU buffers. Create them
  _outside_ the `attachRenderingBackend` call and keep every input read
  unconditional.
- **A packed buffer reused across recolors is `createInstanceCache`.** Declare
  the options next to the `interleave` whose lanes they name, not in the
  renderer — the one way this breaks is a patch landing in a different lane than
  the pack. The geometry token must be a **coordinate** array (replaced
  atomically on refetch); a color array would never invalidate.
- **An `installPerRegionLifecycle` `encode` reads a narrow inputs getter, never
  the display's `renderState`.** The encode runs inside the per-key autorun, so
  every observable it touches re-encodes _every_ region — and a `renderState`
  carries the canvas box and row geometry, which move on each frame of a height
  drag. None of that is in the buffer, so the re-encode rebuilds byte-identical
  output at tens of MB per frame. The spelling is a getter named for the job
  (`gpuProps()`, `featurePaintInputs`); `encode: data => data` is the other safe
  shape.
- **A pass carries its packer — `{ ...slangPass({…}), pack }` — and the instance
  count comes off the packed bytes (`uploadPass`), never a second expression.**
  A count past `byteLength / stride` reads off the end of the buffer: undefined
  pixels, no throw. There is deliberately no constructor wrapping that spread.
  The obligation it buys: **a packer that over-allocates must right-size before
  returning**, preferring the copy to a subarray view, which pins the whole
  allocation.
- **Don't guard an empty upload.** Every HAL deletes the pass's prior buffer
  before it looks at the count, so an empty pack IS the release.
- **Multi-pass renderers bracket `sync()` with `beginUpload`/`endUpload`**, so a
  pass whose data went empty can't leave a stale buffer. To skip a region inside
  that bracket, `retainRegion` it. Per-region backends need none of this.
- A new shared `.slang` **shape** module needs two real consumers and
  non-obvious math — ADR-040 rejected the generic quad skeleton on that test.
