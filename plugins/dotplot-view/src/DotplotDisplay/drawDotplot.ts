import { unpackColorToCSS } from './dotplotWebGLColors.ts'

import type { DotplotGeometryData } from './dotplotBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export interface DotplotDrawParams {
  scaleX: number
  scaleY: number
  offsetX: number
  offsetY: number
  viewHeight: number
}

export function drawDotplotInstances(
  ctx: Ctx2D,
  geometry: DotplotGeometryData,
  params: DotplotDrawParams,
) {
  const { scaleX, scaleY, offsetX, offsetY, viewHeight } = params
  const { x1s, y1s, x2s, y2s, colors, instanceCount } = geometry
  for (let i = 0; i < instanceCount; i++) {
    const sx1 = x1s[i]! * scaleX - offsetX
    const sy1 = viewHeight - (y1s[i]! * scaleY - offsetY)
    const sx2 = x2s[i]! * scaleX - offsetX
    const sy2 = viewHeight - (y2s[i]! * scaleY - offsetY)
    ctx.strokeStyle = unpackColorToCSS(colors[i]!)
    ctx.beginPath()
    ctx.moveTo(sx1, sy1)
    ctx.lineTo(sx2, sy2)
    ctx.stroke()
  }
}
