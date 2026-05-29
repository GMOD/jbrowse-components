# packages/core/src/gpu

Cross-plugin GPU rendering core: the HAL (WebGL2 / WebGPU / mock), the MST
draw-lifecycle mixin, the per-region / global backend base classes, and the
shared clip / canvas / hp-math utilities.

## Naming convention

The `Gpu` prefix means **WebGL/WebGPU-specific** — `GpuHal` / `createGpuHal`,
`gpuDevice`, `webgpuUtils`, and the GPU-side bases `GpuPerRegionRenderingBackend` /
`GpuGlobalRenderingBackend`. Anything that drives **both** GPU and Canvas2D is
backend-agnostic and carries a neutral name: `RenderLifecycleMixin`, the
`PerRegionRenderingBackend` / `GlobalRenderingBackend` interfaces, the `Canvas2D*` bases, and the
`useRenderer` / `useRenderingBackend` hooks. Don't reintroduce `Gpu` on an
agnostic symbol — it reads as "GPU-only" and the same code path also runs the
Canvas2D fallback. `Global*` mirrors `GlobalDataDisplayMixin` (the
no-region-partition displays: HiC, LD, variant matrix).

The React hooks that drive the frame lifecycle live in
`packages/core/src/util/` (`useRenderer`, `useRenderingBackend`,
`useTabVisibilityRerender`), not in this directory.

**The conceptual reference is `agent-docs/ARCHITECTURE.md` → "GPU Rendering
Architecture"** (life of a frame, the three upload patterns, hp-math precision,
SVG export pipeline). This file documents only what bites when editing code _in
this directory_.

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
- `createRenderingBackend.ts` — `createGpuHal` returns a HAL → GPU backend, else Canvas2D
  backend.
- `RenderLifecycleMixin.ts` — the upload + render autorun pair (`attachRenderingBackend`).
- `installPerRegionLifecycle.ts` — per-key autoruns for per-region streamed
  displays (O(N), not O(N²)).
- `perRegionRenderingBackend.ts`, `globalRenderingBackend.ts` — backend base classes (GPU +
  Canvas2D).
- `slangPass.ts` — turns a `.generated.ts` shader module into a
  `PassDescriptor`.
- `blockClipUtils.ts` — GPU clip math + CPU hp-math split
  (`splitPositionWithFrac`).
- `canvas2dUtils.ts` — Canvas2D clip / dpr / color-ramp helpers +
  `clampBlockScissor`.

## Local invariants

- **HAL parity.** A behavior change to one HAL must land in the other and in
  `MockHal`. `glAttributeSync.test.ts` parses the generated GLSL and asserts
  every `GL_ATTRIBUTE` matches a shader input — keep it green.
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
  `renderTick`, `autorunsInstalled` and their actions belong to
  `RenderLifecycleMixin`; plugins compose, never re-declare. `attachRenderingBackend` is
  idempotent — re-calling only swaps the backend (context-loss recovery), and
  the upload autorun bumps `renderTick` so render re-fires after every upload.
- **Renderers stay stateless.** No per-region `Map` on a renderer class —
  delegate buffer lifecycle to `hal.pruneRegions(active)` and read per-region
  data from the model's map passed into `renderBlocks(blocks, regions, state)`.
- **Never hand-edit `*.generated.ts`.** Edit the `.slang` source and run
  `pnpm gen:shaders` (see root `CLAUDE.md` and ADR-005).
