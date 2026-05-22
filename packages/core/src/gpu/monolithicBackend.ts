import type { GpuHal } from './hal/types.ts'

/**
 * Shared contract for monolithic GPU backends (HiC, LD, multi-variant
 * matrix) — displays with no region partitioning. One bulk upload, one
 * draw per frame. Render receives the data directly so Canvas2D backends
 * stay stateless; GPU backends use `uploadData` to push bytes into a HAL
 * buffer and ignore the `data` arg at render time.
 *
 * Plugins with color textures or other side-channel resources (HiC, LD)
 * extend this interface with their own upload methods (e.g.
 * `uploadColorRamp`); the base contract stays minimal.
 */
export interface MonolithicGpuBackend<UploadData, RenderState> {
  uploadData(data: UploadData): void
  render(data: UploadData | null, state: RenderState): void
  dispose(): void
}

/**
 * Canvas2D-side base for `MonolithicGpuBackend` implementations. Owns the
 * `canvas` + 2D context; stubs `uploadData` (no-op — data flows through
 * `render`). Subclasses implement `render` and nothing else.
 */
export abstract class Canvas2DMonolithicBackend<
  UploadData,
  RenderState,
> implements MonolithicGpuBackend<UploadData, RenderState> {
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

  uploadData(): void {}
  dispose(): void {}

  abstract render(data: UploadData | null, state: RenderState): void
}

/**
 * GPU-side base for `MonolithicGpuBackend` implementations. Owns the
 * `hal` reference and a pre-allocated uniform scratch buffer. Default
 * `dispose()` delegates to `hal.dispose()`. Subclasses implement
 * `uploadData` (push bytes to HAL) and `render`.
 */
export abstract class GpuMonolithicBackend<
  UploadData,
  RenderState,
> implements MonolithicGpuBackend<UploadData, RenderState> {
  protected hal: GpuHal
  protected uniformData: ArrayBuffer

  constructor(hal: GpuHal, uniformByteSize: number) {
    this.hal = hal
    this.uniformData = new ArrayBuffer(uniformByteSize)
  }

  dispose(): void {
    this.hal.dispose()
  }

  abstract uploadData(data: UploadData): void
  abstract render(data: UploadData | null, state: RenderState): void
}
