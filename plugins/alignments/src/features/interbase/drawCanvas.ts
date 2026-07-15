import { drawInterbaseSegments } from '@jbrowse/alignments-core'

import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawInterbaseCanvas(
  ctx: Ctx2D,
  region: { interbasePackedBuffer: ArrayBuffer; interbaseMaxCount: number },
  bpToX: (bp: number) => number,
  viewWidth: number,
  state: RenderState,
  domainMax: number,
) {
  drawInterbaseSegments(
    ctx,
    region.interbasePackedBuffer,
    region.interbaseMaxCount,
    {
      insertion: rgb255(state.colors.colorInsertionIndicator),
      softclip: rgb255(state.colors.colorSoftclipIndicator),
      hardclip: rgb255(state.colors.colorHardclipIndicator),
    },
    bpToX,
    viewWidth,
    state.coverageHeight,
    domainMax,
  )
}
