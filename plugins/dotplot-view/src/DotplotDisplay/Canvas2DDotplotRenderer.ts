import { prepareCanvas } from '@jbrowse/render-core/canvas2dUtils'
import { Canvas2DRenderingBackendBase } from '@jbrowse/render-core/renderingBackendBase'

import { drawDotplotInstances } from './drawDotplot.ts'

import type {
  DotplotGeometryData,
  DotplotRenderState,
  DotplotRenderingBackend,
} from './dotplotRenderingBackendTypes.ts'

export class Canvas2DDotplotRenderer
  extends Canvas2DRenderingBackendBase
  implements DotplotRenderingBackend
{
  private geometries = new Map<number, DotplotGeometryData>()
  private width = 0
  private height = 0

  constructor(canvas: HTMLCanvasElement) {
    // The base owns `canvas`, the acquired 2D context, the no-op `dispose` and
    // the no-op `setErrorHandler` (Canvas2D allocates no GPU resources, so it
    // has no OOM channel — but the hook wires every backend the same way).
    super(canvas)
  }

  // Just records the CSS size; the backing store is sized in `render` by
  // `prepareCanvas`, which re-derives dpr each frame (so moving the window to a
  // different-density monitor resizes instead of staying blurry) and bounds the
  // backing store against MAX_CANVAS_DIM_PX. React owns the element's CSS size.
  resize(width: number, height: number) {
    this.width = width
    this.height = height
  }

  upload(displayKey: number, data: DotplotGeometryData) {
    this.geometries.set(displayKey, data)
  }

  release(displayKey: number) {
    this.geometries.delete(displayKey)
  }

  render(state: DotplotRenderState) {
    const {
      viewBpH,
      bpPerPxHInv,
      viewBpV,
      bpPerPxVInv,
      lineWidth,
      alpha,
      displayKeys,
    } = state
    const ctx = this.ctx
    prepareCanvas(this.canvas, ctx, this.width, this.height)

    for (const displayKey of displayKeys) {
      const geometry = this.geometries.get(displayKey)
      if (!geometry || geometry.instanceCount === 0) {
        continue
      }
      drawDotplotInstances(ctx, geometry, {
        viewBpH,
        bpPerPxHInv,
        viewBpV,
        bpPerPxVInv,
        viewWidth: this.width,
        viewHeight: this.height,
        lineWidth,
        alpha,
      })
    }
  }

  override dispose() {
    this.geometries.clear()
  }
}
