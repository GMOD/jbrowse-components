import { unpackColorToCSS } from './dotplotWebGLColors.ts'

import type { DotplotGeometryData } from './dotplotBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export interface DotplotDrawParams {
  viewBpH: number
  bpPerPxHInv: number
  viewBpV: number
  bpPerPxVInv: number
  viewHeight: number
}

export function drawDotplotInstances(
  ctx: Ctx2D,
  geometry: DotplotGeometryData,
  params: DotplotDrawParams,
) {
  const { viewBpH, bpPerPxHInv, viewBpV, bpPerPxVInv, viewHeight } = params
  const {
    x1Hi,
    x1Lo,
    y1Hi,
    y1Lo,
    x2Hi,
    x2Lo,
    y2Hi,
    y2Lo,
    padHs,
    padVs,
    colors,
    instanceCount,
  } = geometry
  for (let i = 0; i < instanceCount; i++) {
    const sx1 = (x1Hi[i]! + x1Lo[i]! - viewBpH) * bpPerPxHInv + padHs[i]!
    const sy1 =
      viewHeight -
      ((y1Hi[i]! + y1Lo[i]! - viewBpV) * bpPerPxVInv + padVs[i]!)
    const sx2 = (x2Hi[i]! + x2Lo[i]! - viewBpH) * bpPerPxHInv + padHs[i]!
    const sy2 =
      viewHeight -
      ((y2Hi[i]! + y2Lo[i]! - viewBpV) * bpPerPxVInv + padVs[i]!)
    ctx.strokeStyle = unpackColorToCSS(colors[i]!)
    ctx.beginPath()
    ctx.moveTo(sx1, sy1)
    ctx.lineTo(sx2, sy2)
    ctx.stroke()
  }
}
