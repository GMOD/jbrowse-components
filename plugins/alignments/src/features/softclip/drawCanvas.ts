import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { drawClipBars } from '../../shared/drawClipBars.ts'

import type { SoftclipRegionFields } from './buildRegion.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawSoftclips(
  ctx: Ctx2D,
  region: SoftclipRegionFields,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  drawClipBars(
    ctx,
    region.softclipPositions,
    region.softclipYs,
    region.softclipLengths,
    region.numSoftclips,
    rgb255(state.colors.colorSoftclip),
    block,
    bpLength,
    fullBlockWidth,
    state,
  )
}
