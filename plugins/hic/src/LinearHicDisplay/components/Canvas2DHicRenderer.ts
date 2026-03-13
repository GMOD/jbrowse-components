import type { HicRenderState } from './WebGLHicRenderer.ts'

const SQRT_HALF = 0.7071067811865476

export class Canvas2DHicRenderer {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private positions: Float32Array | null = null
  private counts: Float32Array | null = null
  private numContacts = 0
  private colorRamp: Uint8Array | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D context not available')
    }
    this.ctx = ctx
  }

  uploadData(data: {
    positions: Float32Array
    counts: Float32Array
    numContacts: number
  }) {
    this.positions = data.positions
    this.counts = data.counts
    this.numContacts = data.numContacts
  }

  uploadColorRamp(colors: Uint8Array) {
    this.colorRamp = colors
  }

  render(state: HicRenderState) {
    const {
      canvasWidth,
      canvasHeight,
      binWidth,
      yScalar,
      maxScore,
      useLogScale,
      viewScale,
      viewOffsetX,
    } = state

    const dpr = window.devicePixelRatio || 1
    const bufW = Math.round(canvasWidth * dpr)
    const bufH = Math.round(canvasHeight * dpr)

    if (this.canvas.width !== bufW || this.canvas.height !== bufH) {
      this.canvas.width = bufW
      this.canvas.height = bufH
    }

    const ctx = this.ctx
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    if (
      this.numContacts === 0 ||
      !this.positions ||
      !this.counts ||
      !this.colorRamp
    ) {
      return
    }

    const logMax = useLogScale ? Math.log2(Math.max(maxScore, 1)) : 1
    const m = useLogScale ? maxScore : maxScore / 20

    for (let i = 0; i < this.numContacts; i++) {
      const px = this.positions[i * 2]!
      const py = this.positions[i * 2 + 1]!
      const count = this.counts[i]!

      const raw = useLogScale
        ? Math.log2(Math.max(count, 1)) / Math.max(logMax, 0.001)
        : count / Math.max(m, 0.001)
      const t = Math.max(0, Math.min(1, raw))

      const rampIdx = Math.round(t * 255) * 4
      const r = this.colorRamp[rampIdx]!
      const g = this.colorRamp[rampIdx + 1]!
      const b = this.colorRamp[rampIdx + 2]!
      const a = this.colorRamp[rampIdx + 3]! / 255

      if (a < 0.01) {
        continue
      }

      const corners = [
        [px, py],
        [px + binWidth, py],
        [px + binWidth, py + binWidth],
        [px, py + binWidth],
      ] as const

      ctx.beginPath()
      for (let c = 0; c < 4; c++) {
        const cx = corners[c]![0]
        const cy = corners[c]![1]
        const rx = (cx + cy) * SQRT_HALF * viewScale + viewOffsetX
        const ry = (-cx + cy) * SQRT_HALF * viewScale * yScalar

        if (c === 0) {
          ctx.moveTo(rx, ry)
        } else {
          ctx.lineTo(rx, ry)
        }
      }
      ctx.closePath()
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`
      ctx.fill()
    }
  }

  destroy() {
    this.positions = null
    this.counts = null
    this.colorRamp = null
  }
}
