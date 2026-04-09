import { lookupColorRamp, prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'

import type { LDBackend, LDRenderState } from './ldBackendTypes.ts'

const COS45 = 0.7071067811865476

export class Canvas2DLDRenderer implements LDBackend {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private positions: Float32Array | null = null
  private cellSizes: Float32Array | null = null
  private ldValues: Float32Array | null = null
  private numCells = 0
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
    cellSizes: Float32Array
    ldValues: Float32Array
    numCells: number
  }) {
    this.positions = data.positions
    this.cellSizes = data.cellSizes
    this.ldValues = data.ldValues
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
    prepareCanvas(this.canvas, ctx, canvasWidth, canvasHeight)

    if (
      !this.positions ||
      !this.cellSizes ||
      !this.ldValues ||
      !this.colorRamp ||
      this.numCells === 0
    ) {
      return
    }

    for (let i = 0; i < this.numCells; i++) {
      const px = this.positions[i * 2]!
      const py = this.positions[i * 2 + 1]!
      const cw = this.cellSizes[i * 2]!
      const ch = this.cellSizes[i * 2 + 1]!
      const ldVal = this.ldValues[i]!

      let t = signedLD ? (ldVal + 1) / 2 : ldVal
      t = Math.max(0, Math.min(1, t))

      const { r, g, b, a } = lookupColorRamp(this.colorRamp, t)

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
      for (let j = 0; j < 4; j++) {
        const [cx, cy] = corners[j]!
        const rx = (cx + cy) * COS45
        const ry = (-cx + cy) * COS45
        const sx = rx * viewScale + viewOffsetX
        const sy = ry * viewScale * yScalar
        if (j === 0) {
          ctx.moveTo(sx, sy)
        } else {
          ctx.lineTo(sx, sy)
        }
      }
      ctx.closePath()
      ctx.fill()
    }
  }

  dispose() {
    this.positions = null
    this.cellSizes = null
    this.ldValues = null
    this.colorRamp = null
    this.numCells = 0
  }
}
