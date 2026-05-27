import { unpackColorToCSS } from './dotplotColors.ts'

import type { DotplotGeometryData } from './dotplotBackendTypes.ts'
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
  const { x1, y1, x2, y2, padHs, padVs, colors, instanceCount } = geometry
  for (let i = 0; i < instanceCount; i++) {
    const sx1 = (x1[i]! - viewBpH) * bpPerPxHInv + padHs[i]!
    const sy1 = viewHeight - ((y1[i]! - viewBpV) * bpPerPxVInv + padVs[i]!)
    const sx2 = (x2[i]! - viewBpH) * bpPerPxHInv + padHs[i]!
    const sy2 = viewHeight - ((y2[i]! - viewBpV) * bpPerPxVInv + padVs[i]!)
    ctx.strokeStyle = unpackColorToCSS(colors[i]!)
    ctx.beginPath()
    ctx.moveTo(sx1, sy1)
    ctx.lineTo(sx2, sy2)
    ctx.stroke()
  }
}
