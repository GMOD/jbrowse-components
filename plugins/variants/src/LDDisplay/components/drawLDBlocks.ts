import { ldValueComputed } from '@jbrowse/ld-core'
import { makeRampFillStyleLut } from '@jbrowse/render-core/canvas2dUtils'

import { bandRowFirstColumn } from '../../VariantRPC/ldBand.ts'
import { mapLDValue } from './ldColorRamp.ts'

import type { LDDrawState, LDUploadData } from './ldRenderingBackendTypes.ts'
import type { MarkContext2D } from '@jbrowse/render-core/marks'

const COS45 = Math.SQRT1_2

/**
 * Pure draw entry point. Paints the LD lower-triangle as 45°-rotated diamonds
 * into any 2D-canvas-like context (real CanvasRenderingContext2D or
 * SvgCanvas): the `ld` marks' painter, and so both the on-screen Canvas2D
 * fallback and the SVG export.
 */
export function drawLDBlocks(
  ctx: MarkContext2D,
  data: LDUploadData,
  colorRamp: Uint8Array,
  state: LDDrawState,
) {
  const { yScalar, viewScale, viewOffsetX } = state
  const { ldValues, boundaries, numCells, band } = data
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
    for (let j = bandRowFirstColumn(i, band); j < i; j++) {
      const px = boundaries[j]!
      const cw = boundaries[j + 1]! - px
      const ldVal = ldValues[k++]!

      // Same test the two shaders' `ldRampColor` makes, from the same generated
      // function: a cell nothing computed is left as background rather than
      // painted at the bottom of the ramp, which for r² is an opaque white
      // diamond claiming linkage equilibrium.
      if (!ldValueComputed(ldVal)) {
        continue
      }
      const t = mapLDValue(ldVal)

      // The four corners of the pre-rotation rect [px,px+cw] x [py,py+ch], each
      // put through the same map the shader's `diagonalCellToClip` applies —
      // (x,y) -> ((x+y)·s, (y-x)·s·yScalar) — rather than a rhombus built from
      // half-diagonals. Stepping +cw along the cell's x axis moves the screen
      // point by (+cw·s, -cw·s·yScalar) and stepping +ch along y by (+ch·s,
      // +ch·s·yScalar), so the two steps compose to the far corner.
      //
      // The half-diagonal form this replaces used `cw` for the horizontal
      // extent and `ch` for the vertical, which describes the rotated rect only
      // when the two are equal. They always are in uniform mode — every
      // boundary is `i * uniformW` — so this is bit-identical there. In genomic
      // mode they are the Voronoi widths of two different SNPs and are equal
      // only by coincidence: cells landed at the wrong center, in the wrong
      // shape, and stopped tiling. It reached figures rather than only the
      // Canvas2D fallback, because SVG export paints through this function on
      // every backend.
      const x0 = (px + py) * s + viewOffsetX
      const y0 = (py - px) * s * yScalar
      const dxw = cw * s
      const dyw = -cw * s * yScalar
      const dxh = ch * s
      const dyh = ch * s * yScalar

      ctx.fillStyle = fillStyleLut(t)
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x0 + dxw, y0 + dyw)
      ctx.lineTo(x0 + dxw + dxh, y0 + dyw + dyh)
      ctx.lineTo(x0 + dxh, y0 + dyh)
      ctx.closePath()
      ctx.fill()
    }
  }
}
