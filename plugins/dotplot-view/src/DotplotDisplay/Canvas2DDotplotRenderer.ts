import { prepareCanvas } from '@jbrowse/render-core/canvas2dUtils'

import { drawDotplotInstances } from './drawDotplot.ts'

import type {
  DotplotGeometryData,
  DotplotRenderState,
  DotplotRenderingBackend,
} from './dotplotRenderingBackendTypes.ts'

export class Canvas2DDotplotRenderer implements DotplotRenderingBackend {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private geometries = new Map<number, DotplotGeometryData>()
  private width = 0
  private height = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = ctx
  }

  // Just records the CSS size; the backing store is sized in `render` by
  // `prepareCanvas`, which re-derives dpr each frame (so moving the window to a
  // different-density monitor resizes instead of staying blurry) and bounds the
  // backing store against MAX_CANVAS_DIM_PX. React owns the element's CSS size.
  resize(width: number, height: number) {
    this.width = width
    this.height = height
  }

  uploadGeometry(displayKey: number, data: DotplotGeometryData) {
    this.geometries.set(displayKey, data)
  }

  deleteGeometry(displayKey: number) {
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

  dispose() {
    this.geometries.clear()
  }
}
