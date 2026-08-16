import { acquireCanvas2D } from './canvasContext.ts'

import type { GpuHal } from './hal/types.ts'

/**
 * Minimum render-state shape a frame scaffold needs: the CSS-pixel canvas
 * dimensions used to size the backing store, and — on the per-region side —
 * to clip each block.
 *
 * Here rather than beside either family because both bound their render state
 * by it: `GpuPerRegionRenderingBackend.renderBlocks` and
 * `GpuGlobalRenderingBackend.render` open with the same `hal.resize`, and the
 * two Canvas2D bases with the same `prepareCanvas`.
 */
export interface FrameDimensions {
  canvasWidth: number
  canvasHeight: number
}

/**
 * What every rendering backend has, whatever its upload shape — the three
 * shape contracts (`PerRegionRenderingBackend`, `GlobalRenderingBackend`,
 * `KeyedRenderingBackend`) all extend this, and `useRenderingBackend` is
 * bounded by it.
 *
 * `setErrorHandler` is here rather than optional at the hook because it was
 * optional at the hook, and the three backends that then went without it —
 * alignments, dotplot and multi-LGV synteny, which allocate the largest vertex
 * buffers in the app — were the three whose over-limit allocations reached
 * nobody: the HAL reported "too much data to render on this GPU, zoom in", the
 * reporter's handler was null, and the view painted blank with a console line.
 * The displays had their error banners built and wired the whole time.
 *
 * Extending `GpuRenderingBackendBase` or `Canvas2DRenderingBackendBase` below
 * satisfies it, which is the intended way to get it.
 */
export interface RenderingBackend {
  /**
   * Route a HAL over-limit allocation to the display's `renderError`. Wired by
   * `useRenderingBackend` once the backend is live; a no-op on Canvas2D, which
   * allocates no GPU resources.
   */
  setErrorHandler(handler: (error: Error) => void): void
  dispose(): void
}

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
