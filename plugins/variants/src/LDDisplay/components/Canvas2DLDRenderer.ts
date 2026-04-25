import { lookupColorRamp, prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import { mapLDValue } from './ldColorRamp.ts'

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
    const s = COS45 * viewScale
    let k = 0
    for (let i = 1; i < n; i++) {
      const py = boundaries[i]!
      const ch = boundaries[i + 1]! - py
      for (let j = 0; j < i; j++) {
        const px = boundaries[j]!
        const cw = boundaries[j + 1]! - px
        const ldVal = ldValues[k++]!

        const t = mapLDValue(ldVal, signedLD)
        const { r, g, b, a } = lookupColorRamp(colorRamp, t)

        // Inline the -45° rotation and viewport transform for the 4 diamond
        // vertices, avoiding a per-cell array allocation and inner loop.
        const base = (px + py) * s + viewOffsetX
        const rBase = (-px + py) * s * yScalar
        const hw = cw * s
        const hh = ch * s * yScalar

        ctx.fillStyle = `rgba(${r},${g},${b},${a})`
        ctx.beginPath()
        ctx.moveTo(base, rBase)
        ctx.lineTo(base + hw, rBase - hh)
        ctx.lineTo(base + 2 * hw, rBase)
        ctx.lineTo(base + hw, rBase + hh)
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
