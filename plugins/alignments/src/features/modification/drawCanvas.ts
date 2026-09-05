import { Paint, paintMarks } from '../mark.ts'
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
  paintMarks(
    ctx,
    MODIFICATION_MARK,
    region,
    { block, bpLength, fullBlockWidth },
    state,
    {
      // The worker's own packed colour, which is not a small table — 5mC, 5hmC
      // and the unmodified blue in per-read runs — so `paintMarks` reformats it
      // per run rather than per mark.
      rule: Paint.packedAbgr,
      keys: region.modificationColors,
      opaqueCss: [],
      fadedCss: [],
    },
  )
}
