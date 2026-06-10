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
) {
  drawInterbaseSegments(
    ctx,
    region.interbasePackedBuffer,
    region.interbaseMaxCount,
    {
      insertion: rgb255(state.colors.colorInsertion),
      softclip: rgb255(state.colors.colorSoftclip),
      hardclip: rgb255(state.colors.colorHardclip),
    },
    bpToX,
    viewWidth,
    state.coverageHeight,
  )
}
