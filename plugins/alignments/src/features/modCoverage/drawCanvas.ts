import { drawModCovSegments } from '@jbrowse/alignments-core'
import { makeScoreNormalizer } from '@jbrowse/wiggle-core'

import type { ModCoverageRegionFields } from './buildRegion.ts'
import type { RenderState } from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { CoverageRegionFields } from '../coverage/buildRegion.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawModCoverageCanvas(
  ctx: Ctx2D,
  region: ModCoverageRegionFields & CoverageRegionFields,
  bpToX: (bp: number) => number,
  viewWidth: number,
  state: RenderState,
) {
  const domainMax = state.coverageMaxDepth
  if (!domainMax) {
    return
  }
  drawModCovSegments(
    ctx,
    region.modCovBuffer,
    makeScoreNormalizer(0, domainMax, state.coverageIsLog),
    region.coverageMaxDepth,
    state.coverageHeight,
    bpToX,
    viewWidth,
  )
}
