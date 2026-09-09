import { bpRangeXTuple } from '../blockClipUtils.ts'
import { getDpr, makeBpMapper } from '../canvas2dUtils.ts'
import * as shader from '../shaders/pointMark.generated.ts'
import { pointDrawsBar, valueToYPx } from '../shaders/pointMark.js.generated.ts'
import { slangPass } from '../slangPass.ts'
import { abgrToCssRgba } from './colorFill.ts'
import { appendGlyph, glyphBox } from './glyphPaint.ts'
import { blockPx } from './spanMark.ts'

import type { MarkShape } from './types.ts'

/**
 * The `point` shape's channels: a glyph per instance at `x`, on the `y` scale,
 * widening to a bar where `x2 - x` is wider than the glyph.
 *
 * `x2` is a channel rather than an option because the widening is per instance:
 * one array holds SNPs (`x2 === x + 1`) and structural variants together, and
 * the shader, the painter and the hit test all take the same branch off it.
 */
export interface PointChannels {
  x: Uint32Array
  x2: Uint32Array
  y: Float32Array
  color: Uint32Array
  glyph: Uint8Array
  count: number
}

export interface PointParams {
  /** `[min, max]` of the linear scale `y` is read through. */
  domain: [number, number]
  /** Glyph diameter in CSS px. */
  diameterPx: number
}

export const pointMark: MarkShape<PointChannels, PointParams> = {
  id: 'point',
  pass: {
    ...slangPass({ id: 'point', mod: shader }),
    pack: c => shader.packInstances(c, c.count),
  },

  writeUniforms(scratch, clip, block, frame, params) {
    shader.writeUniforms(scratch, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: frame.canvasHeight,
      domainMin: params.domain[0],
      domainMax: params.domain[1],
      zero: 0,
      // viewportWidth and radiusPx stay in CSS units to match canvasHeight:
      // mixing a DPR-scaled radius with a CSS-scaled height draws vertically
      // stretched ellipses on hi-DPI.
      viewportWidth: clip.scissorW,
      radiusPx: params.diameterPx / 2,
      devicePixelRatio: getDpr(),
    })
  },

  paintBlock(ctx, channels, block, frame, params) {
    const { x, x2, y, color, glyph, count } = channels
    if (count === 0) {
      return
    }
    const { diameterPx, domain } = params
    const r = diameterPx / 2
    const canvasHeight = frame.canvasHeight
    const domainMin = domain[0]
    const domainMax = domain[1]
    // The per-block closure, not the six-argument `bpToScreenPx`: that spelling
    // re-derives the region span and the block width at every call, and this
    // loop makes two calls per instance. Measured at 1.67x on 100K points.
    const bpToPx = makeBpMapper(block)

    // Batched by colour: a run of one colour is one fillStyle write and one
    // fill() over a shared path, which is most of a painting.
    let current = color[0]!
    ctx.fillStyle = abgrToCssRgba(current)
    ctx.beginPath()
    for (let i = 0; i < count; i++) {
      const abgr = color[i]!
      if (abgr !== current) {
        ctx.fill()
        current = abgr
        ctx.fillStyle = abgrToCssRgba(abgr)
        ctx.beginPath()
      }
      const xStart = bpToPx(x[i]!)
      const xEnd = bpToPx(x2[i]!)
      const yPx = valueToYPx(y[i]!, domainMin, domainMax, canvasHeight)
      const widthPx = Math.abs(xEnd - xStart)
      if (pointDrawsBar(widthPx, r)) {
        ctx.rect(Math.min(xStart, xEnd), yPx - r, widthPx, diameterPx)
      } else {
        appendGlyph(ctx, glyph[i]!, xStart, yPx, diameterPx)
      }
    }
    ctx.fill()
  },

  // A bar is the rect the painter fills, unpadded on every side; a glyph is
  // the box `appendGlyph` paints inside. The hit test is the derived one, so a
  // cursor inside either box is on the instance and a tie goes to the one on
  // top.
  ink(channels, block, frame, params, i) {
    const { x, x2, y, glyph } = channels
    const { diameterPx, domain } = params
    const xStart = blockPx(block, x[i]!)
    const xEnd = blockPx(block, x2[i]!)
    const cy = valueToYPx(y[i]!, domain[0], domain[1], frame.canvasHeight)
    const lo = Math.min(xStart, xEnd)
    const hi = Math.max(xStart, xEnd)
    const r = diameterPx / 2
    return pointDrawsBar(hi - lo, r)
      ? { left: lo, top: cy - r, width: hi - lo, height: diameterPx }
      : glyphBox(glyph[i]!, xStart, cy, diameterPx)
  },
}
