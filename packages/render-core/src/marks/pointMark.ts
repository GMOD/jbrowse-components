import { bpRangeXTuple } from '../blockClipUtils.ts'
import { CappedPath, getDpr, makeBpMapper } from '../canvas2dUtils.ts'
import * as shader from '../shaders/pointMark.generated.ts'
import {
  pointDrawsBar,
  pointRowYPx,
  pointYPx,
} from '../shaders/pointMark.js.generated.ts'
import { slangPass } from '../slangPass.ts'
import { abgrToCssRgba } from './colorFill.ts'
import { appendGlyph, glyphBox } from './glyphPaint.ts'
import { inkAtPoint, inkOnRect, nearestInk } from './markHit.ts'
import { colorBits, paintColors, rampUniforms } from './markRamp.ts'
import { valueWindow } from './nearestMarkHit.ts'
import { bandHeightPx, bandTopPx, rowLane } from './rowLane.ts'
import { valueScaleUniforms } from './valueScale.ts'

import type { ColorChannel } from './markRamp.ts'
import type { RowChannel, RowParams } from './rowLane.ts'
import type { MarkRamp, MarkShape } from './types.ts'
import type { MarkValueScale } from './valueScale.ts'

/**
 * The `point` shape's channels: a glyph per instance at `x`, on the `y` scale,
 * widening to a bar where `x2 - x` is wider than the glyph.
 *
 * `x2` is a channel rather than an option because the widening is per instance:
 * one array holds SNPs (`x2 === x + 1`) and structural variants together, and
 * the shader, the painter and the hit test all take the same branch off it.
 */
export interface PointChannels extends ColorChannel, RowChannel {
  x: Uint32Array
  x2: Uint32Array
  y: Float32Array
  glyph: Uint8Array
  count: number
}

export interface PointParams extends RowParams, MarkValueScale {
  /** The quantitative colour scale, for a point whose colour is a ramp. */
  ramp?: MarkRamp
  /** Glyph diameter in CSS px. */
  diameterPx: number
  /**
   * How far inside the plot the value range ends, so a point at a domain
   * endpoint draws whole — `glyphPaint`'s `pointInsetPx`, and the same number
   * the display's axis takes as its offset. Absent centres it on the edge.
   */
  insetPx?: number
}

export const pointMark: MarkShape<PointChannels, PointParams> = {
  id: 'point',
  pass: {
    ...slangPass({ id: 'point', mod: shader }),
    pack: c =>
      shader.packInstances(
        { ...c, color: colorBits(c), row: rowLane(c.row, c.count) },
        c.count,
      ),
  },

  writeUniforms(scratch, clip, block, frame, params) {
    shader.writeUniforms(scratch, {
      bpRangeX: bpRangeXTuple(clip, block.reversed),
      canvasHeight: frame.canvasHeight,
      domainMin: params.domain[0],
      domainMax: params.domain[1],
      ...valueScaleUniforms(params),
      ...rampUniforms(params.ramp),
      zero: 0,
      // viewportWidth and radiusPx stay in CSS units to match canvasHeight:
      // mixing a DPR-scaled radius with a CSS-scaled height draws vertically
      // stretched ellipses on hi-DPI.
      viewportWidth: clip.scissorW,
      radiusPx: params.diameterPx / 2,
      rowHeight: bandHeightPx(params, frame.canvasHeight),
      rowOffsetPx: params.rowOffsetPx ?? 0,
      reverse: params.reverse ? 1 : 0,
      insetPx: params.insetPx ?? 0,
      devicePixelRatio: getDpr(),
    })
  },

  paintBlock(ctx, channels, block, frame, params) {
    const { x, x2, y, glyph, row, count } = channels
    if (count === 0) {
      return
    }
    const color = paintColors(channels, count, params.ramp)
    const { diameterPx, domain, insetPx = 0, rowOffsetPx: top = 0 } = params
    const reverse = params.reverse ? 1 : 0
    const r = diameterPx / 2
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
      const abgr = color[i]!
      if (abgr !== current) {
        path.flush()
        current = abgr
        ctx.fillStyle = abgrToCssRgba(abgr)
      }
      path.add()
      const xStart = bpToPx(x[i]!)
      const xEnd = bpToPx(x2[i]!)
      const yPx = pointRowYPx(
        top + bandTopPx(row, i, band),
        band,
        reverse,
        pointYPx(y[i]!, domainMin, domainMax, band, st, insetPx, c),
      )
      const widthPx = Math.abs(xEnd - xStart)
      if (pointDrawsBar(widthPx, r)) {
        ctx.rect(Math.min(xStart, xEnd), yPx - r, widthPx, diameterPx)
      } else {
        appendGlyph(ctx, glyph[i]!, xStart, yPx, diameterPx)
      }
    }
    path.flush()
  },

  // A bar is the rect the painter fills, unpadded on every side; a glyph is
  // the box `appendGlyph` paints inside.
  ink(channels, block, frame, params, i) {
    const { x, x2, y, glyph, row } = channels
    const { diameterPx, domain, insetPx = 0 } = params
    const bpToPx = makeBpMapper(block)
    const xStart = bpToPx(x[i]!)
    const xEnd = bpToPx(x2[i]!)
    const r = diameterPx / 2
    const band = bandHeightPx(params, frame.canvasHeight)
    const { valueScaleType: st, valueSymlogConstant: c } =
      valueScaleUniforms(params)
    const cy = pointRowYPx(
      (params.rowOffsetPx ?? 0) + bandTopPx(row, i, band),
      band,
      params.reverse ? 1 : 0,
      pointYPx(y[i]!, domain[0], domain[1], band, st, insetPx, c),
    )
    const lo = Math.min(xStart, xEnd)
    const hi = Math.max(xStart, xEnd)
    return pointDrawsBar(hi - lo, r)
      ? { left: lo, top: cy - r, width: hi - lo, height: diameterPx }
      : glyphBox(glyph[i]!, xStart, cy, diameterPx)
  },

  // Its own rather than the one `ink` implies, for the glyph: a dense plot
  // stacks glyphs whose boxes all contain the cursor at distance 0, and the
  // one under the cursor is the nearest CENTRE, which no box can say. A bar
  // is grabbed anywhere inside the rect it fills, as the derived test would.
  hitNearest(channels, block, frame, params, xPx, yPx, candidates, maxDistSq) {
    const { x, x2, y, row } = channels
    const bpToPx = makeBpMapper(block)
    const { diameterPx, domain, insetPx = 0, rowOffsetPx: top = 0 } = params
    const reverse = params.reverse ? 1 : 0
    const domainMin = domain[0]
    const domainMax = domain[1]
    const band = bandHeightPx(params, frame.canvasHeight)
    const { valueScaleType: st, valueSymlogConstant: c } =
      valueScaleUniforms(params)
    return nearestInk(candidates, maxDistSq, i => {
      const xStart = bpToPx(x[i]!)
      const xEnd = bpToPx(x2[i]!)
      const cy = pointRowYPx(
        top + bandTopPx(row, i, band),
        band,
        reverse,
        pointYPx(y[i]!, domainMin, domainMax, band, st, insetPx, c),
      )
      const lo = Math.min(xStart, xEnd)
      const hi = Math.max(xStart, xEnd)
      return pointDrawsBar(hi - lo, diameterPx / 2)
        ? inkOnRect(xPx, yPx, lo, cy - diameterPx / 2, hi - lo, diameterPx)
        : inkAtPoint(xPx, yPx, xStart, cy)
    })
  },

  valueWindow,
}
