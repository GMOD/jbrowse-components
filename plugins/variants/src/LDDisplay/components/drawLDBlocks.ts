import { enterTriangleCellSpace } from '@jbrowse/display-kit/triangleTransform'
import { ldValueComputed } from '@jbrowse/ld-core'
import { makeRampFillStyleLut } from '@jbrowse/render-core/canvas2dUtils'

import { bandRowFirstColumn } from '../../VariantRPC/ldBand.ts'
import { mapLDValue } from './ldColorRamp.ts'

import type { LDUploadData } from './ldRenderingBackendTypes.ts'
import type { TriangleFrame } from '@jbrowse/display-kit/TriangleMatrixMixin'
import type { MarkContext2D } from '@jbrowse/render-core/marks'

/**
 * The Canvas2D and SVG painter. Cell (i, j) is the pre-rotation rect
 * `[b[j], b[j+1]] x [b[i], b[i+1]]` over `boundaries`, which describe either
 * layout. A cell nothing computed is left as background, as the shaders leave
 * it.
 */
export function drawLDBlocks(
  ctx: MarkContext2D,
  data: LDUploadData,
  colorRamp: Uint8Array,
  state: TriangleFrame,
  width: number,
) {
  const { ldValues, boundaries, numCells, band } = data
  if (numCells === 0) {
    return
  }
  const { viewScale } = state
  const fillStyleLut = makeRampFillStyleLut(colorRamp)
  const { minSum, maxSum } = enterTriangleCellSpace(ctx, state, width)
  const n = boundaries.length - 1
  let k = 0
  for (let i = 1; i < n; i++) {
    const py = boundaries[i]!
    const ch = boundaries[i + 1]! - py
    for (let j = bandRowFirstColumn(i, band); j < i; j++) {
      const px = boundaries[j]!
      const cw = boundaries[j + 1]! - px
      const ldVal = ldValues[k++]!
      const sum = px + py
      if (!ldValueComputed(ldVal) || sum > maxSum || sum + cw + ch < minSum) {
        continue
      }
      ctx.fillStyle = fillStyleLut(mapLDValue(ldVal))
      ctx.fillRect(
        px * viewScale,
        py * viewScale,
        cw * viewScale,
        ch * viewScale,
      )
    }
  }
  ctx.restore()
}
