import { lookupColorRamp, prepareCanvas } from '@jbrowse/core/gpu/canvas2dUtils'
import { SvgCanvas } from '@jbrowse/core/util/SvgCanvas'

import { mapLDValue } from './ldColorRamp.ts'

import type {
  LDBackend,
  LDRenderState,
  LDUploadData,
} from './ldBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const COS45 = Math.SQRT1_2

/**
 * Pure draw entry point. Paints the LD lower-triangle as 45°-rotated diamonds
 * into any 2D-canvas-like context (real CanvasRenderingContext2D or
 * SvgCanvas). The on-screen Canvas2DLDRenderer wraps this with prepareCanvas
 * + lifecycle upload state; SVG export calls it directly with an SvgCanvas.
 */
export function drawLDBlocks(
  ctx: Ctx2D,
  data: LDUploadData,
  colorRamp: Uint8Array,
  state: LDRenderState,
) {
  const { yScalar, signedLD, viewScale, viewOffsetX } = state
  const { ldValues, boundaries, numCells } = data
  if (numCells === 0) {
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
      const leftX = (px + py) * s + viewOffsetX
      const centerY = (-px + py) * s * yScalar
      const halfW = cw * s
      const halfH = ch * s * yScalar

      ctx.fillStyle = `rgba(${r},${g},${b},${a})`
      ctx.beginPath()
      ctx.moveTo(leftX, centerY)
      ctx.lineTo(leftX + halfW, centerY - halfH)
      ctx.lineTo(leftX + 2 * halfW, centerY)
      ctx.lineTo(leftX + halfW, centerY + halfH)
      ctx.closePath()
      ctx.fill()
    }
  }
}

export class Canvas2DLDRenderer implements LDBackend {
  private ctx: Ctx2D
  private canvas: HTMLCanvasElement | null = null
  private data: LDUploadData = {
    ldValues: new Float32Array(0),
    boundaries: new Float32Array(0),
    numCells: 0,
  }
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
    this.data = data
  }

  uploadColorRamp(colors: Uint8Array) {
    this.colorRamp = colors
  }

  render(state: LDRenderState) {
    if (this.canvas) {
      prepareCanvas(
        this.canvas,
        this.ctx as CanvasRenderingContext2D,
        state.canvasWidth,
        state.canvasHeight,
      )
    }
    if (!this.colorRamp) {
      return
    }
    drawLDBlocks(this.ctx, this.data, this.colorRamp, state)
  }

  dispose() {
    this.data = {
      ldValues: new Float32Array(0),
      boundaries: new Float32Array(0),
      numCells: 0,
    }
    this.colorRamp = null
  }
}
