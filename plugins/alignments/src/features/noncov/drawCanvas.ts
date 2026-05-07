import { drawNoncovSegments } from '@jbrowse/alignments-core'

import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawNoncovCanvas(
  ctx: Ctx2D,
  region: { noncovPackedBuffer: ArrayBuffer; noncovMaxCount: number },
  bpToX: (bp: number) => number,
  viewWidth: number,
  state: RenderState,
) {
  drawNoncovSegments(
    ctx,
    region.noncovPackedBuffer,
    region.noncovMaxCount,
    {
      insertion: rgb255(state.colors.colorInsertion),
      softclip: rgb255(state.colors.colorSoftclip),
      hardclip: rgb255(state.colors.colorHardclip),
    },
    bpToX,
    viewWidth,
  )
}
