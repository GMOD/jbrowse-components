import { Paint, paintMarks } from '../mark.ts'
import { buildBaseCssMap, buildBaseFadeCssMap } from './baseColors.ts'
import { MISMATCH_MARK } from './mark.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { MismatchUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawMismatches(
  ctx: Ctx2D,
  region: MismatchUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  // N has a palette entry; any other non-A/C/G/T byte takes the fallback,
  // matching the GPU shader (mismatch.slang baseColor catch-all). Both tables
  // are indexed by the base byte itself, so the opaque case — every mismatch
  // once zoomed to base level, where both fades resolve to 1 — reads a prebuilt
  // string and only a genuinely faded one is formatted.
  paintMarks(
    ctx,
    MISMATCH_MARK,
    region,
    { block, bpLength, fullBlockWidth },
    state,
    {
      rule: Paint.palette,
      keys: region.mismatchBases,
      opaqueCss: buildBaseCssMap(state),
      fadedCss: buildBaseFadeCssMap(state),
    },
  )
}
