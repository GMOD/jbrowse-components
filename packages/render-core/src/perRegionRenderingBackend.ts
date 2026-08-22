import { clipBlock } from './blockClipUtils.ts'
import { prepareCanvas } from './canvas2dUtils.ts'
import { uploadPass } from './instancePass.ts'
import {
  Canvas2DRenderingBackendBase,
  GpuRenderingBackendBase,
} from './renderingBackendBase.ts'

import type { BlockClipResult } from './blockClipUtils.ts'
import type { InstancePass } from './instancePass.ts'
import type { RenderBlock } from './renderBlock.ts'
import type {
  FrameDimensions,
  RenderingBackend,
} from './renderingBackendBase.ts'

// Re-exported from its home beside the two backend bases, both families having
// the same claim on it. Kept on this subpath because that is where the exports
// map has always served it.
export type { FrameDimensions } from './renderingBackendBase.ts'

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
> extends RenderingBackend {
  uploadRegion(displayedRegionIndex: number, data: UploadData): void
  pruneRegions(activeRegions: Iterable<number>): void
  /**
   * Paint one frame and report whether real content reached the canvas. The
   * render callback forwards this straight to `RenderLifecycleMixin`, which
   * flips `canvasDrawn` (the loading scrim, `data-display-drawn`, every browser
   * test's wait) only on `true` — so a tick that drew nothing must answer
   * `false` rather than let a display assert doneness over an empty canvas.
   *
   * The two bases answer at different precision on purpose. GPU knows exactly
   * ("a `drawRegion` ran", after the region-absent and offscreen-clip guards);
   * Canvas2D delegates clipping to the plugin's `drawXxxBlocks` and so answers
   * "some block had region data", which is the same for every case a display
   * can distinguish and avoids re-running `clipBlockForCanvas` purely for a
   * predicate.
   */
  renderBlocks(
    blocks: Block[],
    regions: ReadonlyMap<number, RenderData>,
    state: RenderState,
  ): boolean
}

/**
 * Canvas2D-side base for `PerRegionRenderingBackend` implementations. Inherits
 * the `canvas` + 2D context (and no-op `dispose`) from
 * `Canvas2DRenderingBackendBase`; stubs the upload/prune hooks the backend shape
 * requires but Canvas2D doesn't need (everything comes through `draw` from the
 * model's data map).
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
>
  extends Canvas2DRenderingBackendBase
  implements
    PerRegionRenderingBackend<UploadData, RenderState, Block, RenderData>
{
  uploadRegion(): void {}
  pruneRegions(): void {}

  renderBlocks(
    blocks: Block[],
    regions: ReadonlyMap<number, RenderData>,
    state: RenderState,
  ): boolean {
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    this.draw(blocks, regions, state)
    return blocks.some(block => regions.has(block.displayedRegionIndex))
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
 * GPU-side base for `PerRegionRenderingBackend` implementations. Inherits the
 * `hal` reference, the pre-allocated uniform scratch `ArrayBuffer`, and the
 * HAL-delegating `dispose` from `GpuRenderingBackendBase`; adds the shared
 * `pruneRegions` (delegates to HAL).
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
>
  extends GpuRenderingBackendBase
  implements
    PerRegionRenderingBackend<UploadData, RenderState, Block, RenderData>
{
  pruneRegions(activeRegions: Iterable<number>): void {
    this.hal.pruneRegions(activeRegions)
  }

  /**
   * The passes this backend fills from one region's payload, each carrying its
   * own packer. Usually the same array handed to `createRenderingBackend` —
   * minus any pass that draws off another's buffer (wiggle's line passes,
   * canvas's chevron), which is registered but never uploaded to.
   */
  protected abstract regionPasses: InstancePass<UploadData>[]

  /**
   * Pack and upload every pass for one region.
   *
   * Concrete for the same reason `renderBlocks` below is: the invariants are
   * the base's to keep. Each subclass used to write this, and each wrote the
   * empty case differently — `if (count === 0) deleteRegion() else upload()`
   * five times, an unconditional leading `deleteRegion()` once. Both spellings
   * exist because a pass whose data went empty must not keep drawing its last
   * buffer, and `uploadPass` gets that from the HAL: an empty pack deletes that
   * pass's buffer, so a multi-pass backend clears exactly the passes that went
   * empty instead of dropping the whole region and rebuilding it.
   *
   * Override only for a payload no packer can take — none does today.
   */
  uploadRegion(displayedRegionIndex: number, data: UploadData): void {
    for (const pass of this.regionPasses) {
      uploadPass(this.hal, displayedRegionIndex, pass, data)
    }
  }

  renderBlocks(
    blocks: Block[],
    regions: ReadonlyMap<number, RenderData>,
    state: RenderState,
  ): boolean {
    const { canvasWidth, canvasHeight } = state
    let painted = false
    // The scale the canvas ACTUALLY got, which is `getDpr()` until the backing
    // store clamps and below it after. Read from the resize rather than the
    // window, so a track dragged past the clamp draws at reduced resolution
    // instead of asking for a viewport its target cannot hold.
    const scale = this.hal.resize(canvasWidth, canvasHeight)
    // Always pair beginFrame/endFrame so the canvas clears to transparent even
    // when every block is skipped (e.g. all regions pruned by a density gate).
    this.hal.beginFrame(0, 0, 0, 0)
    for (const block of blocks) {
      const region = regions.get(block.displayedRegionIndex)
      if (region !== undefined) {
        const clip = clipBlock(block, canvasWidth, canvasHeight, scale)
        if (clip) {
          this.hal.setScissor(clip.pxX, 0, clip.pxW, clip.pxH)
          this.hal.setViewport(clip.pxX, 0, clip.pxW, clip.pxH)
          this.drawRegion(block, clip, region, state)
          painted = true
        }
      }
    }
    this.hal.clearScissor()
    this.hal.clearViewport()
    this.hal.endFrame()
    return painted
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
