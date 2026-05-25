import type { GpuHal } from './hal/types.ts'
import type { RenderBlock } from './renderBlock.ts'

/**
 * Shared contract for per-region streamed GPU backends.
 *
 * The model owns the data (`rpcDataMap` / `laidOutDataMap`); the backend
 * uploads what's needed to the GPU (`uploadRegion`) and draws against a
 * data map passed back through `renderBlocks` each frame.
 *
 * `UploadData` is what the upload-side autorun pushes per region;
 * `RenderData` is what the render-side reads. They default to the same
 * type — MAF is the lone case where they diverge (upload payload also
 * carries a pre-encoded GPU buffer that the render side doesn't need).
 *
 * Renderers are stateless: they keep no per-region cache. Canvas2D backends
 * stub `uploadRegion` / `pruneRegions` as no-ops since they read everything
 * from the `regions` map at render time. GPU backends use `uploadRegion` to
 * push bytes into HAL buffers, and `pruneRegions` to delegate region
 * lifecycle to HAL via `hal.pruneRegions(active)`.
 */
export interface PerRegionBackend<
  UploadData,
  RenderState,
  Block = RenderBlock,
  RenderData = UploadData,
> {
  uploadRegion(displayedRegionIndex: number, data: UploadData): void
  pruneRegions(activeRegions: number[]): void
  renderBlocks(
    blocks: Block[],
    regions: ReadonlyMap<number, RenderData>,
    state: RenderState,
  ): void
  dispose(): void
}

/**
 * Canvas2D-side base for `PerRegionBackend` implementations. Owns the
 * `canvas` + 2D context; stubs the upload/prune/dispose hooks the backend
 * shape requires but Canvas2D doesn't need (everything comes through
 * `renderBlocks` from the model's data map). Subclasses implement
 * `renderBlocks` and nothing else.
 */
export abstract class Canvas2DPerRegionBackend<
  UploadData,
  RenderState,
  Block = RenderBlock,
  RenderData = UploadData,
> implements PerRegionBackend<UploadData, RenderState, Block, RenderData> {
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

  uploadRegion(): void {}
  pruneRegions(): void {}
  dispose(): void {}

  abstract renderBlocks(
    blocks: Block[],
    regions: ReadonlyMap<number, RenderData>,
    state: RenderState,
  ): void
}

/**
 * GPU-side base for `PerRegionBackend` implementations. Owns the `hal`
 * reference and a pre-allocated uniform scratch `ArrayBuffer` reused across
 * frames. Provides the shared `pruneRegions` (delegates to HAL) and
 * `dispose` (also delegates) so subclasses implement only `uploadRegion`
 * and `renderBlocks`.
 */
export abstract class GpuPerRegionBackend<
  UploadData,
  RenderState,
  Block = RenderBlock,
  RenderData = UploadData,
> implements PerRegionBackend<UploadData, RenderState, Block, RenderData> {
  protected hal: GpuHal
  protected uniformData: ArrayBuffer

  constructor(hal: GpuHal, uniformByteSize: number) {
    this.hal = hal
    this.uniformData = new ArrayBuffer(uniformByteSize)
  }

  pruneRegions(activeRegions: number[]): void {
    this.hal.pruneRegions(activeRegions)
  }

  dispose(): void {
    this.hal.dispose()
  }

  abstract uploadRegion(displayedRegionIndex: number, data: UploadData): void

  abstract renderBlocks(
    blocks: Block[],
    regions: ReadonlyMap<number, RenderData>,
    state: RenderState,
  ): void
}
