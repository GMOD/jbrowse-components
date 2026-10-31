import { bpRangeXTuple } from '../blockClipUtils.ts'
import { CappedPath, getDpr, makeBpMapper } from '../canvas2dUtils.ts'
import { makeUnclampedScoreNormalizer } from '../scoreScale.ts'
import * as centerShader from '../shaders/lineCenterMark.generated.ts'
import { GAP_Y, NO_PREV_X } from '../shaders/lineCommon.generated.ts'
import { lineColorAlongY } from '../shaders/lineCommon.js.generated.ts'
import * as stepShader from '../shaders/lineStepMark.generated.ts'
import { rowBandTopPx } from '../shaders/rowTable.js.generated.ts'
import { denormalizeScore } from '../shaders/scoreScale.js.generated.ts'
import { slangPass } from '../slangPass.ts'
import { abgrToCssRgba } from './colorFill.ts'
import {
  colorBits,
  isThreshold,
  paintColors,
  rampAsThreshold,
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
import type { ScaleTypeCode } from '../scoreScale.ts'
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
 * row and one `series`, in the order given, each instance a span from `x` to
 * `x2` at `y` on the value scale. The caller hands each series' instances
 * together; a change of row or series starts a new run, and absent, a row is
 * one series. `gapBp` is the linear variant's break: a midpoint further than
 * that from the previous one starts a new run. Both ride with the data, as
 * the neighbour fields the packer derives from them do, so both backends
 * break in the same place.
 */
export interface LineChannels extends ColorChannel, RowChannel {
  x: Uint32Array
  x2: Uint32Array
  y: Float32Array
  series?: Uint32Array
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

/**
 * The instances a tracer walks: each one's span read at `i * stride`, so
 * split lanes walk at stride 1 and interleaved `[start, end]` pairs, with
 * `x2` the same array one on, at stride 2.
 */
export interface LineSpans {
  x: Uint32Array
  x2: Uint32Array
  stride: number
  y: Float32Array
  row: Uint32Array | undefined
  series: Uint32Array | undefined
  gapBp: number | undefined
  count: number
}

function spansOf(c: LineChannels): LineSpans {
  return {
    x: c.x,
    x2: c.x2,
    stride: 1,
    y: c.y,
    row: c.row,
    series: c.series,
    gapBp: c.gapBp,
    count: c.count,
  }
}

/** One row's spans held as interleaved `[start, end]` pairs. */
export function interleavedSpans(
  positions: Uint32Array,
  y: Float32Array,
  count: number,
): LineSpans {
  return {
    x: positions,
    x2: positions.subarray(1),
    stride: 2,
    y,
    row: undefined,
    series: undefined,
    gapBp: undefined,
    count,
  }
}

// Whether instances `a` and `b` stand on one row and in one series.
function sameRun(s: LineSpans, a: number, b: number) {
  const { row, series } = s
  return (
    (row === undefined || row[a] === row[b]) &&
    (series === undefined || series[a] === series[b])
  )
}

// Whether instance `i` abuts the one before it in its run, so the step joins
// them at a shared corner.
function abutsBefore(s: LineSpans, i: number) {
  return (
    i > 0 &&
    sameRun(s, i - 1, i) &&
    s.x2[(i - 1) * s.stride] === s.x[i * s.stride]
  )
}

// Whether the linear variant links instance `i` to the one before it: the same
// row and series, within `gapBp` midpoint to midpoint.
function linksBefore(s: LineSpans, i: number) {
  const { x, x2, stride, gapBp } = s
  return (
    i > 0 &&
    sameRun(s, i - 1, i) &&
    (gapBp === undefined ||
      (x[i * stride]! + x2[i * stride]!) / 2 -
        (x[(i - 1) * stride]! + x2[(i - 1) * stride]!) / 2 <=
        gapBp)
  )
}

function packStep(c: LineChannels) {
  const { x, x2, y, count } = c
  const s = spansOf(c)
  const row = rowLane(c.row, count)
  const prevY = new Float32Array(count)
  const nextY = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    prevY[i] = abutsBefore(s, i) ? y[i - 1]! : GAP_Y
    // a joined next collapses the third quad onto the corner the next
    // instance's first quad draws, so the seam is stroked once
    nextY[i] = i < count - 1 && abutsBefore(s, i + 1) ? y[i]! : GAP_Y
  }
  return stepShader.packInstances(
    { x, x2, y, color: colorBits(c, count), row, prevY, nextY },
    count,
  )
}

function packCenter(c: LineChannels) {
  const { x, x2, y, count } = c
  const s = spansOf(c)
  const row = rowLane(c.row, count)
  const prevX = new Uint32Array(count)
  const prevX2 = new Uint32Array(count)
  const prevY = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const linked = linksBefore(s, i)
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

/**
 * The value scale hoisted per block, as the shader reads it per instance: the
 * band each slot stands in and where a value lands inside it.
 */
export interface LineFrame {
  bpToPx: (bp: number) => number
  /** `normalizeScoreUnclamped` with the domain's transform hoisted out. */
  normalize: (value: number) => number
  pitch: number
  band: number
  rowOffsetPx: number
  domainMin: number
  domainMax: number
  scaleType: ScaleTypeCode
  symlogConstant: number
  table: RowTable | undefined
}

function makeLineFrame(
  block: RenderBlock,
  pitch: number,
  band: number,
  rowOffsetPx: number,
  [domainMin, domainMax]: readonly [number, number],
  scaleType: ScaleTypeCode,
  symlogConstant: number,
  table: RowTable | undefined,
): LineFrame {
  return {
    bpToPx: makeBpMapper(block),
    normalize: makeUnclampedScoreNormalizer(
      domainMin,
      domainMax,
      scaleType,
      symlogConstant,
    ),
    pitch,
    band,
    rowOffsetPx,
    domainMin,
    domainMax,
    scaleType,
    symlogConstant,
    table,
  }
}

/** One row's frame: a band `rowHeight` tall from `rowTop`, with no row table. */
export function rowLineFrame(
  block: RenderBlock,
  rowTop: number,
  rowHeight: number,
  domain: readonly [number, number],
  scaleType: ScaleTypeCode,
  symlogConstant: number,
) {
  return makeLineFrame(
    block,
    rowHeight,
    rowHeight,
    rowTop,
    domain,
    scaleType,
    symlogConstant,
    undefined,
  )
}

function lineFrame(block: RenderBlock, frame: MarkFrame, params: LineParams) {
  const pitch = bandHeightPx(params, frame.canvasHeight)
  const { valueScaleType, valueSymlogConstant } = valueScaleUniforms(params)
  return makeLineFrame(
    block,
    pitch,
    params.rowBandPx ?? pitch,
    params.rowOffsetPx ?? 0,
    params.domain,
    valueScaleType,
    valueSymlogConstant,
    params.rowTable,
  )
}

function bandTopPx(g: LineFrame, slot: number) {
  return rowBandTopPx(g.rowOffsetPx, g.pitch, slot)
}

function colorYInBand(g: LineFrame, bandTop: number, value: number) {
  return bandTop + (1 - g.normalize(value)) * g.band
}

// The y a color y draws at, clamped into the band as the shader clamps the
// normalized value: the band's edge past the domain, its bottom for NaN.
function clampToBand(g: LineFrame, bandTop: number, colorY: number) {
  const bottom = bandTop + g.band
  return colorY < bandTop ? bandTop : colorY < bottom ? colorY : bottom
}

/** A value's y in the band for the color test, as the shader's `lineColorYPx`. */
export function lineColorYPx(g: LineFrame, value: number, slot: number) {
  return colorYInBand(g, bandTopPx(g, slot), value)
}

function valueYPx(g: LineFrame, value: number, slot: number) {
  const bandTop = bandTopPx(g, slot)
  return clampToBand(g, bandTop, colorYInBand(g, bandTop, value))
}

/**
 * What the two tracers hand a pen: the polyline's points, each with the y its
 * color is read at where that differs from the y it is drawn at, and the
 * instance the next points belong to.
 */
export interface LinePen {
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
  private readonly ctx: MarkContext2D
  private readonly colorOf: (i: number) => number

  constructor(ctx: MarkContext2D, colorOf: (i: number) => number) {
    this.ctx = ctx
    this.colorOf = colorOf
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
export class BandPen implements LinePen {
  private x = 0
  private y = 0
  private colorY = 0
  private drawing = false
  private readonly path: CappedPath
  private readonly ctx: MarkContext2D
  private readonly top: number
  private readonly bottom: number

  constructor(ctx: MarkContext2D, top: number, bottom: number) {
    this.ctx = ctx
    this.top = top
    this.bottom = bottom
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

/**
 * The step polyline over `indices` in order, every instance where absent: a
 * rise from the origin, the top across the span, the step at each joint and a
 * drop to the origin at a gap. A rise is colored along the y it is drawn at, a
 * level run by its value's color y, as the shader reads them.
 */
export function traceStep(
  pen: LinePen,
  s: LineSpans,
  g: LineFrame,
  indices: ArrayLike<number> | undefined,
  origin: number,
) {
  const { x, x2, stride, y, row, count } = s
  const { bpToPx, table } = g
  const n = indices ? indices.length : count
  let inRun = false
  let originY = 0
  let bandTop = 0
  for (let k = 0; k < n; k++) {
    const i = indices ? indices[k]! : k
    const slot = rowSlot(row, i, table)
    if (slot === undefined) {
      if (inRun) {
        pen.endRun()
        inRun = false
      }
    } else {
      pen.instance(i)
      const x1 = bpToPx(x[i * stride]!)
      const xb = bpToPx(x2[i * stride]!)
      if (!inRun) {
        // a run stays on one row, so on one slot
        bandTop = bandTopPx(g, slot)
        originY = clampToBand(g, bandTop, colorYInBand(g, bandTop, origin))
        pen.moveTo(x1, originY)
        inRun = true
      }
      const colorTop = colorYInBand(g, bandTop, y[i]!)
      const top = clampToBand(g, bandTop, colorTop)
      pen.lineTo(x1, top)
      pen.recolor(colorTop)
      pen.lineTo(xb, top, colorTop)
      pen.recolor(top)
      if (!(i < count - 1 && abutsBefore(s, i + 1))) {
        pen.lineTo(xb, originY)
        pen.endRun()
        inRun = false
      }
    }
  }
}

/**
 * The linear polyline over `indices`, every instance where absent: one run
 * per stretch of linked midpoints on a row, a break opening a new subpath
 * with a zero-length segment, which paints the dot the shader's collapsed
 * capsule draws.
 */
export function traceCenter(
  pen: LinePen,
  s: LineSpans,
  g: LineFrame,
  indices: ArrayLike<number> | undefined,
) {
  const { x, x2, stride, y, row, count } = s
  const { bpToPx, table } = g
  const n = indices ? indices.length : count
  for (let k = 0; k < n; k++) {
    const i = indices ? indices[k]! : k
    const slot = rowSlot(row, i, table)
    if (slot !== undefined) {
      pen.instance(i)
      const cx = (bpToPx(x[i * stride]!) + bpToPx(x2[i * stride]!)) / 2
      const bandTop = bandTopPx(g, slot)
      const colorY = colorYInBand(g, bandTop, y[i]!)
      const cy = clampToBand(g, bandTop, colorY)
      const linked =
        linksBefore(s, i) && rowSlot(row, i - 1, table) !== undefined
      if (!linked) {
        pen.moveTo(cx, cy, colorY)
      }
      pen.lineTo(cx, cy, colorY)
    }
  }
}

type Trace = (pen: LinePen, indices: ArrayLike<number>) => void

// The lowest and highest value a line along y draws through: its values, and
// for a step the origin it drops to across a gap.
function valuesReached(
  c: LineChannels,
  bySlot: Map<number, number[]>,
  origin: number | undefined,
): [number, number] {
  let low = origin ?? Number.POSITIVE_INFINITY
  let high = origin ?? Number.NEGATIVE_INFINITY
  for (const indices of bySlot.values()) {
    for (const i of indices) {
      const v = c.y[i]!
      if (Number.isFinite(v)) {
        low = Math.min(low, v)
        high = Math.max(high, v)
      }
    }
  }
  return [low, high]
}

// Along y, the line is stroked once per band per row, each pass keeping the
// parts of the polyline inside its band; otherwise once, in each instance's
// own color. A row the table recolors takes its override either way.
function paintLine(
  ctx: MarkContext2D,
  c: LineChannels,
  g: LineFrame,
  params: LineParams,
  trace: Trace,
  dropsTo?: number,
) {
  const { row, count } = c
  const scale = params.colorScale
  const bySlot = new Map<number, number[]>()
  const own: number[] = []
  const { rampMode } = rampUniforms(scale)
  // a ramp along y reads values back through the y scale, which a domain
  // with no range cannot give, so the instances keep their own colors there,
  // as the shader's `lineFragmentColor` does
  const yHasRange =
    denormalizeScore(
      1,
      g.domainMin,
      g.domainMax,
      g.scaleType,
      g.symlogConstant,
    ) >
    denormalizeScore(0, g.domainMin, g.domainMax, g.scaleType, g.symlogConstant)
  const colorFromY =
    params.colorFromY && (yHasRange || (scale && isThreshold(scale))) ? 1 : 0
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
  if (scale && bySlot.size > 0) {
    const { cuts, colors } = isThreshold(scale)
      ? scale
      : rampAsThreshold(scale, ...valuesReached(c, bySlot, dropsTo))
    for (const [slot, indices] of bySlot) {
      const cutYs = cuts.map(cut => lineColorYPx(g, Math.fround(cut), slot))
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
  const s = spansOf(c)
  ctx.lineWidth = params.lineWidth
  paintLine(
    ctx,
    c,
    g,
    params,
    (pen, indices) => {
      traceStep(pen, s, g, indices, params.origin)
    },
    params.origin,
  )
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
  const s = spansOf(c)
  ctx.lineWidth = params.lineWidth
  // Round joins and caps match the GPU capsule so sharp bends do not nick.
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  paintLine(ctx, c, g, params, (pen, indices) => {
    traceCenter(pen, s, g, indices)
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
  const s = spansOf(c)
  const top = valueYPx(g, y[i]!, slot)
  const originY = valueYPx(g, params.origin, slot)
  const riseFrom = abutsBefore(s, i) ? valueYPx(g, y[i - 1]!, slot) : originY
  const dropTo = i < count - 1 && abutsBefore(s, i + 1) ? top : originY
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
  const { x, x2, y, row } = c
  const slot = rowSlot(row, i, params.rowTable)
  if (slot === undefined) {
    return undefined
  }
  const g = lineFrame(block, frame, params)
  const s = spansOf(c)
  const cx = (g.bpToPx(x[i]!) + g.bpToPx(x2[i]!)) / 2
  const cy = valueYPx(g, y[i]!, slot)
  const linked =
    linksBefore(s, i) && rowSlot(row, i - 1, params.rowTable) !== undefined
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
