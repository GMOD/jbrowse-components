/* eslint-disable unicorn/prefer-path2d -- every path here is one instance's own coordinates, built once and stroked once */
import { defineMark } from '@jbrowse/render-core/marks'
import { slangPass } from '@jbrowse/render-core/slangPass'

import { rgba255 } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import { writePileupUniforms } from '../../LinearAlignmentsDisplay/renderers/pileupUniforms.ts'
import {
  bpToScreenX,
  pileupRowOffCanvas,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { CONNECTING_LINE_ALPHA } from '../../shaders/slang/connectingLine.consts.generated.ts'
import * as connectingLineShader from '../../shaders/slang/connectingLine.generated.ts'

import type { RenderState } from '../../LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type { ConnectingLinesUploadData } from './types.ts'
import type { MarkShape } from '@jbrowse/render-core/marks'

function packConnectingLines(data: ConnectingLinesUploadData) {
  const n = data.connectingLinePositions.length / 2
  const F_F32 = connectingLineShader.INSTANCE_OFFSET_F32
  const F_U32 = connectingLineShader.INSTANCE_OFFSET_U32
  const s32 = connectingLineShader.INSTANCE_STRIDE_WORDS
  const buf = new ArrayBuffer(n * connectingLineShader.INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const pos = data.connectingLinePositions
  const ys = data.connectingLineYs
  for (let i = 0; i < n; i++) {
    const o = i * s32
    u32[o + F_U32.startOff] = pos[i * 2]!
    u32[o + F_U32.endOff] = pos[i * 2 + 1]!
    f32[o + F_F32.y] = ys[i]!
  }
  return buf
}

/**
 * A chain's connector: a 1px hairline across the row from the chain's first
 * read to its last, in the theme's foreground. Its own shape rather than a
 * `pileupShape` span, and the pivot is why: the shared span walk floors a
 * sub-pixel mark to 1 CSS px about its MIDPOINT, while `chainAbsMinStarts[i]`
 * is by construction the minimum over the chain's own reads — an ANCHORED span
 * whose left edge IS a read's left edge, which the centred pivot would push half
 * a pixel left of the read that defines it. connectingLine.slang applies no
 * floor either, so this painter strokes the true span and the two stay twinned
 * without one.
 *
 * `CONNECTING_LINE_ALPHA` and the colour come off the shader's exported
 * constant and `colorConnectingLine` on both sides: a hairline joining two mates
 * carries no category, so it wants the theme's foreground, and both renderers
 * once spelled that as a literal black — the background in dark mode.
 */
const connectingLineShape: MarkShape<ConnectingLinesUploadData, RenderState> = {
  id: 'connLine',
  pass: {
    ...slangPass({ id: 'connLine', mod: connectingLineShader }),
    pack: packConnectingLines,
  },
  writeUniforms: writePileupUniforms,
  paintBlock(ctx, region, block, _frame, state) {
    const bpLength = block.end - block.start
    const fullBlockWidth = block.screenEndPx - block.screenStartPx
    const numLines = region.connectingLinePositions.length / 2
    const fH = state.featureHeight
    ctx.strokeStyle = rgba255(
      state.colors.colorConnectingLine,
      CONNECTING_LINE_ALPHA,
    )
    ctx.lineWidth = 1
    for (let i = 0; i < numLines; i++) {
      const rowY = pileupRowY(region.connectingLineYs[i]!, state)
      if (pileupRowOffCanvas(rowY, state)) {
        continue
      }
      const startBp = region.connectingLinePositions[i * 2]!
      const endBp = region.connectingLinePositions[i * 2 + 1]!
      const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
      const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
      // Snap to the same pixel row the shader picks (`floor(center - 0.5)`,
      // then a 1px-tall quad); a centered 1px stroke sits at that row's
      // half-pixel.
      const y = Math.floor(rowY + fH / 2 - 0.5) + 0.5
      ctx.beginPath()
      ctx.moveTo(x1, y)
      ctx.lineTo(x2, y)
      ctx.stroke()
    }
  },
}

// No hit test: a hover on a chain's row but on none of its reads is
// `hitTestChain`'s, which boxes the chain's whole extent — exactly where this
// line is drawn.
export const CONNECTING_LINE_MARK = defineMark({
  shape: connectingLineShape,
  channels: (data: ConnectingLinesUploadData) => data,
  params: (state: RenderState) => state,
  enabled: s => s.chainMode,
})
