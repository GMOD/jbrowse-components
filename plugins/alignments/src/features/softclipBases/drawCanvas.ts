import { paintMarks } from '../mark.ts'
import { buildBaseCssMap } from '../mismatch/baseColors.ts'
import { SOFTCLIP_BASES_MARK } from './mark.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { SoftclipBasesUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

export function drawSoftclipBases(
  ctx: Ctx2D,
  region: SoftclipBasesUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  // N has a palette entry; any other non-A/C/G/T byte takes the table's
  // pre-filled fallback, matching the GPU shader (mismatch.slang baseColor
  // catch-all, shared with the softclip-bases overlay) and the mismatch draw —
  // including its mute under showModifications.
  const baseCss = buildBaseCssMap(state)
  paintMarks(
    ctx,
    SOFTCLIP_BASES_MARK,
    region,
    { block, bpLength, fullBlockWidth },
    state,
    (_alpha, data, i) => baseCss[data.softclipBaseBases[i]!]!,
  )
}
