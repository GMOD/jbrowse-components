// #exampleFile shared | the `score` shape: score.slang's pass, its uniform write, its painter (also the SVG export) and its ink, which is the hit test and the highlight
import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import { makeBpMapper, spanLeft } from '@jbrowse/render-core/canvas2dUtils'
import { blockPx } from '@jbrowse/render-core/marks'
import { abgrToCssRgba } from '@jbrowse/render-core/marks/colorFill'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as shader from './shaders/score.generated.ts'
import { scoreBarHeightPx } from './shaders/score.js.generated.ts'

import type { MarkShape } from '@jbrowse/render-core/marks'

// The shape's lanes, in the shape library's vocabulary (`x`, `x2`, `y`):
// parallel typed arrays plus a count. The encoder's payload carries these
// names, so the mark's channel lens is the identity.
export interface ScoreChannels {
  x: Uint32Array
  x2: Uint32Array
  y: Float32Array
  count: number
}

// Everything else the drawing needs, reaching the GPU as uniforms and the
// painter as arguments
export interface ScoreParams {
  // packed ABGR (`cssColorToABGR`), the form the shader's uniform takes; the
  // painter unpacks it
  color: number
  // the [min, max] a score is placed through
  domain: [number, number]
}

// One box per instance: x..x2 wide, grown up from the canvas bottom to its
// score on the value scale. The shader owns the geometry; the painter and the
// hit test read its generated twin (`scoreBarHeightPx`) and constant
// (`MIN_WIDTH_PX`), so the three cannot drift.
export const scoreMark: MarkShape<ScoreChannels, ScoreParams> = {
  id: 'score',
  pass: {
    ...slangPass({ id: 'score', mod: shader }),
    // the generated packInstances interleaves the parallel arrays into the
    // shader's instance layout; the instance count is the buffer's own
    pack: c => shader.packInstances(c, c.count),
  },

  writeUniforms(scratch, clip, block, frame, params) {
    shader.writeUniforms(scratch, {
      // the hp-split genomic->clip transform, negated on a reversed block
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      zero: 0,
      // CSS px, so the min-width floor is a CSS pixel on every DPR
      viewportWidth: clip.scissorW,
      canvasHeight: frame.canvasHeight,
      domainMin: params.domain[0],
      domainMax: params.domain[1],
      color: params.color,
    })
  },

  paintBlock(ctx, channels, block, frame, params) {
    const { x, x2, y, count } = channels
    const { canvasHeight } = frame
    const [domainMin, domainMax] = params.domain
    const toX = makeBpMapper(block)
    ctx.fillStyle = abgrToCssRgba(params.color)
    for (let i = 0; i < count; i++) {
      const xa = toX(x[i]!)
      const xb = toX(x2[i]!)
      const width = Math.max(shader.MIN_WIDTH_PX, Math.abs(xb - xa))
      const h = scoreBarHeightPx(y[i]!, domainMin, domainMax, canvasHeight)
      ctx.fillRect(spanLeft(xa, xb, width), canvasHeight - h, width, h)
    }
  },

  // The rect `paintBlock` fills. render-core derives the hit test from it —
  // distance 0 inside the box, the nearest edge outside — and the chrome's
  // highlight lights it for the hovered instance
  ink(channels, block, frame, params, i) {
    const { x, x2, y } = channels
    const { canvasHeight } = frame
    const [domainMin, domainMax] = params.domain
    const xa = blockPx(block, x[i]!)
    const xb = blockPx(block, x2[i]!)
    const width = Math.max(shader.MIN_WIDTH_PX, Math.abs(xb - xa))
    const height = scoreBarHeightPx(y[i]!, domainMin, domainMax, canvasHeight)
    return {
      left: spanLeft(xa, xb, width),
      top: canvasHeight - height,
      width,
      height,
    }
  },
}
