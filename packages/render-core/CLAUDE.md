# @jbrowse/render-core

GPU/Canvas2D rendering primitives for JBrowse displays: the hardware abstraction
layer (HAL), the MST draw-lifecycle mixin, per-region / global backend base
classes, the shared clip / canvas geometry utilities, and the React backend
hooks.

**@experimental** — names and signatures may change before this package is
frozen under semver. A third-party plugin depending on it should pin an exact
version and expect to rebuild on upgrades.

Conceptual reference is `agent-docs/reference/GPU_RENDERING.md`; this is only
what bites when editing _this package_.

**There is no barrel — the `exports` map is the API, one subpath per module.**
`src/index.ts` used to re-export a curated surface alongside the subpaths, which
meant every symbol had two import paths that nothing kept in agreement. It was
also 88/90 redundant with the subpath map, and the two names it did not share
(`RecoveryBudget`, `RecoveryVerdict`) are `useRenderingBackend` internals the
barrel's own docblock said it did not re-export. Every in-repo consumer already
imported subpaths — 336 subpath imports against 15 barrel ones — so the barrel
went and those 15 moved. Adding a module means adding its `exports` entry and
running `pnpm autogen`; it does not mean adding a re-export anywhere.

**It must not depend on `@jbrowse/core`** — the dependency runs the other way,
and keeping this a leaf is what lets a third-party display use it without
pulling in core. Don't put `Gpu` on a symbol that also drives the Canvas2D
fallback.

The WebGL→Canvas2D ladder runs at **backend construction only**. A context lost
afterwards surfaces as `renderError` with the page-wide `setGpuOverride` escape;
don't add a second per-display fallback path.

**Module state must survive being duplicated, or live on the `globalThis`
cell.** ADR-030 makes this package static-import-only, so a third-party display
bundles its own copy — two live instances on one page is the shipping shape, not
an edge case. A class or a memo per copy is fine. Anything page-wide is not:
`gpuDevice` holds one physical device and the override the _host_ writes
(`?renderer=`, the "disable GPU" banner button), so per-copy state meant a
plugin silently ignoring both. See `GpuDeviceCell` — its shape is a
cross-version contract, and the tests that pin this load a second copy through
`jest.resetModules`.

## The reversed-block family

Three ways to place a mark wrong on a flipped region, all invisible on forward
blocks. Don't hand-roll any of them: per-base cells take `makeCellLeftMapper`,
min-width widening takes `spanLeft`, and a **genomic** strand from the worker
takes a `block.reversed ? -d : d` / `flipX` before it becomes a left/right
decision. Each helper's JSDoc says when to reach for it; `canvas2dUtils.test.ts`
and `LinearBasicDisplay/reversedGlyphDirection.test.ts` pin the behavior, and
the latter's header explains why a Canvas2D-vs-GPU parity gate cannot catch the
strand case.

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
  pays the clip round trip per empty block — and the `finally`-paired restore is
  what keeps a throwing painter from leaving every later frame clipped.
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
- **An `installPerRegionLifecycle` `encode` reads a narrow inputs getter, never
  the display's `renderState`.** The encode runs inside the per-key autorun, so
  every observable it touches is a re-encode trigger for _every_ region — and a
  `renderState` carries the canvas box and the row geometry, which move on each
  frame of a height drag or a window resize. None of that is in the buffer: the
  geometry reaches the shader as uniforms, so the re-encode rebuilds byte-
  identical output, at tens of MB and a pass over every feature, per frame. The
  established spelling is a getter named for the job — maf's and wiggle's
  `gpuProps()`, multi-row features' `featurePaintInputs` (which the hit test
  reads too, so it is deliberately not `gpuProps`). Manhattan and sequence
  encode `data => data` and read nothing, which is the other safe shape.
- **A pass carries its packer — `{ ...slangPass({…}), pack }`, an `InstancePass`
  — and the instance count comes off the packed bytes (`uploadPass`), never from
  a second expression.** A count past `byteLength / stride` reads off the end of
  the buffer: undefined pixels, no throw. There is deliberately no constructor
  wrapping that spread; `slangPass` stays the one way a pass is built. The
  obligation that buys: **a packer that over-allocates must right-size before
  returning**, and prefer the copy to a subarray view — a view pins the whole
  allocation and these payloads are retained per region
  (`InstanceWriter.finish`, `buildMultiRowInstanceBuffer`).
- **Don't guard an empty upload.** Every HAL deletes the pass's prior buffer
  before it looks at the count, so an empty pack IS the release. That is how a
  per-region backend clears exactly the passes that emptied without dropping the
  region.
- **Multi-pass renderers bracket `sync()` with `beginUpload`/`endUpload`**, so a
  pass whose data went empty can't leave a stale buffer. To skip a region inside
  that bracket, `retainRegion` it — the sweep destroys anything not rewritten,
  and the exemption is whole-region so the emptied-pass guarantee survives.
  Per-region backends need none of this: `uploadRegion` is the base's, over the
  `regionPasses` they declare.
- A new shared `.slang` **shape** module needs two real consumers and
  non-obvious math — ADR-040 rejected the generic quad skeleton on that test.
