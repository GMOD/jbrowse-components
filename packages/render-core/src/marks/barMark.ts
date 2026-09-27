import { bpRangeXTuple } from '../blockClipUtils.ts'
import { getDpr, makeBpMapper, spanLeft } from '../canvas2dUtils.ts'
import * as shader from '../shaders/barMark.generated.ts'
import {
  CLIP_STRIP_COLOR,
  CLIP_STRIP_PX,
} from '../shaders/clipStrip.generated.ts'
import { clipSide } from '../shaders/clipStrip.js.generated.ts'
import { valueToYPxScaled } from '../shaders/pointMark.js.generated.ts'
import { rowBandTopPx } from '../shaders/rowTable.js.generated.ts'
import { slangPass } from '../slangPass.ts'
import { makeAbgrFill } from './colorFill.ts'
import { colorBits, paintColors, rampUniforms } from './markRamp.ts'
import { valueWindow } from './nearestMarkHit.ts'
import {
  bandHeightPx,
  rowColor,
  rowLane,
  rowSlot,
  rowTableKeys,
  rowTableTextures,
} from './rowLane.ts'
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
}

// Where a slot's value scale sits: its top and height, in the frame's CSS px.
function barBand(params: BarParams, canvasHeight: number, slot: number) {
  const pitch = bandHeightPx(params, canvasHeight)
  return {
    top: rowBandTopPx(params.rowOffsetPx ?? 0, pitch, slot),
    band: params.rowBandPx ?? pitch,
  }
}

type YScale = ReturnType<typeof valueScaleUniforms>

// Where the baseline sits inside a band, in CSS px below its top.
function originYPx(
  params: BarParams,
  band: number,
  { valueScaleType: st, valueSymlogConstant: c }: YScale,
) {
  const [domainMin, domainMax] = params.domain
  return valueToYPxScaled(params.origin, domainMin, domainMax, band, st, c)
}

// The x span one instance paints, floored at `minWidthPx` off its start edge.
function barSpan(
  bpToPx: (bp: number) => number,
  x: number,
  x2: number,
  params: BarParams,
) {
  const xa = bpToPx(x)
  const xb = bpToPx(x2)
  const width = Math.max(params.minWidthPx, Math.abs(xb - xa))
  return { left: spanLeft(xa, xb, width), width }
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
  const { left, width } = barSpan(bpToPx, x, x2, params)
  const [domainMin, domainMax] = params.domain
  const valueY =
    bandTop + valueToYPxScaled(y, domainMin, domainMax, band, st, c)
  const originY = bandTop + originYPx(params, band, yScale)
  const top = Math.min(valueY, originY)
  const height = Math.abs(valueY - originY)
  return height === 0 ? undefined : { left, top, width, height }
}

// The clip strip's rect, or undefined for a bar the domain holds (ADR-183).
function stripRect(
  bpToPx: (bp: number) => number,
  x: number,
  x2: number,
  y: number,
  bandTop: number,
  band: number,
  params: BarParams,
  yScale: YScale,
) {
  const [domainMin, domainMax] = params.domain
  const side = clipSide(y, domainMin, domainMax, yScale.valueScaleType)
  if (side === 0) {
    return undefined
  }
  const { left, width } = barSpan(bpToPx, x, x2, params)
  return {
    left,
    top: side > 0 ? bandTop : bandTop + band - CLIP_STRIP_PX,
    width,
    height: CLIP_STRIP_PX,
  }
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
      rowTableKeys: rowTableKeys(params),
    })
  },

  textures: rowTableTextures,

  paintBlock(ctx, channels, block, frame, params) {
    const { x, x2, y, row, count } = channels
    const color = paintColors(channels, count, params.ramp)
    const bpToPx = makeBpMapper(block)
    const setFill = makeAbgrFill(ctx)
    const yScale = valueScaleUniforms(params)
    const table = params.rowTable
    const [domainMin, domainMax] = params.domain
    let clipped = false
    for (let i = 0; i < count; i++) {
      const slot = rowSlot(row, i, table)
      if (slot === undefined) {
        continue
      }
      const { top, band } = barBand(params, frame.canvasHeight, slot)
      const r = barRect(bpToPx, x[i]!, x2[i]!, y[i]!, top, band, params, yScale)
      if (r) {
        setFill(rowColor(color[i]!, row, i, table))
        ctx.fillRect(r.left, r.top, r.width + params.seamPx, r.height)
      }
      clipped ||=
        clipSide(y[i]!, domainMin, domainMax, yScale.valueScaleType) !== 0
    }
    if (!clipped) {
      return
    }
    // The strips go on after every bar, as the shader's second quad does, so
    // a neighbour widened to the min-width floor cannot paint over one.
    setFill(CLIP_STRIP_COLOR)
    for (let i = 0; i < count; i++) {
      const slot = rowSlot(row, i, table)
      if (slot === undefined) {
        continue
      }
      const { top, band } = barBand(params, frame.canvasHeight, slot)
      const s = stripRect(
        bpToPx,
        x[i]!,
        x2[i]!,
        y[i]!,
        top,
        band,
        params,
        yScale,
      )
      if (s) {
        ctx.fillRect(s.left, s.top, s.width + params.seamPx, s.height)
      }
    }
  },

  ink(channels, block, frame, params, i) {
    const { x, x2, y, row } = channels
    const slot = rowSlot(row, i, params.rowTable)
    if (slot === undefined) {
      return undefined
    }
    // A bar cut to no height, its origin on the edge that cut it, paints only
    // its strip, which is then what answers a hover.
    const { top, band } = barBand(params, frame.canvasHeight, slot)
    const bpToPx = makeBpMapper(block)
    const yScale = valueScaleUniforms(params)
    return (
      barRect(bpToPx, x[i]!, x2[i]!, y[i]!, top, band, params, yScale) ??
      stripRect(bpToPx, x[i]!, x2[i]!, y[i]!, top, band, params, yScale)
    )
  },

  valueWindow(yPx, radiusPx, frame, params) {
    return params.rowOffsetPx === undefined && params.rowBandPx === undefined
      ? valueWindow(yPx, radiusPx, frame, params)
      : [-Infinity, Infinity]
  },
}
