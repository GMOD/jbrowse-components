import { normalizedRgbToCssRgba } from '@jbrowse/core/util/colorBits'

import {
  bpToScreenX,
  pileupRowOffCanvas,
  pileupRowY,
  shouldDrawOverlaps,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import {
  overlapAlpha,
  overlapFade,
} from '../../shaders/slang/overlap.js.generated.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { OverlapsUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// The overlap mark over each interval where two features share a row. Twin of
// overlap.slang, which carries the argument for the two forms: chain mode fills
// the span with a theme neutral that is no read colour (both segments of one
// molecule are there, so neither segment's colour is honest), collapsed rows
// keep the stacking dark tint that makes depth readable. Hidden under ~3px rows
// like the GPU pass, and faded out for sub-pixel-narrow overlaps so they vanish
// when zoomed out — `overlapFade`/`overlapAlpha` are overlap.slang's own
// fade, generated into TS (adr-051), replacing a local re-implementation of
// `smoothstep` applied to the same two constants.
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
  if (!shouldDrawOverlaps(state)) {
    return
  }
  const fH = state.featureHeight
  const { chainMode } = state
  const numOverlaps = region.overlapPositions.length / 2
  for (let i = 0; i < numOverlaps; i++) {
    const y = pileupRowY(region.overlapYs[i]!, state)
    if (pileupRowOffCanvas(y, state)) {
      continue
    }
    const startBp = region.overlapPositions[i * 2]!
    const endBp = region.overlapPositions[i * 2 + 1]!
    const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
    const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
    // reversed (flipped) regions map startBp to the larger screen x, so anchor
    // at the smaller edge and use the absolute width
    const left = Math.min(x1, x2)
    const w = Math.abs(x2 - x1)
    const fade = overlapFade(w)
    if (w > 0 && fade > 0) {
      // Both tints come off the palette now. The collapsed one was a literal
      // black held to the shader's own `float3` by eye — and since it STACKS
      // to show depth, black on a dark ground composed toward the ground and
      // showed none.
      ctx.fillStyle = chainMode
        ? normalizedRgbToCssRgba(state.colors.colorOverlap, fade)
        : normalizedRgbToCssRgba(state.colors.colorOverlapTint, overlapAlpha(w))
      ctx.fillRect(left, y, w, fH)
    }
  }
}
