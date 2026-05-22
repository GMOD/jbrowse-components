import {
  lookupColorRamp,
  makeRampFillStyleLut,
  prepareCanvas,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { Canvas2DMonolithicBackend } from '@jbrowse/core/gpu/monolithicBackend'

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
  const fillStyleLut = makeRampFillStyleLut(colorRamp)
  let k = 0
  for (let i = 1; i < n; i++) {
    const py = boundaries[i]!
    const ch = boundaries[i + 1]! - py
    for (let j = 0; j < i; j++) {
      const px = boundaries[j]!
      const cw = boundaries[j + 1]! - px
      const ldVal = ldValues[k++]!

      const t = mapLDValue(ldVal, signedLD)
      const { a } = lookupColorRamp(colorRamp, t)
      if (a < 0.01) {
        continue
      }

      const leftX = (px + py) * s + viewOffsetX
      const centerY = (-px + py) * s * yScalar
      const halfW = cw * s
      const halfH = ch * s * yScalar

      ctx.fillStyle = fillStyleLut(t)
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

export class Canvas2DLDRenderer
  extends Canvas2DMonolithicBackend<LDUploadData, LDRenderState>
  implements LDBackend
{
  private colorRamp: Uint8Array | null = null

  uploadColorRamp(colors: Uint8Array) {
    this.colorRamp = colors
  }

  render(data: LDUploadData | null, state: LDRenderState) {
    prepareCanvas(this.canvas, this.ctx, state.canvasWidth, state.canvasHeight)
    if (!data || !this.colorRamp) {
      return
    }
    drawLDBlocks(this.ctx, data, this.colorRamp, state)
  }
}
