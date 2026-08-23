import { drawModCovSegments } from '@jbrowse/alignments-core'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { CoverageScale } from '../coverage/coverageScale.ts'
import type { CoverageRegionFields } from '../coverage/types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawModCoverageCanvas(
  ctx: Ctx2D,
  region: { modCovPackedBuffer: ArrayBuffer } & CoverageRegionFields,
  bpToX: (bp: number) => number,
  viewWidth: number,
  state: RenderState,
  normalizeDepth: CoverageScale['normalize'],
) {
  drawModCovSegments(
    ctx,
    region.modCovPackedBuffer,
    normalizeDepth,
    region.coverageMaxDepth,
    state.coverageHeight,
    bpToX,
    viewWidth,
  )
}
