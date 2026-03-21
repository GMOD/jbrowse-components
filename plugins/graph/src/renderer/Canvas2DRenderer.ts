import type { Renderer, RenderBatch, SubBatch, TransformUniform } from './types.ts'

export class Canvas2DRenderer implements Renderer {
  private ctx: CanvasRenderingContext2D
  private transform: TransformUniform | null = null
  private edgeBatch: SubBatch | null = null
  private nodeBatch: SubBatch | null = null
  private arrowBatch: SubBatch | null = null

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
    this.edgeBatch = batch.edges
    this.nodeBatch = batch.nodes
    this.arrowBatch = batch.arrows
  }

  updateSubBatchColors(
    target: 'edges' | 'nodes' | 'arrows',
    colors: Float32Array,
    vertexStart: number,
  ) {
    const batch =
      target === 'edges' ? this.edgeBatch
      : target === 'nodes' ? this.nodeBatch
      : this.arrowBatch
    if (!batch) {
      return
    }
    batch.colors.set(colors, vertexStart * 4)
  }

  updateTransform(transform: TransformUniform) {
    this.transform = transform
  }

  render(clearColor: [number, number, number, number]) {
    if (!this.transform) {
      return
    }
    const ctx = this.ctx
    const { width, height } = ctx.canvas

    ctx.fillStyle = `rgba(${clearColor[0] * 255},${clearColor[1] * 255},${clearColor[2] * 255},${clearColor[3]})`
    ctx.fillRect(0, 0, width, height)

    this.renderSubBatch(this.edgeBatch)
    this.renderSubBatch(this.nodeBatch)
    this.renderSubBatch(this.arrowBatch)
  }

  private renderSubBatch(batch: SubBatch | null) {
    if (!batch || !this.transform) {
      return
    }
    const ctx = this.ctx
    const t = this.transform
    const { positions, normals, thicknesses, colors, indices } = batch

    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i]!
      const i1 = indices[i + 1]!
      const i2 = indices[i + 2]!

      const x0 = positions[i0 * 2]! * t.scaleX + normals[i0 * 2]! * thicknesses[i0]! + t.translateX
      const y0 = t.viewportHeight - (positions[i0 * 2 + 1]! * t.scaleY + normals[i0 * 2 + 1]! * thicknesses[i0]! + t.translateY)
      const x1 = positions[i1 * 2]! * t.scaleX + normals[i1 * 2]! * thicknesses[i1]! + t.translateX
      const y1 = t.viewportHeight - (positions[i1 * 2 + 1]! * t.scaleY + normals[i1 * 2 + 1]! * thicknesses[i1]! + t.translateY)
      const x2 = positions[i2 * 2]! * t.scaleX + normals[i2 * 2]! * thicknesses[i2]! + t.translateX
      const y2 = t.viewportHeight - (positions[i2 * 2 + 1]! * t.scaleY + normals[i2 * 2 + 1]! * thicknesses[i2]! + t.translateY)

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
    this.edgeBatch = null
    this.nodeBatch = null
    this.arrowBatch = null
  }
}
