import { rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { paintMarks } from '../mark.ts'
import { buildBaseCssMap, buildBaseTupleMap } from './baseColors.ts'
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
  // matching the GPU shader (mismatch.slang baseColor catch-all). Opaque
  // mismatches — the common case once zoomed to base level, where both fades
  // resolve to 1 — read a prebuilt CSS string instead of formatting one per
  // mismatch; only a genuinely faded one pays `rgba255`.
  const baseCss = buildBaseCssMap(state)
  const baseTuples = buildBaseTupleMap(state)
  paintMarks(
    ctx,
    MISMATCH_MARK,
    region,
    { block, bpLength, fullBlockWidth },
    state,
    (alpha, data, i) => {
      const base = data.mismatchBases[i]!
      return alpha >= 1 ? baseCss[base]! : rgba255(baseTuples[base]!, alpha)
    },
  )
}
