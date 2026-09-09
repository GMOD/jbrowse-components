// #exampleFile shared | the `score` shape: score.slang's pass, its uniform write, its painter (also the SVG export) and its hit test
import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import { makeBpMapper, spanLeft } from '@jbrowse/render-core/canvas2dUtils'
import { abgrToCssRgba } from '@jbrowse/render-core/marks/colorFill'
import { inkOnRect, nearestInk } from '@jbrowse/render-core/marks/hit'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as shader from './shaders/score.generated.ts'
import { scoreBarHeightPx } from './shaders/score.js.generated.ts'

import type { MarkShape } from '@jbrowse/render-core/marks'

// The shape's lanes: parallel typed arrays plus a count
export interface ScoreChannels {
  startBp: Uint32Array
  endBp: Uint32Array
  score: Float32Array
  count: number
}

// Everything else the drawing needs, reaching the GPU as uniforms and the
// painter as arguments
export interface ScoreParams {
  // packed ABGR (`cssColorToABGR`), the form the shader's uniform takes; the
  // painter unpacks it
  color: number
}

// One box per instance: startBp..endBp wide, grown up from the canvas bottom to
// score x canvasHeight. The shader owns the geometry; the painter and the hit
// test read its generated twin (`scoreBarHeightPx`) and constant
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
      color: params.color,
    })
  },

  paintBlock(ctx, channels, block, frame, params) {
    const { startBp, endBp, score, count } = channels
    const { canvasHeight } = frame
    const toX = makeBpMapper(block)
    ctx.fillStyle = abgrToCssRgba(params.color)
    for (let i = 0; i < count; i++) {
      const xa = toX(startBp[i]!)
      const xb = toX(endBp[i]!)
      const width = Math.max(shader.MIN_WIDTH_PX, Math.abs(xb - xa))
      const h = scoreBarHeightPx(score[i]!, canvasHeight)
      ctx.fillRect(spanLeft(xa, xb, width), canvasHeight - h, width, h)
    }
  },

  // The rect `paintBlock` fills is the hit target, so a hit's `x`/`y` is a
  // point on the box and `distSq` is 0 inside it
  hitNearest(channels, block, frame, _params, xPx, yPx, candidates, maxDistSq) {
    const { startBp, endBp, score } = channels
    const { canvasHeight } = frame
    const toX = makeBpMapper(block)
    return nearestInk(candidates, maxDistSq, i => {
      const xa = toX(startBp[i]!)
      const xb = toX(endBp[i]!)
      const width = Math.max(shader.MIN_WIDTH_PX, Math.abs(xb - xa))
      const h = scoreBarHeightPx(score[i]!, canvasHeight)
      return inkOnRect(
        xPx,
        yPx,
        spanLeft(xa, xb, width),
        canvasHeight - h,
        width,
        h,
      )
    })
  },
}
