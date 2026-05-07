import { drawSnpSegments } from '@jbrowse/alignments-core'
import { makeScoreNormalizer } from '@jbrowse/wiggle-core'

import { buildCigarOpDrawColors } from '../mismatch/baseColors.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { CoverageRegionFields } from '../coverage/buildRegion.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawSnpSegmentsCanvas(
  ctx: Ctx2D,
  region: { snpPackedBuffer: ArrayBuffer } & CoverageRegionFields,
  bpToX: (bp: number) => number,
  viewWidth: number,
  state: RenderState,
) {
  const domainMax = state.coverageMaxDepth
  if (!domainMax) {
    return
  }
  drawSnpSegments(
    ctx,
    region.snpPackedBuffer,
    makeScoreNormalizer(0, domainMax, state.coverageIsLog),
    region.coverageMaxDepth,
    state.coverageHeight,
    buildCigarOpDrawColors(state),
    bpToX,
    viewWidth,
  )
}
