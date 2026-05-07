import { drawSnpSegments } from '@jbrowse/alignments-core'

import { buildCigarOpDrawColors } from '../mismatch/baseColors.ts'

import type { SnpCoverageRegionFields } from './buildRegion.ts'
import type { RenderState } from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { CoverageRegionFields } from '../coverage/buildRegion.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Draws SNP-colored stacked segments overlaid on the coverage bars.
// Heights are normalized 0–1 by the worker (max-depth-relative); the
// `snpDepthScale = region.coverageMaxDepth / domainMax` keeps the total bar
// height consistent when the wiggle ydomain is autoscaled across regions.
export function drawSnpSegmentsCanvas(
  ctx: Ctx2D,
  region: SnpCoverageRegionFields & CoverageRegionFields,
  bpToX: (bp: number) => number,
  viewWidth: number,
  state: RenderState,
) {
  const domainMax = state.coverageMaxDepth
  if (!domainMax || region.snpSegmentCount === 0) {
    return
  }
  const snpDepthScale = region.coverageMaxDepth / domainMax
  drawSnpSegments(
    ctx,
    region.snpBuffer,
    region.snpSegmentCount,
    snpDepthScale,
    state.coverageHeight,
    buildCigarOpDrawColors(state),
    bpToX,
    viewWidth,
  )
}
