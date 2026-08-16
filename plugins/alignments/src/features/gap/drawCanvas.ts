import { fillSpanRect } from '@jbrowse/alignments-core'

import { rgb255, rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  frequencyFade,
  intronAlpha,
  pileupRowOffCanvas,
  pileupRowY,
  sizeAlpha,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import {
  GAP_DELETION,
  GAP_SKIP,
} from '../../shaders/slang/gap.consts.generated.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { GapUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// One walk per gap kind, since the two are separate draw layers with separate
// gating (`PILEUP_LAYERS`) — `wanted` is what each takes out of the shared
// arrays. The geometry above the branch is what makes this one function: both
// marks are the same span projected the same way, and the reversed-block edge
// ordering is a rule neither should be spelling for itself.
function drawGapsOfType(
  ctx: Ctx2D,
  region: GapUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
  wanted: number,
) {
  const fH = state.featureHeight
  const deletions = wanted === GAP_DELETION
  const colorBase = deletions
    ? state.colors.colorDeletion
    : state.colors.colorSkip
  // Constant across the loop either way — the skip color entirely, since its
  // alpha is a function of row height alone, and the deletion color whenever
  // its fade resolves opaque, which is every deletion once zoomed in.
  // Formatting per gap was the only per-item string work in this pass; an ONT
  // read carries hundreds of gaps. Resolved off `wanted` rather than both being
  // built up front, so neither pass reads the color of the mark it isn't
  // drawing.
  const constCss = deletions
    ? rgb255(colorBase)
    : rgba255(colorBase, intronAlpha(fH))

  // gapPositions stores [start, end] pairs
  const numGaps = region.gapPositions.length / 2
  for (let i = 0; i < numGaps; i++) {
    if (region.gapTypes[i] !== wanted) {
      continue
    }
    const yRow = region.gapYs[i]!
    const y = pileupRowY(yRow, state)
    if (pileupRowOffCanvas(y, state)) {
      continue
    }
    const startBp = region.gapPositions[i * 2]!
    const endBp = region.gapPositions[i * 2 + 1]!
    const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
    const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
    // reversed (flipped) regions map startBp to the larger screen x, so order
    // the edges and use the absolute width
    const px = Math.min(x1, x2)
    const px2 = Math.max(x1, x2)
    const widthPx = px2 - px
    // Both branches below draw through `fillSpanRect`, which widens a sub-pixel
    // gap to 1px CENTERED on its span because that is what gap.slang's
    // `expandMinWidthX` does — the shader widens once, before it splits deletion
    // from skip. `widthPx` stays the TRUE span here because the fades below are
    // the shader's and test the true span too.

    if (deletions) {
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
      ctx.fillStyle = alpha >= 1 ? constCss : rgba255(colorBase, alpha)
      fillSpanRect(ctx, px, px2, y, fH)
    } else {
      // No clearRect needed: drawReads splits spliced reads into per-exon
      // segments, so the intron span is already unpainted. Just draw the 1px
      // centerline. (clearRect is a no-op on SvgCanvas — relying on it left
      // the read body solid under the line in vector SVG export.)
      ctx.fillStyle = constCss
      const midY = y + fH / 2
      fillSpanRect(ctx, px, px2, midY - 0.5, 1)
    }
  }
}

export function drawDeletions(
  ctx: Ctx2D,
  region: GapUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  drawGapsOfType(
    ctx,
    region,
    block,
    bpLength,
    fullBlockWidth,
    state,
    GAP_DELETION,
  )
}

export function drawSkips(
  ctx: Ctx2D,
  region: GapUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  drawGapsOfType(ctx, region, block, bpLength, fullBlockWidth, state, GAP_SKIP)
}
