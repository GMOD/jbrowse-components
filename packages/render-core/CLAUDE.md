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

**Conceptual reference: `agent-docs/ARCHITECTURE.md` → "GPU Rendering
Architecture."** This file documents only what bites when editing _this
package_.

## Local invariants

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
