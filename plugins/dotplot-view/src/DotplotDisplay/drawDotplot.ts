import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import type { DotplotGeometryData } from './dotplotRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export interface DotplotDrawParams {
  viewBpH: number
  bpPerPxHInv: number
  viewBpV: number
  bpPerPxVInv: number
  viewHeight: number
  lineWidth: number
}

export function drawDotplotInstances(
  ctx: Ctx2D,
  geometry: DotplotGeometryData,
  params: DotplotDrawParams,
) {
  const { viewBpH, bpPerPxHInv, viewBpV, bpPerPxVInv, viewHeight, lineWidth } =
    params
  // Round caps make sub-lineWidth segments render as dots, matching the GPU
  // capsule-SDF path. Setting per call keeps callers from forgetting.
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'round'
  const { x1, y1, x2, y2, colors, instanceCount } = geometry
  if (instanceCount === 0) {
    return
  }

  // Batch consecutive same-color segments into one path, flushing only when the
  // packed color changes (same shape as Canvas2DManhattanRenderer). Runs are
  // long in practice: every CIGAR segment of one alignment carries that
  // alignment's color, and the common color-by modes resolve to a handful of
  // distinct colors. Worth it twice over — on the Canvas2D fallback the
  // per-segment strokeStyle write plus beginPath/stroke pair is the dominant
  // cost at 10^5+ segments, and in vector SVG export SvgCanvas emits one <path>
  // element per stroke() call, so batching divides the element count by the
  // average run length.
  let currentAbgr = colors[0]!
  ctx.strokeStyle = abgrToCssRgba(currentAbgr)
  ctx.beginPath()
  for (let i = 0; i < instanceCount; i++) {
    const abgr = colors[i]!
    if (abgr !== currentAbgr) {
      ctx.stroke()
      currentAbgr = abgr
      ctx.strokeStyle = abgrToCssRgba(currentAbgr)
      ctx.beginPath()
    }
    const sx1 = (x1[i]! - viewBpH) * bpPerPxHInv
    const sy1 = viewHeight - (y1[i]! - viewBpV) * bpPerPxVInv
    const sx2 = (x2[i]! - viewBpH) * bpPerPxHInv
    const sy2 = viewHeight - (y2[i]! - viewBpV) * bpPerPxVInv
    ctx.moveTo(sx1, sy1)
    ctx.lineTo(sx2, sy2)
  }
  ctx.stroke()
}
