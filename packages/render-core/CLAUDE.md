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

- the shared `.slang` modules (`hpmath`/`colorPack`) live here in `src/shaders`
  and the feature-glyph passes live in the canvas plugin; the codegen emits
  `@jbrowse/render-core/hal` imports into every `.generated.ts`.

`Gpu` prefix = WebGL/WebGPU-specific (`GpuHal`, `gpuDevice`, the `Gpu*Backend`
bases). Anything driving **both** GPU and Canvas2D is backend-agnostic with a
neutral name (`RenderLifecycleMixin`, `PerRegionRenderingBackend`, `Canvas2D*`,
`useRenderingBackend`). Don't put `Gpu` on an agnostic symbol — the same path
runs the Canvas2D fallback. `useRenderingBackend` owns the whole canvas-init /
context-loss / device-loss / pagehide / retry lifecycle.

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

- **Min-width widening goes through `extendToMinWidth`, never
  `max(minPx, abs(dx))` off `min(x1, x2)`.** Both spellings widen a sub-pixel
  mark to the floor, but only the first anchors the feature's _start_ edge the
  way the shaders' `extendToMinWidthX` does. On a reversed block `makeBpMapper`
  flips, so the leftmost edge is the feature's _end_ and the in-place spelling
  slides the mark up to `minPx` toward the block's end — invisible on forward
  blocks, so it survives review. The canvas rect painter (2px) and the multi-row
  painter (1px) each had it. Same shape of bug as the `makeCellLeftMapper` pivot
  below — and note the two are alternatives, not partners: a painter either
  fills per-base _cells_ (`makeCellLeftMapper`, caller owns width) or a two-edge
  _span_ widened to a floor (`extendToMinWidth`). MAF's cell painter is the
  former, wiggle/multi-row/canvas-rect the latter.
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
  modules (`hpmath`/`colorPack`) live here in `src/shaders` — the codegen's
  `SHARED_INCLUDE` — so any shader repo-wide can `import hpmath;`. The build
  script itself lives in `@jbrowse/shader-tools`.
