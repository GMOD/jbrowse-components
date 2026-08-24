import { prepareCanvas } from './canvas2dUtils.ts'
import {
  Canvas2DRenderingBackendBase,
  GpuRenderingBackendBase,
} from './renderingBackendBase.ts'

import type {
  FrameDimensions,
  RenderingBackend,
} from './renderingBackendBase.ts'

/**
 * Shared contract for monolithic GPU backends (HiC, LD, multi-variant
 * matrix) — displays with no region partitioning. One payload under the
 * `data` key, one draw per frame. Render receives the data directly so
 * Canvas2D backends stay stateless; GPU backends use `upload` to push bytes
 * into a HAL buffer and ignore the `data` arg at render time.
 *
 * A display with a second upload beside the payload — HiC's and LD's colour
 * ramp texture, derived from a setting rather than the fetch — widens `Key`
 * and `Cell` so `upload` takes both cells and tells them apart, while `render`
 * is still handed the payload alone.
 */
export interface GlobalRenderingBackend<
  UploadData,
  RenderState,
  Key extends string = 'data',
  Cell = UploadData,
> extends RenderingBackend {
  upload(key: Key, data: Cell): void
  release(key: Key): void
  /**
   * Paint one frame and report whether real content reached the canvas — the
   * monolithic twin of `PerRegionRenderingBackend.renderBlocks`, and it answers
   * for the same reason. `RenderLifecycleMixin` flips `canvasDrawn` (the loading
   * scrim, `data-display-drawn`, every browser test's wait) only on `true`, so a
   * tick that drew nothing must say so.
   *
   * **This used to return `void`, and the answer was the display's to give.**
   * Each of the three wrote the same six lines — "data is here, so return
   * `true`" — beside a renderer whose own guard was strictly narrower: a color
   * ramp that had not arrived, a zero instance count, an empty HAL buffer. Two
   * expressions of one fact, and the one that could see what actually happened
   * was not the one being asked. LD's model even carried a comment explaining
   * the workaround, which is the usual sign that a signature is wrong rather
   * than a caller.
   */
  render(data: UploadData | null, state: RenderState): boolean
}

/**
 * Canvas2D-side base for `GlobalRenderingBackend` implementations. Inherits the
 * `canvas` + 2D context (and no-op `dispose`) from
 * `Canvas2DRenderingBackendBase`; stubs `upload` (no-op — data flows through
 * `render`).
 *
 * `render` is concrete and runs `prepareCanvas` (DPR-aware backing-store sizing)
 * before handing off to the abstract `draw`, exactly as
 * `Canvas2DPerRegionRenderingBackend` does — so a renderer here can no more
 * forget it and paint blurry on hi-DPI than one over there can. All three
 * subclasses opened with that same call and none of them had to.
 *
 * A null payload still prepares (and so clears) the canvas, then skips the
 * draw: that is the frame where a refetch is in flight and the old picture must
 * not stay up.
 */
export abstract class Canvas2DGlobalRenderingBackend<
  UploadData,
  RenderState extends FrameDimensions,
  Key extends string = 'data',
  Cell = UploadData,
>
  extends Canvas2DRenderingBackendBase
  implements GlobalRenderingBackend<UploadData, RenderState, Key, Cell>
{
  upload(_key: Key, _cell: Cell): void {}
  release(_key: Key): void {}

  render(data: UploadData | null, state: RenderState): boolean {
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    return data !== null && this.draw(data, state)
  }

  /**
   * Paint `data` into `this.ctx` (already DPR-prepared) and answer whether
   * anything reached it. Delegates to the plugin's pure `drawXxxBlocks`
   * function, the one SVG export shares.
   */
  protected abstract draw(data: UploadData, state: RenderState): boolean
}

/**
 * GPU-side base for `GlobalRenderingBackend` implementations. Inherits the
 * `hal` reference, the pre-allocated uniform scratch buffer, and the
 * HAL-delegating `dispose` from `GpuRenderingBackendBase`. Subclasses implement
 * `upload` and `draw`.
 *
 * `render` is the frame scaffold the per-region base has always had and this
 * one did not: resize the backing store, `beginFrame`/`endFrame`, and hand the
 * middle to `draw`. **The pairing is the point.** `beginFrame` is what clears
 * the canvas, so a frame that draws nothing still has to open and close one or
 * the last picture stays up — and with each subclass writing its own scaffold,
 * that invariant held three times by hand.
 *
 * `release` is a no-op by default: a payload leaving the map is answered by
 * `render` being handed `null`, and `beginFrame` clears the last picture. A
 * subclass whose buffers are worth freeing early overrides it.
 */
export abstract class GpuGlobalRenderingBackend<
  UploadData,
  RenderState extends FrameDimensions,
  Key extends string = 'data',
  Cell = UploadData,
>
  extends GpuRenderingBackendBase
  implements GlobalRenderingBackend<UploadData, RenderState, Key, Cell>
{
  abstract upload(key: Key, data: Cell): void

  release(): void {}

  render(data: UploadData | null, state: RenderState): boolean {
    this.hal.resize(state.canvasWidth, state.canvasHeight)
    this.hal.beginFrame(0, 0, 0, 0)
    const painted = data !== null && this.draw(data, state)
    this.hal.endFrame()
    return painted
  }

  /**
   * Write uniforms and issue the draw passes for one frame, inside an already-
   * open `beginFrame`/`endFrame`. Return whether anything was drawn — a buffer
   * the upload has not filled yet is the ordinary reason not to.
   */
  protected abstract draw(data: UploadData, state: RenderState): boolean
}
