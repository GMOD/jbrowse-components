import { bpRangeXTuple } from '../blockClipUtils.ts'
import { getDpr, makeBpMapper, spanLeft } from '../canvas2dUtils.ts'
import * as shader from '../shaders/barMark.generated.ts'
import { valueToYPxScaled } from '../shaders/pointMark.js.generated.ts'
import { slangPass } from '../slangPass.ts'
import { makeAbgrFill } from './colorFill.ts'
import {
  colorBits,
  paintColors,
  rampUniforms,
  valueScaleTypeCode,
} from './markRamp.ts'
import { blockPx } from './spanMark.ts'

import type { ColorChannel } from './markRamp.ts'
import type { MarkRamp, MarkShape, MarkValueScaleType } from './types.ts'

/**
 * The `bar` shape's channels: a rectangle from `x` to `x2` standing between
 * the baseline and `y` on the value scale.
 */
export interface BarChannels extends ColorChannel {
  x: Uint32Array
  x2: Uint32Array
  y: Float32Array
  count: number
}

export interface BarParams {
  /** `[min, max]` `y` and `origin` are read through. */
  domain: [number, number]
  /** How that domain is read; linear when absent. */
  scaleType?: MarkValueScaleType
  /** The quantitative colour scale, for a bar whose colour is a ramp. */
  ramp?: MarkRamp
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
  const st = valueScaleTypeCode(params.scaleType)
  const valueY = valueToYPxScaled(y, domainMin, domainMax, canvasHeight, st)
  const originY = valueToYPxScaled(
    params.origin,
    domainMin,
    domainMax,
    canvasHeight,
    st,
  )
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
    pack: c => shader.packInstances({ ...c, color: colorBits(c) }, c.count),
  },

  writeUniforms(scratch, clip, block, frame, params) {
    shader.writeUniforms(scratch, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: frame.canvasHeight,
      domainMin: params.domain[0],
      domainMax: params.domain[1],
      valueScaleType: valueScaleTypeCode(params.scaleType),
      ...rampUniforms(params.ramp),
      origin: params.origin,
      zero: 0,
      minCellDenomPx: clip.scissorW,
      minWidthPx: params.minWidthPx,
      devicePixelRatio: getDpr(),
    })
  },

  paintBlock(ctx, channels, block, frame, params) {
    const { x, x2, y, count } = channels
    const color = paintColors(channels, count, params.ramp)
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

  ink(channels, block, frame, params, i) {
    const { x, x2, y } = channels
    return barRect(
      bp => blockPx(block, bp),
      x[i]!,
      x2[i]!,
      y[i]!,
      params,
      frame.canvasHeight,
    )
  },
}
