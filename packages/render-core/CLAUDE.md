# @jbrowse/render-core

Conceptual reference is `agent-docs/reference/GPU_RENDERING.md`; this is only
what bites when editing _this package_.

**It must not depend on `@jbrowse/core`** — the dependency runs the other way,
and keeping this a leaf is what lets a third-party display use it without
pulling in core. Don't put `Gpu` on a symbol that also drives the Canvas2D
fallback.

The WebGL→Canvas2D ladder runs at **backend construction only**. A context lost
afterwards surfaces as `renderError` with the page-wide `setGpuOverride` escape;
don't add a second per-display fallback path.

## The reversed-block family — three shapes of one bug

All three are invisible on forward blocks, so they survive review.

- **Per-base Canvas2D cells go through `makeCellLeftMapper`**, never
  `makeBpMapper` directly — reversed runs bp leftward, so a raw mapper returns
  the cell's _right_ edge and the fill covers the neighboring base.
- **Min-width widening goes through `spanLeft(x1, x2, width)`**, not
  `max(minPx, abs(dx))` off `min(x1, x2)` — only the first anchors the feature's
  _start_ edge the way the shaders do.
- **A strand crossing the worker boundary is _genomic_; flip it before it places
  anything on screen** (`block.reversed ? -d : d`, or `flipX`). The worker
  cannot know `reversed`. Both backends read the same field, so getting it wrong
  usually means getting it wrong identically in both and the parity gate sees
  nothing. Safest by construction: build geometry unflipped and `flipX` the
  final position. A strand used only to pick a color or a symmetric glyph needs
  no flip — say so where it isn't obvious.

## Other invariants

- **A scrolling GPU canvas and its DOM overlays must share one scroll source
  (`model.scrollTop`).** A native `overflow:auto` container is a second,
  compositor-driven scroll space, so on a fast scroll the labels tear away from
  their glyphs. Wrap overlays in `ScrollLockedOverlay`.
- **HAL parity**: a behavior change to one HAL lands in the other and in
  `MockHal`. `glAttributeSync.test.ts` is the gate.
- **Every drawing path gets its ratio from `getDpr()`**, never a bare
  `devicePixelRatio` — it caps at 2, so the two disagree above that and a canvas
  sized by one with geometry from the other is scaled wrong. Analytics is not a
  drawing path.
- **Two uniform-write patterns, don't invent a third**: the generated
  object-packer when every field is set each frame, or offset-pokes when writes
  are incremental. The `bpRangeX` triple always goes through
  `writeBpRangeUniforms` — the reversed-block pivot is easy to get subtly wrong
  per copy.
- **Per-block Canvas2D clipping goes through `forEachClippedBlock`.** Its
  `select` callback is the single skip gate — skipping inside `paint` instead
  leaves dead `<clipPath>` markup in the SVG export, and the `finally`-paired
  restore is what keeps a throwing painter from leaving every later frame
  clipped.
- **Don't redefine lifecycle state** (`canvasDrawn`, `renderTick`,
  `renderError`, …) — plugins compose `RenderLifecycleMixin`, never re-declare.
- **Renderers stay stateless.** The one sanctioned exception is a cache written
  exclusively by the upload callback and never patched in place.
- **Upload memos are helpers, not hand-rolled `let`s** —
  `createRegionUploadSync` / `createGlobalUploadSync` / `createKeyedUploadSync`.
  They drop their memos on a backend swap, which is the part a hand-rolled
  version forgets, since context-loss recovery hands back empty GPU buffers.
  Create them _outside_ the `attachRenderingBackend` call and keep every input
  read unconditional.
- **Multi-pass renderers bracket `sync()` with `beginUpload`/`endUpload`**, so a
  pass whose data went empty can't leave a stale buffer.
- A new shared `.slang` **shape** module needs two real consumers and
  non-obvious math — ADR-040 rejected the generic quad skeleton on that test.
