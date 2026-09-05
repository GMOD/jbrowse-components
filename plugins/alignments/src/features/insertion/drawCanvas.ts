import { drawInsertionSerifs } from '@jbrowse/alignments-core'

import {
  rgb255,
  rgbaPrefix255,
} from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { InsertionSlot, Paint, paintMarks } from '../mark.ts'
import { insertionMark } from './mark.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { InterbaseUploadData } from '../../shared/uploadTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawInsertions(
  ctx: Ctx2D,
  region: InterbaseUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const color = state.colors.colorInsertion
  paintMarks(
    ctx,
    insertionMark(state.featureHeight, InsertionSlot.all),
    region,
    { block, bpLength, fullBlockWidth },
    state,
    {
      rule: Paint.palette,
      keys: undefined,
      opaqueCss: [rgb255(color)],
      fadedCss: [rgbaPrefix255(color)],
    },
    // The bar itself is the point glyph `paintMarks` draws from the mark's width
    // rule; these are the serif caps a small insertion wears on top of it,
    // shared with plugin-maf so the two displays draw one glyph.
    (c, x, top, height, data, i, pxPerBp) => {
      drawInsertionSerifs(c, x, top, height, data.interbaseLengths[i]!, pxPerBp)
    },
  )
}
