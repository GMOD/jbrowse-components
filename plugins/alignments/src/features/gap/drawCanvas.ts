import {
  rgb255,
  rgba255,
  rgbaPrefix255,
} from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { Paint, paintMarks } from '../mark.ts'
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
  paintMarks(
    ctx,
    DELETION_MARK,
    region,
    { block, bpLength, fullBlockWidth },
    state,
    {
      rule: Paint.palette,
      keys: undefined,
      opaqueCss: [rgb255(color)],
      fadedCss: [rgbaPrefix255(color)],
    },
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
  const color = state.colors.colorSkip
  paintMarks(
    ctx,
    SKIP_MARK,
    region,
    { block, bpLength, fullBlockWidth },
    state,
    {
      rule: Paint.palette,
      keys: undefined,
      // An intron's alpha is a function of row height alone, so `paintMarks`
      // resolves one string for the whole pass out of these two.
      opaqueCss: [rgba255(color, 1)],
      fadedCss: [rgbaPrefix255(color)],
    },
  )
}
