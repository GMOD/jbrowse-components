import {
  COVERAGE_BAR_SEAM_FUDGE_PX,
  drawCoverageBins,
} from '@jbrowse/alignments-core'

import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'

import type { CoverageScale } from './coverageScale.ts'
import type { CoverageRegionFields } from './types.ts'
import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Draws only the depth-bar layer of the coverage area. Other coverage-area
// layers (SNP / mod-cov / interbase / indicator) are drawn from their own
// feature folders by the renderer's coverage-area orchestrator.
export function drawCoverageBars(
  ctx: Ctx2D,
  region: CoverageRegionFields,
  bpToX: (bp: number) => number,
  viewWidth: number,
  state: RenderState,
  normalizeDepth: CoverageScale['normalize'],
) {
  drawCoverageBins(
    ctx,
    region.coveragePackedBuffer,
    normalizeDepth,
    region.coverageMaxDepth,
    state.coverageHeight,
    rgb255(state.colors.colorCoverage),
    bpToX,
    viewWidth,
    region.coverageBinSize,
    COVERAGE_BAR_SEAM_FUDGE_PX,
  )
}
