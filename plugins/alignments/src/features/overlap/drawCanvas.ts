import { normalizedRgbToCssRgba } from '@jbrowse/core/util/colorBits'

import {
  bpToScreenX,
  pileupRowOffCanvas,
  pileupRowY,
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
  const fH = state.featureHeight
  if (fH >= 3) {
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
        // black mirrors the shader's OVERLAP_TINT, which is a float3 and so has
        // no generated twin to import — the one value here kept in step by eye
        ctx.fillStyle = chainMode
          ? normalizedRgbToCssRgba(state.colors.colorOverlap, fade)
          : `rgba(0,0,0,${overlapAlpha(w)})`
        ctx.fillRect(left, y, w, fH)
      }
    }
  }
}
