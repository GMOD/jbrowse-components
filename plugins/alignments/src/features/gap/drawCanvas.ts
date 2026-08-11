import { minWidthLeft } from '@jbrowse/alignments-core'

import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  frequencyFade,
  intronAlpha,
  pileupRowOffCanvas,
  pileupRowY,
  sizeAlpha,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { GapUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

const GAP_DELETION = 0
const GAP_SKIP = 1

export function drawGaps(
  ctx: Ctx2D,
  region: GapUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  const delColorBase = state.colors.colorDeletion
  // Both are constant across the loop — the skip color entirely, and the
  // deletion color whenever its fade resolves opaque, which is every deletion
  // once zoomed in. Formatting them per gap was the only per-item string work
  // in this pass; an ONT read carries hundreds of gaps.
  const delCssOpaque = rgb255(delColorBase)
  const skipCss = rgba255(state.colors.colorSkip, intronAlpha(fH))

  // gapPositions stores [start, end] pairs
  const numGaps = region.gapPositions.length / 2
  for (let i = 0; i < numGaps; i++) {
    const yRow = region.gapYs[i]!
    const y = pileupRowY(yRow, state)
    if (pileupRowOffCanvas(y, state)) {
      continue
    }
    const startBp = region.gapPositions[i * 2]!
    const endBp = region.gapPositions[i * 2 + 1]!
    const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
    const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
    const gapType = region.gapTypes[i]!
    // reversed (flipped) regions map startBp to the larger screen x, so order
    // the edges and use the absolute width
    const px = Math.min(x1, x2)
    const px2 = Math.max(x1, x2)
    const widthPx = px2 - px
    const w = Math.max(1, widthPx)
    // A sub-pixel gap is widened to 1px CENTERED on its span, because that is
    // what gap.slang's `expandMinWidthX` does. Anchoring the widened mark at
    // the gap's left edge put every Canvas2D gap up to half a pixel right of
    // the GPU's once the deletion went under 1px — the same divergence the
    // coverage marks were fixed for (see minWidthLeft), on the call site that
    // fix missed. Both branches below share it: the shader widens once, before
    // it splits deletion from skip.
    const left = minWidthLeft(px, px2, widthPx)

    if (gapType === GAP_DELETION) {
      // Twin of gap.slang's deletion branch: the frequency fade, times the
      // deletion's own on-screen span. The second factor is what the first one
      // cannot supply — a site every read carries lerps back to 1 however
      // sub-pixel it is. sizeAlpha snaps to 0 below one alpha step.
      const alpha =
        frequencyFade(state, widthPx * widthPx, region.gapFrequencies[i]!) *
        sizeAlpha(widthPx)
      if (alpha === 0) {
        continue
      }
      ctx.fillStyle = alpha >= 1 ? delCssOpaque : rgba255(delColorBase, alpha)
      ctx.fillRect(left, y, w, fH)
    } else if (gapType === GAP_SKIP) {
      // No clearRect needed: drawReads splits spliced reads into per-exon
      // segments, so the intron span is already unpainted. Just draw the 1px
      // centerline. (clearRect is a no-op on SvgCanvas — relying on it left
      // the read body solid under the line in vector SVG export.)
      ctx.fillStyle = skipCss
      const midY = y + fH / 2
      ctx.fillRect(left, midY - 0.5, w, 1)
    }
  }
}
