import { drawIndicators } from '@jbrowse/alignments-core'

import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'

import type { IndicatorRegionFields } from './buildRegion.ts'
import type { RenderState } from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawIndicatorCanvas(
  ctx: Ctx2D,
  region: IndicatorRegionFields,
  bpToX: (bp: number) => number,
  viewWidth: number,
  state: RenderState,
) {
  drawIndicators(
    ctx,
    region.indicatorBuffer,
    {
      insertion: rgb255(state.colors.colorInsertion),
      softclip: rgb255(state.colors.colorSoftclip),
      hardclip: rgb255(state.colors.colorHardclip),
    },
    bpToX,
    viewWidth,
  )
}
