import { rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { buildLinkedReadColorPalette } from '../../shaders/palettes.ts'
// The palette-index rule, generated from alignmentsUniforms.slang (adr-051) —
// the same import the bezier overlay makes. This pass spelled it
// `colorType % css.length`, the wrap that file's `min` explicitly replaced: it
// agrees with the clamp on every slot in use and resolves an out-of-range one to
// a different REAL colour instead of the last slot, which is drift review cannot
// see.
import { linkedReadColorSlot } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import {
  LINKED_READ_LINE_ALPHA,
  LINKED_READ_LINE_WIDTH_PX,
} from '../../shaders/slang/linkedReadLine.consts.generated.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { ColorPalette } from '../../shaders/colors.ts'
import type { LinkedReadLinesUploadData } from './types.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

// Every stroke this pass can use is still known up front — build the eight CSS
// strings once per draw rather than formatting one per line (the cost
// `drawReads` documents for fillStyle). Once per draw and not once per module,
// because the palette is the THEMED one now: baking it at import time is what
// left dark mode drawing connectors in the light palette's colors while the
// reads under them were dimmed. Memoized on the palette object, which the model
// rebuilds only when the theme changes.
// LINKED_READ_LINE_ALPHA comes from linkedReadLine.generated.ts
// (linkedReadLine.slang is the source of truth), so this path can't drift from
// the shader.
let lineCssMemo: { colors: ColorPalette; css: string[] } | undefined
function lineCss(colors: ColorPalette) {
  if (lineCssMemo?.colors !== colors) {
    lineCssMemo = {
      colors,
      css: buildLinkedReadColorPalette(colors).map(c =>
        rgba255(c, LINKED_READ_LINE_ALPHA),
      ),
    }
  }
  return lineCssMemo.css
}

export function drawLinkedReadLines(
  ctx: Ctx2D,
  region: LinkedReadLinesUploadData,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight
  // From linkedReadLine.slang, like the alpha above. It was a bare 1.5 here and
  // nothing at all on the GPU, which drew a native line list at a fixed 1 px —
  // the two backends disagreed on the weight of every connector.
  ctx.lineWidth = LINKED_READ_LINE_WIDTH_PX
  const css = lineCss(state.colors)
  for (let i = 0; i < region.numLinkedReadLines; i++) {
    const y1 = pileupRowY(region.linkedReadLineYs[i * 2]!, state) + fH / 2
    const y2 = pileupRowY(region.linkedReadLineYs[i * 2 + 1]!, state) + fH / 2
    // A mate pair can straddle the viewport, so unlike the per-row passes the
    // cull has to see both endpoints leave on the same side before it can skip.
    const offCanvas =
      Math.max(y1, y2) < -1 || Math.min(y1, y2) > state.canvasHeight + 1
    if (!offCanvas) {
      const startBp = region.linkedReadLinePositions[i * 2]!
      const endBp = region.linkedReadLinePositions[i * 2 + 1]!
      const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      ctx.strokeStyle =
        css[linkedReadColorSlot(region.linkedReadLineColorTypes[i]!)]!
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }
  }
}
