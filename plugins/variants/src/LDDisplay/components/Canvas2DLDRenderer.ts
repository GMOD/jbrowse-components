import { lookupColorRamp, prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import type {
  LDBackend,
  LDRenderState,
  LDUploadData,
} from './ldBackendTypes.ts'

const COS45 = Math.SQRT1_2

export class Canvas2DLDRenderer implements LDBackend {
  private ctx: CanvasRenderingContext2D | SvgCanvas
  private canvas: HTMLCanvasElement | null = null
  private ldValues: Float32Array | null = null
  private boundaries: Float32Array | null = null
  private numCells = 0
  private colorRamp: Uint8Array | null = null

  constructor(canvasOrCtx: HTMLCanvasElement | SvgCanvas) {
    if (canvasOrCtx instanceof SvgCanvas) {
      this.ctx = canvasOrCtx
    } else {
      this.canvas = canvasOrCtx
      this.ctx = canvasOrCtx.getContext('2d')!
    }
  }

  uploadData(data: LDUploadData) {
    this.ldValues = data.ldValues
    this.boundaries = data.boundaries
    this.numCells = data.numCells
  }

  uploadColorRamp(colors: Uint8Array) {
    this.colorRamp = colors
  }

  render(state: LDRenderState) {
    const {
      canvasWidth,
      canvasHeight,
      yScalar,
      signedLD,
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

    const { ldValues, boundaries, colorRamp } = this
    if (!ldValues || !boundaries || !colorRamp || this.numCells === 0) {
      return
    }

    const n = boundaries.length - 1
    let k = 0
    for (let i = 1; i < n; i++) {
      const py = boundaries[i]!
      const ch = boundaries[i + 1]! - py
      for (let j = 0; j < i; j++) {
        const px = boundaries[j]!
        const cw = boundaries[j + 1]! - px
        const ldVal = ldValues[k++]!

        let t = signedLD ? (ldVal + 1) / 2 : ldVal
        t = Math.max(0, Math.min(1, t))

        const { r, g, b, a } = lookupColorRamp(colorRamp, t)

        if (a < 0.01) {
          continue
        }

        const corners = [
          [px, py],
          [px + cw, py],
          [px + cw, py + ch],
          [px, py + ch],
        ] as const

        ctx.fillStyle = `rgba(${r},${g},${b},${a})`
        ctx.beginPath()
        for (let m = 0; m < 4; m++) {
          const [cx, cy] = corners[m]!
          const rx = (cx + cy) * COS45
          const ry = (-cx + cy) * COS45
          const sx = rx * viewScale + viewOffsetX
          const sy = ry * viewScale * yScalar
          if (m === 0) {
            ctx.moveTo(sx, sy)
          } else {
            ctx.lineTo(sx, sy)
          }
        }
        ctx.closePath()
        ctx.fill()
      }
    }
  }

  dispose() {
    this.ldValues = null
    this.boundaries = null
    this.colorRamp = null
    this.numCells = 0
  }
}
