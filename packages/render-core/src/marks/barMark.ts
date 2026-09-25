import { bpRangeXTuple } from '../blockClipUtils.ts'
import { getDpr, makeBpMapper, spanLeft } from '../canvas2dUtils.ts'
import * as shader from '../shaders/barMark.generated.ts'
import { valueToYPxScaled } from '../shaders/pointMark.js.generated.ts'
import { slangPass } from '../slangPass.ts'
import { makeAbgrFill } from './colorFill.ts'
import { colorBits, paintColors, rampUniforms } from './markRamp.ts'
import { valueWindow } from './nearestMarkHit.ts'
import { bandHeightPx, bandTopPx, rowLane } from './rowLane.ts'
import { valueScaleUniforms } from './valueScale.ts'

import type { ColorChannel } from './markRamp.ts'
import type { RowChannel, RowParams } from './rowLane.ts'
import type { MarkRamp, MarkShape } from './types.ts'
import type { MarkValueScale } from './valueScale.ts'

/**
 * The `bar` shape's channels: a rectangle from `x` to `x2` standing between
 * the baseline and `y` on the value scale, in the band of its `row`.
 */
export interface BarChannels extends ColorChannel, RowChannel {
  x: Uint32Array
  x2: Uint32Array
  y: Float32Array
  count: number
}

export interface BarParams extends RowParams, MarkValueScale {
  /** The quantitative colour scale, for a bar whose colour is a ramp. */
  ramp?: MarkRamp
  /** The value bars grow from; a bar below it hangs down. */
  origin: number
  /**
   * Narrowest a bar is painted, in CSS px, grown off the start edge. Zero is
   * a no-op for a caller whose bars tile.
   */
  minWidthPx: number
  /** CSS px the painter alone adds to the drawn width; see `SpanParams.seamPx`. */
  seamPx: number
  /** CSS px each row's value scale runs over; the row's own height when absent. */
  rowBandPx?: number
  /** CSS px every row's band starts below its top, less a scroll; 0 when absent. */
  rowOffsetPx?: number
}

// Where row `i`'s value scale sits: its top and height, in the frame's CSS px.
function barBand(
  params: BarParams,
  canvasHeight: number,
  row: Uint32Array | undefined,
  i: number,
) {
  const pitch = bandHeightPx(params, canvasHeight)
  return {
    top: (params.rowOffsetPx ?? 0) + bandTopPx(row, i, pitch),
    band: params.rowBandPx ?? pitch,
  }
}

type YScale = ReturnType<typeof valueScaleUniforms>

// Where the baseline sits inside a band, in CSS px below its top. Every
// instance in a draw shares it, so the shader reads it as a uniform rather
// than running the scale again per vertex.
function originYPx(
  params: BarParams,
  band: number,
  { valueScaleType: st, valueSymlogConstant: c }: YScale,
) {
  const [domainMin, domainMax] = params.domain
  return valueToYPxScaled(params.origin, domainMin, domainMax, band, st, c)
}

// The rect one instance paints, in the frame's CSS px, or undefined for a bar
// with no height — which draws nothing and so cannot be hovered.
function barRect(
  bpToPx: (bp: number) => number,
  x: number,
  x2: number,
  y: number,
  bandTop: number,
  band: number,
  params: BarParams,
  yScale: YScale,
) {
  const { valueScaleType: st, valueSymlogConstant: c } = yScale
  const xa = bpToPx(x)
  const xb = bpToPx(x2)
  const width = Math.max(params.minWidthPx, Math.abs(xb - xa))
  const [domainMin, domainMax] = params.domain
  const valueY =
    bandTop + valueToYPxScaled(y, domainMin, domainMax, band, st, c)
  const originY = bandTop + originYPx(params, band, yScale)
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
    pack: c =>
      shader.packInstances(
        { ...c, color: colorBits(c), row: rowLane(c.row, c.count) },
        c.count,
      ),
  },

  writeUniforms(scratch, clip, block, frame, params) {
    const yScale = valueScaleUniforms(params)
    const band = params.rowBandPx ?? bandHeightPx(params, frame.canvasHeight)
    shader.writeUniforms(scratch, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: frame.canvasHeight,
      domainMin: params.domain[0],
      domainMax: params.domain[1],
      ...yScale,
      ...rampUniforms(params.ramp),
      originYPx: originYPx(params, band, yScale),
      rowHeight: bandHeightPx(params, frame.canvasHeight),
      rowBandPx: band,
      rowOffsetPx: params.rowOffsetPx ?? 0,
      zero: 0,
      minCellDenomPx: clip.scissorW,
      minWidthPx: params.minWidthPx,
      devicePixelRatio: getDpr(),
    })
  },

  paintBlock(ctx, channels, block, frame, params) {
    const { x, x2, y, row, count } = channels
    const color = paintColors(channels, count, params.ramp)
    const bpToPx = makeBpMapper(block)
    const setFill = makeAbgrFill(ctx)
    const yScale = valueScaleUniforms(params)
    for (let i = 0; i < count; i++) {
      const { top, band } = barBand(params, frame.canvasHeight, row, i)
      const r = barRect(bpToPx, x[i]!, x2[i]!, y[i]!, top, band, params, yScale)
      if (r) {
        setFill(color[i]!)
        ctx.fillRect(r.left, r.top, r.width + params.seamPx, r.height)
      }
    }
  },

  ink(channels, block, frame, params, i) {
    const { x, x2, y, row } = channels
    const { top, band } = barBand(params, frame.canvasHeight, row, i)
    return barRect(
      makeBpMapper(block),
      x[i]!,
      x2[i]!,
      y[i]!,
      top,
      band,
      params,
      valueScaleUniforms(params),
    )
  },

  valueWindow(yPx, radiusPx, frame, params) {
    return params.rowOffsetPx === undefined && params.rowBandPx === undefined
      ? valueWindow(yPx, radiusPx, frame, params)
      : [-Infinity, Infinity]
  },
}
