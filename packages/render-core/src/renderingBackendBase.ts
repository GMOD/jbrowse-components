import { acquireCanvas2D } from './canvasContext.ts'

import type { GpuHal } from './hal/types.ts'

/**
 * Shared GPU-side state for every GPU rendering backend — both per-region
 * (`GpuPerRegionRenderingBackend`) and monolithic (`GpuGlobalRenderingBackend`).
 * Owns the `hal` reference and a pre-allocated uniform scratch `ArrayBuffer`
 * reused across frames to avoid per-frame GC churn. `dispose()` delegates to
 * the HAL. Subclasses add only their upload/render shape.
 */
export abstract class GpuRenderingBackendBase {
  protected hal: GpuHal
  protected uniformData: ArrayBuffer

  constructor(hal: GpuHal, uniformByteSize: number) {
    this.hal = hal
    this.uniformData = new ArrayBuffer(uniformByteSize)
  }

  // Forward OOM / over-limit allocation failures from the HAL to the display's
  // renderError. Wired by useRenderingBackend once the backend is live.
  setErrorHandler(handler: (error: Error) => void): void {
    this.hal.setErrorHandler(handler)
  }

  dispose(): void {
    this.hal.dispose()
  }
}

/**
 * Shared Canvas2D-side state for every Canvas2D rendering backend — both
 * per-region (`Canvas2DPerRegionRenderingBackend`) and monolithic
 * (`Canvas2DGlobalRenderingBackend`). Owns the `canvas` and its 2D context
 * (constructor throws if unavailable). `dispose()` is a no-op since Canvas2D
 * holds no GPU resources. Subclasses add only their render shape and stub the
 * upload/prune hooks their interface requires (everything flows through the
 * model's data map at render time).
 */
export abstract class Canvas2DRenderingBackendBase {
  protected canvas: HTMLCanvasElement
  protected ctx: CanvasRenderingContext2D

  constructor(canvas: HTMLCanvasElement) {
    // Canvas2D is the ladder's last rung, so this is where a re-init on a reused
    // element lands — and a bare "not available" sends the reader looking for a
    // missing browser feature instead of the committed context actually in the
    // way. `acquireCanvas2D` names which (canvasContext.ts).
    this.ctx = acquireCanvas2D(canvas)
    this.canvas = canvas
  }

  // Canvas2D allocates no GPU resources, so there is no OOM channel to forward.
  // Present for symmetry with the GPU base so useRenderingBackend can wire both
  // uniformly.
  setErrorHandler(_handler: (error: Error) => void): void {}

  dispose(): void {}
}
