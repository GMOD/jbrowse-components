import { Paint, paintMarks } from '../mark.ts'
import { qualityCssColors } from './colors.ts'
import { PER_BASE_QUALITY_MARK } from './mark.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { PerBaseQualityUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawPerBaseQuality(
  ctx: Ctx2D,
  region: PerBaseQualityUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  paintMarks(
    ctx,
    PER_BASE_QUALITY_MARK,
    region,
    { block, bpLength, fullBlockWidth },
    state,
    {
      rule: Paint.palette,
      // Prebuilt per score, never formatted per base: this is one cell per
      // aligned base of every read on screen, and the layer is opaque, so the
      // faded table is unreachable.
      keys: region.perBaseQualScores,
      opaqueCss: qualityCssColors,
      fadedCss: [],
    },
  )
}
