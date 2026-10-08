import { bpRangeXTuple } from '../blockClipUtils.ts'
import { CappedPath, getDpr, makeBpMapper } from '../canvas2dUtils.ts'
import * as centerShader from '../shaders/lineCenterMark.generated.ts'
import { GAP_Y, NO_PREV_X } from '../shaders/lineCommon.generated.ts'
import { lineColorAlongY } from '../shaders/lineCommon.js.generated.ts'
import * as stepShader from '../shaders/lineStepMark.generated.ts'
import { valueToYPxScaled } from '../shaders/pointMark.js.generated.ts'
import { rowBandTopPx } from '../shaders/rowTable.js.generated.ts'
import { normalizeScoreUnclamped } from '../shaders/scoreScale.js.generated.ts'
import { slangPass } from '../slangPass.ts'
import { abgrToCssRgba } from './colorFill.ts'
import {
  colorBits,
  isThreshold,
  paintColors,
  rampUniforms,
} from './markRamp.ts'
import {
  bandHeightPx,
  rowColor,
  rowColorOverride,
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
  MarkColorScale,
  MarkContext2D,
  MarkFrame,
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
  /** The quantitative color scale, for a line whose color is a ramp or a threshold. */
  colorScale?: MarkColorScale
  /**
   * Whether the color field is the plotted `y`. Only then does a threshold's
   * cut sit on the y scale, so the line changes color where it crosses one;
   * otherwise each instance takes its own value's color.
   */
  colorFromY?: boolean
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
    { x, x2, y, color: colorBits(c, count), row, prevY, nextY },
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
    { x, x2, y, color: colorBits(c, count), row, prevX, prevX2, prevY },
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
    ...rampUniforms(params.colorScale),
    colorFromY: params.colorFromY ? 1 : 0,
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

// A value's y in the band for the color test, placed UNCLAMPED where
// `valueYPx` clamps it to draw: the cuts go through it, and so does the line a
// threshold colors along, as the shader's `lineColorYPx` does.
function colorYPx(g: LineFrame, value: number, slot: number) {
  const norm = normalizeScoreUnclamped(
    value,
    g.domainMin,
    g.domainMax,
    g.scaleType,
    g.symlogConstant,
  )
  return rowBandTopPx(g.rowOffsetPx, g.pitch, slot) + (1 - norm) * g.band
}

/**
 * What the two tracers hand a pen: the polyline's points, each with the y its
 * color is read at where that differs from the y it is drawn at, and the
 * instance the next points belong to.
 */
interface LinePen {
  instance(i: number): void
  moveTo(x: number, y: number, colorY?: number): void
  lineTo(x: number, y: number, colorY?: number): void
  /** Reads the next segment's color from `colorY` without moving the pen. */
  recolor(colorY: number): void
  endRun(): void
  end(): void
}

// One color per instance: a change ends the stroke batch and reopens it from
// the pen, so a segment carries the color of the instance it belongs to, as
// the shader's per-instance color does.
class InstancePen implements LinePen {
  private lastAbgr = -1
  private x = 0
  private y = 0
  private inRun = false

  constructor(
    private readonly ctx: MarkContext2D,
    private readonly colorOf: (i: number) => number,
  ) {
    ctx.beginPath()
  }

  instance(i: number) {
    const abgr = this.colorOf(i)
    if (abgr === this.lastAbgr) {
      return
    }
    this.ctx.stroke()
    this.ctx.beginPath()
    if (this.inRun) {
      this.ctx.moveTo(this.x, this.y)
    }
    this.ctx.strokeStyle = abgrToCssRgba(abgr)
    this.lastAbgr = abgr
  }

  moveTo(x: number, y: number) {
    this.ctx.moveTo(x, y)
    this.x = x
    this.y = y
    this.inRun = true
  }

  lineTo(x: number, y: number) {
    this.ctx.lineTo(x, y)
    this.x = x
    this.y = y
  }

  recolor() {}

  endRun() {
    this.inRun = false
  }

  end() {
    this.ctx.stroke()
  }
}

// The part of the segment from y0 to y1, as a fraction of it, inside the band
// top < y <= bottom; undefined where it misses. A band owns its lower edge,
// so a line lying on a cut takes the color above it, as the shader does.
function bandSpan(y0: number, y1: number, top: number, bottom: number) {
  if (y0 === y1) {
    return top < y0 && y0 <= bottom ? ([0, 1] as const) : undefined
  }
  const tTop = (top - y0) / (y1 - y0)
  const tBottom = (bottom - y0) / (y1 - y0)
  const t0 = Math.max(0, Math.min(tTop, tBottom))
  const t1 = Math.min(1, Math.max(tTop, tBottom))
  return t0 < t1 || (t0 === t1 && y0 + (y1 - y0) * t0 !== top)
    ? ([t0, t1] as const)
    : undefined
}

// Keeps the part of each segment inside one threshold band, cut where it
// crosses the band's edges, so a line stroked once per band changes color
// where the shader's fragments do. A point's color y is where the band test
// reads it and its y where it draws, which part where the drawn y is clamped.
class BandPen implements LinePen {
  private x = 0
  private y = 0
  private colorY = 0
  private drawing = false
  private readonly path: CappedPath

  constructor(
    private readonly ctx: MarkContext2D,
    private readonly top: number,
    private readonly bottom: number,
  ) {
    this.path = new CappedPath(ctx, 'stroke')
  }

  instance() {}

  moveTo(x: number, y: number, colorY = y) {
    this.x = x
    this.y = y
    this.colorY = colorY
    this.drawing = false
  }

  recolor(colorY: number) {
    this.colorY = colorY
  }

  lineTo(x: number, y: number, colorY = y) {
    const span = bandSpan(this.colorY, colorY, this.top, this.bottom)
    if (span) {
      const [t0, t1] = span
      if (this.path.add()) {
        this.drawing = false
      }
      if (!this.drawing || t0 > 0) {
        this.ctx.moveTo(this.x + (x - this.x) * t0, this.y + (y - this.y) * t0)
      }
      if (t0 < t1 || (t0 === 0 && t1 === 1)) {
        this.ctx.lineTo(this.x + (x - this.x) * t1, this.y + (y - this.y) * t1)
      }
      this.drawing = t1 === 1
    } else {
      this.drawing = false
    }
    this.x = x
    this.y = y
    this.colorY = colorY
  }

  endRun() {
    this.drawing = false
  }

  end() {
    this.path.flush()
  }
}

// The step polyline over `indices`, in order: a rise from the origin, the top
// across the span, the step at each joint and a drop to the origin at a gap.
// A rise is colored along the y it is drawn at, a level run by its value's
// color y, as the shader reads them.
function traceStep(
  pen: LinePen,
  c: LineChannels,
  g: LineFrame,
  rows: ArrayLike<number>,
  indices: Iterable<number>,
  origin: number,
) {
  const { x, x2, y, row, count } = c
  let inRun = false
  for (const i of indices) {
    const slot = rowSlot(row, i, g.table)
    if (slot === undefined) {
      if (inRun) {
        pen.endRun()
        inRun = false
      }
      continue
    }
    pen.instance(i)
    const x1 = g.bpToPx(x[i]!)
    const xb = g.bpToPx(x2[i]!)
    const top = valueYPx(g, y[i]!, slot)
    const originY = valueYPx(g, origin, slot)
    const colorTop = colorYPx(g, y[i]!, slot)
    if (!inRun) {
      pen.moveTo(x1, originY)
      inRun = true
    }
    pen.lineTo(x1, top)
    pen.recolor(colorTop)
    pen.lineTo(xb, top, colorTop)
    pen.recolor(top)
    if (!(i < count - 1 && abutsBefore(c, rows, i + 1))) {
      pen.lineTo(xb, originY)
      pen.endRun()
      inRun = false
    }
  }
}

// The linear polyline over `indices`: one run per stretch of linked midpoints
// on a row, a break opening a new subpath with a zero-length segment, which
// paints the dot the shader's collapsed capsule draws.
function traceCenter(
  pen: LinePen,
  c: LineChannels,
  g: LineFrame,
  rows: ArrayLike<number>,
  indices: Iterable<number>,
) {
  const { x, x2, y, row } = c
  for (const i of indices) {
    const slot = rowSlot(row, i, g.table)
    if (slot === undefined) {
      continue
    }
    pen.instance(i)
    const cx = (g.bpToPx(x[i]!) + g.bpToPx(x2[i]!)) / 2
    const cy = valueYPx(g, y[i]!, slot)
    const colorY = colorYPx(g, y[i]!, slot)
    const linked =
      linksBefore(c, rows, i) && rowSlot(row, i - 1, g.table) !== undefined
    if (!linked) {
      pen.moveTo(cx, cy, colorY)
    }
    pen.lineTo(cx, cy, colorY)
  }
}

type Trace = (pen: LinePen, indices: Iterable<number>) => void

// Along y, the line is stroked once per band per row, each pass keeping the
// parts of the polyline inside its band; otherwise once, in each instance's
// own color. A row the table recolors takes its override either way.
function paintLine(
  ctx: MarkContext2D,
  c: LineChannels,
  g: LineFrame,
  params: LineParams,
  trace: Trace,
) {
  const { row, count } = c
  const scale = params.colorScale
  const bySlot = new Map<number, number[]>()
  const own: number[] = []
  const { rampMode } = rampUniforms(scale)
  const colorFromY = params.colorFromY ? 1 : 0
  for (let i = 0; i < count; i++) {
    const slot = rowSlot(row, i, g.table)
    if (slot === undefined) {
      continue
    }
    const overridden = rowColorOverride(row, i, g.table) !== undefined
    if (lineColorAlongY(rampMode, colorFromY, overridden)) {
      const held = bySlot.get(slot)
      if (held) {
        held.push(i)
      } else {
        bySlot.set(slot, [i])
      }
    } else {
      own.push(i)
    }
  }
  if (scale && isThreshold(scale)) {
    const { cuts, colors } = scale
    for (const [slot, indices] of bySlot) {
      const cutYs = cuts.map(cut => colorYPx(g, cut, slot))
      for (let k = 0; k <= cuts.length; k++) {
        ctx.strokeStyle = abgrToCssRgba(colors[k] ?? 0)
        const pen = new BandPen(
          ctx,
          k < cuts.length ? cutYs[k]! : Number.NEGATIVE_INFINITY,
          k > 0 ? cutYs[k - 1]! : Number.POSITIVE_INFINITY,
        )
        trace(pen, indices)
        pen.end()
      }
    }
  }
  if (own.length > 0) {
    const color = paintColors(c, count, scale)
    const pen = new InstancePen(ctx, i => rowColor(color[i]!, row, i, g.table))
    trace(pen, own)
    pen.end()
  }
}

function paintStep(
  ctx: MarkContext2D,
  c: LineChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: LineParams,
) {
  if (c.count === 0) {
    return
  }
  const g = lineFrame(block, frame, params)
  const rows = rowLane(c.row, c.count)
  ctx.lineWidth = params.lineWidth
  paintLine(ctx, c, g, params, (pen, indices) => {
    traceStep(pen, c, g, rows, indices, params.origin)
  })
}

function paintCenter(
  ctx: MarkContext2D,
  c: LineChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: LineParams,
) {
  if (c.count === 0) {
    return
  }
  const g = lineFrame(block, frame, params)
  const rows = rowLane(c.row, c.count)
  ctx.lineWidth = params.lineWidth
  // Round joins and caps match the GPU capsule so sharp bends do not nick.
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  paintLine(ctx, c, g, params, (pen, indices) => {
    traceCenter(pen, c, g, rows, indices)
  })
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
