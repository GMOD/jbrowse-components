import { paintMarks } from '../mark.ts'
import { buildBaseCssMap } from '../mismatch/baseColors.ts'
import { PER_BASE_LETTER_MARK } from './mark.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { PerBaseLetterUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawPerBaseLetter(
  ctx: Ctx2D,
  region: PerBaseLetterUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  // Same per-base palette as the mismatch and softclip-base draws, so the
  // Canvas2D and GPU paths render identical colors (and both mute under
  // modifications). The CSS table bakes in the non-ACGTN fallback, so the byte
  // indexes it directly — one entry per visible base per read runs through this.
  const baseCss = buildBaseCssMap(state)
  paintMarks(
    ctx,
    PER_BASE_LETTER_MARK,
    region,
    { block, bpLength, fullBlockWidth },
    state,
    (_alpha, data, i) => baseCss[data.perBaseLetterBases[i]!]!,
  )
}
