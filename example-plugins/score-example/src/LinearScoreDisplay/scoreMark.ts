// #exampleFile shared | the `score` shape: score.slang's pass, its uniform write, and the placement its painter (also the SVG export) and its ink (the hit test and the highlight) both read
import { bpRangeXTuple } from '@jbrowse/render-core/blockClipUtils'
import {
  bpProjection,
  projectBp,
  spanLeft,
} from '@jbrowse/render-core/canvas2dUtils'
import { abgrToCssRgba } from '@jbrowse/render-core/marks/colorFill'
import { slangPass } from '@jbrowse/render-core/slangPass'

import * as shader from './shaders/score.generated.ts'
import { scoreBarHeightPx } from './shaders/score.js.generated.ts'

import type { BpProjection } from '@jbrowse/render-core/canvas2dUtils'
import type { MarkFrame, MarkShape } from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

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

// What one block fixes for every instance, beside the box `placeScore` writes
// for one of them
interface ScoreFrame extends BpProjection {
  canvasHeight: number
  domainMin: number
  domainMax: number
  left: number
  top: number
  width: number
  height: number
}

function scoreFrame(
  block: RenderBlock,
  frame: MarkFrame,
  params: ScoreParams,
): ScoreFrame {
  const { originPx, startBp, spanBp, signedSpanPx } = bpProjection(block)
  return {
    originPx,
    startBp,
    spanBp,
    signedSpanPx,
    canvasHeight: frame.canvasHeight,
    domainMin: params.domain[0],
    domainMax: params.domain[1],
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  }
}

// One box per instance: x..x2 wide, grown up from the canvas bottom to its
// score on the value scale. The painter and the ink both place through here,
// and the shader owns the geometry: its generated twin (`scoreBarHeightPx`)
// and constant (`MIN_WIDTH_PX`), so the three cannot drift.
function placeScore(c: ScoreChannels, g: ScoreFrame, i: number) {
  const xa = projectBp(g, c.x[i]!)
  const xb = projectBp(g, c.x2[i]!)
  const width = Math.max(shader.MIN_WIDTH_PX, Math.abs(xb - xa))
  const height = scoreBarHeightPx(
    c.y[i]!,
    g.domainMin,
    g.domainMax,
    g.canvasHeight,
  )
  g.left = spanLeft(xa, xb, width)
  g.top = g.canvasHeight - height
  g.width = width
  g.height = height
}

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
    const g = scoreFrame(block, frame, params)
    ctx.fillStyle = abgrToCssRgba(params.color)
    for (let i = 0; i < channels.count; i++) {
      placeScore(channels, g, i)
      ctx.fillRect(g.left, g.top, g.width, g.height)
    }
  },

  // The rect `paintBlock` fills. render-core derives the hit test from it —
  // distance 0 inside the box, the nearest edge outside — and the chrome's
  // highlight lights it for the hovered instance
  ink(channels, block, frame, params, i) {
    const g = scoreFrame(block, frame, params)
    placeScore(channels, g, i)
    return { left: g.left, top: g.top, width: g.width, height: g.height }
  },
}
