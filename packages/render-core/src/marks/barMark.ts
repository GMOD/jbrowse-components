import { bpRangeXTuple } from '../blockClipUtils.ts'
import { getDpr, makeBpMapper, spanLeft } from '../canvas2dUtils.ts'
import * as shader from '../shaders/barMark.generated.ts'
import { valueToYPx } from '../shaders/pointMark.js.generated.ts'
import { slangPass } from '../slangPass.ts'
import { makeAbgrFill } from './colorFill.ts'
import { inkOnRect, nearestInk } from './markHit.ts'

import type { MarkShape } from './types.ts'

/**
 * The `bar` shape's channels: a rectangle from `x` to `x2` standing between
 * the baseline and `y` on the value scale.
 */
export interface BarChannels {
  x: Uint32Array
  x2: Uint32Array
  y: Float32Array
  color: Uint32Array
  count: number
}

export interface BarParams {
  /** `[min, max]` of the linear scale `y` and `origin` are read through. */
  domain: [number, number]
  /** The value bars grow from; a bar below it hangs down. */
  origin: number
  /**
   * Narrowest a bar is painted, in CSS px, grown off the start edge. Zero is
   * a no-op for a caller whose bars tile.
   */
  minWidthPx: number
}

// The rect one instance paints, in the frame's CSS px, or undefined for a bar
// with no height — which draws nothing and so cannot be hovered.
function barRect(
  bpToPx: (bp: number) => number,
  x: number,
  x2: number,
  y: number,
  params: BarParams,
  canvasHeight: number,
) {
  const xa = bpToPx(x)
  const xb = bpToPx(x2)
  const width = Math.max(params.minWidthPx, Math.abs(xb - xa))
  const [domainMin, domainMax] = params.domain
  const valueY = valueToYPx(y, domainMin, domainMax, canvasHeight)
  const originY = valueToYPx(params.origin, domainMin, domainMax, canvasHeight)
  const top = Math.min(valueY, originY)
  const height = Math.abs(valueY - originY)
  return height === 0
    ? undefined
    : { left: spanLeft(xa, xb, width), top, width, height }
}

export const barMark: MarkShape<BarChannels, BarParams> = {
  id: 'bar',
  pass: {
    ...slangPass({ id: 'bar', mod: shader }),
    pack: c => shader.packInstances(c, c.count),
  },

  writeUniforms(scratch, clip, block, frame, params) {
    shader.writeUniforms(scratch, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: frame.canvasHeight,
      domainMin: params.domain[0],
      domainMax: params.domain[1],
      origin: params.origin,
      zero: 0,
      minCellDenomPx: clip.scissorW,
      minWidthPx: params.minWidthPx,
      devicePixelRatio: getDpr(),
    })
  },

  paintBlock(ctx, channels, block, frame, params) {
    const { x, x2, y, color, count } = channels
    const bpToPx = makeBpMapper(block)
    const setFill = makeAbgrFill(ctx)
    for (let i = 0; i < count; i++) {
      const r = barRect(
        bpToPx,
        x[i]!,
        x2[i]!,
        y[i]!,
        params,
        frame.canvasHeight,
      )
      if (r) {
        setFill(color[i]!)
        ctx.fillRect(r.left, r.top, r.width, r.height)
      }
    }
  },

  hitNearest(channels, block, frame, params, xPx, yPx, candidates, maxDistSq) {
    const { x, x2, y } = channels
    const bpToPx = makeBpMapper(block)
    return nearestInk(candidates, maxDistSq, i => {
      const r = barRect(
        bpToPx,
        x[i]!,
        x2[i]!,
        y[i]!,
        params,
        frame.canvasHeight,
      )
      return r && inkOnRect(xPx, yPx, r.left, r.top, r.width, r.height)
    })
  },
}
