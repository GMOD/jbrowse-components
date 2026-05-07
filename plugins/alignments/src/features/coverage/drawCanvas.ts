import { drawCoverageBins } from '@jbrowse/alignments-core'
import { makeScoreNormalizer } from '@jbrowse/wiggle-core'

import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { ALIGNMENTS_FUDGE_FACTOR } from '../../LinearAlignmentsDisplay/constants.ts'

import type { CoverageRegionFields } from './buildRegion.ts'
import type { RenderState } from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Draws only the depth-bar layer of the coverage area. Other coverage-area
// layers (SNP / mod-cov / noncov / indicator) are drawn from their own
// feature folders by the renderer's coverage-area orchestrator.
export function drawCoverageBars(
  ctx: Ctx2D,
  region: CoverageRegionFields,
  bpToX: (bp: number) => number,
  viewWidth: number,
  state: RenderState,
) {
  const domainMax = state.coverageMaxDepth
  if (domainMax) {
    drawCoverageBins(
      ctx,
      region.coverageBuffer,
      makeScoreNormalizer(0, domainMax, state.coverageIsLog),
      state.coverageHeight,
      rgb255(state.colors.colorCoverage),
      bpToX,
      viewWidth,
      ALIGNMENTS_FUDGE_FACTOR,
    )
  }
}
