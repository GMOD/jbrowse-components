import { drawSnpSegments } from '@jbrowse/alignments-core'

import { buildCigarOpDrawColors } from '../mismatch/baseColors.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { CoverageRegionFields } from '../coverage/buildRegion.ts'
import type { CoverageScale } from '../coverage/coverageScale.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawSnpSegmentsCanvas(
  ctx: Ctx2D,
  region: { snpPackedBuffer: ArrayBuffer } & CoverageRegionFields,
  bpToX: (bp: number) => number,
  viewWidth: number,
  state: RenderState,
  normalizeDepth: CoverageScale['normalize'],
) {
  drawSnpSegments(
    ctx,
    region.snpPackedBuffer,
    normalizeDepth,
    region.coverageMaxDepth,
    state.coverageHeight,
    buildCigarOpDrawColors(state),
    bpToX,
    viewWidth,
  )
}
