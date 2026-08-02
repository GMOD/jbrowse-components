# @jbrowse/render-core

Cross-plugin GPU/Canvas2D rendering primitives: the HAL (WebGL2 / WebGPU /
mock), the MST draw-lifecycle mixin, the per-region / global backend base
classes, the React backend hooks, and the shared clip / canvas / hp-math
utilities.

**This package depends only on `mobx` + `@jbrowse/mobx-state-tree` (+ `react` as
a peer). It must NOT depend on `@jbrowse/core`** — the dependency runs the other
way (`@jbrowse/core` and the LGV plugin consume render-core). Keeping it a leaf
is the whole point: a third-party GPU/Canvas2D display can depend on this
without pulling in all of core. If you find yourself reaching for something in
`@jbrowse/core`, either it belongs here too, or the code belongs in core, not
here.

## Public surface + naming

`src/index.ts` is the curated `@experimental` public API; per-file subpaths
(`@jbrowse/render-core/hal`, …) exist for fine-grained imports. `webgpuUtils`
and shader codegen are intentionally out of the barrel. This is the only import
path — the old `@jbrowse/core/gpu/*` re-export shims were removed once every
in-tree import migrated here (ADR-030 shim-retirement follow-up). Shader codegen

- the shared `.slang` modules live here in `src/shaders` (the math atoms
  `hpmath`/`colorPack`, plus the shape modules `pointGlyph`/`diagonalGrid`/
  `rowRect`) and the feature-glyph passes live in the canvas plugin; the codegen
  emits `@jbrowse/render-core/hal` imports into every `.generated.ts`.

`Gpu` prefix = WebGL/WebGPU-specific (`GpuHal`, `gpuDevice`, the `Gpu*Backend`
bases). Anything driving **both** GPU and Canvas2D is backend-agnostic with a
neutral name (`RenderLifecycleMixin`, `PerRegionRenderingBackend`, `Canvas2D*`,
`useRenderingBackend`). Don't put `Gpu` on an agnostic symbol — the same path
runs the Canvas2D fallback. `useRenderingBackend` owns the whole canvas-init /
context-loss / device-loss / pagehide / retry lifecycle.

**The WebGL→Canvas2D ladder in `createGpuHal` runs at backend construction
only.** A context lost afterwards never degrades to Canvas2D by itself, so the
hook reports an unrestored loss as `renderError` (whose unmount is the only way
to get a live context back) and the banner offers the page-wide
`setGpuOverride('canvas2d')` switch. See `agent-docs/reference/GPU_RENDERING.md`
"Context-loss recovery"; don't add a second, per-display fallback path.

**Conceptual reference: `agent-docs/reference/GPU_RENDERING.md`.** This file
documents only what bites when editing _this package_.

## Local invariants

- **A scrolling GPU canvas and its DOM overlays MUST share one scroll source
  (`model.scrollTop`).** The canvas GPU displays scroll VIRTUALLY: a fixed
  (`position:absolute`) canvas painting the visible window at `inst.y - scrollY`
  (`scrollY = model.scrollTop`), a `VerticalScrollbar` overlay + a
  `useVirtualScrollWheel` handler driving `model.scrollTop`, and DOM overlays
  translated by the same value. The failure mode this avoids: a native
  `overflow:auto` container (a second, compositor-driven scroll space) — the DOM
  overlays would ride the compositor while the canvas repaints from the
  main-thread `model.scrollTop`, so on a fast scroll the labels/highlights tear
  away from their glyphs. Wrap DOM overlays in `ScrollLockedOverlay` (this
  package): it clips to the viewport and shifts children by `-scrollTop` so they
  track the canvas. Used by `LinearBasicDisplay` (FeatureComponent);
  `LinearMultiSampleVariantDisplay` positions its hover highlight from
  `model.scrollTop` inline. The alignments pileup uses the same single-source
  virtual model.
- **HAL parity.** A behavior change to one HAL must land in the other and in
  `MockHal`. `products/jbrowse-web/src/tests/glAttributeSync.test.ts` parses the
  generated GLSL and asserts every `GL_ATTRIBUTE` matches a shader input — keep
  it green.
- **Scissor/viewport are physical pixels, top-left origin.** WebGL flips Y
  internally (`canvas.height - y - h`); WebGPU stores the rect and applies it
  per `drawPass`. Both GPU and Canvas2D clamp the visible span through
  `clampBlockScissor` (CSS px) so they clip the _same_ columns — don't reinline
  the floor/ceil rounding.
- **Two canvas-sizing helpers, on purpose.** `syncCanvasSize` sets the backing
  store **and** CSS (the HAL owns its canvas). `prepareCanvas` sets only the
  backing store — React/layout owns the CSS size. Don't add CSS to
  `prepareCanvas`.
- **Every drawing path gets its ratio from `getDpr()`, never a bare
  `devicePixelRatio`.** It caps at `MAX_DPR` (2), so the two reads answer
  differently on a dpr>2 device, and a canvas sized by one while its geometry is
  computed from the other is scaled wrong. This covers shader uniforms that
  rebuild backing-store dimensions from CSS ones, not just canvas sizing —
  `GpuVariantMatrixRenderer`'s `devicePixelRatio` uniform is one. Reporting the
  _device_ (analytics, error dialogs) is not a drawing path and correctly reads
  the raw global.
- **WebGPU uniform ring buffer.** `writeUniforms` post-increments the slot;
  `drawPass` reads slot `n-1`. Always pair one `writeUniforms` with the
  `drawPass`(es) that consume it; the per-frame cap is `MAX_UNIFORM_SLOTS`.
- **Two uniform-write patterns, pick by write shape — don't invent a third.** A
  renderer fills its uniform buffer one of two ways: the generated
  **object-packer** `shader.writeUniforms(buf, { …every field… })` when it sets
  all fields each frame (rect/`GpuCanvasFeatureRenderer`), or **offset-pokes**
  `const U = shader.UNIFORM_OFFSET_F32; f32[U.field] = …` when writes are
  incremental/conditional (hic, dotplot, wiggle, most others). The offset maps
  are **split by scalar type** — `UNIFORM_OFFSET_F32` (float fields only),
  `_I32` (int), `_U32` (uint) — so a field only appears under the map whose
  typed-array view it may be written through, and `i32[U.someFloatField]` fails
  at tsc instead of silently corrupting. Alias each view you touch
  (`const U = …_F32, UI = …_I32, UU = …_U32`) and poke `f32[U.x]` / `i32[UI.y]`
  / `u32[UU.z]`; the codegen emits only the maps a shader actually needs (a
  float-only shader has no `_I32` / `_U32`). The one write every genome-mapped
  shader shares — the hp-math `bpRangeX` triple (a float3, so it lives in the
  F32 map) — goes through
  `writeBpRangeUniforms(f32, U.bpRangeX, clip, reversed)` in either pattern;
  don't hand-roll the `f32[U.bpRangeX + n] = …` triple (the reversed-block pivot
  is easy to get subtly wrong per copy). Instance `FIELD_OFFSET_F32` stays a
  single flat map — structured instance data has the type-safe `packInstances`
  packer, and multi-source interleavers pack through one map.
- **Per-base Canvas2D cells go through `makeCellLeftMapper`, never
  `makeBpMapper` directly.** `makeBpMapper(bp)` is the cell's left edge only on
  a forward block: reversed runs bp leftward, so it returns the _right_ edge and
  a `fillRect(x, y, +w, h)` from there covers the neighboring base. One base of
  error — invisible zoomed out (cells floor to ~1px), glaring zoomed in, and
  only on flipped regions, so it survives review. MAF and the alignments pileup
  each hand-rolled this pivot; the pileup got it wrong across all five of its
  cell layers. Two-edge spans (`min(toX(start), toX(end))`) and boundary marks
  (insertions, clip bars) are orientation-safe and don't need it. Cell _width_
  stays with the caller — it's a per-plugin rule. The Canvas2D twin of
  `writeBpRangeUniforms` above.

- **Min-width widening goes through `spanLeft(x1, x2, width)`, never
  `max(minPx, abs(dx))` off `min(x1, x2)`.** Both spellings widen a sub-pixel
  mark to the floor, but only the first anchors the feature's _start_ edge the
  way the shaders' `extendToMinWidthX` does. On a reversed block `makeBpMapper`
  flips, so the leftmost edge is the feature's _end_ and the in-place spelling
  slides the mark up to `minPx` toward the block's end — invisible on forward
  blocks, so it survives review. The canvas rect painter (2px) and the multi-row
  painter (1px) each had it. Same shape of bug as the `makeCellLeftMapper` pivot
  above — and note the two are alternatives, not partners: a painter either
  fills per-base _cells_ (`makeCellLeftMapper`, caller owns width) or a two-edge
  _span_ widened to a floor (`spanLeft`). MAF's cell painter is the former,
  wiggle/multi-row/canvas-rect the latter.
- **A strand/direction crossing the worker boundary is _genomic_; flip it before
  it places anything on screen.** The worker cannot know `reversed` — it packs
  the feature's own strand — so every renderer that turns one into a left/right
  decision owes it a `block.reversed ? -d : d` (Canvas2D) or `flipX(d, u)`
  (shader). Third member of the family above, and the nastiest to catch: both
  backends read the same field, so getting it wrong in one place usually means
  getting it wrong identically in both, and the Canvas2D-vs-GPU parity gate sees
  nothing. The canvas plugin flipped `lineDirections` and `arrowDirections` but
  not `rectStrands`, so on a flipped region a + gene's continuation markers
  pointed opposite the strand arrows on the same glyph. Two ways to be safe by
  construction, both in alignments: build the geometry unflipped and `flipX` the
  final position (`read.slang` — mirroring the shape mirrors its direction, and
  note this requires `bpLen` stay POSITIVE rather than baking reversal into the
  bp range as canvas does), or derive the sign from screen x's you already have
  (`chevronApexX`'s `Math.sign(tipX - otherX)`). A strand used only to pick a
  _color_ (arcs' inversion/deletion junction kinds) or a symmetric glyph
  (variants' shapes) needs no flip — say so where it isn't obvious.
- **Per-block Canvas2D clipping goes through `forEachClippedBlock`, never a
  hand-rolled `save`/`clip`/`restore` loop.** It is the Canvas2D twin of
  `GpuPerRegionRenderingBackend.renderBlocks`' per-block scissor, and it owns
  the three things painters kept re-deriving: the `clipBlockForCanvas` null
  check, the `(scissorX, 0, scissorW, clipHeight)` rect, and the save/restore
  pairing (in a `finally`, since an on-screen ctx outlives the frame and
  `prepareCanvas` does **not** reset clip state — one throwing painter would
  otherwise leave every later frame drawing through a stale clip). Its `select`
  callback is the single skip gate: return `undefined` for "no region", "zero
  features", or "the sub-field this painter needs is absent" (MAF's
  `?.coverage`). Skipping there rather than inside `paint` is load-bearing on
  the export path — `SvgCanvas.clip()` emits a `<clipPath>` + group
  unconditionally, so a block skipped _after_ the clip opens leaves dead markup
  in the SVG. Painters that clip to a sub-band pass that band's height, not
  `canvasHeight` (MAF coverage).
- **`gpuDevice` is a shared singleton.** `getGpuDevice` serves both the HAL and
  the LD-matrix WebGPU compute path (`plugins/variants/.../getLDMatrixGPU.ts`),
  so its `?renderer=` override checks are load-bearing in both. The `.lost`
  handler guards on device identity — keep that guard when touching recovery.
  Tests reset via `resetGpuDeviceForTests`.
- **Don't redefine lifecycle state.** `canvasDrawn`, `currentRenderingBackend`,
  `renderTick`, `autorunsInstalled`, `renderError` and their actions belong to
  `RenderLifecycleMixin`; plugins compose, never re-declare. `renderError` is
  the single source for the `renderError` terminal phase (`displayPhase`) —
  `useRenderingBackend` writes it via `setRenderError`; don't fork a
  display-local copy. `attachRenderingBackend` is idempotent — re-calling only
  swaps the backend (context-loss recovery), and the upload autorun bumps
  `renderTick` so render re-fires after every upload.
- **Renderers stay stateless.** No per-region `Map` on a renderer class —
  delegate buffer lifecycle to `hal.pruneRegions(active)` and read per-region
  data from the model's map passed into `renderBlocks(blocks, regions, state)`.
  The one sanctioned exception is a cache written **exclusively by the upload
  callback** and never patched in place (alignments' `sync(sources)`, on both
  its GPU and Canvas2D backends): `RenderLifecycleMixin` bumps `renderTick`
  after every upload, so the render autorun re-fires and the cache cannot stale.
  Still forbidden: a cache populated from anywhere else, or one whose entries
  are mutated. ARCHITECTURE.md "What not to do" carries the same rule.
- **Upload memos are helpers, not hand-rolled `let`s.** The mixin gives a
  display one upload autorun, so every observable any upload reads re-fires all
  of them. Per-region maps diff through `createRegionUploadSync`; a monolithic
  display with **independently-keyed** slots (HiC: RPC matrix + config palette)
  diffs through `createGlobalUploadSync`; a backend **shared by sibling
  displays** (the dotplot view's canvas, the synteny level's canvas) diffs
  through `createKeyedUploadSync`, which deletes departed keys one at a time
  rather than active-set pruning a sibling's buffers away — keyed by
  `sharedBackendKey(display.id)`, never a list index, which renumbers on a hide
  and aliases one display's buffer onto another. A shared-canvas backend's
  `render` also returns `void` and repaints unconditionally (clear, then draw
  what it holds): nothing else repaints that canvas, so an early return is how a
  hidden display's pixels survive. All three drop their memos on a backend swap,
  which is the part a hand-rolled version forgets — context-loss recovery hands
  back a backend with empty GPU buffers. Create any of them _outside_ the
  `attachRenderingBackend` call (it captures callbacks from the first call
  only), and keep every input read unconditional so none drops out of the
  dependency set. A display whose slots share one source (LD) needs none of
  them.
- **Multi-pass renderers bracket `sync()` with `hal.beginUpload()` /
  `hal.endUpload()`.** Between them every `uploadBuffer` is recorded;
  `endUpload` destroys any pass buffer _not_ rewritten — so a pass whose data
  went empty (and was skipped by an `if (n > 0)` guard) can't leave a stale
  buffer, with no per-region pre-wipe. This is what makes those guards safe by
  construction; `GpuAlignmentsRenderer` relies on it. Single-pass renderers
  (wiggle, hic, maf, variants, manhattan) don't need it — they `deleteRegion`
  explicitly on the empty case right next to their one upload, which is already
  unambiguous.
- **Never hand-edit `*.generated.ts`.** Edit the `.slang` source and run
  `pnpm gen:shaders` (see root `CLAUDE.md` and ADR-005). The shared `.slang`
  modules live here in `src/shaders` — the codegen's `SHARED_INCLUDE` — so any
  shader repo-wide can `import hpmath;`. Two kinds: **atoms**
  (`hpmath`/`colorPack`) that take primitives, never a `Uniforms` struct, and
  **shape** modules (`pointGlyph`, `diagonalGrid`, `rowRect`) that own a whole
  glyph two-plus plugins draw identically. A new shape module needs the
  `pointGlyph` justification — two real consumers, non-obvious or drift-prone
  math — not surface similarity; ADR-040 rejected the generic quad skeleton and
  the single-consumer composition helper on exactly that test. The build script
  itself lives in `@jbrowse/shader-tools`.
