import { prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import { HIC_LINEAR_SCORE_DIVISOR, lookupColorRamp } from './colorRamp.ts'

import type { HicBackend, HicRenderState } from './hicBackendTypes.ts'

const SQRT_HALF = Math.SQRT1_2

export class Canvas2DHicRenderer implements HicBackend {
  private ctx: CanvasRenderingContext2D | SvgCanvas
  private canvas: HTMLCanvasElement | null = null
  private positions: Float32Array | null = null
  private counts: Float32Array | null = null
  private numContacts = 0
  private colorRamp: Uint8Array | null = null

  constructor(canvasOrCtx: HTMLCanvasElement | SvgCanvas) {
    if (canvasOrCtx instanceof SvgCanvas) {
      this.ctx = canvasOrCtx
    } else {
      this.canvas = canvasOrCtx
      this.ctx = canvasOrCtx.getContext('2d')!
    }
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

    const ctx = this.ctx
    if (this.canvas) {
      prepareCanvas(
        this.canvas,
        ctx as CanvasRenderingContext2D,
        canvasWidth,
        canvasHeight,
      )
    }

    if (
      this.numContacts === 0 ||
      !this.positions ||
      !this.counts ||
      !this.colorRamp
    ) {
      return
    }

    const logMax = useLogScale ? Math.log2(Math.max(maxScore, 1)) : 1
    const m = useLogScale ? maxScore : maxScore / HIC_LINEAR_SCORE_DIVISOR

    for (let i = 0; i < this.numContacts; i++) {
      const px = this.positions[i * 2]!
      const py = this.positions[i * 2 + 1]!
      const count = this.counts[i]!

      const raw = useLogScale
        ? Math.log2(Math.max(count, 1)) / Math.max(logMax, 0.001)
        : count / Math.max(m, 0.001)
      const t = Math.max(0, Math.min(1, raw))

      const { r, g, b, a } = lookupColorRamp(this.colorRamp, t)

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

  dispose() {
    this.positions = null
    this.counts = null
    this.colorRamp = null
  }
}
