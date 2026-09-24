import { enterTriangleCellSpace } from '@jbrowse/display-kit/triangleTransform'
import { makeScoreNormalizer } from '@jbrowse/render-core/scoreScale'

import { makeHicFillStyleLut } from './colorRamp.ts'
import {
  getInstanceCount,
  getInstancePosition,
} from './shaders/hic.iface.generated.ts'

import type {
  HicRenderState,
  HicUploadData,
} from './hicRenderingBackendTypes.ts'
import type { MarkContext2D } from '@jbrowse/render-core/marks'

/**
 * The Canvas2D and SVG painter. `width` is the painted surface's, used only to
 * skip off-surface bins: a pan redraws the whole fetched matrix, 300k to 4.5M
 * contacts, under the live transform. A cell's `px + py` spans
 * `2 * binWidth`, hence the pad on the low side.
 */
export function drawHicBlocks(
  ctx: MarkContext2D,
  data: HicUploadData,
  state: HicRenderState,
  width: number,
) {
  const { instances, numContacts, binWidth } = data
  if (numContacts === 0) {
    return
  }
  const { viewScale, domainMin, domainMax, scaleType, colorRamp } = state
  const normalize = makeScoreNormalizer(domainMin, domainMax, scaleType, 1)
  const fillStyleLut = makeHicFillStyleLut(colorRamp)
  const { minSum, maxSum } = enterTriangleCellSpace(ctx, state, width)
  const lo = minSum - 2 * binWidth
  const size = binWidth * viewScale

  for (let i = 0; i < numContacts; i++) {
    const px = getInstancePosition(instances, i, 0)
    const py = getInstancePosition(instances, i, 1)
    const sum = px + py
    if (sum < lo || sum > maxSum) {
      continue
    }
    const fill = fillStyleLut(normalize(getInstanceCount(instances, i)))
    if (fill !== undefined) {
      ctx.fillStyle = fill
      ctx.fillRect(px * viewScale, py * viewScale, size, size)
    }
  }

  ctx.restore()
}
