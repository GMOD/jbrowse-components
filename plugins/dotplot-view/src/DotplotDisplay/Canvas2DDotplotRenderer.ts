import { projectBpToScreenPx } from '@jbrowse/core/util/bpProjection'

import type {
  DotplotBackend,
  DotplotGeometryData,
  DotplotRenderState,
} from './dotplotBackendTypes.ts'

type Geometry = DotplotGeometryData

export class Canvas2DDotplotRenderer implements DotplotBackend {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private geometries = new Map<number, Geometry>()
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
    const { lineWidth, trackProjections } = state
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    const ctx = this.ctx

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'

    for (const { displayKey, projH, projV } of trackProjections) {
      const geo = this.geometries.get(displayKey)
      if (!geo || geo.instanceCount === 0) {
        continue
      }

      for (let i = 0; i < geo.instanceCount; i++) {
        const xRegIdx = geo.xRegionIdx[i]!
        const yRegIdx = geo.yRegionIdx[i]!
        const sx1 = projectBpToScreenPx(geo.x1s[i]!, xRegIdx, projH)
        const sy1 = this.height - projectBpToScreenPx(geo.y1s[i]!, yRegIdx, projV)
        const sx2 = projectBpToScreenPx(geo.x2s[i]!, xRegIdx, projH)
        const sy2 = this.height - projectBpToScreenPx(geo.y2s[i]!, yRegIdx, projV)

        const packed = geo.colors[i]!
        const r = packed & 0xff
        const g = (packed >>> 8) & 0xff
        const b = (packed >>> 16) & 0xff
        const a = (packed >>> 24) / 255

        ctx.strokeStyle = `rgba(${r},${g},${b},${a})`
        ctx.beginPath()
        ctx.moveTo(sx1, sy1)
        ctx.lineTo(sx2, sy2)
        ctx.stroke()
      }
    }
  }

  dispose() {
    this.geometries.clear()
  }
}
