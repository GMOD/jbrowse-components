import { bpRangeXTuple } from '../blockClipUtils.ts'
import { getDpr, makeBpMapper } from '../canvas2dUtils.ts'
import * as centerShader from '../shaders/lineCenterMark.generated.ts'
import { GAP_Y, NO_PREV_X } from '../shaders/lineCommon.generated.ts'
import * as stepShader from '../shaders/lineStepMark.generated.ts'
import { valueToYPxScaled } from '../shaders/pointMark.js.generated.ts'
import { rowBandTopPx } from '../shaders/rowTable.js.generated.ts'
import { slangPass } from '../slangPass.ts'
import { abgrToCssRgba } from './colorFill.ts'
import { colorBits, paintColors, rampUniforms } from './markRamp.ts'
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
import type { RowTable } from './rowTable.ts'
import type {
  InkRect,
  MarkContext2D,
  MarkFrame,
  MarkRamp,
  MarkShape,
} from './types.ts'
import type { MarkValueScale } from './valueScale.ts'

/**
 * The `line` shape's channels: a stroke through consecutive instances of one
 * row, in the order given, each instance a span from `x` to `x2` at `y` on the
 * value scale. `gapBp` is the linear variant's break: a midpoint further than
 * that from the previous one on its row starts a new run. It rides with the
 * data, as the neighbour fields the packer derives from it do, so both
 * backends break in the same place; absent, a row is one run.
 */
export interface LineChannels extends ColorChannel, RowChannel {
  x: Uint32Array
  x2: Uint32Array
  y: Float32Array
  gapBp?: number
  count: number
}

export interface LineParams extends RowParams, MarkValueScale {
  /** The quantitative colour scale, for a line whose colour is a ramp. */
  ramp?: MarkRamp
  /** The value a step drops to across a gap. */
  origin: number
  /** Stroke width in CSS px. */
  lineWidth: number
  /** CSS px each row's value scale runs over; the row's own height when absent. */
  rowBandPx?: number
}

/** `step` holds each value across its span; `linear` joins the spans' midpoints. */
export type LineInterpolate = 'step' | 'linear'

const NO_GAP = Number.POSITIVE_INFINITY

function sameRow(row: ArrayLike<number>, a: number, b: number) {
  return row[a] === row[b]
}

// Whether instance `i` abuts the one before it on its row, so the step joins
// them at a shared corner.
function abutsBefore(c: LineChannels, row: ArrayLike<number>, i: number) {
  return i > 0 && sameRow(row, i - 1, i) && c.x2[i - 1] === c.x[i]
}

// Whether the linear variant links instance `i` to the one before it: the same
// row, within `gapBp` midpoint to midpoint.
function linksBefore(c: LineChannels, row: ArrayLike<number>, i: number) {
  if (i === 0 || !sameRow(row, i - 1, i)) {
    return false
  }
  const gapBp = c.gapBp ?? NO_GAP
  return (c.x[i]! + c.x2[i]!) / 2 - (c.x[i - 1]! + c.x2[i - 1]!) / 2 <= gapBp
}

function packStep(c: LineChannels) {
  const { x, x2, y, count } = c
  const row = rowLane(c.row, count)
  const prevY = new Float32Array(count)
  const nextY = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    prevY[i] = abutsBefore(c, row, i) ? y[i - 1]! : GAP_Y
    // a joined next collapses the third quad onto the corner the next
    // instance's first quad draws, so the seam is stroked once
    nextY[i] = i < count - 1 && abutsBefore(c, row, i + 1) ? y[i]! : GAP_Y
  }
  return stepShader.packInstances(
    { x, x2, y, color: colorBits(c), row, prevY, nextY },
    count,
  )
}

function packCenter(c: LineChannels) {
  const { x, x2, y, count } = c
  const row = rowLane(c.row, count)
  const prevX = new Uint32Array(count)
  const prevX2 = new Uint32Array(count)
  const prevY = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const linked = linksBefore(c, row, i)
    prevX[i] = linked ? x[i - 1]! : NO_PREV_X
    prevX2[i] = linked ? x2[i - 1]! : 0
    prevY[i] = linked ? y[i - 1]! : 0
  }
  return centerShader.packInstances(
    { x, x2, y, color: colorBits(c), row, prevX, prevX2, prevY },
    count,
  )
}

// The two modules share `lineCommon`'s uniform block, so either writer serves.
function writeLineUniforms(
  scratch: ArrayBuffer,
  clip: BlockClipResult,
  block: RenderBlock,
  frame: MarkFrame,
  params: LineParams,
) {
  const rowHeight = bandHeightPx(params, frame.canvasHeight)
  stepShader.writeUniforms(scratch, {
    bpRangeX: bpRangeXTuple(clip, block.reversed),
    canvasHeight: frame.canvasHeight,
    domainMin: params.domain[0],
    domainMax: params.domain[1],
    ...valueScaleUniforms(params),
    ...rampUniforms(params.ramp),
    rowHeight,
    rowBandPx: params.rowBandPx ?? rowHeight,
    rowOffsetPx: params.rowOffsetPx ?? 0,
    origin: params.origin,
    lineWidth: params.lineWidth,
    zero: 0,
    viewportWidth: clip.scissorW,
    devicePixelRatio: getDpr(),
    rowTableKeys: rowTableKeys(params),
  })
}

// The value scale hoisted per block, as the shader reads it per instance: the
// band each slot stands in and where a value lands inside it.
interface LineFrame {
  bpToPx: (bp: number) => number
  pitch: number
  band: number
  rowOffsetPx: number
  domainMin: number
  domainMax: number
  scaleType: number
  symlogConstant: number
  table: RowTable | undefined
}

function lineFrame(
  block: RenderBlock,
  frame: MarkFrame,
  params: LineParams,
): LineFrame {
  const pitch = bandHeightPx(params, frame.canvasHeight)
  const { valueScaleType, valueSymlogConstant } = valueScaleUniforms(params)
  return {
    bpToPx: makeBpMapper(block),
    pitch,
    band: params.rowBandPx ?? pitch,
    rowOffsetPx: params.rowOffsetPx ?? 0,
    domainMin: params.domain[0],
    domainMax: params.domain[1],
    scaleType: valueScaleType,
    symlogConstant: valueSymlogConstant,
    table: params.rowTable,
  }
}

function valueYPx(g: LineFrame, value: number, slot: number) {
  return (
    rowBandTopPx(g.rowOffsetPx, g.pitch, slot) +
    valueToYPxScaled(
      value,
      g.domainMin,
      g.domainMax,
      g.band,
      g.scaleType,
      g.symlogConstant,
    )
  )
}

// A colour change ends the stroke batch and reopens it from the pen, so a
// segment carries the colour of the instance it belongs to, as the shader's
// per-instance colour does.
function restroke(
  ctx: MarkContext2D,
  abgr: number,
  inRun: boolean,
  penX: number,
  penY: number,
) {
  ctx.stroke()
  ctx.beginPath()
  if (inRun) {
    ctx.moveTo(penX, penY)
  }
  ctx.strokeStyle = abgrToCssRgba(abgr)
}

// One polyline per run of abutting instances on a row: a rise from the origin,
// the tops, the step at each joint, and a drop to the origin at a gap. The
// frame's fields are locals inside the loop, since a returned object is
// reloaded field by field per instance (benches/placeWalkers.bench.ts).
function paintStep(
  ctx: MarkContext2D,
  c: LineChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: LineParams,
) {
  const { x, x2, y, row, count } = c
  if (count === 0) {
    return
  }
  const color = paintColors(c, count, params.ramp)
  const g = lineFrame(block, frame, params)
  const { bpToPx, table } = g
  const rows = rowLane(row, count)
  ctx.lineWidth = params.lineWidth
  let lastAbgr = -1
  let inRun = false
  let penX = 0
  let penY = 0
  ctx.beginPath()
  for (let i = 0; i < count; i++) {
    const slot = rowSlot(row, i, table)
    if (slot === undefined) {
      if (inRun) {
        ctx.stroke()
        ctx.beginPath()
        inRun = false
      }
      continue
    }
    const abgr = rowColor(color[i]!, row, i, table)
    if (abgr !== lastAbgr) {
      restroke(ctx, abgr, inRun, penX, penY)
      lastAbgr = abgr
    }
    const x1 = bpToPx(x[i]!)
    const xb = bpToPx(x2[i]!)
    const top = valueYPx(g, y[i]!, slot)
    const originY = valueYPx(g, params.origin, slot)
    if (inRun) {
      ctx.lineTo(x1, top)
    } else {
      ctx.moveTo(x1, originY)
      ctx.lineTo(x1, top)
      inRun = true
    }
    ctx.lineTo(xb, top)
    penX = xb
    penY = top
    if (!(i < count - 1 && abutsBefore(c, rows, i + 1))) {
      penY = originY
      ctx.lineTo(xb, penY)
      inRun = false
    }
  }
  ctx.stroke()
}

// One polyline per run of midpoints on a row, round-joined and round-capped so
// a break paints the dot the shader's collapsed capsule draws.
function paintCenter(
  ctx: MarkContext2D,
  c: LineChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: LineParams,
) {
  const { x, x2, y, row, count } = c
  if (count === 0) {
    return
  }
  const color = paintColors(c, count, params.ramp)
  const g = lineFrame(block, frame, params)
  const { bpToPx, table } = g
  const rows = rowLane(row, count)
  ctx.lineWidth = params.lineWidth
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  let lastAbgr = -1
  let penX = 0
  let penY = 0
  ctx.beginPath()
  for (let i = 0; i < count; i++) {
    const slot = rowSlot(row, i, table)
    if (slot === undefined) {
      continue
    }
    const cx = (bpToPx(x[i]!) + bpToPx(x2[i]!)) / 2
    const cy = valueYPx(g, y[i]!, slot)
    const linked =
      linksBefore(c, rows, i) && rowSlot(row, i - 1, table) !== undefined
    const abgr = rowColor(color[i]!, row, i, table)
    if (abgr !== lastAbgr) {
      restroke(ctx, abgr, linked, penX, penY)
      lastAbgr = abgr
    }
    if (linked) {
      ctx.lineTo(cx, cy)
    } else {
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx, cy)
    }
    penX = cx
    penY = cy
  }
  ctx.stroke()
}

function box(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  half: number,
): InkRect {
  const left = Math.min(x0, x1) - half
  const top = Math.min(y0, y1) - half
  return {
    left,
    top,
    width: Math.max(x0, x1) + half - left,
    height: Math.max(y0, y1) + half - top,
  }
}

// The step's ink for one instance: its rise, its top and, where nothing abuts
// it, its drop, each stroked `lineWidth` wide.
function stepInk(
  c: LineChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: LineParams,
  i: number,
): InkRect | undefined {
  const { x, x2, y, row, count } = c
  const slot = rowSlot(row, i, params.rowTable)
  if (slot === undefined) {
    return undefined
  }
  const g = lineFrame(block, frame, params)
  const rows = rowLane(row, count)
  const top = valueYPx(g, y[i]!, slot)
  const originY = valueYPx(g, params.origin, slot)
  const riseFrom = abutsBefore(c, rows, i)
    ? valueYPx(g, y[i - 1]!, slot)
    : originY
  const dropTo = i < count - 1 && abutsBefore(c, rows, i + 1) ? top : originY
  return box(
    g.bpToPx(x[i]!),
    g.bpToPx(x2[i]!),
    Math.min(top, riseFrom, dropTo),
    Math.max(top, riseFrom, dropTo),
    params.lineWidth / 2,
  )
}

// The linear variant's ink for one instance: the segment from the previous
// midpoint to its own, or its dot at a run start.
function centerInk(
  c: LineChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: LineParams,
  i: number,
): InkRect | undefined {
  const { x, x2, y, row, count } = c
  const slot = rowSlot(row, i, params.rowTable)
  if (slot === undefined) {
    return undefined
  }
  const g = lineFrame(block, frame, params)
  const rows = rowLane(row, count)
  const cx = (g.bpToPx(x[i]!) + g.bpToPx(x2[i]!)) / 2
  const cy = valueYPx(g, y[i]!, slot)
  const linked =
    linksBefore(c, rows, i) &&
    rowSlot(row, i - 1, params.rowTable) !== undefined
  const px = linked ? (g.bpToPx(x[i - 1]!) + g.bpToPx(x2[i - 1]!)) / 2 : cx
  const py = linked ? valueYPx(g, y[i - 1]!, slot) : cy
  return box(px, cx, py, cy, params.lineWidth / 2)
}

/** The step variant: three square-capped quads an instance, flat filled. */
export const lineStepMark: MarkShape<LineChannels, LineParams> = {
  id: 'lineStep',
  pass: { ...slangPass({ id: 'lineStep', mod: stepShader }), pack: packStep },
  writeUniforms: writeLineUniforms,
  textures: rowTableTextures,
  paintBlock: paintStep,
  ink: stepInk,
}

/** The linear variant: one round-capped capsule an instance, max blended. */
export const lineCenterMark: MarkShape<LineChannels, LineParams> = {
  id: 'lineCenter',
  pass: {
    ...slangPass({ id: 'lineCenter', mod: centerShader }),
    pack: packCenter,
  },
  writeUniforms: writeLineUniforms,
  textures: rowTableTextures,
  paintBlock: paintCenter,
  ink: centerInk,
}

/** The shape a line's `interpolate` draws with. */
export function lineMarkOf(interpolate: LineInterpolate) {
  return interpolate === 'linear' ? lineCenterMark : lineStepMark
}
