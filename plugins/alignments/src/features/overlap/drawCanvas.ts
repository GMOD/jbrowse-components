import { normalizedRgbToCssRgba } from '@jbrowse/core/util/colorBits'

import { shouldDrawOverlaps } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { paintMarks } from '../mark.ts'
import { OVERLAP_MARK } from './mark.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { OverlapsUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Twin of overlap.slang, which carries the argument for the two forms: chain
// mode fills the span with a theme neutral that is no read colour (both segments
// of one molecule are there, so neither segment's colour is honest), collapsed
// rows keep the stacking dark tint that makes depth readable. Both tints come
// off the palette — the collapsed one was a literal black held to the shader's
// own `float3` by eye, and since it STACKS to show depth, black on a dark ground
// composed toward the ground and showed none.
export function drawOverlaps(
  ctx: Ctx2D,
  region: OverlapsUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  // The layer's own gate, not a local `fH >= 3` spelling the same number a
  // second time. The renderer has already filtered PILEUP_LAYERS on it, so this
  // is redundant there — but it is this function's precondition and its unit
  // tests call it directly, and the duplicated constant is exactly the drift
  // `shouldDrawOverlaps` was extracted to stop.
  if (shouldDrawOverlaps(state)) {
    const tint = state.chainMode
      ? state.colors.colorOverlap
      : state.colors.colorOverlapTint
    paintMarks(
      ctx,
      OVERLAP_MARK,
      region,
      { block, bpLength, fullBlockWidth },
      state,
      alpha => normalizedRgbToCssRgba(tint, alpha),
    )
  }
}
