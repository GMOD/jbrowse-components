import { bpRangeXTuple } from '../blockClipUtils.ts'
import { CappedPath, getDpr, makeBpMapper } from '../canvas2dUtils.ts'
import * as shader from '../shaders/pointMark.generated.ts'
import { pointRowYPx, pointYPx } from '../shaders/pointMark.js.generated.ts'
import { rowBandTopPx } from '../shaders/rowTable.js.generated.ts'
import { slangPass } from '../slangPass.ts'
import { abgrToCssRgba } from './colorFill.ts'
import { appendGlyph, glyphBox } from './glyphPaint.ts'
import { inkAtPoint, nearestInk } from './markHit.ts'
import {
  colorBits,
  instanceColor,
  paintColors,
  rampUniforms,
} from './markRamp.ts'
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

import type { BlockClipResult } from '../blockClipUtils.ts'
import type { RenderBlock } from '../renderBlock.ts'
import type { ColorChannel } from './markRamp.ts'
import type { RowChannel, RowParams } from './rowLane.ts'
import type { MarkFrame, MarkColorScale, MarkShape } from './types.ts'
import type { MarkValueScale } from './valueScale.ts'

/**
 * The `point` shape's channels: a glyph per instance at the centre of
 * `x`..`x2`, on the `y` scale.
 */
export interface PointChannels extends ColorChannel, RowChannel {
  x: Uint32Array
  x2: Uint32Array
  y: Float32Array
  glyph: Uint8Array
  count: number
}

/** The channels cut down to instance `i`, for its own painter to trace alone. */
export function pointInstance(c: PointChannels, i: number): PointChannels {
  return {
    x: c.x.subarray(i, i + 1),
    x2: c.x2.subarray(i, i + 1),
    y: c.y.subarray(i, i + 1),
    glyph: c.glyph.subarray(i, i + 1),
    row: c.row?.subarray(i, i + 1),
    color: instanceColor(c.color, i),
    count: 1,
  }
}

/** What the point and rule shapes share: a value scale, rows and a color scale. */
export interface ValuedMarkParams extends RowParams, MarkValueScale {
  /** The quantitative color scale, for a mark whose color is a ramp or a threshold. */
  colorScale?: MarkColorScale
  /**
   * How far inside the plot the value range ends, so a mark at a domain
   * endpoint draws whole — `glyphPaint`'s `pointInsetPx`, and the same number
   * the display's axis takes as its offset. Absent centres it on the edge.
   */
  insetPx?: number
}

export interface PointParams extends ValuedMarkParams {
  /** Glyph diameter in CSS px. */
  diameterPx: number
}

/**
 * The point shader's uniforms, which the rule shape draws through too:
 * `radiusPx` is half a glyph or half a rule's thickness.
 */
export function writePointUniforms(
  scratch: ArrayBuffer,
  clip: BlockClipResult,
  block: RenderBlock,
  frame: MarkFrame,
  params: ValuedMarkParams,
  shape: { radiusPx: number; rule: boolean; minWidthPx: number },
) {
  shader.writeUniforms(scratch, {
    bpRangeX: bpRangeXTuple(clip, block.reversed),
    canvasHeight: frame.canvasHeight,
    domainMin: params.domain[0],
    domainMax: params.domain[1],
    ...valueScaleUniforms(params),
    ...rampUniforms(params.colorScale),
    zero: 0,
    // viewportWidth and radiusPx stay in CSS units to match canvasHeight:
    // mixing a DPR-scaled radius with a CSS-scaled height draws vertically
    // stretched ellipses on hi-DPI.
    viewportWidth: clip.scissorW,
    radiusPx: shape.radiusPx,
    rowHeight: bandHeightPx(params, frame.canvasHeight),
    rowOffsetPx: params.rowOffsetPx ?? 0,
    reverse: params.reverse ? 1 : 0,
    insetPx: params.insetPx ?? 0,
    devicePixelRatio: getDpr(),
    rowTableKeys: rowTableKeys(params),
    rule: shape.rule ? 1 : 0,
    minWidthPx: shape.minWidthPx,
  })
}

export const pointMark: MarkShape<PointChannels, PointParams> = {
  id: 'point',
  pass: {
    ...slangPass({ id: 'point', mod: shader }),
    pack: c =>
      shader.packInstances(
        { ...c, color: colorBits(c, c.count), row: rowLane(c.row, c.count) },
        c.count,
      ),
  },

  writeUniforms(scratch, clip, block, frame, params) {
    writePointUniforms(scratch, clip, block, frame, params, {
      radiusPx: params.diameterPx / 2,
      rule: false,
      minWidthPx: 0,
    })
  },

  textures: rowTableTextures,

  paintBlock(ctx, channels, block, frame, params) {
    const { x, x2, y, glyph, row, count } = channels
    if (count === 0) {
      return
    }
    const color = paintColors(channels, count, params.colorScale)
    const {
      diameterPx,
      domain,
      insetPx = 0,
      rowOffsetPx: top = 0,
      rowTable: table,
    } = params
    const reverse = params.reverse ? 1 : 0
    const band = bandHeightPx(params, frame.canvasHeight)
    const domainMin = domain[0]
    const domainMax = domain[1]
    const { valueScaleType: st, valueSymlogConstant: c } =
      valueScaleUniforms(params)
    const bpToPx = makeBpMapper(block)

    let current = color[0]!
    ctx.fillStyle = abgrToCssRgba(current)
    const path = new CappedPath(ctx, 'fill')
    for (let i = 0; i < count; i++) {
      const slot = rowSlot(row, i, table)
      if (slot === undefined) {
        continue
      }
      const abgr = rowColor(color[i]!, row, i, table)
      if (abgr !== current) {
        path.flush()
        current = abgr
        ctx.fillStyle = abgrToCssRgba(abgr)
      }
      path.add()
      const yPx = pointRowYPx(
        rowBandTopPx(top, band, slot),
        band,
        reverse,
        pointYPx(y[i]!, domainMin, domainMax, band, st, insetPx, c),
      )
      appendGlyph(
        ctx,
        glyph[i]!,
        (bpToPx(x[i]!) + bpToPx(x2[i]!)) / 2,
        yPx,
        diameterPx,
      )
    }
    path.flush()
  },

  // The box `appendGlyph` paints inside.
  ink(channels, block, frame, params, i) {
    const { x, x2, y, glyph, row } = channels
    const slot = rowSlot(row, i, params.rowTable)
    if (slot === undefined) {
      return undefined
    }
    const { diameterPx, domain, insetPx = 0 } = params
    const bpToPx = makeBpMapper(block)
    const band = bandHeightPx(params, frame.canvasHeight)
    const { valueScaleType: st, valueSymlogConstant: c } =
      valueScaleUniforms(params)
    const cy = pointRowYPx(
      rowBandTopPx(params.rowOffsetPx ?? 0, band, slot),
      band,
      params.reverse ? 1 : 0,
      pointYPx(y[i]!, domain[0], domain[1], band, st, insetPx, c),
    )
    return glyphBox(
      glyph[i]!,
      (bpToPx(x[i]!) + bpToPx(x2[i]!)) / 2,
      cy,
      diameterPx,
    )
  },

  // Its own rather than the one `ink` implies: a dense plot stacks glyphs
  // whose boxes all contain the cursor at distance 0, and the one under the
  // cursor is the nearest CENTRE, which no box can say.
  hitNearest(channels, block, frame, params, xPx, yPx, candidates, maxDistSq) {
    const { x, x2, y, row } = channels
    const bpToPx = makeBpMapper(block)
    const {
      domain,
      insetPx = 0,
      rowOffsetPx: top = 0,
      rowTable: table,
    } = params
    const reverse = params.reverse ? 1 : 0
    const domainMin = domain[0]
    const domainMax = domain[1]
    const band = bandHeightPx(params, frame.canvasHeight)
    const { valueScaleType: st, valueSymlogConstant: c } =
      valueScaleUniforms(params)
    return nearestInk(candidates, maxDistSq, i => {
      const slot = rowSlot(row, i, table)
      if (slot === undefined) {
        return undefined
      }
      const cy = pointRowYPx(
        rowBandTopPx(top, band, slot),
        band,
        reverse,
        pointYPx(y[i]!, domainMin, domainMax, band, st, insetPx, c),
      )
      return inkAtPoint(xPx, yPx, (bpToPx(x[i]!) + bpToPx(x2[i]!)) / 2, cy)
    })
  },

  valueWindow,
}
