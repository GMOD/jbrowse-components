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

  resize(width: number, height: number) {
    if (this.width === width && this.height === height) {
      return
    }
    this.width = width
    this.height = height
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    this.canvas.width = Math.round(width * dpr)
    this.canvas.height = Math.round(height * dpr)
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
      displayKeys,
    } = state
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    const ctx = this.ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)

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
        viewHeight: this.height,
        lineWidth,
      })
    }
  }

  dispose() {
    this.geometries.clear()
  }
}
