import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { intronAlpha } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { paintMarks } from '../mark.ts'
import { DELETION_MARK, SKIP_MARK } from './mark.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { GapUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawDeletions(
  ctx: Ctx2D,
  region: GapUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const color = state.colors.colorDeletion
  // Opaque is the common case — every deletion once zoomed in — and formatting
  // per gap was the only per-item string work in this pass; an ONT read carries
  // hundreds of them.
  const opaqueCss = rgb255(color)
  paintMarks(
    ctx,
    DELETION_MARK,
    region,
    { block, bpLength, fullBlockWidth },
    state,
    alpha => (alpha >= 1 ? opaqueCss : rgba255(color, alpha)),
  )
}

export function drawSkips(
  ctx: Ctx2D,
  region: GapUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  // Constant across the pass: an intron's alpha is a function of row height
  // alone, so the mark resolves the same number for every instance and the
  // string is built once.
  const css = rgba255(state.colors.colorSkip, intronAlpha(state.featureHeight))
  paintMarks(
    ctx,
    SKIP_MARK,
    region,
    { block, bpLength, fullBlockWidth },
    state,
    () => css,
  )
}
