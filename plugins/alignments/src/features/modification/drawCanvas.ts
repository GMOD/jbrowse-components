import { abgrToCssRgba } from '@jbrowse/core/util/colorBits'

import { paintMarks } from '../mark.ts'
import { MODIFICATION_MARK } from './mark.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { ModificationUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawModifications(
  ctx: Ctx2D,
  region: ModificationUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  // Reformat the CSS string only when the packed color actually changes. This
  // is the densest array the display produces (one mark per CpG per read on a
  // nanopore pileup) but it draws from a handful of colors — 5mC, 5hmC, the
  // unmodified blue — in per-read runs, so `abgrToCssRgba` goes from once per
  // mark to once per run. The comparison is on the u32, not the string.
  let lastAbgr = -1
  let lastCss = ''
  paintMarks(
    ctx,
    MODIFICATION_MARK,
    region,
    { block, bpLength, fullBlockWidth },
    state,
    (_alpha, data, i) => {
      const abgr = data.modificationColors[i]!
      if (abgr !== lastAbgr) {
        lastAbgr = abgr
        lastCss = abgrToCssRgba(abgr)
      }
      return lastCss
    },
  )
}
