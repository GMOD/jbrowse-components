import { rgb255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { drawClipBars } from '../../LinearAlignmentsDisplay/components/drawClipBars.ts'

import type { HardclipRegionFields } from './buildRegion.ts'
import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawHardclips(
  ctx: Ctx2D,
  region: HardclipRegionFields,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  drawClipBars(
    ctx,
    region.hardclipPositions,
    region.hardclipYs,
    region.hardclipLengths,
    region.numHardclips,
    rgb255(state.colors.colorHardclip),
    block,
    bpLength,
    fullBlockWidth,
    state,
  )
}
