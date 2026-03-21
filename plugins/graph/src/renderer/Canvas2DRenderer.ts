import type { Renderer, RenderBatch, TransformUniform } from './types.ts'

export class Canvas2DRenderer implements Renderer {
  private ctx: CanvasRenderingContext2D
  private transform: TransformUniform | null = null
  private batch: RenderBatch | null = null

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D not supported')
    }
    this.ctx = ctx
  }

  resize(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1
    this.ctx.canvas.width = width * dpr
    this.ctx.canvas.height = height * dpr
    this.ctx.canvas.style.width = width + 'px'
    this.ctx.canvas.style.height = height + 'px'
  }

  uploadGeometry(batch: RenderBatch) {
    this.batch = batch
  }

  updateTransform(transform: TransformUniform) {
    this.transform = transform
  }

  render(clearColor: [number, number, number, number]) {
    if (!this.transform || !this.batch) {
      return
    }
    const ctx = this.ctx
    const t = this.transform
    const { width, height } = ctx.canvas
    const { positions, colors, indices } = this.batch

    ctx.fillStyle = `rgba(${clearColor[0] * 255},${clearColor[1] * 255},${clearColor[2] * 255},${clearColor[3]})`
    ctx.fillRect(0, 0, width, height)

    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i]!
      const i1 = indices[i + 1]!
      const i2 = indices[i + 2]!

      const x0 = positions[i0 * 2]! * t.scaleX + t.translateX
      const y0 = t.viewportHeight - (positions[i0 * 2 + 1]! * t.scaleY + t.translateY)
      const x1 = positions[i1 * 2]! * t.scaleX + t.translateX
      const y1 = t.viewportHeight - (positions[i1 * 2 + 1]! * t.scaleY + t.translateY)
      const x2 = positions[i2 * 2]! * t.scaleX + t.translateX
      const y2 = t.viewportHeight - (positions[i2 * 2 + 1]! * t.scaleY + t.translateY)

      const r = Math.round(colors[i0 * 4]! * 255)
      const g = Math.round(colors[i0 * 4 + 1]! * 255)
      const b = Math.round(colors[i0 * 4 + 2]! * 255)
      const a = colors[i0 * 4 + 3]!

      ctx.fillStyle = `rgba(${r},${g},${b},${a})`
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.closePath()
      ctx.fill()
    }
  }

  destroy() {
    this.batch = null
  }
}
