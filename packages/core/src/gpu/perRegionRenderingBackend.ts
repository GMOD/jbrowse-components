import { clipBlock } from './blockClipUtils.ts'
import { getDpr, prepareCanvas } from './canvas2dUtils.ts'

import type { BlockClipResult } from './blockClipUtils.ts'
import type { GpuHal } from './hal/types.ts'
import type { RenderBlock } from './renderBlock.ts'

/**
 * Minimum render-state shape the GPU frame scaffold needs: the CSS-pixel
 * canvas dimensions used to size the backing store and clip each block.
 */
export interface FrameDimensions {
  canvasWidth: number
  canvasHeight: number
}

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
export interface PerRegionRenderingBackend<
  UploadData,
  RenderState,
  Block = RenderBlock,
  RenderData = UploadData,
> {
  uploadRegion(displayedRegionIndex: number, data: UploadData): void
  pruneRegions(activeRegions: Iterable<number>): void
  renderBlocks(
    blocks: Block[],
    regions: ReadonlyMap<number, RenderData>,
    state: RenderState,
  ): void
  dispose(): void
}

/**
 * Canvas2D-side base for `PerRegionRenderingBackend` implementations. Owns the
 * `canvas` + 2D context; stubs the upload/prune/dispose hooks the backend
 * shape requires but Canvas2D doesn't need (everything comes through `draw`
 * from the model's data map).
 *
 * `renderBlocks` is concrete: it runs `prepareCanvas` (DPR-aware backing-store
 * sizing — symmetric to the GPU base owning `resize`/scissor) and then calls
 * the abstract `draw`. Subclasses implement only `draw`, which delegates to the
 * plugin's pure `drawXxxBlocks` function (also shared with SVG export). Keeping
 * `prepareCanvas` in the base means a renderer can't forget it and render
 * blurry on hi-DPI.
 */
export abstract class Canvas2DPerRegionRenderingBackend<
  UploadData,
  RenderState extends FrameDimensions,
  Block extends RenderBlock = RenderBlock,
  RenderData = UploadData,
> implements PerRegionRenderingBackend<
  UploadData,
  RenderState,
  Block,
  RenderData
> {
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

  renderBlocks(
    blocks: Block[],
    regions: ReadonlyMap<number, RenderData>,
    state: RenderState,
  ): void {
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    this.draw(blocks, regions, state)
  }

  /**
   * Paint the visible blocks into `this.ctx` (already DPR-prepared). Delegates
   * to the plugin's pure `drawXxxBlocks(ctx, regions, blocks, state)` function.
   */
  protected abstract draw(
    blocks: Block[],
    regions: ReadonlyMap<number, RenderData>,
    state: RenderState,
  ): void
}

/**
 * GPU-side base for `PerRegionRenderingBackend` implementations. Owns the `hal`
 * reference and a pre-allocated uniform scratch `ArrayBuffer` reused across
 * frames. Provides the shared `pruneRegions` (delegates to HAL) and
 * `dispose` (also delegates).
 *
 * `renderBlocks` is a concrete frame scaffold shared by every per-region GPU
 * renderer: resize the backing store, `beginFrame`/`endFrame`, and per block
 * compute the scissor clip + set scissor/viewport. The scaffold's invariants
 * (paired begin/end, cleared scissor/viewport, the skip-absent-region and
 * skip-offscreen guards) are owned here so a subclass can't forget them.
 * Subclasses implement only `uploadRegion` and `drawRegion` — the latter writes
 * uniforms and issues draw passes for one already-clipped block.
 */
export abstract class GpuPerRegionRenderingBackend<
  UploadData,
  RenderState extends FrameDimensions,
  Block extends RenderBlock = RenderBlock,
  RenderData = UploadData,
> implements PerRegionRenderingBackend<
  UploadData,
  RenderState,
  Block,
  RenderData
> {
  protected hal: GpuHal
  protected uniformData: ArrayBuffer

  constructor(hal: GpuHal, uniformByteSize: number) {
    this.hal = hal
    this.uniformData = new ArrayBuffer(uniformByteSize)
  }

  pruneRegions(activeRegions: Iterable<number>): void {
    this.hal.pruneRegions(activeRegions)
  }

  dispose(): void {
    this.hal.dispose()
  }

  abstract uploadRegion(displayedRegionIndex: number, data: UploadData): void

  renderBlocks(
    blocks: Block[],
    regions: ReadonlyMap<number, RenderData>,
    state: RenderState,
  ): void {
    const { canvasWidth, canvasHeight } = state
    const dpr = getDpr()
    this.hal.resize(canvasWidth, canvasHeight)
    // Always pair beginFrame/endFrame so the canvas clears to transparent even
    // when every block is skipped (e.g. all regions pruned by a density gate).
    this.hal.beginFrame(0, 0, 0, 0)
    for (const block of blocks) {
      const region = regions.get(block.displayedRegionIndex)
      if (region !== undefined) {
        const clip = clipBlock(block, canvasWidth, canvasHeight, dpr)
        if (clip) {
          this.hal.setScissor(clip.pxX, 0, clip.pxW, clip.pxH)
          this.hal.setViewport(clip.pxX, 0, clip.pxW, clip.pxH)
          this.drawRegion(block, clip, region, state)
        }
      }
    }
    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
  }

  /**
   * Write uniforms and issue draw passes for one block whose scissor/viewport
   * are already set to its clipped span. `clip` carries the HP-split bp range
   * and pixel dimensions; `region` is the model's per-region data (used by
   * renderers that read per-region uniforms like an outline color, ignored by
   * those whose draw state is fully in the uploaded buffer).
   */
  protected abstract drawRegion(
    block: Block,
    clip: BlockClipResult,
    region: RenderData,
    state: RenderState,
  ): void
}
