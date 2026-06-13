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
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.canvas = canvas
    this.ctx = ctx
  }

  dispose(): void {}
}
