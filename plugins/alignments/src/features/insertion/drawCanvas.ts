import { drawInsertionSerifs } from '@jbrowse/alignments-core'

import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { paintMarks } from '../mark.ts'
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
  // Opaque is the common case once zoomed in, and formatting per marker was the
  // only per-item string work in this pass.
  const opaqueCss = rgb255(color)
  paintMarks(
    ctx,
    insertionMark(state.featureHeight, 'all'),
    region,
    { block, bpLength, fullBlockWidth },
    state,
    alpha => (alpha >= 1 ? opaqueCss : rgba255(color, alpha)),
    // The bar itself is the point glyph `paintMarks` draws from the mark's
    // `widthPx`; these are the serif caps a small insertion wears on top of it,
    // shared with plugin-maf so the two displays draw one glyph.
    (c, x, top, height, data, i, pxPerBp) => {
      drawInsertionSerifs(c, x, top, height, data.interbaseLengths[i]!, pxPerBp)
    },
  )
}
