import { getDpr } from '../canvas2dUtils.ts'
import {
  CONNECTOR_CURVE_SEGMENTS,
  CONNECTOR_DASHED,
  CONNECTOR_MAX_HANDLE_PX,
  CONNECTOR_MAX_REACH_PX,
} from '../shaders/connectorMark.consts.generated.ts'
import * as shader from '../shaders/connectorMark.generated.ts'
import { slangPass } from '../slangPass.ts'
import { abgrToCssRgba } from './colorFill.ts'
import { newPlaced, placeConnector } from './connectorPlacement.ts'
import { viewRegionUniforms } from './linkMark.ts'
import { nearestInk } from './markHit.ts'

import type { RenderBlock } from '../renderBlock.ts'
import type { ConnectorPlacement } from './connectorPlacement.ts'
import type { LinkRegion } from './linkRegion.ts'
import type { InkRect, MarkFrame, MarkShape } from './types.ts'

/**
 * The `connector` shape's channels: a stroked cubic from `x` on the displayed
 * region whose payload holds it, at row `row`'s centre, to `x2` on the
 * displayed region `x2Region` names, at row `row2`'s. `bend` is the depth in
 * px a dipping connector reaches below its ends, or `CONNECTOR_BOW` for one
 * that bows up over its row; `width` the stroke in CSS px; `color` ABGR with
 * its alpha; `bits` the `CONNECTOR_*` flags: each end's strand, a split
 * junction's leading second end, a straight segment, a dash, an arrowhead.
 */
export interface ConnectorChannels {
  x: Uint32Array
  x2: Uint32Array
  x2Region: Uint32Array
  row: Uint32Array
  row2: Uint32Array
  bend: Float32Array
  width: Float32Array
  color: Uint32Array
  bits: Uint8Array
  count: number
}

export interface ConnectorParams {
  /** The view's displayed regions, indexed as `x2Region` and the block's own index are. */
  regions: readonly LinkRegion[]
  /** Canvas y of row 0's centre. */
  rowOffsetPx: number
  /** Canvas px between two rows' centres. */
  rowPitchPx: number
  /** How far an arrowhead's arms reach back and off the row. */
  arrowPx: number
  /** A dashed connector's `[dash, gap]` in CSS px, starting on a dash. */
  strokeDash?: readonly [number, number]
  maxHandlePx?: number
}

// The curve's point at `t`, written into `out`.
function cubicAt(
  p: ConnectorPlacement,
  t: number,
  out: { x: number; y: number },
) {
  const s = 1 - t
  const a = s * s * s
  const b = 3 * s * s * t
  const d = 3 * s * t * t
  const e = t * t * t
  out.x = a * p.x0 + b * p.x1 + d * p.x2 + e * p.x3
  out.y = a * p.y0 + b * p.y1 + d * p.y2 + e * p.y3
}

// A connector whose ends both lie further off the canvas than any curve can
// reach back onto it draws nothing there.
function offCanvas(p: ConnectorPlacement, frame: MarkFrame) {
  const reach = CONNECTOR_MAX_REACH_PX + p.strokePx
  return (
    Math.max(p.y0, p.y3) + reach < 0 ||
    Math.min(p.y0, p.y3) - reach > frame.canvasHeight
  )
}

interface PathSink {
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  bezierCurveTo(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    x: number,
    y: number,
  ): void
}

function traceCurve(ctx: PathSink, p: ConnectorPlacement) {
  ctx.moveTo(p.x0, p.y0)
  ctx.bezierCurveTo(p.x1, p.y1, p.x2, p.y2, p.x3, p.y3)
}

function traceArrow(ctx: PathSink, p: ConnectorPlacement, arrowPx: number) {
  ctx.moveTo(p.x3 + p.back, p.y3 - arrowPx)
  ctx.lineTo(p.x3, p.y3)
  ctx.moveTo(p.x3 + p.back, p.y3 + arrowPx)
  ctx.lineTo(p.x3, p.y3)
}

const svgNumber = (n: number) => Math.round(n * 100) / 100

function svgPathOf(p: ConnectorPlacement, arrowPx: number) {
  const parts: string[] = []
  const pt = (x: number, y: number) => `${svgNumber(x)} ${svgNumber(y)}`
  const sink: PathSink = {
    moveTo: (x, y) => parts.push(`M${pt(x, y)}`),
    lineTo: (x, y) => parts.push(`L${pt(x, y)}`),
    bezierCurveTo: (x1, y1, x2, y2, x, y) =>
      parts.push(`C${pt(x1, y1)} ${pt(x2, y2)} ${pt(x, y)}`),
  }
  traceCurve(sink, p)
  if (p.arrow) {
    traceArrow(sink, p, arrowPx)
  }
  return parts.join('')
}

const POINT = { x: 0, y: 0 }

// The box the stroke lies in: the hull of the curve's chords, its arrow, and
// half the stroke.
function inkBox(p: ConnectorPlacement, arrowPx: number): InkRect {
  let left = Math.min(p.x0, p.x3)
  let right = Math.max(p.x0, p.x3)
  let top = Math.min(p.y0, p.y3)
  let bottom = Math.max(p.y0, p.y3)
  for (let k = 1; k < CONNECTOR_CURVE_SEGMENTS; k++) {
    cubicAt(p, k / CONNECTOR_CURVE_SEGMENTS, POINT)
    left = Math.min(left, POINT.x)
    right = Math.max(right, POINT.x)
    top = Math.min(top, POINT.y)
    bottom = Math.max(bottom, POINT.y)
  }
  if (p.arrow) {
    left = Math.min(left, p.x3 + p.back)
    right = Math.max(right, p.x3 + p.back)
    top = Math.min(top, p.y3 - arrowPx)
    bottom = Math.max(bottom, p.y3 + arrowPx)
  }
  const half = p.strokePx / 2
  return {
    left: left - half,
    top: top - half,
    width: right - left + p.strokePx,
    height: bottom - top + p.strokePx,
  }
}

// The nearest point to (px, py) on segment (ax, ay)-(bx, by), into `best`
// where it is nearer than what `best` holds.
function nearSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
  best: { x: number; y: number; distSq: number },
) {
  const dx = bx - ax
  const dy = by - ay
  const lenSq = dx * dx + dy * dy
  const t =
    lenSq > 0
      ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lenSq))
      : 0
  const x = ax + t * dx
  const y = ay + t * dy
  const distSq = (px - x) ** 2 + (py - y) ** 2
  if (distSq < best.distSq) {
    best.x = x
    best.y = y
    best.distSq = distSq
  }
}

// The nearest point of the drawn ink's centreline, over the chords the GPU
// strip is built from.
function nearestOnConnector(
  p: ConnectorPlacement,
  arrowPx: number,
  px: number,
  py: number,
) {
  const best = { x: p.x0, y: p.y0, distSq: Infinity }
  let ax = p.x0
  let ay = p.y0
  for (let k = 1; k <= CONNECTOR_CURVE_SEGMENTS; k++) {
    cubicAt(p, k / CONNECTOR_CURVE_SEGMENTS, POINT)
    nearSegment(ax, ay, POINT.x, POINT.y, px, py, best)
    ax = POINT.x
    ay = POINT.y
  }
  if (p.arrow) {
    for (const sign of [-1, 1]) {
      nearSegment(
        p.x3 + p.back,
        p.y3 + sign * arrowPx,
        p.x3,
        p.y3,
        px,
        py,
        best,
      )
    }
  }
  return best
}

/**
 * A connector's two ends in canvas px, for a gesture that acts on the nearer
 * one; undefined where the instance places nowhere.
 */
export function connectorEnds(
  c: ConnectorChannels,
  block: RenderBlock,
  params: ConnectorParams,
  i: number,
) {
  const p = newPlaced()
  return placeConnector(c, params, block.displayedRegionIndex, i, p, getDpr())
    ? { x: p.x0, y: p.y0, x2: p.x3, y2: p.y3 }
    : undefined
}

const PLACED = newPlaced()

export const connectorMark: MarkShape<ConnectorChannels, ConnectorParams> = {
  id: 'connector',
  spansView: true,
  pass: {
    ...slangPass({ id: 'connector', mod: shader }),
    pack: c =>
      shader.packInstances(
        {
          x: c.x,
          x2: c.x2,
          x2Region: c.x2Region,
          row: c.row,
          row2: c.row2,
          bend: c.bend,
          width: c.width,
          color: c.color,
          bits: c.bits,
        },
        c.count,
      ),
  },

  writeUniforms(scratch, _clip, block, frame, params) {
    shader.writeUniforms(scratch, {
      canvasHeight: frame.canvasHeight,
      canvasWidth: frame.canvasWidth,
      devicePixelRatio: getDpr(),
      rowOffsetPx: params.rowOffsetPx,
      rowPitchPx: params.rowPitchPx,
      maxHandlePx: params.maxHandlePx ?? CONNECTOR_MAX_HANDLE_PX,
      dashPx: params.strokeDash?.[0] ?? 0,
      gapPx: params.strokeDash?.[1] ?? 0,
      arrowPx: params.arrowPx,
      zero: 0,
      ...viewRegionUniforms(params.regions, block.displayedRegionIndex),
    })
  },

  paintsBlock(block, _frame, params) {
    return params.regions[block.displayedRegionIndex] !== undefined
  },

  paintBlock(ctx, c, block, frame, params) {
    const own = block.displayedRegionIndex
    const dpr = getDpr()
    const dash = params.strokeDash ? [...params.strokeDash] : []
    ctx.lineCap = 'butt'
    for (let i = 0; i < c.count; i++) {
      if (
        !placeConnector(c, params, own, i, PLACED, dpr) ||
        offCanvas(PLACED, frame)
      ) {
        continue
      }
      ctx.lineWidth = PLACED.strokePx
      ctx.strokeStyle = abgrToCssRgba(c.color[i]!)
      ctx.setLineDash((c.bits[i]! & CONNECTOR_DASHED) !== 0 ? dash : [])
      ctx.beginPath()
      traceCurve(ctx, PLACED)
      ctx.stroke()
      if (PLACED.arrow) {
        ctx.setLineDash([])
        ctx.beginPath()
        traceArrow(ctx, PLACED, params.arrowPx)
        ctx.stroke()
      }
    }
    ctx.setLineDash([])
  },

  ink(c, block, _frame, params, i) {
    const p = newPlaced()
    if (
      !placeConnector(c, params, block.displayedRegionIndex, i, p, getDpr())
    ) {
      return undefined
    }
    return {
      ...inkBox(p, params.arrowPx),
      stroke: {
        d: svgPathOf(p, params.arrowPx),
        widthPx: p.strokePx,
        originX: 0,
        originY: 0,
      },
    }
  },

  hitNearest(c, block, _frame, params, xPx, yPx, candidates, maxDistSq) {
    const own = block.displayedRegionIndex
    const dpr = getDpr()
    const reach = Math.sqrt(maxDistSq)
    return nearestInk(candidates, maxDistSq, i => {
      if (!placeConnector(c, params, own, i, PLACED, dpr)) {
        return undefined
      }
      const box = inkBox(PLACED, params.arrowPx)
      if (
        xPx < box.left - reach ||
        xPx > box.left + box.width + reach ||
        yPx < box.top - reach ||
        yPx > box.top + box.height + reach
      ) {
        return undefined
      }
      const near = nearestOnConnector(PLACED, params.arrowPx, xPx, yPx)
      const dist = Math.sqrt(near.distSq)
      const half = PLACED.strokePx / 2
      if (dist <= half) {
        return { x: xPx, y: yPx, distSq: 0 }
      }
      const t = half / dist
      const x = near.x + (xPx - near.x) * t
      const y = near.y + (yPx - near.y) * t
      return { x, y, distSq: (xPx - x) ** 2 + (yPx - y) ** 2 }
    })
  },
}
