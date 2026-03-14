import type { SyntenyInstanceData } from '../LinearSyntenyRPC/executeSyntenyInstanceData.ts'

const CURVE_SEGMENTS = 16

function hermiteY(t: number, height: number) {
  return height * (1.5 * t * (1 - t) + t * t * t)
}

export class Canvas2DSyntenyRenderer {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private data: SyntenyInstanceData | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = ctx
  }

  resize(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1
    const pw = Math.round(width * dpr)
    const ph = Math.round(height * dpr)
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw
      this.canvas.height = ph
    }
  }

  uploadGeometry(data: SyntenyInstanceData) {
    this.data = data
  }

  render(
    offset0: number,
    offset1: number,
    height: number,
    curBpPerPx0: number,
    curBpPerPx1: number,
    maxOffScreenPx: number,
    minAlignmentLength: number,
    alpha: number,
    hoveredFeatureId: number,
    clickedFeatureId: number,
  ) {
    const data = this.data
    if (!data || data.instanceCount === 0) {
      return
    }

    const dpr = window.devicePixelRatio || 1
    const ctx = this.ctx
    const logicalW = this.canvas.width / dpr
    const logicalH = this.canvas.height / dpr

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, logicalW, logicalH)

    const scale0 = data.geometryBpPerPx0 / curBpPerPx0
    const scale1 = data.geometryBpPerPx1 / curBpPerPx1
    const adjOff0 = offset0 / scale0 - data.refOffset0
    const adjOff1 = offset1 / scale1 - data.refOffset1

    ctx.globalAlpha = alpha

    for (let i = 0; i < data.instanceCount; i++) {
      if (data.queryTotalLengths[i]! < minAlignmentLength) {
        continue
      }

      const ci = i * 4
      const r = Math.round(data.colors[ci]! * 255)
      const g = Math.round(data.colors[ci + 1]! * 255)
      const b = Math.round(data.colors[ci + 2]! * 255)
      const a = data.colors[ci + 3]!
      if (a < 0.01) {
        continue
      }

      const padTop = data.padTops[i]!
      const padBottom = data.padBottoms[i]!

      const sx1 =
        (data.x1[i]! - adjOff0) * scale0 - padTop * (scale0 - 1)
      const sx2 =
        (data.x2[i]! - adjOff0) * scale0 - padTop * (scale0 - 1)
      const sx3 =
        (data.x3[i]! - adjOff1) * scale1 - padBottom * (scale1 - 1)
      const sx4 =
        (data.x4[i]! - adjOff1) * scale1 - padBottom * (scale1 - 1)

      const minX = Math.min(sx1, sx2, sx3, sx4)
      const maxX = Math.max(sx1, sx2, sx3, sx4)
      if (maxX < -maxOffScreenPx || minX > logicalW + maxOffScreenPx) {
        continue
      }

      const isHovered = data.featureIds[i] === hoveredFeatureId
      const isClicked = data.featureIds[i] === clickedFeatureId
      const effectiveAlpha = isHovered ? Math.min(1, a * 1.5) : a

      ctx.fillStyle = `rgba(${r},${g},${b},${effectiveAlpha})`

      if (data.isCurves[i]! > 0.5) {
        ctx.beginPath()
        ctx.moveTo(sx1, 0)
        for (let s = 1; s <= CURVE_SEGMENTS; s++) {
          const t = s / CURVE_SEGMENTS
          const y = hermiteY(t, height)
          const x = sx1 + (sx4 - sx1) * t
          ctx.lineTo(x, y)
        }
        for (let s = CURVE_SEGMENTS; s >= 0; s--) {
          const t = s / CURVE_SEGMENTS
          const y = hermiteY(t, height)
          const x = sx2 + (sx3 - sx2) * t
          ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.fill()
      } else {
        ctx.beginPath()
        ctx.moveTo(sx1, 0)
        ctx.lineTo(sx4, height)
        ctx.lineTo(sx3, height)
        ctx.lineTo(sx2, 0)
        ctx.closePath()
        ctx.fill()
      }

      if (isClicked) {
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    ctx.globalAlpha = 1
  }

  pick(_x: number, _y: number, _onResult?: (result: number) => void) {
    return -1
  }

  destroy() {
    this.data = null
    this.ctx = null!
  }
}
