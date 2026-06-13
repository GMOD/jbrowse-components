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

## Public surface

`src/index.ts` is the **curated, `@experimental` public API** (the barrel a
third-party plugin imports). Per-file subpath exports
(`@jbrowse/render-core/hal`, `/renderBlock`, …) also exist for fine-grained
imports. `webgpuUtils` and any shader codegen are intentionally NOT in the
barrel — internal building blocks.

The old `@jbrowse/core/gpu/*` import paths still resolve: they are thin
re-export **shims** pointing here, kept so the ~160 in-tree call sites didn't
have to change in one pass. New code (in-tree or third-party) should import from
`@jbrowse/render-core`. The shims are a migration aid, not a second public API.

## What stayed in `@jbrowse/core/gpu`

- `passes/` — the shared "simple shape" GPU passes (arrow/chevron/line/rect)
  with their `.generated.ts` shaders (runtime code imported by the canvas
  plugin).
- `shaders/` — the shared cross-plugin `.slang` modules (`hpmath.slang`,
  `colorPack.slang`), the `SHARED_INCLUDE` of the shader codegen (now its own
  package, `@jbrowse/shader-tools`).
- `glAttributeSync.test.ts` — a cross-plugin integration test (imports plugin
  renderers), so it can't live in this leaf package.

## Naming convention

The `Gpu` prefix means **WebGL/WebGPU-specific** — `GpuHal` / `createGpuHal`,
`gpuDevice`, `webgpuUtils`, and the GPU-side bases
`GpuPerRegionRenderingBackend` / `GpuGlobalRenderingBackend`. Anything that
drives **both** GPU and Canvas2D is backend-agnostic and carries a neutral name:
`RenderLifecycleMixin`, the `PerRegionRenderingBackend` /
`GlobalRenderingBackend` interfaces, the `Canvas2D*` bases, and the
`useRenderingBackend` / `useTabVisibilityRerender` hooks. Don't reintroduce
`Gpu` on an agnostic symbol — it reads as "GPU-only" and the same code path also
runs the Canvas2D fallback. `Global*` mirrors `GlobalDataDisplayMixin` (the
no-region-partition displays: HiC, LD, variant matrix).

`useRenderingBackend` owns the whole canvas-init / context-loss / device-loss /
pagehide / retry lifecycle and wires each event straight to the model's
`RenderLifecycleMixin` actions (there is no separate generic `useRenderer` layer
— it was folded in).

**The conceptual reference is `agent-docs/ARCHITECTURE.md` → "GPU Rendering
Architecture"** (life of a frame, the three upload patterns, hp-math precision,
SVG export pipeline). This file documents only what bites when editing code _in
this package_.

## File map

- `hal/types.ts` — the `GpuHal` interface every backend implements +
  `PassDescriptor`.
- `hal/webgl2Hal.ts`, `hal/webgpuHal.ts` — the two real HALs. They must stay
  behaviorally identical; `hal/mockHal.ts` mirrors the same interface for tests.
- `hal/regionRegistry.ts` — the per-`(region, pass)` buffer map both HALs own.
  Centralizes delete/prune/get-or-create so the two implementations can't drift.
- `hal/createHal.ts` — WebGPU → WebGL2 → null ladder (`?renderer=` pins it).
- `gpuDevice.ts` — module-level WebGPU `GPUDevice` singleton + device-lost
  recovery.
- `createRenderingBackend.ts` — `createGpuHal` returns a HAL → GPU backend, else
  Canvas2D backend; `createCanvas2DBackend` is the Canvas2D-only on-ramp.
- `RenderLifecycleMixin.ts` — the upload + render autorun pair
  (`attachRenderingBackend`).
- `useRenderingBackend.ts`, `useTabVisibilityRerender.ts` — the React hooks (+ a
  local `useEventCallback.ts` copy so the package stays core-free).
- `installPerRegionLifecycle.ts` — per-key autoruns for per-region streamed
  displays (O(N), not O(N²)).
- `regionUploadSync.ts` — incremental whole-map upload diff for
  canvas/alignments.
- `renderingBackendBase.ts` — `GpuRenderingBackendBase` (hal + uniform scratch +
  HAL-delegating dispose) and `Canvas2DRenderingBackendBase` (canvas + 2D ctx +
  no-op dispose), shared by the per-region and global bases below.
- `perRegionRenderingBackend.ts`, `globalRenderingBackend.ts` — backend base
  classes (GPU + Canvas2D), each extending the shared base in
  `renderingBackendBase.ts`.
- `slangPass.ts` — turns a `.generated.ts` shader module into a
  `PassDescriptor`.
- `blockClipUtils.ts` — GPU clip math + CPU hp-math split
  (`splitPositionWithFrac`).
- `canvas2dUtils.ts` — Canvas2D clip / dpr / color-ramp helpers +
  `clampBlockScissor`.

## Local invariants

- **HAL parity.** A behavior change to one HAL must land in the other and in
  `MockHal`. `packages/core/src/gpu/glAttributeSync.test.ts` parses the
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
  `pnpm gen:shaders` (see root `CLAUDE.md` and ADR-005). The codegen still lives
  in `@jbrowse/core` (`packages/core/src/gpu/{shaders,passes}` + the build
  script); this extraction did not touch it.
