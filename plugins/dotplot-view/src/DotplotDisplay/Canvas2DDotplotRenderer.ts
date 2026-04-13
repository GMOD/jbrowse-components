import type { DotplotBackend, DotplotGeometryData, TrackScale } from './dotplotBackendTypes.ts'

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

  uploadGeometry(regionKey: number, data: DotplotGeometryData) {
    this.geometries.set(regionKey, data)
  }

  deleteGeometry(regionKey: number) {
    this.geometries.delete(regionKey)
  }

  render(
    offsetX: number,
    offsetY: number,
    lineWidth: number,
    trackScales: readonly TrackScale[],
  ) {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    const ctx = this.ctx

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'

    for (const { regionKey, scaleX, scaleY } of trackScales) {
      const geo = this.geometries.get(regionKey)
      if (!geo || geo.instanceCount === 0) {
        continue
      }

      for (let i = 0; i < geo.instanceCount; i++) {
        const sx1 = geo.x1s[i]! * scaleX - offsetX
        const sy1 = this.height - (geo.y1s[i]! * scaleY - offsetY)
        const sx2 = geo.x2s[i]! * scaleX - offsetX
        const sy2 = this.height - (geo.y2s[i]! * scaleY - offsetY)

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
