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
import type { MarkColorScale, MarkShape } from './types.ts'
import type { MarkValueScale } from './valueScale.ts'

/**
 * The `bar` shape's channels: a rectangle from `x` to `x2` standing between
 * the baseline and `y` on the value scale, in the band of its `row`; with a
 * `y2` lane, between `y2` and `y`, a stack's or a range's bar.
 */
export interface BarChannels extends ColorChannel, RowChannel {
  x: Uint32Array
  x2: Uint32Array
  y: Float32Array
  y2?: Float32Array
  count: number
}

export interface BarParams extends RowParams, MarkValueScale {
  /** The quantitative colour scale, for a bar whose colour is a ramp or a threshold. */
  colorScale?: MarkColorScale
  /** The value bars grow from; a bar below it hangs down. */
  origin: number
  /** Whether the bars stand on their `y2` lane rather than on `origin`. */
  standsOnY2?: boolean
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

// The `y2` lane packed for a caller standing every bar on the origin: zeros
// the shader never reads, as `rowLane` fills for a rowless caller.
function y2Lane(y2: Float32Array | undefined, count: number) {
  return y2 ?? new Float32Array(count)
}

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
// with no height — which draws nothing and so cannot be hovered. `base` is
// the instance's own `y2`, or the origin where it stands on none.
function barRect(
  bpToPx: (bp: number) => number,
  x: number,
  x2: number,
  y: number,
  base: number | undefined,
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
  const originY =
    bandTop +
    (base === undefined
      ? originYPx(params, band, yScale)
      : valueToYPxScaled(base, domainMin, domainMax, band, st, c))
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
        {
          ...c,
          color: colorBits(c, c.count),
          row: rowLane(c.row, c.count),
          y2: y2Lane(c.y2, c.count),
        },
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
      ...rampUniforms(params.colorScale),
      originYPx: originYPx(params, band, yScale),
      y2Mode: params.standsOnY2 ? 1 : 0,
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
    const { x, x2, y, y2, row, count } = channels
    const color = paintColors(channels, count, params.colorScale)
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
      const r = barRect(
        bpToPx,
        x[i]!,
        x2[i]!,
        y[i]!,
        y2?.[i],
        top,
        band,
        params,
        yScale,
      )
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
    const { x, x2, y, y2, row } = channels
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
      barRect(
        bpToPx,
        x[i]!,
        x2[i]!,
        y[i]!,
        y2?.[i],
        top,
        band,
        params,
        yScale,
      ) ?? stripRect(bpToPx, x[i]!, x2[i]!, y[i]!, top, band, params, yScale)
    )
  },

  valueWindow(yPx, radiusPx, frame, params) {
    return params.rowBandPx === undefined
      ? valueWindow(yPx, radiusPx, frame, { ...params, edgePx: CLIP_STRIP_PX })
      : [-Infinity, Infinity]
  },
}
