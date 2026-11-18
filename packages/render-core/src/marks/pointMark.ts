import { bpRangeXTuple } from '../blockClipUtils.ts'
import { CappedPath, getDpr, makeBpMapper } from '../canvas2dUtils.ts'
import * as shader from '../shaders/pointMark.generated.ts'
import { pointRowYPx, pointYPx } from '../shaders/pointMark.js.generated.ts'
import { rowBandTopPx } from '../shaders/rowTable.js.generated.ts'
import { slangPass } from '../slangPass.ts'
import { abgrToCssRgba } from './colorFill.ts'
import { appendGlyph, glyphBox } from './glyphPaint.ts'
import { inkOnStroke } from './markHit.ts'
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
import type { MarkFrame, MarkColorScale, MarkHit, MarkShape } from './types.ts'
import type { MarkValueScale } from './valueScale.ts'

/**
 * The `point` shape's channels: a glyph per instance at the centre of
 * `x`..`x2`, on the `y` scale, at 0 where `y` is absent. `glyph` is one per
 * instance or one for all of them, as `color` is.
 */
export interface PointChannels extends ColorChannel, RowChannel {
  x: Uint32Array
  x2: Uint32Array
  y?: Float32Array
  glyph: Uint8Array | number
  count: number
}

const NO_VALUES = new Float32Array(0)

/** The channels cut down to instance `i`, for its own painter to trace alone. */
export function pointInstance(c: PointChannels, i: number): PointChannels {
  const { glyph } = c
  return {
    x: c.x.subarray(i, i + 1),
    x2: c.x2.subarray(i, i + 1),
    y: c.y?.subarray(i, i + 1),
    glyph: typeof glyph === 'number' ? glyph : glyph.subarray(i, i + 1),
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
  /** Whether the domain's minimum sits at the band's top rather than its bottom. */
  reverse?: boolean
}

export interface PointParams extends ValuedMarkParams {
  /** Glyph diameter in CSS px. */
  diameterPx: number
  /** The triangle's height in CSS px, where it is not `diameterPx`. */
  triangleHeightPx?: number
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
  shape: {
    radiusPx: number
    triangleRadiusYPx: number
    rule: boolean
    minWidthPx: number
  },
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
    triangleRadiusYPx: shape.triangleRadiusYPx,
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
        {
          x: c.x,
          x2: c.x2,
          y: c.y ?? (c.count === 0 ? NO_VALUES : new Float32Array(c.count)),
          glyph:
            typeof c.glyph === 'number'
              ? new Uint8Array(c.count).fill(c.glyph)
              : c.glyph,
          color: colorBits(c, c.count),
          row: rowLane(c.row, c.count),
        },
        c.count,
      ),
  },

  writeUniforms(scratch, clip, block, frame, params) {
    writePointUniforms(scratch, clip, block, frame, params, {
      radiusPx: params.diameterPx / 2,
      triangleRadiusYPx: (params.triangleHeightPx ?? params.diameterPx) / 2,
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
      triangleHeightPx = diameterPx,
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
        pointYPx(y ? y[i]! : 0, domainMin, domainMax, band, st, insetPx, c),
      )
      appendGlyph(
        ctx,
        typeof glyph === 'number' ? glyph : glyph[i]!,
        (bpToPx(x[i]!) + bpToPx(x2[i]!)) / 2,
        yPx,
        diameterPx,
        triangleHeightPx,
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
    const { diameterPx, triangleHeightPx, domain, insetPx = 0 } = params
    const bpToPx = makeBpMapper(block)
    const band = bandHeightPx(params, frame.canvasHeight)
    const { valueScaleType: st, valueSymlogConstant: c } =
      valueScaleUniforms(params)
    const cy = pointRowYPx(
      rowBandTopPx(params.rowOffsetPx ?? 0, band, slot),
      band,
      params.reverse ? 1 : 0,
      pointYPx(y ? y[i]! : 0, domain[0], domain[1], band, st, insetPx, c),
    )
    return glyphBox(
      typeof glyph === 'number' ? glyph : glyph[i]!,
      (bpToPx(x[i]!) + bpToPx(x2[i]!)) / 2,
      cy,
      diameterPx,
      triangleHeightPx,
    )
  },

  // Its own rather than the one `ink` implies: a dense plot stacks glyphs
  // whose boxes all contain the cursor at distance 0, and the one under the
  // cursor is the nearest CENTRE, which no box can say. A glyph answers as the
  // largest disc round its centre that its box holds: anywhere on that disc at
  // distance 0, the nearest centre winning among the discs under the cursor,
  // and off it by the distance to its rim, so a glyph wider than the grab
  // radius answers out to its rim and past it.
  hitNearest(channels, block, frame, params, xPx, yPx, candidates, maxDistSq) {
    const { x, x2, y, glyph, row } = channels
    const bpToPx = makeBpMapper(block)
    const {
      diameterPx,
      triangleHeightPx,
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
    let best: MarkHit | undefined
    let bestDistSq = maxDistSq
    let bestCentreSq = Infinity
    for (const i of candidates) {
      const slot = rowSlot(row, i, table)
      if (slot !== undefined) {
        const cx = (bpToPx(x[i]!) + bpToPx(x2[i]!)) / 2
        const cy = pointRowYPx(
          rowBandTopPx(top, band, slot),
          band,
          reverse,
          pointYPx(y ? y[i]! : 0, domainMin, domainMax, band, st, insetPx, c),
        )
        const box = glyphBox(
          typeof glyph === 'number' ? glyph : glyph[i]!,
          cx,
          cy,
          diameterPx,
          triangleHeightPx,
        )
        const radius = Math.max(
          0,
          Math.min(
            cx - box.left,
            box.left + box.width - cx,
            cy - box.top,
            box.top + box.height - cy,
          ),
        )
        const centreSq = (xPx - cx) ** 2 + (yPx - cy) ** 2
        const ink = inkOnStroke(
          xPx,
          yPx,
          cx,
          cy,
          Math.sqrt(centreSq),
          2 * radius,
        )
        if (
          ink.distSq < bestDistSq ||
          (ink.distSq === 0 && best !== undefined && centreSq < bestCentreSq)
        ) {
          best = { index: i, x: ink.x, y: ink.y, distSq: ink.distSq }
          bestDistSq = ink.distSq
          bestCentreSq = centreSq
        }
      }
    }
    return best
  },

  // Widened by the glyph's radius, as far as its disc reaches past its value.
  valueWindow(yPx, radiusPx, frame, params) {
    return valueWindow(yPx, radiusPx + params.diameterPx / 2, frame, params)
  },
}
