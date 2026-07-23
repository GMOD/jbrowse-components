/**
 * `@jbrowse/render-core` — GPU/Canvas2D rendering primitives for JBrowse
 * displays: the hardware abstraction layer (HAL), the MST draw-lifecycle mixin,
 * per-region / global backend base classes, the shared clip / canvas geometry
 * utilities, and the React backend hooks.
 *
 * @experimental The surface of this package is still being refined; names and
 * signatures may change before it is frozen under semver. If you depend on it
 * from a third-party plugin, pin an exact version and expect to rebuild on
 * upgrades. The conceptual reference is
 * `agent-docs/reference/GPU_RENDERING.md`.
 *
 * This is the curated public surface. Internal building blocks (`webgpuUtils`,
 * the shader codegen) are intentionally not re-exported here.
 */

// --- Draw lifecycle ---
export { RenderLifecycleMixin } from './RenderLifecycleMixin.ts'
export type { RenderingBackendCallbacks } from './RenderLifecycleMixin.ts'
export { useRenderingBackend } from './useRenderingBackend.ts'
export type { RenderLifecycleModel } from './useRenderingBackend.ts'
export { useTabVisibilityRerender } from './useTabVisibilityRerender.ts'
export { ScrollLockedOverlay } from './ScrollLockedOverlay.tsx'

// --- Backend factories ---
export {
  createCanvas2DBackend,
  createRenderingBackend,
} from './createRenderingBackend.ts'
export type { RenderingBackendOptions } from './createRenderingBackend.ts'

// --- Backend base classes + contracts ---
export {
  Canvas2DRenderingBackendBase,
  GpuRenderingBackendBase,
} from './renderingBackendBase.ts'
export {
  Canvas2DPerRegionRenderingBackend,
  GpuPerRegionRenderingBackend,
} from './perRegionRenderingBackend.ts'
export type {
  FrameDimensions,
  PerRegionRenderingBackend,
} from './perRegionRenderingBackend.ts'
export {
  Canvas2DGlobalRenderingBackend,
  GpuGlobalRenderingBackend,
} from './globalRenderingBackend.ts'
export type { GlobalRenderingBackend } from './globalRenderingBackend.ts'

// --- Per-region upload helpers ---
export { installPerRegionLifecycle } from './installPerRegionLifecycle.ts'
export type { PerRegionRender } from './installPerRegionLifecycle.ts'
export { createRegionUploadSync } from './regionUploadSync.ts'

// --- Render blocks + display phase ---
export { buildRenderBlocks } from './renderBlock.ts'
export type { BpRegionBounds, RenderBlock } from './renderBlock.ts'
export { computeDisplayPhase } from './displayPhase.ts'
export type { DisplayPhase, DisplayPhaseInputs } from './displayPhase.ts'

// --- Clip + Canvas2D geometry utilities ---
export {
  bpRangeXTuple,
  clipBlock,
  splitPositionWithFrac,
  writeBpRangeUniforms,
} from './blockClipUtils.ts'
export type { BlockClipResult } from './blockClipUtils.ts'
export {
  MAX_CANVAS_DIM_PX,
  bpToScreenPx,
  clampBlockScissor,
  clipBlockForCanvas,
  devicePxSpan,
  getDpr,
  getPreparedCanvas2D,
  lookupColorRamp,
  makeBpMapper,
  makeCellLeftMapper,
  makeRampFillStyleLut,
  prepareCanvas,
  spanLeft,
  syncCanvasSize,
} from './canvas2dUtils.ts'
export type { BlockClip } from './canvas2dUtils.ts'

// --- Shader pass wiring ---
export { slangPass } from './slangPass.ts'
export type { ShaderModule, SlangPassOpts } from './slangPass.ts'

// --- HAL (WebGL2 / WebGPU / mock) ---
export * from './hal/index.ts'

// --- GPU device singleton ---
export {
  getGpuDevice,
  getGpuOverride,
  onDeviceLost,
  resetGpuDeviceForTests,
  setGpuOverride,
} from './gpuDevice.ts'
