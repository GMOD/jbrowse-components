// Does a box shape whose painter and ink share one placement paint at the speed
// of the painter it retired?
//
//   node --no-use-osr packages/render-core/benches/placeWalkers.bench.ts --shape=cell --size=1m
//
// Flags: --shape=cell|rect|rectOutline|span, --size=100k|1m, one of each per
// process (BENCHMARKING.md, "Looping several DATASETS"), --rounds=<n>
// (default 25). rectOutline is rect with its outline stroke on.
//
// ARMS, each a whole `paintBlock` over one block on a counting context:
//
//   retired   the painter the port replaced, copied verbatim
//   control   a separately declared copy of retired
//   ported    the production shape's `paintBlock`, imported
//
// Each arm has its own driver literal, and every call before the timed rounds
// is a forward block on the counting context, with OSR off. The retired span
// painter calls two per-call closures per instance, and whether TurboFan
// inlines them depends on when a GC clears their call feedback: a reversed
// block, a second context or OSR-compiled entry before timing put it, its
// control or both at 40-47 ns against 21-25, so the control read 0.60-1.72x.
//
// IDENTITY. After timing and before anything prints, all three arms are
// recorded through `recordingContext` — rects plus every fillStyle,
// strokeStyle and lineWidth write, in order — in both orientations, and must
// match retired exactly. Every timed run is checked against retired's counts
// and coordinate sum.
//
// WHAT IT SAYS. Separate processes, AC power, load under 4, min of 25
// interleaved rounds, ratio to retired:
//
//                 size   retired ns   control     ported
//   cell          1M     31.6-36.0    0.99-1.01   1.00-1.03
//   cell          100K   36.2-39.8    0.99-1.00   0.98-0.99
//   rect          1M     58.1-66.5    1.00-1.02   0.87-0.89
//   rect          100K   65.1-68.5    1.00-1.01   0.87-0.88
//   rectOutline   1M     64.1-66.3    1.01-1.03   0.89-0.90
//   span          1M     21.3-24.2    0.99-1.01   0.91-0.93
//   span          100K   20.5-22.2    0.99        0.90-0.91
//
// A third rect 1M process read its control at 1.08x and is left out. Three
// of the cell 1M processes and two of the rect 1M ones ran after cell's and
// rect's frames took their block from `bpProjection`; the rest ran before.
//
// WHERE THE FRAME IS ALLOCATED DECIDES IT. The placement functions read the
// block off a frame object, and TurboFan scalar-replaces that object only when
// the painter's own optimized code allocates it; a frame a call returns is
// reloaded field by field on every instance, since each context write kills
// what the loop knew. On cell the loop's inlinees spend the 920-byte
// cumulative inlining budget before a once-per-block builder call comes up,
// so in a scratch copy of this harness `paintBlock` calling `cellFrame` read
// 1.03-1.06x, and 0.97-0.98x under --max-inlined-bytecode-size-cumulative=2000.
// A Float64Array frame read 0.93-0.96x with literal slot indices and
// 1.12-1.18x with named ones, whose module-level constants TurboFan did not
// fold; the frame carrying `makeBpMapper`'s closure read 1.07-1.10x. Across
// three processes, a frame destructuring `bpProjection(block)` read 0.99-1.02x
// beside 0.99-1.02x for the two ternaries it replaced, and one nesting it as
// `px` read 1.06-1.11x.
//
// BYTECODE. `--print-bytecode --print-bytecode-filter=<name>` prints a
// function's length; `--trace-turbo-inlining` prints each call site's size
// beside what its optimized code already inlined, against the 460-byte budget.
// `placeCellY` 60 and `placeCellX` 113 + 293 both inline into `paintBlock`, and
// `projectBp` is 32. `placeRectY` 92 + 290 inlines and `placeRectX` 276 + 301
// does not; rect's frame escapes into that call either way, so `paintBlock`
// builds it with `rectFrame`, which inlines at 79 with `bpProjection`'s 84.
// `placeSpan` 156 + 81 inlines, and so does `spanFrame` at 125 with
// `bpProjection`'s 84, which leaves span's frame to scalar-replace.

import { execSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'

import { MIN_DENSITY_ALPHA } from '../../../plugins/canvas/src/LinearBasicDisplay/components/sharedRendererConstants.ts'
import { rectShape } from '../../../plugins/canvas/src/LinearBasicDisplay/marks/featureGlyphShapes.ts'
import {
  rectDrawsOutline,
  rectSpanPx,
} from '../../../plugins/canvas/src/LinearBasicDisplay/passes/shaders/rect.js.generated.ts'
import { cellMark } from '../../../plugins/variants/src/LinearMultiSampleVariantDisplay/components/cellMark.ts'
import { drawnCellHeightPx } from '../../../plugins/variants/src/LinearMultiSampleVariantDisplay/components/shaders/variant.js.generated.ts'
import { snapVariantCellX } from '../../../plugins/variants/src/LinearMultiSampleVariantDisplay/components/snapVariantCellX.ts'
import {
  SHAPE_RECT,
  SHAPE_TRI_LEFT,
  drawVariantShape,
} from '../../../plugins/variants/src/LinearMultiSampleVariantDisplay/components/variantShape.ts'
import {
  abgrAlpha,
  abgrBlue,
  abgrGreen,
  abgrRed,
} from '../../core/src/util/colorBits.ts'
import {
  makeBpMapper,
  spanLeft,
  strokeRectInside,
} from '../src/canvas2dUtils.ts'
import { abgrToCssRgba, makeAbgrFill } from '../src/marks/colorFill.ts'
import { recordingContext } from '../src/marks/drawAgainstHit.ts'
import { spanMark } from '../src/marks/spanMark.ts'
import {
  snapBoxHeightPx,
  snapBoxTopPx,
} from '../src/shaders/hpmath.js.generated.ts'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '../src/shaders/rowRect.js.generated.ts'

import type {
  FeatureGlyphParams,
  RectChannels,
} from '../../../plugins/canvas/src/LinearBasicDisplay/marks/featureGlyphShapes.ts'
import type {
  CellChannels,
  CellParams,
} from '../../../plugins/variants/src/LinearMultiSampleVariantDisplay/components/cellMark.ts'
import type { SpanChannels, SpanParams } from '../src/marks/spanMark.ts'
import type { MarkContext2D, MarkFrame, MarkShape } from '../src/marks/types.ts'
import type { RenderBlock } from '../src/renderBlock.ts'

class CountingContext implements MarkContext2D {
  fills = 0
  styles = 0
  strokes = 0
  paths = 0
  sum = 0
  style: MarkContext2D['fillStyle'] = ''
  stroked: MarkContext2D['strokeStyle'] = ''
  width = 1
  get fillStyle() {
    return this.style
  }
  set fillStyle(v: MarkContext2D['fillStyle']) {
    this.style = v
    this.styles++
  }
  get strokeStyle() {
    return this.stroked
  }
  set strokeStyle(v: MarkContext2D['strokeStyle']) {
    this.stroked = v
    this.styles++
  }
  get lineWidth() {
    return this.width
  }
  set lineWidth(v: number) {
    this.width = v
    this.styles++
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.fills++
    this.sum += x + y + w + h
  }
  strokeRect(x: number, y: number, w: number, h: number) {
    this.strokes++
    this.sum += x + y + w + h
  }
  moveTo(x: number, y: number) {
    this.sum += x + y
  }
  lineTo(x: number, y: number) {
    this.sum += x + y
  }
  fill() {
    this.paths++
  }
  save() {}
  restore() {}
  beginPath() {}
  rect() {}
  clip() {}
  translate() {}
  scale() {}
  rotate() {}
  bezierCurveTo() {}
  arc() {}
  ellipse() {}
  setLineDash() {}
  closePath() {}
  stroke() {}
}

function sameCounts(a: CountingContext, b: CountingContext) {
  return (
    a.fills === b.fills &&
    a.styles === b.styles &&
    a.strokes === b.strokes &&
    a.paths === b.paths &&
    a.sum === b.sum
  )
}

class StyleLog implements MarkContext2D {
  readonly inner = recordingContext()
  readonly styles: string[] = []
  get fillStyle() {
    return this.inner.ctx.fillStyle
  }
  set fillStyle(v: MarkContext2D['fillStyle']) {
    const style = String(v)
    this.styles.push(`fill ${style}`)
    this.inner.ctx.fillStyle = style
  }
  get strokeStyle() {
    return this.inner.ctx.strokeStyle
  }
  set strokeStyle(v: MarkContext2D['strokeStyle']) {
    const style = String(v)
    this.styles.push(`stroke ${style}`)
    this.inner.ctx.strokeStyle = style
  }
  get lineWidth() {
    return this.inner.ctx.lineWidth
  }
  set lineWidth(v: number) {
    this.styles.push(`lineWidth ${v}`)
    this.inner.ctx.lineWidth = v
  }
  fillRect(x: number, y: number, w: number, h: number) {
    this.inner.ctx.fillRect(x, y, w, h)
  }
  strokeRect(x: number, y: number, w: number, h: number) {
    this.inner.ctx.strokeRect(x, y, w, h)
  }
  rect(x: number, y: number, w: number, h: number) {
    this.inner.ctx.rect(x, y, w, h)
  }
  moveTo(x: number, y: number) {
    this.inner.ctx.moveTo(x, y)
  }
  lineTo(x: number, y: number) {
    this.inner.ctx.lineTo(x, y)
  }
  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number,
  ) {
    this.inner.ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y)
  }
  arc(x: number, y: number, radius: number) {
    this.inner.ctx.arc(x, y, radius)
  }
  ellipse(x: number, y: number, radiusX: number, radiusY: number) {
    this.inner.ctx.ellipse(x, y, radiusX, radiusY)
  }
  beginPath() {
    this.inner.ctx.beginPath()
  }
  closePath() {
    this.inner.ctx.closePath()
  }
  fill() {
    this.inner.ctx.fill()
  }
  stroke() {
    this.inner.ctx.stroke()
  }
  save() {
    this.inner.ctx.save()
  }
  restore() {
    this.inner.ctx.restore()
  }
  translate(x: number, y: number) {
    this.inner.ctx.translate(x, y)
  }
  scale(x: number, y: number) {
    this.inner.ctx.scale(x, y)
  }
  rotate(angle: number) {
    this.inner.ctx.rotate(angle)
  }
  clip() {}
  setLineDash() {}
}

type Painter = (ctx: MarkContext2D, block: RenderBlock) => void

interface Arm {
  name: 'retired' | 'control' | 'ported'
  paint: Painter
}

interface Bench {
  entries: number
  forward: RenderBlock
  reversed: RenderBlock
  arms: Arm[]
}

function record(paint: Painter, block: RenderBlock) {
  const log = new StyleLog()
  paint(log, block)
  return { calls: log.inner.calls, styles: log.styles }
}

type Recording = ReturnType<typeof record>

function firstDifference(a: Recording, b: Recording) {
  if (a.calls.length !== b.calls.length) {
    return `${a.calls.length} rects against ${b.calls.length}`
  }
  for (let i = 0; i < a.calls.length; i++) {
    const p = a.calls[i]!
    const q = b.calls[i]!
    if (
      p.x !== q.x ||
      p.y !== q.y ||
      p.w !== q.w ||
      p.h !== q.h ||
      p.fillStyle !== q.fillStyle
    ) {
      return `rect ${i}: ${JSON.stringify(p)} against ${JSON.stringify(q)}`
    }
  }
  if (a.styles.length !== b.styles.length) {
    return `${a.styles.length} style writes against ${b.styles.length}`
  }
  for (let i = 0; i < a.styles.length; i++) {
    if (a.styles[i] !== b.styles[i]) {
      return `style write ${i}: ${a.styles[i]} against ${b.styles[i]}`
    }
  }
  return undefined
}

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const FRAME: MarkFrame = { canvasWidth: 1600, canvasHeight: 1000 }

function blocksOf(start: number, bpLength: number) {
  const forward: RenderBlock = {
    displayedRegionIndex: 0,
    start,
    end: start + bpLength,
    screenStartPx: 0,
    screenEndPx: FRAME.canvasWidth,
    reversed: false,
  }
  return { forward, reversed: { ...forward, reversed: true } }
}

const retiredCell: Pick<MarkShape<CellChannels, CellParams>, 'paintBlock'> = {
  paintBlock(ctx, channels, block, frame, params) {
    const { startEnd, row, shapeType, color, count } = channels
    const { canvasHeight } = frame
    const { rowHeight, scrollTop } = params
    const h = drawnCellHeightPx(rowHeight)
    const toX = makeBpMapper(block)
    const setFill = makeAbgrFill(ctx)
    for (let i = 0; i < count; i++) {
      const y = row[i]! * rowHeight - scrollTop
      if (y + h >= 0 && y <= canvasHeight) {
        const { x, width } = snapVariantCellX(
          toX(startEnd[i * 2]!),
          toX(startEnd[i * 2 + 1]!),
        )
        setFill(color[i]!)
        drawVariantShape(ctx, shapeType[i]!, x, y, width, h)
      }
    }
  },
}

const controlCell: Pick<MarkShape<CellChannels, CellParams>, 'paintBlock'> = {
  paintBlock(ctx, channels, block, frame, params) {
    const { startEnd, row, shapeType, color, count } = channels
    const { canvasHeight } = frame
    const { rowHeight, scrollTop } = params
    const h = drawnCellHeightPx(rowHeight)
    const toX = makeBpMapper(block)
    const setFill = makeAbgrFill(ctx)
    for (let i = 0; i < count; i++) {
      const y = row[i]! * rowHeight - scrollTop
      if (y + h >= 0 && y <= canvasHeight) {
        const { x, width } = snapVariantCellX(
          toX(startEnd[i * 2]!),
          toX(startEnd[i * 2 + 1]!),
        )
        setFill(color[i]!)
        drawVariantShape(ctx, shapeType[i]!, x, y, width, h)
      }
    }
  },
}

function cellBench(n: number): Bench {
  const rand = rng(67)
  const samples = n >= 1_000_000 ? 200 : 100
  const features = Math.ceil(n / samples)
  const count = features * samples
  const bpLength = features * 300
  const { forward, reversed } = blocksOf(50_000_000, bpLength)
  const genotypes = Uint32Array.of(0xffcc4411, 0xff1133bb, 0xffeeeeee)
  const startEnd = new Uint32Array(count * 2)
  const row = new Uint32Array(count)
  const shapeType = new Uint8Array(count)
  const color = new Uint32Array(count)
  let genotype = 0
  for (let f = 0; f < features; f++) {
    const start = forward.start + f * 300 + Math.floor(rand() * 200)
    const end = rand() < 0.95 ? start + 1 : start + 2000
    const shape = rand() < 0.01 ? SHAPE_TRI_LEFT : SHAPE_RECT
    for (let s = 0; s < samples; s++) {
      const i = f * samples + s
      startEnd[i * 2] = start
      startEnd[i * 2 + 1] = end
      row[i] = s
      shapeType[i] = shape
      if (rand() < 0.4) {
        genotype = rand() < 0.7 ? 0 : rand() < 0.8 ? 1 : 2
      }
      color[i] = genotypes[genotype]!
    }
  }
  const channels: CellChannels = { startEnd, row, shapeType, color, count }
  const rowHeight = FRAME.canvasHeight / (samples * 0.9)
  const params: CellParams = {
    rowHeight,
    scrollTop: 0.05 * samples * rowHeight,
  }
  return {
    entries: count,
    forward,
    reversed,
    arms: [
      {
        name: 'retired',
        paint: (ctx, block) => {
          retiredCell.paintBlock(ctx, channels, block, FRAME, params)
        },
      },
      {
        name: 'control',
        paint: (ctx, block) => {
          controlCell.paintBlock(ctx, channels, block, FRAME, params)
        },
      },
      {
        name: 'ported',
        paint: (ctx, block) => {
          cellMark.paintBlock(ctx, channels, block, FRAME, params)
        },
      },
    ],
  }
}

const PALETTE = Uint32Array.of(
  0xff3355cc,
  0xff22aa44,
  0xffcc8811,
  0xff884499,
  0xff1177ee,
  0xff999999,
  0xff0044aa,
  0xffee2266,
)

function runs(rand: () => number, n: number, meanRun: number) {
  const out = new Uint32Array(n)
  let pick = 0
  for (let i = 0; i < n; i++) {
    if (rand() < 1 / meanRun) {
      pick = Math.floor(rand() * PALETTE.length)
    }
    out[i] = PALETTE[pick]!
  }
  return out
}

function geometric(rand: () => number, mean: number) {
  return Math.floor(-Math.log(1 - rand()) * mean)
}

const GLYPH_Y_SLACK_PX = 8

function rowVisibleRetired(
  scrollY: number,
  canvasHeight: number,
  topY: number,
  heightPx: number,
) {
  const y = topY - scrollY
  return (
    y + heightPx >= -GLYPH_Y_SLACK_PX && y <= canvasHeight + GLYPH_Y_SLACK_PX
  )
}

function makeRectFillRetired(ctx: MarkContext2D) {
  let last: number | undefined
  return (c: number, fade: number | undefined) => {
    const key = fade ? c + 0x1_0000_0000 : c
    if (key !== last) {
      last = key
      const a = (abgrAlpha(c) / 255) * (fade ? MIN_DENSITY_ALPHA : 1)
      ctx.fillStyle = `rgba(${abgrRed(c)},${abgrGreen(c)},${abgrBlue(c)},${a})`
    }
  }
}

function paintedRectSpanRetired(
  startBp: number,
  endBp: number,
  toX: (bp: number) => number,
): [xLeft: number, width: number] {
  const [sx1, sx2] = rectSpanPx(toX(startBp), toX(endBp), startBp === endBp)
  const width = Math.abs(sx2 - sx1)
  return [spanLeft(sx1, sx2, width), width]
}

const retiredRect: Pick<
  MarkShape<RectChannels, FeatureGlyphParams>,
  'paintBlock'
> = {
  paintBlock(ctx, channels, block, frame, params) {
    const { startEnd, y: ys, height, color, densityFade, count } = channels
    const { scrollY, outlineColor } = params
    const { canvasHeight } = frame
    const toX = makeBpMapper(block)
    const setFill = makeRectFillRetired(ctx)
    const outlineStyle = outlineColor ? abgrToCssRgba(outlineColor) : undefined
    if (outlineStyle !== undefined) {
      ctx.strokeStyle = outlineStyle
      ctx.lineWidth = 1
    }
    for (let i = 0; i < count; i++) {
      if (!rowVisibleRetired(scrollY, canvasHeight, ys[i]!, height[i]!)) {
        continue
      }
      const y = snapBoxTopPx(ys[i]!, height[i]!, scrollY)
      const h = snapBoxHeightPx(height[i]!)
      const [xLeft, w] = paintedRectSpanRetired(
        startEnd[i * 2]!,
        startEnd[i * 2 + 1]!,
        toX,
      )
      setFill(color[i]!, densityFade[i])
      ctx.fillRect(xLeft, y, w, h)
      if (outlineStyle !== undefined && rectDrawsOutline(w, h)) {
        strokeRectInside(ctx, xLeft, y, w, h)
      }
    }
  },
}

function rowVisibleControl(
  scrollY: number,
  canvasHeight: number,
  topY: number,
  heightPx: number,
) {
  const y = topY - scrollY
  return (
    y + heightPx >= -GLYPH_Y_SLACK_PX && y <= canvasHeight + GLYPH_Y_SLACK_PX
  )
}

function makeRectFillControl(ctx: MarkContext2D) {
  let last: number | undefined
  return (c: number, fade: number | undefined) => {
    const key = fade ? c + 0x1_0000_0000 : c
    if (key !== last) {
      last = key
      const a = (abgrAlpha(c) / 255) * (fade ? MIN_DENSITY_ALPHA : 1)
      ctx.fillStyle = `rgba(${abgrRed(c)},${abgrGreen(c)},${abgrBlue(c)},${a})`
    }
  }
}

function paintedRectSpanControl(
  startBp: number,
  endBp: number,
  toX: (bp: number) => number,
): [xLeft: number, width: number] {
  const [sx1, sx2] = rectSpanPx(toX(startBp), toX(endBp), startBp === endBp)
  const width = Math.abs(sx2 - sx1)
  return [spanLeft(sx1, sx2, width), width]
}

const controlRect: Pick<
  MarkShape<RectChannels, FeatureGlyphParams>,
  'paintBlock'
> = {
  paintBlock(ctx, channels, block, frame, params) {
    const { startEnd, y: ys, height, color, densityFade, count } = channels
    const { scrollY, outlineColor } = params
    const { canvasHeight } = frame
    const toX = makeBpMapper(block)
    const setFill = makeRectFillControl(ctx)
    const outlineStyle = outlineColor ? abgrToCssRgba(outlineColor) : undefined
    if (outlineStyle !== undefined) {
      ctx.strokeStyle = outlineStyle
      ctx.lineWidth = 1
    }
    for (let i = 0; i < count; i++) {
      if (!rowVisibleControl(scrollY, canvasHeight, ys[i]!, height[i]!)) {
        continue
      }
      const y = snapBoxTopPx(ys[i]!, height[i]!, scrollY)
      const h = snapBoxHeightPx(height[i]!)
      const [xLeft, w] = paintedRectSpanControl(
        startEnd[i * 2]!,
        startEnd[i * 2 + 1]!,
        toX,
      )
      setFill(color[i]!, densityFade[i])
      ctx.fillRect(xLeft, y, w, h)
      if (outlineStyle !== undefined && rectDrawsOutline(w, h)) {
        strokeRectInside(ctx, xLeft, y, w, h)
      }
    }
  },
}

function rectBench(n: number, outline: boolean): Bench {
  const rand = rng(53)
  const bpLength = 2_000_000
  const { forward, reversed } = blocksOf(40_000_000, bpLength)
  const startEnd = new Uint32Array(n * 2)
  const y = new Float32Array(n)
  const height = new Float32Array(n)
  const densityFade = new Uint32Array(n)
  let faded = 0
  for (let i = 0; i < n; i++) {
    const start = forward.start + Math.floor((i / n) * bpLength)
    startEnd[i * 2] = start
    startEnd[i * 2 + 1] =
      rand() < 0.02 ? start : start + 200 + geometric(rand, 3000)
    y[i] = Math.floor(rand() * 90) * 12
    height[i] = rand() < 0.8 ? 10 : 6
    if (rand() < 0.05) {
      faded = faded ? 0 : 1
    }
    densityFade[i] = faded
  }
  const channels: RectChannels = {
    startEnd,
    y,
    height,
    color: runs(rand, n, 20),
    densityFade,
    strand: new Float32Array(n).fill(1),
    count: n,
  }
  const params: FeatureGlyphParams = {
    scrollY: 0,
    outlineColor: outline ? 0xff222222 : 0,
  }
  return {
    entries: n,
    forward,
    reversed,
    arms: [
      {
        name: 'retired',
        paint: (ctx, block) => {
          retiredRect.paintBlock(ctx, channels, block, FRAME, params)
        },
      },
      {
        name: 'control',
        paint: (ctx, block) => {
          controlRect.paintBlock(ctx, channels, block, FRAME, params)
        },
      },
      {
        name: 'ported',
        paint: (ctx, block) => {
          rectShape.paintBlock(ctx, channels, block, FRAME, params)
        },
      },
    ],
  }
}

const retiredSpan: Pick<MarkShape<SpanChannels, SpanParams>, 'paintBlock'> = {
  paintBlock(ctx, channels, block, _frame, params) {
    const { x, x2, row, color, count } = channels
    const { rowHeight, rowProportion, minWidthPx, seamPx, scrollTop } = params
    const h = drawnRowHeightPx(rowHeight, rowProportion)
    const offset = rowBandOffsetPx(rowHeight, rowProportion)
    const bpToPx = makeBpMapper(block)
    const setFill = makeAbgrFill(ctx)
    for (let i = 0; i < count; i++) {
      const xa = bpToPx(x[i]!)
      const xb = bpToPx(x2[i]!)
      const width = Math.max(minWidthPx, Math.abs(xb - xa))
      setFill(color[i]!)
      ctx.fillRect(
        spanLeft(xa, xb, width),
        offset + rowHeight * row[i]! - scrollTop,
        width + seamPx,
        h,
      )
    }
  },
}

const controlSpan: Pick<MarkShape<SpanChannels, SpanParams>, 'paintBlock'> = {
  paintBlock(ctx, channels, block, _frame, params) {
    const { x, x2, row, color, count } = channels
    const { rowHeight, rowProportion, minWidthPx, seamPx, scrollTop } = params
    const h = drawnRowHeightPx(rowHeight, rowProportion)
    const offset = rowBandOffsetPx(rowHeight, rowProportion)
    const bpToPx = makeBpMapper(block)
    const setFill = makeAbgrFill(ctx)
    for (let i = 0; i < count; i++) {
      const xa = bpToPx(x[i]!)
      const xb = bpToPx(x2[i]!)
      const width = Math.max(minWidthPx, Math.abs(xb - xa))
      setFill(color[i]!)
      ctx.fillRect(
        spanLeft(xa, xb, width),
        offset + rowHeight * row[i]! - scrollTop,
        width + seamPx,
        h,
      )
    }
  },
}

function spanBench(n: number): Bench {
  const rand = rng(11)
  const bpLength = 400_000
  const { forward, reversed } = blocksOf(20_000_000, bpLength)
  const x = new Uint32Array(n)
  const x2 = new Uint32Array(n)
  const row = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    x[i] = forward.start + Math.floor((i / n) * bpLength)
    x2[i] = x[i]! + 1 + geometric(rand, 60)
    row[i] = Math.floor(rand() * 100)
  }
  const channels: SpanChannels = {
    x,
    x2,
    row,
    color: runs(rand, n, 12),
    count: n,
  }
  const params: SpanParams = {
    rowHeight: 10,
    rowProportion: 0.8,
    minWidthPx: 1,
    seamPx: 0,
    scrollTop: 0,
  }
  return {
    entries: n,
    forward,
    reversed,
    arms: [
      {
        name: 'retired',
        paint: (ctx, block) => {
          retiredSpan.paintBlock(ctx, channels, block, FRAME, params)
        },
      },
      {
        name: 'control',
        paint: (ctx, block) => {
          controlSpan.paintBlock(ctx, channels, block, FRAME, params)
        },
      },
      {
        name: 'ported',
        paint: (ctx, block) => {
          spanMark.paintBlock(ctx, channels, block, FRAME, params)
        },
      },
    ],
  }
}

const BENCHES: Record<string, (n: number) => Bench> = {
  cell: cellBench,
  rect: n => rectBench(n, false),
  rectOutline: n => rectBench(n, true),
  span: spanBench,
}

function warm(bench: Bench, times: number) {
  for (let w = 0; w < times; w++) {
    for (const arm of bench.arms) {
      arm.paint(new CountingContext(), bench.forward)
    }
  }
}

function exitOnIdentityFailure(shape: string, bench: Bench) {
  for (const block of [bench.forward, bench.reversed]) {
    const [retired, ...rest] = bench.arms
    const reference = record(retired!.paint, block)
    for (const arm of rest) {
      const diff = firstDifference(reference, record(arm.paint, block))
      if (diff) {
        console.error(
          `IDENTITY FAIL ${shape} ${bench.entries} ${block.reversed ? 'reversed' : 'forward'}: ${arm.name} against retired: ${diff}`,
        )
        process.exit(1)
      }
    }
  }
}

function main() {
  const arg = (name: string) =>
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
  const shape = arg('shape') ?? ''
  const size = arg('size') ?? '100k'
  const n = size === '1m' ? 1_000_000 : size === '100k' ? 100_000 : Number.NaN
  const build = BENCHES[shape]
  if (!build || Number.isNaN(n)) {
    console.error(
      `--shape=${Object.keys(BENCHES).join('|')} and --size=100k|1m`,
    )
    process.exit(1)
  }
  const rounds = Number(arg('rounds') ?? 25)

  warm(build(2_000), 300)
  const bench = build(n)
  warm(bench, 3)

  const expected = new CountingContext()
  bench.arms[0]!.paint(expected, bench.forward)

  const { arms } = bench
  const best = arms.map(() => Infinity)
  for (let r = 0; r < rounds; r++) {
    for (let k = 0; k < arms.length; k++) {
      const a = (r + k) % arms.length
      const ctx = new CountingContext()
      const t0 = performance.now()
      arms[a]!.paint(ctx, bench.forward)
      const ms = performance.now() - t0
      if (!sameCounts(ctx, expected)) {
        console.error(
          `TIMED RUN DIFFERS ${shape} ${arms[a]!.name} in round ${r}`,
        )
        process.exit(1)
      }
      best[a] = Math.min(best[a]!, ms)
    }
  }

  exitOnIdentityFailure(shape, bench)

  const power = execSync('cat /sys/class/power_supply/AC*/online')
    .toString()
    .trim()
  const uptime = execSync('uptime').toString().trim()
  console.log(`AC online: ${power}`)
  console.log(uptime)
  console.log(
    `--shape=${shape} --size=${size}, ${rounds} interleaved rounds, min per arm`,
  )
  console.log('identity: control and ported match retired, both orientations')
  const retired = best[0]!
  console.log(
    `${'shape'.padEnd(8)}${'entries'.padStart(9)}${'painted'.padStart(9)}${'styles'.padStart(9)}${'retired'.padStart(20)}${'control'.padStart(10)}${'ported'.padStart(10)}`,
  )
  console.log(
    `${shape.padEnd(8)}${String(bench.entries).padStart(9)}${String(expected.fills + expected.paths).padStart(9)}${String(expected.styles).padStart(9)}${`${retired.toFixed(2)}ms ${((retired / bench.entries) * 1e6).toFixed(1)}ns`.padStart(20)}${`${(best[1]! / retired).toFixed(2)}x`.padStart(10)}${`${(best[2]! / retired).toFixed(2)}x`.padStart(10)}`,
  )
}

main()
