/* eslint-disable unicorn/prefer-path2d -- every path here is one instance's own coordinates, built once and stroked once */
import { defineMark } from '@jbrowse/render-core/marks'
import { slangPass } from '@jbrowse/render-core/slangPass'

import { rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { writePileupUniforms } from '../../LinearAlignmentsDisplay/renderers/pileupUniforms.ts'
import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { buildLinkedReadColorPalette } from '../../shaders/palettes.ts'
// The palette-index rule, generated from alignmentsUniforms.slang (adr-051) —
// the same import the bezier overlay makes. This pass once spelled it
// `colorType % css.length`, the wrap that file's `min` explicitly replaced.
import { linkedReadColorSlot } from '../../shaders/slang/alignmentsUniforms.js.generated.ts'
import {
  LINKED_READ_LINE_ALPHA,
  LINKED_READ_LINE_WIDTH_PX,
} from '../../shaders/slang/linkedReadLine.consts.generated.ts'
import * as linkedReadLineShader from '../../shaders/slang/linkedReadLine.generated.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { ColorPalette } from '../../shaders/colors.ts'
import type { LinkedReadLinesUploadData } from './types.ts'
import type { MarkShape } from '@jbrowse/render-core/marks'

function packLinkedReadLines(data: LinkedReadLinesUploadData) {
  const n = data.numLinkedReadLines
  const F_F32 = linkedReadLineShader.INSTANCE_OFFSET_F32
  const F_U32 = linkedReadLineShader.INSTANCE_OFFSET_U32
  const s32 = linkedReadLineShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(n * linkedReadLineShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.linkedReadLinePositions
  const ys = data.linkedReadLineYs
  const cts = data.linkedReadLineColorTypes
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F_U32.bp1] = pos[i * 2]!
    u32[o + F_U32.bp2] = pos[i * 2 + 1]!
    f32[o + F_F32.y1] = ys[i * 2]!
    f32[o + F_F32.y2] = ys[i * 2 + 1]!
    f32[o + F_F32.colorType] = cts[i]!
  }
  return buf
}

// Every stroke this pass can use is known up front — the eight CSS strings are
// built once per palette rather than per line. Not at module scope, because the
// palette is THEMED: baking it at import time is what left dark mode drawing
// connectors in the light palette's colors while the reads under them were
// dimmed. `LINKED_READ_LINE_ALPHA` is linkedReadLine.slang's, so this path
// cannot drift from the shader.
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

/**
 * A straight connector between normal-orientation mates in pileup layout. Its
 * own shape: each instance carries TWO rows (`y1`, `y2`, a diagonal between
 * mates), where the pileup shape's row scan and off-canvas cull each read one
 * — this cull has to see both endpoints leave on the same side before it can
 * skip.
 *
 * Default triangle-list topology — the connector is an antialiased 6-vertex
 * quad, not a native line. A line list is 1 px on both GPU backends whatever
 * width you ask for, which is not the 1.5 px this painter strokes; see the
 * header of linkedReadLine.slang.
 */
const linkedReadLineShape: MarkShape<LinkedReadLinesUploadData, RenderState> = {
  id: 'linkedReadLine',
  pass: {
    ...slangPass({ id: 'linkedReadLine', mod: linkedReadLineShader }),
    pack: packLinkedReadLines,
  },
  writeUniforms: writePileupUniforms,
  paintBlock(ctx, region, block, _frame, state) {
    const bpLength = block.end - block.start
    const fullBlockWidth = block.screenEndPx - block.screenStartPx
    const fH = state.featureHeight
    // From linkedReadLine.slang, like the alpha. It was a bare 1.5 here and
    // nothing at all on the GPU, which drew a native line list at a fixed
    // 1 px — the two backends disagreed on the weight of every connector.
    ctx.lineWidth = LINKED_READ_LINE_WIDTH_PX
    const css = lineCss(state.colors)
    for (let i = 0; i < region.numLinkedReadLines; i++) {
      const y1 = pileupRowY(region.linkedReadLineYs[i * 2]!, state) + fH / 2
      const y2 = pileupRowY(region.linkedReadLineYs[i * 2 + 1]!, state) + fH / 2
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
  },
}

// Decoration between read bodies with no hit semantics of its own:
// `hitTestFeature` answers for the mates it joins.
export const LINKED_READ_LINE_MARK = defineMark({
  shape: linkedReadLineShape,
  channels: (data: LinkedReadLinesUploadData) => data,
  params: (state: RenderState) => state,
  enabled: s => s.showLinkedReadLines,
})
