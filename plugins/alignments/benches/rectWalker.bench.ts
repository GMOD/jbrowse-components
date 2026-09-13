// Does one shared, rule-coded rect walker paint at hand speed?
//
//   node --no-use-osr plugins/alignments/benches/rectWalker.bench.ts --size=100k
//   node --no-use-osr plugins/alignments/benches/rectWalker.bench.ts --size=1m
//
// Flags: --size=100k|1m (one per process), --rounds=<n> (default 25),
// --outline (the canvas rect arm strokes outlines)
//
// ARMS, per shape — span (render-core spanMark), deletion and mismatch
// (pileupShape), rect (canvas rectShape), cell (variants cellMark):
//
//   hand         today's painter, copied verbatim
//   control      a separately declared copy of hand
//   walker       `walkRects` below: one function literal over rule codes,
//                warmed with every consumer's channels, its production state
//   perShape     a copy of `walkRects` per shape, loaded as its own module
//                instance (`?copy=`) and warmed with that shape alone, standing
//                in for a generated per-shape walker
//   placed       rect and cell: the paint loop calls a module-level `place`
//                that writes one instance's box into a scratch `Float64Array`,
//                the placement ink and hit would read too; `place` calls the
//                generated scalar twins
//   placedFlat   the same with the twins' arithmetic written into `place`
//   placedSplit  rect: placedFlat's placement as an x and a y function
//   splitTwins   span, rect, cell: an x and a y placement function that call
//                the lifted twins, per-block values on a frame object
//   splitTwinsOut  rect and cell: splitTwins over bench-local out-parameter
//                copies of the pair twins (`rectSpanPx`, `snapVariantCellX`),
//                sizing a float2 emitter that writes into its caller's array
//   pileupShared deletion and mismatch: production `pileupShape`'s painter,
//                warmed with the same pileup marks as hand
//
// pileupShape's ten painters are closures of one function literal, so hand and
// control for deletion and mismatch are one factory each, warmed with every
// non-point pileup mark (skip, overlap, perBaseQuality and modification too).
// The walker is warmed with those as well. The point marks are left out of
// both: the prototype has no point rule.
//
// The walker takes scalar cores where a lifted twin returns a tuple or an
// object (`expandToMinWidthPx`, `rectSpanPx`, `snapVariantCellX`) and calls the
// scalar twins otherwise. Its projection stays two rules: `makeBpMapper` and the
// pileup's `bpToScreenX` differ by up to 2.3e-13 px on 43% of reversed
// positions, which an SVG export would serialize.
//
// IDENTITY. After timing and before anything prints, every arm and the
// production painter are recorded through `recordingContext` — rects plus every
// fillStyle, strokeStyle and lineWidth write, in order — in both orientations,
// and must match hand exactly; every arm's single-instance placements must
// match the painting. Every timed run is also checked against the production
// painter's counts and coordinate sum.
//
// THE HAND PAINTERS ARE BIMODAL, which is why every call before the timed
// rounds is a forward block on the counting stub and why OSR is off. `spanHand`
// calls two per-call closures per instance, and whether TurboFan inlines them
// depends on when a GC cleared their call feedback: a reversed block or a second
// context before timing, or OSR-compiled entry, put span's hand, control or both
// at 40-47 ns against 21-25, so the control read 0.60-1.72x. The walker arms
// hold no per-call closure.
//
// WHAT IT SAYS. 1M instances, four processes (two for placedSplit), AC power,
// load 2.0-3.9, min of 25 interleaved rounds, ratio to hand; one 100K process
// agrees within 0.05 on every cell:
//
//             hand ns    control    walker     perShape   placed     flat       split
//   span      21.1-21.8  1.00-1.02  1.09-1.13  0.86-0.88
//   deletion  94.5-97.7  0.99-1.02  0.75-0.77  0.69-0.71
//   mismatch  83.2-85.7  0.97-1.04  0.92-0.99  0.83-0.88
//   rect      56.3-58.9  0.97-1.00  0.79-0.96  0.70-0.72  0.74-0.79  0.73-0.77  0.68-0.69
//   cell      36.8-37.5  0.98-1.01  1.34-1.46  0.91-0.94  1.08-1.11  0.82-0.83
//
// The shared walker is refused: it misses hand speed on span and cell. Its one
// compile stops inlining with `snappedCellWidthPx`, `snapBoxTopPx` and
// `drawVariantShape` still candidates, and its keyed loads see every consumer's
// arrays. A per-shape copy of the same source beats hand on every shape.
//
// `placed` misses that copy by 6-10% on rect and 15-19% on cell, per process.
// TurboFan inlines no callee whose bytecode, counting what it already inlined,
// passes 460 bytes: `placeCell` is 186 + 371 and `placeRect` 343 + 464, so each
// instance pays a call. Written to inline, the same design beats the copy —
// `placedFlat` cell at 0.87-0.90x of perShape, and rect, whose flat placement is
// still over the limit, at 0.94-0.96x split in two.
//
// SPLIT PLACEMENT OVER THE TWINS. Three processes at 1M, AC, load 3.0-6.2, the
// controls 0.97-1.03x:
//
//             splitTwins   splitTwinsOut
//   span      0.93-0.95
//   rect      0.86-0.89    0.83-0.84
//   cell      0.98-1.00    1.01-1.06
//
// Bytecode against the 460-byte budget, own plus already inlined: `placeSpanX`
// 119 + 80-97 and `placeSpanY` 54 inline; `placeCellY` 74 and `placeCellX`
// 114 + 309 inline; `placeRectTwinY` 112 + 258 inlines, while `placeRectTwinX`
// at 277 + 317 does not, and neither does `placeRectTwinXOut` at 145 + 310 —
// the loop spends its cumulative budget on the y side first. `placeCellXOut`
// at 99 + 371 misses too, which is why the out-parameter cell is the slower
// one. So split placement over the lifted twins holds at or under hand on all
// three shapes, and a float2 emitter writing into the caller buys 3-5% on rect
// alone.
//
// ONE PLACEMENT FOR THE PILEUP. `pileupShared` times production `pileupShape`,
// whose `walk` states each instance's box and fade once: the painter walks the
// block, and `ink` and `hitNearest` walk one instance. Three processes at 1M,
// AC, load 0.7-2.1, the controls 0.99-1.01x: deletion 0.82-0.85x, mismatch
// 0.98-1.02x. The painter it replaced, which restated the geometry and the fade
// beside `inkRect`, measured 1.00x on both.
//
// A per-instance placement call does not fit TurboFan's budget. One process each
// at 1M, AC, load 2.0-2.7, controls 0.93-1.01x:
//
//                                          deletion   mismatch
//   `place(c, frame, i, out)` per instance    1.20x      1.32x
//   `placeRow`, `placeFade`, `placeX`          1.22x      1.12x
//
// `place` is 811 bytes of bytecode, over the 460 any callee may be. Split,
// `placeRow` (101 + 75) and `placeX` (223) inline and `placeFade` (436 + 391)
// never does: a callee's bytecode counts against the 920-byte cumulative budget,
// and the same statements in the loop body cost none of it. The walk that does
// fit has no slack. `spanRectPx`, destructured at 245 bytes, runs out of line
// with boxed arguments; indexed at 103 bytes it inlines and deletion reaches
// 0.89x, but `qualityFade`'s `_smoothstep` then falls out of the budget and
// mismatch reads 1.09x. One `frequencyFade` call site for the four rules that
// fade by frequency, instead of one per rule, returns the 84-byte chain and gives
// both shapes the numbers above.

import { execSync } from 'node:child_process'
import { performance } from 'node:perf_hooks'

import { fillSpanRect, insertionSizeAlpha } from '@jbrowse/alignments-core'
import {
  abgrAlpha,
  abgrBlue,
  abgrGreen,
  abgrRed,
} from '@jbrowse/core/util/colorBits'
import {
  makeBpMapper,
  spanLeft,
  strokeRectInside,
} from '@jbrowse/render-core/canvas2dUtils'
import { spanMark } from '@jbrowse/render-core/marks'
import {
  abgrToCssRgba,
  makeAbgrFill,
} from '@jbrowse/render-core/marks/colorFill'
import { recordingContext } from '@jbrowse/render-core/marks/drawAgainstHit'
import {
  extendToMinWidthPx,
  snapBoxHeightPx,
  snapBoxTopPx,
} from '@jbrowse/render-core/shaders/hpmath'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '@jbrowse/render-core/shaders/rowRect'

import { rectShape } from '../../canvas/src/LinearBasicDisplay/marks/featureGlyphShapes.ts'
import { MIN_DENSITY_ALPHA } from '../../canvas/src/LinearBasicDisplay/passes/shaders/rect.consts.generated.ts'
import {
  rectDrawsOutline,
  rectSpanPx,
} from '../../canvas/src/LinearBasicDisplay/passes/shaders/rect.js.generated.ts'
import { cellMark } from '../../variants/src/LinearMultiSampleVariantDisplay/components/cellMark.ts'
import {
  SHAPE_RECT,
  SHAPE_TRI_LEFT,
} from '../../variants/src/LinearMultiSampleVariantDisplay/components/shaders/variant.consts.generated.ts'
import {
  drawnCellHeightPx,
  snappedCellLeftPx,
  snappedCellWidthPx,
} from '../../variants/src/LinearMultiSampleVariantDisplay/components/shaders/variant.js.generated.ts'
import { snapVariantCellX } from '../../variants/src/LinearMultiSampleVariantDisplay/components/snapVariantCellX.ts'
import { drawVariantShape } from '../../variants/src/LinearMultiSampleVariantDisplay/components/variantShape.ts'
import {
  rgb255,
  rgba255,
  rgbaPrefix255,
} from '../src/LinearAlignmentsDisplay/colorUtils.ts'
import {
  insertionBarWidth,
  LONG_INSERTION_MIN_LENGTH,
} from '../src/LinearAlignmentsDisplay/constants.ts'
import {
  bpToScreenX,
  frequencyFade,
  intronAlpha,
  makePileupCellMapper,
  pileupRowOffCanvas,
  pileupRowY,
  sizeAlpha,
} from '../src/LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import { DELETION_MARK, packGaps } from '../src/features/gap/mark.ts'
import {
  buildBaseCssMap,
  buildBaseFadeCssMap,
} from '../src/features/mismatch/baseColors.ts'
import { MISMATCH_MARK } from '../src/features/mismatch/mark.ts'
import { qualityCssColors } from '../src/features/perBaseQuality/colors.ts'
import {
  Band,
  Fade,
  Hit,
  Paint,
  Point,
  markSelects,
  pileupShape,
} from '../src/features/pileupShape.ts'
import { frequencyFadeGate } from '../src/shaders/slang/alignmentsUniforms.js.generated.ts'
import {
  GAP_DELETION,
  GAP_SKIP,
} from '../src/shaders/slang/gap.consts.generated.ts'
import * as gapShader from '../src/shaders/slang/gap.generated.ts'
import { qualityFade } from '../src/shaders/slang/mismatch.js.generated.ts'
import {
  overlapAlpha,
  overlapFade,
} from '../src/shaders/slang/overlap.js.generated.ts'

import type { FeatureGlyphParams } from '../../canvas/src/LinearBasicDisplay/marks/featureGlyphShapes.ts'
import type {
  CellChannels,
  CellParams,
} from '../../variants/src/LinearMultiSampleVariantDisplay/components/cellMark.ts'
import type { RenderState } from '../src/LinearAlignmentsDisplay/renderers/rendererTypes.ts'
import type {
  PileupChannels,
  PileupShapeSpec,
} from '../src/features/pileupShape.ts'
import type {
  MarkContext2D,
  MarkFrame,
  SpanChannels,
  SpanParams,
} from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

const WLayout = { pair: 0, interleaved: 1, single: 2 } as const
const WX = {
  floor: 0,
  midpoint: 1,
  cell: 2,
  rectSnap: 3,
  variantSnap: 4,
} as const
const WY = { rowBand: 0, pileupRow: 1, snapBox: 2, cellRow: 3 } as const
const WFade = {
  opaque: 0,
  spanFrequencySize: 1,
  cellFrequencyQuality: 2,
  overlap: 3,
} as const
const WFill = {
  abgrRun: 0,
  abgrFade: 1,
  palette: 2,
  packedRun: 3,
  constant: 4,
} as const
const WGlyph = { rect: 0, variant: 1 } as const

const GLYPH_Y_SLACK_PX = 8

export interface WalkPlan {
  layout: number
  x: number
  y: number
  fade: number
  fill: number
  glyph: number
  kind: number
  reversed: boolean
  bpStart: number
  bpEnd: number
  bpSpan: number
  pxStart: number
  pxEnd: number
  pxSpan: number
  minWidthPx: number
  seamPx: number
  cellShift: number
  cellWidth: number
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  rowOffset: number
  rowPitch: number
  topOffset: number
  bandOffset: number
  bandHeight: number
  scrollTop: number
  featureHeight: number
  pxPerBp: number
  filterByFrequency: boolean
  mismatchAlpha: boolean
  chainMode: boolean
  constantAlpha: number
  opaqueCss: readonly string[]
  fadedCss: readonly string[]
  constantCss: string | undefined
  outlineStyle: string | undefined
}

export interface WalkChannels {
  start: ArrayLike<number>
  end: ArrayLike<number> | undefined
  row: ArrayLike<number> | undefined
  top: ArrayLike<number> | undefined
  height: ArrayLike<number> | undefined
  color: ArrayLike<number> | undefined
  fade: ArrayLike<number> | undefined
  glyph: ArrayLike<number> | undefined
  kinds: ArrayLike<number> | undefined
  freqs: ArrayLike<number> | undefined
  quals: ArrayLike<number> | undefined
  from: number
  to: number
}

export function walkRects(
  ctx: MarkContext2D | undefined,
  p: WalkPlan,
  c: WalkChannels,
  from: number,
  to: number,
  out: Float64Array | undefined,
) {
  const { start, end, row, top: tops, height: heights, color } = c
  const { fade: fades, glyph, kinds, freqs, quals } = c
  const { layout, x: xRule, y: yRule, fade, fill, glyph: glyphRule } = p
  const { kind, reversed, bpStart, bpEnd, bpSpan, pxStart, pxEnd, pxSpan } = p
  const { minWidthPx, seamPx, cellShift, cellWidth, canvasWidth } = p
  const { canvasHeight, rowHeight, rowOffset, rowPitch, topOffset } = p
  const { bandOffset, bandHeight, scrollTop, featureHeight, pxPerBp } = p
  const { filterByFrequency, mismatchAlpha, chainMode, constantAlpha } = p
  const { opaqueCss, fadedCss, constantCss, outlineStyle } = p
  if (out === undefined) {
    if (constantCss !== undefined) {
      ctx!.fillStyle = constantCss
    }
    if (outlineStyle !== undefined) {
      ctx!.strokeStyle = outlineStyle
      ctx!.lineWidth = 1
    }
  }
  let lastKey = -1
  let lastCss = ''
  for (let i = from; i < to; i++) {
    if (kinds !== undefined && kinds[i] !== kind) {
      continue
    }
    let top = 0
    let height = bandHeight
    switch (yRule) {
      case WY.rowBand: {
        top = rowOffset + rowHeight * row![i]! - scrollTop
        break
      }
      case WY.pileupRow: {
        const rowY = row![i]! * rowPitch + topOffset - scrollTop
        if (rowY + featureHeight < -1 || rowY > canvasHeight + 1) {
          continue
        }
        top = rowY + bandOffset
        break
      }
      case WY.snapBox: {
        const boxTop = tops![i]!
        const boxHeight = heights![i]!
        const visibleTop = boxTop - scrollTop
        if (
          !(
            visibleTop + boxHeight >= -GLYPH_Y_SLACK_PX &&
            visibleTop <= canvasHeight + GLYPH_Y_SLACK_PX
          )
        ) {
          continue
        }
        top = snapBoxTopPx(boxTop, boxHeight, scrollTop)
        height = snapBoxHeightPx(boxHeight)
        break
      }
      case WY.cellRow: {
        top = row![i]! * rowHeight - scrollTop
        if (!(top + bandHeight >= 0 && top <= canvasHeight)) {
          continue
        }
        break
      }
    }
    let a = 0
    let b = 0
    switch (layout) {
      case WLayout.pair: {
        a = start[i]!
        b = end![i]!
        break
      }
      case WLayout.interleaved: {
        a = start[i * 2]!
        b = start[i * 2 + 1]!
        break
      }
      case WLayout.single: {
        a = start[i]!
        b = a + 1
        break
      }
    }
    let alpha = constantAlpha
    switch (fade) {
      case WFade.spanFrequencySize: {
        const widthPx = (b - a) * pxPerBp
        alpha =
          frequencyFadeGate(
            widthPx * widthPx,
            freqs![i]! / 255,
            filterByFrequency,
          ) * sizeAlpha(widthPx)
        break
      }
      case WFade.cellFrequencyQuality: {
        const widthPx = (b - a) * pxPerBp
        alpha =
          frequencyFadeGate(widthPx, freqs![i]! / 255, filterByFrequency) *
          qualityFade(quals![i]!, mismatchAlpha)
        break
      }
      case WFade.overlap: {
        const widthPx = (b - a) * pxPerBp
        alpha = chainMode ? overlapFade(widthPx) : overlapAlpha(widthPx)
        break
      }
    }
    if (!(alpha > 0)) {
      continue
    }
    let left = 0
    let width = 0
    switch (xRule) {
      case WX.floor: {
        const xa = reversed
          ? pxEnd - ((a - bpStart) / bpSpan) * pxSpan
          : pxStart + ((a - bpStart) / bpSpan) * pxSpan
        const xb = reversed
          ? pxEnd - ((b - bpStart) / bpSpan) * pxSpan
          : pxStart + ((b - bpStart) / bpSpan) * pxSpan
        const floored = Math.max(minWidthPx, Math.abs(xb - xa))
        left = xb < xa ? xa - floored : xa
        width = floored + seamPx
        break
      }
      case WX.midpoint: {
        const x1 =
          pxStart + ((reversed ? bpEnd - a : a - bpStart) / bpSpan) * pxSpan
        const x2 =
          pxStart + ((reversed ? bpEnd - b : b - bpStart) / bpSpan) * pxSpan
        const lo = x1 < x2 ? x1 : x2
        const hi = x1 < x2 ? x2 : x1
        let right = hi
        left = lo
        if (hi - lo < 1) {
          const mid = (lo + hi) * 0.5
          left = mid - 0.5
          right = mid + 0.5
        }
        width = Math.max(hi - lo + seamPx, right - left)
        break
      }
      case WX.cell: {
        left =
          (reversed
            ? pxEnd - ((a - bpStart) / bpSpan) * pxSpan
            : pxStart + ((a - bpStart) / bpSpan) * pxSpan) + cellShift
        width = cellWidth
        break
      }
      case WX.rectSnap: {
        const x1 = reversed
          ? pxEnd - ((a - bpStart) / bpSpan) * pxSpan
          : pxStart + ((a - bpStart) / bpSpan) * pxSpan
        let s1 = 0
        let s2 = 0
        if (a === b) {
          s1 = Math.floor(x1 - 1 + 0.5)
          s2 = Math.floor(x1 + 1 + 0.5)
        } else {
          const x2 = reversed
            ? pxEnd - ((b - bpStart) / bpSpan) * pxSpan
            : pxStart + ((b - bpStart) / bpSpan) * pxSpan
          s1 = Math.floor(x1 + 0.5)
          s2 = extendToMinWidthPx(s1, Math.floor(x2 + 0.5), 2)
        }
        width = Math.abs(s2 - s1)
        left = s2 < s1 ? s1 - width : s1
        break
      }
      case WX.variantSnap: {
        const x1 = reversed
          ? pxEnd - ((a - bpStart) / bpSpan) * pxSpan
          : pxStart + ((a - bpStart) / bpSpan) * pxSpan
        const x2 = reversed
          ? pxEnd - ((b - bpStart) / bpSpan) * pxSpan
          : pxStart + ((b - bpStart) / bpSpan) * pxSpan
        width = snappedCellWidthPx(x1, x2, canvasWidth)
        left = snappedCellLeftPx(x1, x2, canvasWidth, width)
        break
      }
    }
    if (out !== undefined) {
      out[0] = left
      out[1] = top
      out[2] = width
      out[3] = height
      return true
    }
    switch (fill) {
      case WFill.abgrRun: {
        const key = color![i]!
        if (key !== lastKey) {
          lastKey = key
          ctx!.fillStyle = abgrToCssRgba(key)
        }
        break
      }
      case WFill.abgrFade: {
        const abgr = color![i]!
        const faded = fades![i]!
        const key = faded ? abgr + 0x1_0000_0000 : abgr
        if (key !== lastKey) {
          lastKey = key
          const alphaOut =
            (abgrAlpha(abgr) / 255) * (faded ? MIN_DENSITY_ALPHA : 1)
          ctx!.fillStyle = `rgba(${abgrRed(abgr)},${abgrGreen(abgr)},${abgrBlue(abgr)},${alphaOut})`
        }
        break
      }
      case WFill.palette: {
        const key = color === undefined ? 0 : color[i]!
        ctx!.fillStyle =
          alpha >= 1 ? opaqueCss[key]! : `${fadedCss[key]!}${alpha})`
        break
      }
      case WFill.packedRun: {
        const key = color![i]!
        if (key !== lastKey) {
          lastKey = key
          lastCss = abgrToCssRgba(key)
        }
        ctx!.fillStyle = lastCss
        break
      }
    }
    switch (glyphRule) {
      case WGlyph.rect: {
        ctx!.fillRect(left, top, width, height)
        if (outlineStyle !== undefined && rectDrawsOutline(width, height)) {
          strokeRectInside(ctx!, left, top, width, height)
        }
        break
      }
      case WGlyph.variant: {
        drawVariantShape(ctx!, glyph![i]!, left, top, width, height)
        break
      }
    }
  }
  return false
}

class CountingContext implements MarkContext2D {
  fills = 0
  styles = 0
  strokes = 0
  paths = 0
  sum = 0
  style: MarkContext2D['fillStyle'] = ''
  strokeStyle: MarkContext2D['strokeStyle'] = ''
  lineWidth = 1
  get fillStyle() {
    return this.style
  }
  set fillStyle(v: MarkContext2D['fillStyle']) {
    this.style = v
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

function spanHand(
  ctx: MarkContext2D,
  channels: SpanChannels,
  block: RenderBlock,
  _frame: MarkFrame,
  params: SpanParams,
) {
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
}

function spanControl(
  ctx: MarkContext2D,
  channels: SpanChannels,
  block: RenderBlock,
  _frame: MarkFrame,
  params: SpanParams,
) {
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
}

type PileupPaintSpec = Pick<
  PileupShapeSpec,
  'pivot' | 'fade' | 'band' | 'contiguous' | 'point' | 'paint' | 'decorate'
>

const CLIP_BAR_WIDTH_PX = 1

function pointWidthPx(
  point: number,
  c: PileupChannels,
  index: number,
  pxPerBp: number,
  featureHeight: number,
) {
  return point === Point.insertionBar
    ? insertionBarWidth(c.lengths![index]!, pxPerBp, featureHeight)
    : CLIP_BAR_WIDTH_PX
}

function pileupHand(spec: PileupPaintSpec) {
  const { pivot, fade, band, contiguous, point, decorate } = spec
  const paintTables = spec.paint
  const centerline = band === Band.centerline
  return {
    paintBlock(
      ctx: MarkContext2D,
      c: PileupChannels,
      block: RenderBlock,
      _frame: MarkFrame,
      state: RenderState,
    ) {
      const { positions, stride, rows, kinds, kind, freqs, quals, lengths } = c
      const { keys, end } = c
      const { rule: paintRule, opaqueCss, fadedCss } = paintTables(state)
      const bpLength = block.end - block.start
      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const featureHeight = state.featureHeight
      const mismatchAlpha = state.mismatchAlpha
      const chainMode = state.chainMode
      const constantAlpha =
        fade === Fade.intron ? intronAlpha(featureHeight) : 1
      const pxPerBp = fullBlockWidth / bpLength
      const bandOffset = centerline ? featureHeight / 2 - 0.5 : 0
      const bandHeight = centerline ? 1 : featureHeight
      const constantCss =
        keys === undefined && (fade === Fade.opaque || fade === Fade.intron)
          ? constantAlpha >= 1
            ? opaqueCss[0]!
            : `${fadedCss[0]!}${constantAlpha})`
          : undefined
      if (constantCss !== undefined) {
        ctx.fillStyle = constantCss
      }
      let lastKey = -1
      let lastCss = ''
      const cell =
        pivot === 'cell'
          ? makePileupCellMapper(block, bpLength, fullBlockWidth, contiguous)
          : undefined
      for (let i = c.start; i < end; i++) {
        if (markSelects(kinds, kind, i)) {
          const rowY = pileupRowY(rows[i]!, state)
          if (!pileupRowOffCanvas(rowY, state)) {
            const offset = i * stride
            const startBp = positions[offset]!
            const widthPx =
              point === undefined
                ? ((stride === 2 ? positions[offset + 1]! : startBp + 1) -
                    startBp) *
                  pxPerBp
                : pointWidthPx(point, c, i, pxPerBp, featureHeight)
            let alpha = constantAlpha
            switch (fade) {
              case Fade.opaque:
              case Fade.intron: {
                break
              }
              case Fade.spanFrequencySize: {
                alpha =
                  frequencyFade(state, widthPx * widthPx, freqs![i]!) *
                  sizeAlpha(widthPx)
                break
              }
              case Fade.cellFrequencyQuality: {
                alpha =
                  frequencyFade(state, widthPx, freqs![i]!) *
                  qualityFade(quals![i]!, mismatchAlpha)
                break
              }
              case Fade.overlap: {
                alpha = chainMode ? overlapFade(widthPx) : overlapAlpha(widthPx)
                break
              }
              case Fade.insertion: {
                const length = lengths![i]!
                alpha =
                  (length >= LONG_INSERTION_MIN_LENGTH
                    ? 1
                    : frequencyFade(state, pxPerBp * pxPerBp, freqs![i]!)) *
                  insertionSizeAlpha(length, pxPerBp)
                break
              }
              case Fade.pointFrequency: {
                alpha = frequencyFade(state, pxPerBp, freqs![i]!)
                break
              }
            }
            if (alpha > 0) {
              if (constantCss === undefined) {
                const key = keys === undefined ? 0 : keys[i]!
                if (paintRule === Paint.packedAbgr) {
                  if (key !== lastKey) {
                    lastKey = key
                    lastCss = abgrToCssRgba(key)
                  }
                  ctx.fillStyle = lastCss
                } else {
                  ctx.fillStyle =
                    alpha >= 1 ? opaqueCss[key]! : `${fadedCss[key]!}${alpha})`
                }
              }
              const top = rowY + bandOffset
              if (point !== undefined) {
                const x = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
                ctx.fillRect(x - widthPx / 2, top, widthPx, bandHeight)
                decorate?.draw(ctx, x, top, bandHeight, c, i, pxPerBp)
              } else if (cell !== undefined) {
                ctx.fillRect(cell.cellX(startBp), top, cell.w, bandHeight)
              } else {
                const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
                const x2 = bpToScreenX(
                  positions[offset + 1]!,
                  block,
                  bpLength,
                  fullBlockWidth,
                )
                const lo = x1 < x2 ? x1 : x2
                const hi = x1 < x2 ? x2 : x1
                fillSpanRect(ctx, lo, hi, top, bandHeight)
              }
            }
          }
        }
      }
    },
  }
}

function pileupControl(spec: PileupPaintSpec) {
  const { pivot, fade, band, contiguous, point, decorate } = spec
  const paintTables = spec.paint
  const centerline = band === Band.centerline
  return {
    paintBlock(
      ctx: MarkContext2D,
      c: PileupChannels,
      block: RenderBlock,
      _frame: MarkFrame,
      state: RenderState,
    ) {
      const { positions, stride, rows, kinds, kind, freqs, quals, lengths } = c
      const { keys, end } = c
      const { rule: paintRule, opaqueCss, fadedCss } = paintTables(state)
      const bpLength = block.end - block.start
      const fullBlockWidth = block.screenEndPx - block.screenStartPx
      const featureHeight = state.featureHeight
      const mismatchAlpha = state.mismatchAlpha
      const chainMode = state.chainMode
      const constantAlpha =
        fade === Fade.intron ? intronAlpha(featureHeight) : 1
      const pxPerBp = fullBlockWidth / bpLength
      const bandOffset = centerline ? featureHeight / 2 - 0.5 : 0
      const bandHeight = centerline ? 1 : featureHeight
      const constantCss =
        keys === undefined && (fade === Fade.opaque || fade === Fade.intron)
          ? constantAlpha >= 1
            ? opaqueCss[0]!
            : `${fadedCss[0]!}${constantAlpha})`
          : undefined
      if (constantCss !== undefined) {
        ctx.fillStyle = constantCss
      }
      let lastKey = -1
      let lastCss = ''
      const cell =
        pivot === 'cell'
          ? makePileupCellMapper(block, bpLength, fullBlockWidth, contiguous)
          : undefined
      for (let i = c.start; i < end; i++) {
        if (markSelects(kinds, kind, i)) {
          const rowY = pileupRowY(rows[i]!, state)
          if (!pileupRowOffCanvas(rowY, state)) {
            const offset = i * stride
            const startBp = positions[offset]!
            const widthPx =
              point === undefined
                ? ((stride === 2 ? positions[offset + 1]! : startBp + 1) -
                    startBp) *
                  pxPerBp
                : pointWidthPx(point, c, i, pxPerBp, featureHeight)
            let alpha = constantAlpha
            switch (fade) {
              case Fade.opaque:
              case Fade.intron: {
                break
              }
              case Fade.spanFrequencySize: {
                alpha =
                  frequencyFade(state, widthPx * widthPx, freqs![i]!) *
                  sizeAlpha(widthPx)
                break
              }
              case Fade.cellFrequencyQuality: {
                alpha =
                  frequencyFade(state, widthPx, freqs![i]!) *
                  qualityFade(quals![i]!, mismatchAlpha)
                break
              }
              case Fade.overlap: {
                alpha = chainMode ? overlapFade(widthPx) : overlapAlpha(widthPx)
                break
              }
              case Fade.insertion: {
                const length = lengths![i]!
                alpha =
                  (length >= LONG_INSERTION_MIN_LENGTH
                    ? 1
                    : frequencyFade(state, pxPerBp * pxPerBp, freqs![i]!)) *
                  insertionSizeAlpha(length, pxPerBp)
                break
              }
              case Fade.pointFrequency: {
                alpha = frequencyFade(state, pxPerBp, freqs![i]!)
                break
              }
            }
            if (alpha > 0) {
              if (constantCss === undefined) {
                const key = keys === undefined ? 0 : keys[i]!
                if (paintRule === Paint.packedAbgr) {
                  if (key !== lastKey) {
                    lastKey = key
                    lastCss = abgrToCssRgba(key)
                  }
                  ctx.fillStyle = lastCss
                } else {
                  ctx.fillStyle =
                    alpha >= 1 ? opaqueCss[key]! : `${fadedCss[key]!}${alpha})`
                }
              }
              const top = rowY + bandOffset
              if (point !== undefined) {
                const x = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
                ctx.fillRect(x - widthPx / 2, top, widthPx, bandHeight)
                decorate?.draw(ctx, x, top, bandHeight, c, i, pxPerBp)
              } else if (cell !== undefined) {
                ctx.fillRect(cell.cellX(startBp), top, cell.w, bandHeight)
              } else {
                const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
                const x2 = bpToScreenX(
                  positions[offset + 1]!,
                  block,
                  bpLength,
                  fullBlockWidth,
                )
                const lo = x1 < x2 ? x1 : x2
                const hi = x1 < x2 ? x2 : x1
                fillSpanRect(ctx, lo, hi, top, bandHeight)
              }
            }
          }
        }
      }
    },
  }
}

interface RectChannelsLike {
  startEnd: Uint32Array
  y: Float32Array
  height: Float32Array
  color: Uint32Array
  densityFade: Uint32Array
  strand: Float32Array
  count: number
}

function rowVisibleHand(
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

function makeRectFillHand(ctx: MarkContext2D) {
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

function paintedRectSpanHand(
  startBp: number,
  endBp: number,
  toX: (bp: number) => number,
): [xLeft: number, width: number] {
  const [sx1, sx2] = rectSpanPx(toX(startBp), toX(endBp), startBp === endBp)
  const width = Math.abs(sx2 - sx1)
  return [spanLeft(sx1, sx2, width), width]
}

function rectHand(
  ctx: MarkContext2D,
  channels: RectChannelsLike,
  block: RenderBlock,
  frame: MarkFrame,
  params: FeatureGlyphParams,
) {
  const { startEnd, y: ys, height, color, densityFade, count } = channels
  const { scrollY, outlineColor } = params
  const { canvasHeight } = frame
  const toX = makeBpMapper(block)
  const setFill = makeRectFillHand(ctx)
  const outlineStyle = outlineColor ? abgrToCssRgba(outlineColor) : undefined
  if (outlineStyle !== undefined) {
    ctx.strokeStyle = outlineStyle
    ctx.lineWidth = 1
  }
  for (let i = 0; i < count; i++) {
    if (!rowVisibleHand(scrollY, canvasHeight, ys[i]!, height[i]!)) {
      continue
    }
    const y = snapBoxTopPx(ys[i]!, height[i]!, scrollY)
    const h = snapBoxHeightPx(height[i]!)
    const [xLeft, w] = paintedRectSpanHand(
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

function rectControl(
  ctx: MarkContext2D,
  channels: RectChannelsLike,
  block: RenderBlock,
  frame: MarkFrame,
  params: FeatureGlyphParams,
) {
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
}

function cellHand(
  ctx: MarkContext2D,
  channels: CellChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: CellParams,
) {
  const { startEnd, row, shapeType, color, count } = channels
  const { canvasWidth, canvasHeight } = frame
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
        canvasWidth,
      )
      setFill(color[i]!)
      drawVariantShape(ctx, shapeType[i]!, x, y, width, h)
    }
  }
}

function cellControl(
  ctx: MarkContext2D,
  channels: CellChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: CellParams,
) {
  const { startEnd, row, shapeType, color, count } = channels
  const { canvasWidth, canvasHeight } = frame
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
        canvasWidth,
      )
      setFill(color[i]!)
      drawVariantShape(ctx, shapeType[i]!, x, y, width, h)
    }
  }
}

interface BlockPx {
  reversed: boolean
  bpStart: number
  bpSpan: number
  pxStart: number
  pxEnd: number
  pxSpan: number
}

function mapperPx(p: BlockPx, bp: number) {
  return p.reversed
    ? p.pxEnd - ((bp - p.bpStart) / p.bpSpan) * p.pxSpan
    : p.pxStart + ((bp - p.bpStart) / p.bpSpan) * p.pxSpan
}

interface CellFrame extends BlockPx {
  canvasWidth: number
  canvasHeight: number
  rowHeight: number
  scrollTop: number
  height: number
}

function cellFrameOf(
  block: RenderBlock,
  frame: MarkFrame,
  params: CellParams,
): CellFrame {
  return {
    ...blockProjection(block),
    canvasWidth: frame.canvasWidth,
    canvasHeight: frame.canvasHeight,
    rowHeight: params.rowHeight,
    scrollTop: params.scrollTop,
    height: drawnCellHeightPx(params.rowHeight),
  }
}

const CELL_BOX = new Float64Array(4)

function placeCell(
  c: CellChannels,
  g: CellFrame,
  i: number,
  out: Float64Array,
) {
  const top = c.row[i]! * g.rowHeight - g.scrollTop
  if (!(top + g.height >= 0 && top <= g.canvasHeight)) {
    return false
  }
  const x1 = mapperPx(g, c.startEnd[i * 2]!)
  const x2 = mapperPx(g, c.startEnd[i * 2 + 1]!)
  const width = snappedCellWidthPx(x1, x2, g.canvasWidth)
  out[0] = snappedCellLeftPx(x1, x2, g.canvasWidth, width)
  out[1] = top
  out[2] = width
  out[3] = g.height
  return true
}

function cellPlaced(
  ctx: MarkContext2D,
  c: CellChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: CellParams,
) {
  const { shapeType, color, count } = c
  const g = cellFrameOf(block, frame, params)
  let last = -1
  for (let i = 0; i < count; i++) {
    if (placeCell(c, g, i, CELL_BOX)) {
      const abgr = color[i]!
      if (abgr !== last) {
        last = abgr
        ctx.fillStyle = abgrToCssRgba(abgr)
      }
      drawVariantShape(
        ctx,
        shapeType[i]!,
        CELL_BOX[0]!,
        CELL_BOX[1]!,
        CELL_BOX[2]!,
        CELL_BOX[3]!,
      )
    }
  }
}

function cellPlacedInk(
  c: CellChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: CellParams,
  i: number,
) {
  return placeCell(c, cellFrameOf(block, frame, params), i, CELL_BOX)
    ? [CELL_BOX[0]!, CELL_BOX[1]!, CELL_BOX[2]!, CELL_BOX[3]!]
    : undefined
}

interface RectFrame extends BlockPx {
  canvasHeight: number
  scrollY: number
}

function rectFrameOf(
  block: RenderBlock,
  frame: MarkFrame,
  params: FeatureGlyphParams,
): RectFrame {
  return {
    ...blockProjection(block),
    canvasHeight: frame.canvasHeight,
    scrollY: params.scrollY,
  }
}

const RECT_BOX = new Float64Array(4)

function placeRect(
  c: RectChannelsLike,
  g: RectFrame,
  i: number,
  out: Float64Array,
) {
  const boxTop = c.y[i]!
  const boxHeight = c.height[i]!
  const visibleTop = boxTop - g.scrollY
  if (
    !(
      visibleTop + boxHeight >= -GLYPH_Y_SLACK_PX &&
      visibleTop <= g.canvasHeight + GLYPH_Y_SLACK_PX
    )
  ) {
    return false
  }
  const startBp = c.startEnd[i * 2]!
  const endBp = c.startEnd[i * 2 + 1]!
  const x1 = mapperPx(g, startBp)
  let s1 = 0
  let s2 = 0
  if (startBp === endBp) {
    s1 = Math.floor(x1 - 1 + 0.5)
    s2 = Math.floor(x1 + 1 + 0.5)
  } else {
    s1 = Math.floor(x1 + 0.5)
    s2 = extendToMinWidthPx(s1, Math.floor(mapperPx(g, endBp) + 0.5), 2)
  }
  const width = Math.abs(s2 - s1)
  out[0] = s2 < s1 ? s1 - width : s1
  out[1] = snapBoxTopPx(boxTop, boxHeight, g.scrollY)
  out[2] = width
  out[3] = snapBoxHeightPx(boxHeight)
  return true
}

function rectPlaced(
  ctx: MarkContext2D,
  c: RectChannelsLike,
  block: RenderBlock,
  frame: MarkFrame,
  params: FeatureGlyphParams,
) {
  const { color, densityFade, count } = c
  const g = rectFrameOf(block, frame, params)
  const outlineStyle = params.outlineColor
    ? abgrToCssRgba(params.outlineColor)
    : undefined
  if (outlineStyle !== undefined) {
    ctx.strokeStyle = outlineStyle
    ctx.lineWidth = 1
  }
  let last = -1
  for (let i = 0; i < count; i++) {
    if (placeRect(c, g, i, RECT_BOX)) {
      const abgr = color[i]!
      const faded = densityFade[i]!
      const key = faded ? abgr + 0x1_0000_0000 : abgr
      if (key !== last) {
        last = key
        const alpha = (abgrAlpha(abgr) / 255) * (faded ? MIN_DENSITY_ALPHA : 1)
        ctx.fillStyle = `rgba(${abgrRed(abgr)},${abgrGreen(abgr)},${abgrBlue(abgr)},${alpha})`
      }
      const left = RECT_BOX[0]!
      const top = RECT_BOX[1]!
      const width = RECT_BOX[2]!
      const height = RECT_BOX[3]!
      ctx.fillRect(left, top, width, height)
      if (outlineStyle !== undefined && rectDrawsOutline(width, height)) {
        strokeRectInside(ctx, left, top, width, height)
      }
    }
  }
}

function rectPlacedInk(
  c: RectChannelsLike,
  block: RenderBlock,
  frame: MarkFrame,
  params: FeatureGlyphParams,
  i: number,
) {
  return placeRect(c, rectFrameOf(block, frame, params), i, RECT_BOX)
    ? [RECT_BOX[0]!, RECT_BOX[1]!, RECT_BOX[2]!, RECT_BOX[3]!]
    : undefined
}

interface FlatPx {
  origin: number
  dir: number
  bpStart: number
  bpSpan: number
  pxSpan: number
}

function flatPx(block: RenderBlock): FlatPx {
  return {
    origin: block.reversed ? block.screenEndPx : block.screenStartPx,
    dir: block.reversed ? -1 : 1,
    bpStart: block.start,
    bpSpan: block.end - block.start,
    pxSpan: block.screenEndPx - block.screenStartPx,
  }
}

interface CellFlatFrame extends FlatPx {
  half: number
  canvasHeight: number
  rowHeight: number
  scrollTop: number
  height: number
}

function cellFlatFrameOf(
  block: RenderBlock,
  frame: MarkFrame,
  params: CellParams,
): CellFlatFrame {
  return {
    ...flatPx(block),
    half: frame.canvasWidth * 0.5,
    canvasHeight: frame.canvasHeight,
    rowHeight: params.rowHeight,
    scrollTop: params.scrollTop,
    height: drawnCellHeightPx(params.rowHeight),
  }
}

const CELL_FLAT_BOX = new Float64Array(4)

function placeCellFlat(
  c: CellChannels,
  g: CellFlatFrame,
  i: number,
  out: Float64Array,
) {
  const { origin, dir, bpStart, bpSpan, pxSpan, half, height } = g
  const top = c.row[i]! * g.rowHeight - g.scrollTop
  if (!(top + height >= 0 && top <= g.canvasHeight)) {
    return false
  }
  const x1 = origin + dir * (((c.startEnd[i * 2]! - bpStart) / bpSpan) * pxSpan)
  const x2 =
    origin + dir * (((c.startEnd[i * 2 + 1]! - bpStart) / bpSpan) * pxSpan)
  const edge1 = Math.floor(x1 - half + 0.5) + half
  const span = Math.abs(Math.floor(x2 - half + 0.5) + half - edge1)
  const width = span > 2 ? span : 2
  out[0] = x2 < x1 ? edge1 - width : edge1
  out[1] = top
  out[2] = width
  out[3] = height
  return true
}

function cellPlacedFlat(
  ctx: MarkContext2D,
  c: CellChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: CellParams,
) {
  const { shapeType, color, count } = c
  const g = cellFlatFrameOf(block, frame, params)
  let last = -1
  for (let i = 0; i < count; i++) {
    if (placeCellFlat(c, g, i, CELL_FLAT_BOX)) {
      const abgr = color[i]!
      if (abgr !== last) {
        last = abgr
        ctx.fillStyle = abgrToCssRgba(abgr)
      }
      drawVariantShape(
        ctx,
        shapeType[i]!,
        CELL_FLAT_BOX[0]!,
        CELL_FLAT_BOX[1]!,
        CELL_FLAT_BOX[2]!,
        CELL_FLAT_BOX[3]!,
      )
    }
  }
}

function cellPlacedFlatInk(
  c: CellChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: CellParams,
  i: number,
) {
  return placeCellFlat(
    c,
    cellFlatFrameOf(block, frame, params),
    i,
    CELL_FLAT_BOX,
  )
    ? [
        CELL_FLAT_BOX[0]!,
        CELL_FLAT_BOX[1]!,
        CELL_FLAT_BOX[2]!,
        CELL_FLAT_BOX[3]!,
      ]
    : undefined
}

interface RectFlatFrame extends FlatPx {
  canvasHeight: number
  scrollY: number
}

function rectFlatFrameOf(
  block: RenderBlock,
  frame: MarkFrame,
  params: FeatureGlyphParams,
): RectFlatFrame {
  return {
    ...flatPx(block),
    canvasHeight: frame.canvasHeight,
    scrollY: params.scrollY,
  }
}

const RECT_FLAT_BOX = new Float64Array(4)

function placeRectFlat(
  c: RectChannelsLike,
  g: RectFlatFrame,
  i: number,
  out: Float64Array,
) {
  const { origin, dir, bpStart, bpSpan, pxSpan, scrollY } = g
  const boxTop = c.y[i]!
  const boxHeight = c.height[i]!
  const visibleTop = boxTop - scrollY
  if (
    !(
      visibleTop + boxHeight >= -GLYPH_Y_SLACK_PX &&
      visibleTop <= g.canvasHeight + GLYPH_Y_SLACK_PX
    )
  ) {
    return false
  }
  const a = c.startEnd[i * 2]!
  const b = c.startEnd[i * 2 + 1]!
  const x1 = origin + dir * (((a - bpStart) / bpSpan) * pxSpan)
  let s1 = 0
  let s2 = 0
  if (a === b) {
    s1 = Math.floor(x1 - 1 + 0.5)
    s2 = Math.floor(x1 + 1 + 0.5)
  } else {
    s1 = Math.floor(x1 + 0.5)
    const right = Math.floor(
      origin + dir * (((b - bpStart) / bpSpan) * pxSpan) + 0.5,
    )
    const dx = right - s1
    s2 = Math.abs(dx) < 2 ? s1 + (dx < 0 ? -2 : 2) : right
  }
  const width = Math.abs(s2 - s1)
  const rounded = Math.floor(boxHeight + 0.5)
  const height =
    rounded - 2 * Math.floor(rounded * 0.5) === 0 &&
    rounded >= 2 &&
    rounded <= 4
      ? rounded + 1
      : rounded
  out[0] = s2 < s1 ? s1 - width : s1
  out[1] = Math.floor(boxTop + boxHeight * 0.5 - height * 0.5 - scrollY + 0.5)
  out[2] = width
  out[3] = height
  return true
}

function rectPlacedFlat(
  ctx: MarkContext2D,
  c: RectChannelsLike,
  block: RenderBlock,
  frame: MarkFrame,
  params: FeatureGlyphParams,
) {
  const { color, densityFade, count } = c
  const g = rectFlatFrameOf(block, frame, params)
  const outlineStyle = params.outlineColor
    ? abgrToCssRgba(params.outlineColor)
    : undefined
  if (outlineStyle !== undefined) {
    ctx.strokeStyle = outlineStyle
    ctx.lineWidth = 1
  }
  let last = -1
  for (let i = 0; i < count; i++) {
    if (placeRectFlat(c, g, i, RECT_FLAT_BOX)) {
      const abgr = color[i]!
      const faded = densityFade[i]!
      const key = faded ? abgr + 0x1_0000_0000 : abgr
      if (key !== last) {
        last = key
        const alpha = (abgrAlpha(abgr) / 255) * (faded ? MIN_DENSITY_ALPHA : 1)
        ctx.fillStyle = `rgba(${abgrRed(abgr)},${abgrGreen(abgr)},${abgrBlue(abgr)},${alpha})`
      }
      const left = RECT_FLAT_BOX[0]!
      const top = RECT_FLAT_BOX[1]!
      const width = RECT_FLAT_BOX[2]!
      const height = RECT_FLAT_BOX[3]!
      ctx.fillRect(left, top, width, height)
      if (outlineStyle !== undefined && rectDrawsOutline(width, height)) {
        strokeRectInside(ctx, left, top, width, height)
      }
    }
  }
}

function rectPlacedFlatInk(
  c: RectChannelsLike,
  block: RenderBlock,
  frame: MarkFrame,
  params: FeatureGlyphParams,
  i: number,
) {
  return placeRectFlat(
    c,
    rectFlatFrameOf(block, frame, params),
    i,
    RECT_FLAT_BOX,
  )
    ? [
        RECT_FLAT_BOX[0]!,
        RECT_FLAT_BOX[1]!,
        RECT_FLAT_BOX[2]!,
        RECT_FLAT_BOX[3]!,
      ]
    : undefined
}

const RECT_SPLIT_BOX = new Float64Array(4)

function placeRectY(
  c: RectChannelsLike,
  g: RectFlatFrame,
  i: number,
  out: Float64Array,
) {
  const { scrollY } = g
  const boxTop = c.y[i]!
  const boxHeight = c.height[i]!
  const visibleTop = boxTop - scrollY
  if (
    !(
      visibleTop + boxHeight >= -GLYPH_Y_SLACK_PX &&
      visibleTop <= g.canvasHeight + GLYPH_Y_SLACK_PX
    )
  ) {
    return false
  }
  const rounded = Math.floor(boxHeight + 0.5)
  const height =
    rounded - 2 * Math.floor(rounded * 0.5) === 0 &&
    rounded >= 2 &&
    rounded <= 4
      ? rounded + 1
      : rounded
  out[1] = Math.floor(boxTop + boxHeight * 0.5 - height * 0.5 - scrollY + 0.5)
  out[3] = height
  return true
}

function placeRectX(
  c: RectChannelsLike,
  g: RectFlatFrame,
  i: number,
  out: Float64Array,
) {
  const { origin, dir, bpStart, bpSpan, pxSpan } = g
  const a = c.startEnd[i * 2]!
  const b = c.startEnd[i * 2 + 1]!
  const x1 = origin + dir * (((a - bpStart) / bpSpan) * pxSpan)
  let s1 = 0
  let s2 = 0
  if (a === b) {
    s1 = Math.floor(x1 - 1 + 0.5)
    s2 = Math.floor(x1 + 1 + 0.5)
  } else {
    s1 = Math.floor(x1 + 0.5)
    const right = Math.floor(
      origin + dir * (((b - bpStart) / bpSpan) * pxSpan) + 0.5,
    )
    const dx = right - s1
    s2 = Math.abs(dx) < 2 ? s1 + (dx < 0 ? -2 : 2) : right
  }
  const width = Math.abs(s2 - s1)
  out[0] = s2 < s1 ? s1 - width : s1
  out[2] = width
}

function rectPlacedSplit(
  ctx: MarkContext2D,
  c: RectChannelsLike,
  block: RenderBlock,
  frame: MarkFrame,
  params: FeatureGlyphParams,
) {
  const { color, densityFade, count } = c
  const g = rectFlatFrameOf(block, frame, params)
  const outlineStyle = params.outlineColor
    ? abgrToCssRgba(params.outlineColor)
    : undefined
  if (outlineStyle !== undefined) {
    ctx.strokeStyle = outlineStyle
    ctx.lineWidth = 1
  }
  let last = -1
  for (let i = 0; i < count; i++) {
    if (placeRectY(c, g, i, RECT_SPLIT_BOX)) {
      placeRectX(c, g, i, RECT_SPLIT_BOX)
      const abgr = color[i]!
      const faded = densityFade[i]!
      const key = faded ? abgr + 0x1_0000_0000 : abgr
      if (key !== last) {
        last = key
        const alpha = (abgrAlpha(abgr) / 255) * (faded ? MIN_DENSITY_ALPHA : 1)
        ctx.fillStyle = `rgba(${abgrRed(abgr)},${abgrGreen(abgr)},${abgrBlue(abgr)},${alpha})`
      }
      const left = RECT_SPLIT_BOX[0]!
      const top = RECT_SPLIT_BOX[1]!
      const width = RECT_SPLIT_BOX[2]!
      const height = RECT_SPLIT_BOX[3]!
      ctx.fillRect(left, top, width, height)
      if (outlineStyle !== undefined && rectDrawsOutline(width, height)) {
        strokeRectInside(ctx, left, top, width, height)
      }
    }
  }
}

function rectPlacedSplitInk(
  c: RectChannelsLike,
  block: RenderBlock,
  frame: MarkFrame,
  params: FeatureGlyphParams,
  i: number,
) {
  const g = rectFlatFrameOf(block, frame, params)
  if (!placeRectY(c, g, i, RECT_SPLIT_BOX)) {
    return undefined
  }
  placeRectX(c, g, i, RECT_SPLIT_BOX)
  return [
    RECT_SPLIT_BOX[0]!,
    RECT_SPLIT_BOX[1]!,
    RECT_SPLIT_BOX[2]!,
    RECT_SPLIT_BOX[3]!,
  ]
}

function blockPxAt(p: FlatPx, bp: number) {
  return p.origin + p.dir * (((bp - p.bpStart) / p.bpSpan) * p.pxSpan)
}

interface SpanFrame extends FlatPx {
  minWidthPx: number
  seamPx: number
  rowHeight: number
  scrollTop: number
  offset: number
  height: number
}

function spanFrameOf(block: RenderBlock, params: SpanParams): SpanFrame {
  return {
    ...flatPx(block),
    minWidthPx: params.minWidthPx,
    seamPx: params.seamPx,
    rowHeight: params.rowHeight,
    scrollTop: params.scrollTop,
    offset: rowBandOffsetPx(params.rowHeight, params.rowProportion),
    height: drawnRowHeightPx(params.rowHeight, params.rowProportion),
  }
}

const SPAN_TWIN_BOX = new Float64Array(4)

function placeSpanY(
  c: SpanChannels,
  g: SpanFrame,
  i: number,
  out: Float64Array,
) {
  out[1] = g.offset + g.rowHeight * c.row[i]! - g.scrollTop
  out[3] = g.height
}

function placeSpanX(
  c: SpanChannels,
  g: SpanFrame,
  i: number,
  out: Float64Array,
) {
  const xa = blockPxAt(g, c.x[i]!)
  const xb = blockPxAt(g, c.x2[i]!)
  const width = Math.max(g.minWidthPx, Math.abs(xb - xa))
  out[0] = spanLeft(xa, xb, width)
  out[2] = width
}

function spanSplitTwins(
  ctx: MarkContext2D,
  c: SpanChannels,
  block: RenderBlock,
  _frame: MarkFrame,
  params: SpanParams,
) {
  const { color, count } = c
  const g = spanFrameOf(block, params)
  const box = SPAN_TWIN_BOX
  let last = -1
  for (let i = 0; i < count; i++) {
    placeSpanY(c, g, i, box)
    placeSpanX(c, g, i, box)
    const abgr = color[i]!
    if (abgr !== last) {
      last = abgr
      ctx.fillStyle = abgrToCssRgba(abgr)
    }
    ctx.fillRect(box[0]!, box[1]!, box[2]! + g.seamPx, box[3]!)
  }
}

function spanSplitTwinsInk(
  c: SpanChannels,
  block: RenderBlock,
  params: SpanParams,
  i: number,
) {
  const g = spanFrameOf(block, params)
  placeSpanY(c, g, i, SPAN_TWIN_BOX)
  placeSpanX(c, g, i, SPAN_TWIN_BOX)
  return [
    SPAN_TWIN_BOX[0]!,
    SPAN_TWIN_BOX[1]!,
    SPAN_TWIN_BOX[2]! + g.seamPx,
    SPAN_TWIN_BOX[3]!,
  ]
}

const CELL_TWIN_BOX = new Float64Array(4)

function cellTwinFrameOf(
  block: RenderBlock,
  frame: MarkFrame,
  params: CellParams,
) {
  return {
    ...flatPx(block),
    canvasWidth: frame.canvasWidth,
    canvasHeight: frame.canvasHeight,
    rowHeight: params.rowHeight,
    scrollTop: params.scrollTop,
    height: drawnCellHeightPx(params.rowHeight),
  }
}

type CellTwinFrame = ReturnType<typeof cellTwinFrameOf>

function placeCellY(
  c: CellChannels,
  g: CellTwinFrame,
  i: number,
  out: Float64Array,
) {
  const top = c.row[i]! * g.rowHeight - g.scrollTop
  if (!(top + g.height >= 0 && top <= g.canvasHeight)) {
    return false
  }
  out[1] = top
  out[3] = g.height
  return true
}

function placeCellX(
  c: CellChannels,
  g: CellTwinFrame,
  i: number,
  out: Float64Array,
) {
  const x1 = blockPxAt(g, c.startEnd[i * 2]!)
  const x2 = blockPxAt(g, c.startEnd[i * 2 + 1]!)
  const width = snappedCellWidthPx(x1, x2, g.canvasWidth)
  out[0] = snappedCellLeftPx(x1, x2, g.canvasWidth, width)
  out[2] = width
}

function cellSplitTwins(
  ctx: MarkContext2D,
  c: CellChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: CellParams,
) {
  const { shapeType, color, count } = c
  const g = cellTwinFrameOf(block, frame, params)
  const box = CELL_TWIN_BOX
  let last = -1
  for (let i = 0; i < count; i++) {
    if (placeCellY(c, g, i, box)) {
      placeCellX(c, g, i, box)
      const abgr = color[i]!
      if (abgr !== last) {
        last = abgr
        ctx.fillStyle = abgrToCssRgba(abgr)
      }
      drawVariantShape(ctx, shapeType[i]!, box[0]!, box[1]!, box[2]!, box[3]!)
    }
  }
}

function cellSplitTwinsInk(
  c: CellChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: CellParams,
  i: number,
) {
  const g = cellTwinFrameOf(block, frame, params)
  if (!placeCellY(c, g, i, CELL_TWIN_BOX)) {
    return undefined
  }
  placeCellX(c, g, i, CELL_TWIN_BOX)
  return [...CELL_TWIN_BOX]
}

function snapVariantCellXInto(
  x1: number,
  x2: number,
  canvasWidth: number,
  out: Float64Array,
  o: number,
) {
  const width = snappedCellWidthPx(x1, x2, canvasWidth)
  out[o] = snappedCellLeftPx(x1, x2, canvasWidth, width)
  out[o + 1] = width
}

const CELL_OUT_BOX = new Float64Array(4)
const CELL_OUT_PAIR = new Float64Array(2)

function placeCellXOut(
  c: CellChannels,
  g: CellTwinFrame,
  i: number,
  out: Float64Array,
) {
  snapVariantCellXInto(
    blockPxAt(g, c.startEnd[i * 2]!),
    blockPxAt(g, c.startEnd[i * 2 + 1]!),
    g.canvasWidth,
    CELL_OUT_PAIR,
    0,
  )
  out[0] = CELL_OUT_PAIR[0]!
  out[2] = CELL_OUT_PAIR[1]!
}

function cellSplitTwinsOut(
  ctx: MarkContext2D,
  c: CellChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: CellParams,
) {
  const { shapeType, color, count } = c
  const g = cellTwinFrameOf(block, frame, params)
  const box = CELL_OUT_BOX
  let last = -1
  for (let i = 0; i < count; i++) {
    if (placeCellY(c, g, i, box)) {
      placeCellXOut(c, g, i, box)
      const abgr = color[i]!
      if (abgr !== last) {
        last = abgr
        ctx.fillStyle = abgrToCssRgba(abgr)
      }
      drawVariantShape(ctx, shapeType[i]!, box[0]!, box[1]!, box[2]!, box[3]!)
    }
  }
}

function cellSplitTwinsOutInk(
  c: CellChannels,
  block: RenderBlock,
  frame: MarkFrame,
  params: CellParams,
  i: number,
) {
  const g = cellTwinFrameOf(block, frame, params)
  if (!placeCellY(c, g, i, CELL_OUT_BOX)) {
    return undefined
  }
  placeCellXOut(c, g, i, CELL_OUT_BOX)
  return [...CELL_OUT_BOX]
}

function rectTwinFrameOf(
  block: RenderBlock,
  frame: MarkFrame,
  params: FeatureGlyphParams,
) {
  return {
    ...flatPx(block),
    canvasHeight: frame.canvasHeight,
    scrollY: params.scrollY,
  }
}

type RectTwinFrame = ReturnType<typeof rectTwinFrameOf>

function placeRectTwinY(
  c: RectChannelsLike,
  g: RectTwinFrame,
  i: number,
  out: Float64Array,
) {
  const boxTop = c.y[i]!
  const boxHeight = c.height[i]!
  const visibleTop = boxTop - g.scrollY
  if (
    !(
      visibleTop + boxHeight >= -GLYPH_Y_SLACK_PX &&
      visibleTop <= g.canvasHeight + GLYPH_Y_SLACK_PX
    )
  ) {
    return false
  }
  out[1] = snapBoxTopPx(boxTop, boxHeight, g.scrollY)
  out[3] = snapBoxHeightPx(boxHeight)
  return true
}

function placeRectTwinX(
  c: RectChannelsLike,
  g: RectTwinFrame,
  i: number,
  out: Float64Array,
) {
  const startBp = c.startEnd[i * 2]!
  const endBp = c.startEnd[i * 2 + 1]!
  const [s1, s2] = rectSpanPx(
    blockPxAt(g, startBp),
    blockPxAt(g, endBp),
    startBp === endBp,
  )
  const width = Math.abs(s2 - s1)
  out[0] = spanLeft(s1, s2, width)
  out[2] = width
}

const RECT_TWIN_BOX = new Float64Array(4)

function rectSplitTwins(
  ctx: MarkContext2D,
  c: RectChannelsLike,
  block: RenderBlock,
  frame: MarkFrame,
  params: FeatureGlyphParams,
) {
  const { color, densityFade, count } = c
  const g = rectTwinFrameOf(block, frame, params)
  const box = RECT_TWIN_BOX
  const outlineStyle = params.outlineColor
    ? abgrToCssRgba(params.outlineColor)
    : undefined
  if (outlineStyle !== undefined) {
    ctx.strokeStyle = outlineStyle
    ctx.lineWidth = 1
  }
  let last = -1
  for (let i = 0; i < count; i++) {
    if (placeRectTwinY(c, g, i, box)) {
      placeRectTwinX(c, g, i, box)
      const abgr = color[i]!
      const faded = densityFade[i]!
      const key = faded ? abgr + 0x1_0000_0000 : abgr
      if (key !== last) {
        last = key
        const alpha = (abgrAlpha(abgr) / 255) * (faded ? MIN_DENSITY_ALPHA : 1)
        ctx.fillStyle = `rgba(${abgrRed(abgr)},${abgrGreen(abgr)},${abgrBlue(abgr)},${alpha})`
      }
      const left = box[0]!
      const top = box[1]!
      const width = box[2]!
      const height = box[3]!
      ctx.fillRect(left, top, width, height)
      if (outlineStyle !== undefined && rectDrawsOutline(width, height)) {
        strokeRectInside(ctx, left, top, width, height)
      }
    }
  }
}

function rectSplitTwinsInk(
  c: RectChannelsLike,
  block: RenderBlock,
  frame: MarkFrame,
  params: FeatureGlyphParams,
  i: number,
) {
  const g = rectTwinFrameOf(block, frame, params)
  if (!placeRectTwinY(c, g, i, RECT_TWIN_BOX)) {
    return undefined
  }
  placeRectTwinX(c, g, i, RECT_TWIN_BOX)
  return [...RECT_TWIN_BOX]
}

function rectSpanPxInto(
  x1Px: number,
  x2Px: number,
  isPoint: boolean,
  out: Float64Array,
  o: number,
) {
  if (isPoint) {
    out[o] = Math.floor(x1Px - 1 + 0.5)
    out[o + 1] = Math.floor(x1Px + 1 + 0.5)
    return
  }
  const left = Math.floor(x1Px + 0.5)
  out[o] = left
  out[o + 1] = extendToMinWidthPx(left, Math.floor(x2Px + 0.5), 2)
}

const RECT_OUT_BOX = new Float64Array(4)
const RECT_OUT_PAIR = new Float64Array(2)

function placeRectTwinXOut(
  c: RectChannelsLike,
  g: RectTwinFrame,
  i: number,
  out: Float64Array,
) {
  const startBp = c.startEnd[i * 2]!
  const endBp = c.startEnd[i * 2 + 1]!
  rectSpanPxInto(
    blockPxAt(g, startBp),
    blockPxAt(g, endBp),
    startBp === endBp,
    RECT_OUT_PAIR,
    0,
  )
  const s1 = RECT_OUT_PAIR[0]!
  const s2 = RECT_OUT_PAIR[1]!
  const width = Math.abs(s2 - s1)
  out[0] = spanLeft(s1, s2, width)
  out[2] = width
}

function rectSplitTwinsOut(
  ctx: MarkContext2D,
  c: RectChannelsLike,
  block: RenderBlock,
  frame: MarkFrame,
  params: FeatureGlyphParams,
) {
  const { color, densityFade, count } = c
  const g = rectTwinFrameOf(block, frame, params)
  const box = RECT_OUT_BOX
  const outlineStyle = params.outlineColor
    ? abgrToCssRgba(params.outlineColor)
    : undefined
  if (outlineStyle !== undefined) {
    ctx.strokeStyle = outlineStyle
    ctx.lineWidth = 1
  }
  let last = -1
  for (let i = 0; i < count; i++) {
    if (placeRectTwinY(c, g, i, box)) {
      placeRectTwinXOut(c, g, i, box)
      const abgr = color[i]!
      const faded = densityFade[i]!
      const key = faded ? abgr + 0x1_0000_0000 : abgr
      if (key !== last) {
        last = key
        const alpha = (abgrAlpha(abgr) / 255) * (faded ? MIN_DENSITY_ALPHA : 1)
        ctx.fillStyle = `rgba(${abgrRed(abgr)},${abgrGreen(abgr)},${abgrBlue(abgr)},${alpha})`
      }
      const left = box[0]!
      const top = box[1]!
      const width = box[2]!
      const height = box[3]!
      ctx.fillRect(left, top, width, height)
      if (outlineStyle !== undefined && rectDrawsOutline(width, height)) {
        strokeRectInside(ctx, left, top, width, height)
      }
    }
  }
}

function rectSplitTwinsOutInk(
  c: RectChannelsLike,
  block: RenderBlock,
  frame: MarkFrame,
  params: FeatureGlyphParams,
  i: number,
) {
  const g = rectTwinFrameOf(block, frame, params)
  if (!placeRectTwinY(c, g, i, RECT_OUT_BOX)) {
    return undefined
  }
  placeRectTwinXOut(c, g, i, RECT_OUT_BOX)
  return [...RECT_OUT_BOX]
}

const BASE_PLAN: WalkPlan = {
  layout: WLayout.pair,
  x: WX.floor,
  y: WY.rowBand,
  fade: WFade.opaque,
  fill: WFill.abgrRun,
  glyph: WGlyph.rect,
  kind: 0,
  reversed: false,
  bpStart: 0,
  bpEnd: 0,
  bpSpan: 0,
  pxStart: 0,
  pxEnd: 0,
  pxSpan: 0,
  minWidthPx: 0,
  seamPx: 0,
  cellShift: 0,
  cellWidth: 0,
  canvasWidth: 0,
  canvasHeight: 0,
  rowHeight: 0,
  rowOffset: 0,
  rowPitch: 0,
  topOffset: 0,
  bandOffset: 0,
  bandHeight: 0,
  scrollTop: 0,
  featureHeight: 0,
  pxPerBp: 0,
  filterByFrequency: false,
  mismatchAlpha: false,
  chainMode: false,
  constantAlpha: 1,
  opaqueCss: [],
  fadedCss: [],
  constantCss: undefined,
  outlineStyle: undefined,
}

const BASE_CHANNELS: WalkChannels = {
  start: [],
  end: undefined,
  row: undefined,
  top: undefined,
  height: undefined,
  color: undefined,
  fade: undefined,
  glyph: undefined,
  kinds: undefined,
  freqs: undefined,
  quals: undefined,
  from: 0,
  to: 0,
}

function blockProjection(block: RenderBlock) {
  return {
    reversed: block.reversed,
    bpStart: block.start,
    bpEnd: block.end,
    bpSpan: block.end - block.start,
    pxStart: block.screenStartPx,
    pxEnd: block.screenEndPx,
    pxSpan: block.screenEndPx - block.screenStartPx,
  }
}

function spanPlan(
  block: RenderBlock,
  frame: MarkFrame,
  params: SpanParams,
): WalkPlan {
  return {
    ...BASE_PLAN,
    ...blockProjection(block),
    minWidthPx: params.minWidthPx,
    seamPx: params.seamPx,
    canvasHeight: frame.canvasHeight,
    rowHeight: params.rowHeight,
    rowOffset: rowBandOffsetPx(params.rowHeight, params.rowProportion),
    bandHeight: drawnRowHeightPx(params.rowHeight, params.rowProportion),
    scrollTop: params.scrollTop,
  }
}

function spanChannels(c: SpanChannels): WalkChannels {
  return {
    ...BASE_CHANNELS,
    start: c.x,
    end: c.x2,
    row: c.row,
    color: c.color,
    to: c.count,
  }
}

const PILEUP_FADE = {
  [Fade.opaque]: WFade.opaque,
  [Fade.intron]: WFade.opaque,
  [Fade.spanFrequencySize]: WFade.spanFrequencySize,
  [Fade.cellFrequencyQuality]: WFade.cellFrequencyQuality,
  [Fade.overlap]: WFade.overlap,
} as Record<number, number>

function pileupPlan(
  spec: PileupPaintSpec,
  c: PileupChannels,
  block: RenderBlock,
  state: RenderState,
): WalkPlan {
  const { rule, opaqueCss, fadedCss } = spec.paint(state)
  const bpLength = block.end - block.start
  const fullBlockWidth = block.screenEndPx - block.screenStartPx
  const { featureHeight } = state
  const centerline = spec.band === Band.centerline
  const constantAlpha =
    spec.fade === Fade.intron ? intronAlpha(featureHeight) : 1
  const constantCss =
    c.keys === undefined &&
    (spec.fade === Fade.opaque || spec.fade === Fade.intron)
      ? constantAlpha >= 1
        ? opaqueCss[0]!
        : `${fadedCss[0]!}${constantAlpha})`
      : undefined
  const cellEnd = block.screenStartPx + fullBlockWidth
  const cellBpSpan = block.start + bpLength - block.start
  const cellPxSpan = cellEnd - block.screenStartPx
  const cell = spec.pivot === 'cell'
  return {
    ...BASE_PLAN,
    layout: c.stride === 2 ? WLayout.interleaved : WLayout.single,
    x: cell ? WX.cell : WX.midpoint,
    y: WY.pileupRow,
    fade: PILEUP_FADE[spec.fade]!,
    fill:
      constantCss !== undefined
        ? WFill.constant
        : rule === Paint.packedAbgr
          ? WFill.packedRun
          : WFill.palette,
    kind: c.kind,
    reversed: block.reversed,
    bpStart: block.start,
    bpEnd: block.end,
    bpSpan: cell ? cellBpSpan : bpLength,
    pxStart: block.screenStartPx,
    pxEnd: cell ? cellEnd : block.screenEndPx,
    pxSpan: cell ? cellPxSpan : fullBlockWidth,
    cellShift: block.reversed ? -(cellPxSpan / cellBpSpan) : 0,
    cellWidth: cell
      ? makePileupCellMapper(block, bpLength, fullBlockWidth, spec.contiguous).w
      : 0,
    canvasHeight: state.canvasHeight,
    rowPitch: featureHeight + state.featureSpacing,
    topOffset: state.pileupTopOffset,
    bandOffset: centerline ? featureHeight / 2 - 0.5 : 0,
    bandHeight: centerline ? 1 : featureHeight,
    scrollTop: state.scrollTop,
    featureHeight,
    pxPerBp: fullBlockWidth / bpLength,
    filterByFrequency: state.filterMismatchesByFrequency,
    mismatchAlpha: state.mismatchAlpha,
    chainMode: state.chainMode,
    constantAlpha,
    opaqueCss,
    fadedCss,
    constantCss,
  }
}

function pileupWalkChannels(c: PileupChannels): WalkChannels {
  return {
    ...BASE_CHANNELS,
    start: c.positions,
    row: c.rows,
    color: c.keys,
    kinds: c.kinds,
    freqs: c.freqs,
    quals: c.quals,
    from: c.start,
    to: c.end,
  }
}

function rectPlan(
  block: RenderBlock,
  frame: MarkFrame,
  params: FeatureGlyphParams,
): WalkPlan {
  return {
    ...BASE_PLAN,
    ...blockProjection(block),
    layout: WLayout.interleaved,
    x: WX.rectSnap,
    y: WY.snapBox,
    fill: WFill.abgrFade,
    canvasHeight: frame.canvasHeight,
    scrollTop: params.scrollY,
    outlineStyle: params.outlineColor
      ? abgrToCssRgba(params.outlineColor)
      : undefined,
  }
}

function rectWalkChannels(c: RectChannelsLike): WalkChannels {
  return {
    ...BASE_CHANNELS,
    start: c.startEnd,
    top: c.y,
    height: c.height,
    color: c.color,
    fade: c.densityFade,
    to: c.count,
  }
}

function cellPlan(
  block: RenderBlock,
  frame: MarkFrame,
  params: CellParams,
): WalkPlan {
  return {
    ...BASE_PLAN,
    ...blockProjection(block),
    layout: WLayout.interleaved,
    x: WX.variantSnap,
    y: WY.cellRow,
    glyph: WGlyph.variant,
    canvasWidth: frame.canvasWidth,
    canvasHeight: frame.canvasHeight,
    rowHeight: params.rowHeight,
    bandHeight: drawnCellHeightPx(params.rowHeight),
    scrollTop: params.scrollTop,
  }
}

function cellWalkChannels(c: CellChannels): WalkChannels {
  return {
    ...BASE_CHANNELS,
    start: c.startEnd,
    row: c.row,
    color: c.color,
    glyph: c.shapeType,
    to: c.count,
  }
}

function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

const FRAME = { canvasWidth: 1600, canvasHeight: 1000 }
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

function spanFixture(n: number) {
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
  return { channels, params, forward, reversed }
}

const PILEUP_BP = 6400

function pileupState(): RenderState {
  return {
    featureHeight: 7,
    featureSpacing: 0,
    pileupTopOffset: 0,
    scrollTop: 0,
    canvasWidth: FRAME.canvasWidth,
    canvasHeight: FRAME.canvasHeight,
    mismatchAlpha: false,
    filterMismatchesByFrequency: true,
    chainMode: true,
    showMismatches: true,
    showModifications: false,
    colors: {
      colorDeletion: [0.5, 0.5, 0.5],
      colorSkip: [0, 0, 1],
      colorOverlap: [0.3, 0.3, 0.3],
      colorOverlapTint: [0, 0, 0],
      colorBaseA: [0, 0.8, 0],
      colorBaseC: [0, 0, 0.9],
      colorBaseG: [0.9, 0.6, 0],
      colorBaseT: [0.9, 0, 0],
      colorBaseN: [0.5, 0.4, 0.3],
      colorMutedSnpBase: [0.6, 0.6, 0.6],
    },
  } as unknown as RenderState
}

const DELETION_SPEC: PileupPaintSpec = {
  pivot: 'span',
  fade: Fade.spanFrequencySize,
  band: Band.row,
  contiguous: false,
  paint: state => ({
    rule: Paint.palette,
    opaqueCss: [rgb255(state.colors.colorDeletion)],
    fadedCss: [rgbaPrefix255(state.colors.colorDeletion)],
  }),
}

const MISMATCH_SPEC: PileupPaintSpec = {
  pivot: 'cell',
  fade: Fade.cellFrequencyQuality,
  band: Band.row,
  contiguous: false,
  paint: state => ({
    rule: Paint.palette,
    opaqueCss: buildBaseCssMap(state),
    fadedCss: buildBaseFadeCssMap(state),
  }),
}

const SKIP_SPEC: PileupPaintSpec = {
  pivot: 'span',
  fade: Fade.intron,
  band: Band.centerline,
  contiguous: false,
  paint: state => ({
    rule: Paint.palette,
    opaqueCss: [rgba255(state.colors.colorSkip, 1)],
    fadedCss: [rgbaPrefix255(state.colors.colorSkip)],
  }),
}

const OVERLAP_SPEC: PileupPaintSpec = {
  pivot: 'span',
  fade: Fade.overlap,
  band: Band.row,
  contiguous: false,
  paint: state => {
    const tint = state.chainMode
      ? state.colors.colorOverlap
      : state.colors.colorOverlapTint
    return {
      rule: Paint.palette,
      opaqueCss: [rgb255(tint)],
      fadedCss: [rgbaPrefix255(tint)],
    }
  },
}

const QUALITY_SPEC: PileupPaintSpec = {
  pivot: 'cell',
  fade: Fade.opaque,
  band: Band.row,
  contiguous: true,
  paint: () => ({
    rule: Paint.palette,
    opaqueCss: qualityCssColors,
    fadedCss: [],
  }),
}

const MODIFICATION_SPEC: PileupPaintSpec = {
  pivot: 'cell',
  fade: Fade.opaque,
  band: Band.row,
  contiguous: false,
  paint: () => ({ rule: Paint.packedAbgr, opaqueCss: [], fadedCss: [] }),
}

function sharedPileupPainter(spec: PileupPaintSpec) {
  return pileupShape({
    ...spec,
    id: 'bench',
    mod: gapShader,
    pack: packGaps,
    hit: Hit.always,
  }).paintBlock
}

function pileupChannels(
  fields: Pick<PileupChannels, 'positions' | 'stride' | 'rows'> &
    Partial<PileupChannels>,
): PileupChannels {
  return {
    positions: fields.positions,
    stride: fields.stride,
    rows: fields.rows,
    start: 0,
    end: fields.rows.length,
    kinds: fields.kinds,
    kind: fields.kind ?? 0,
    freqs: fields.freqs,
    quals: fields.quals,
    lengths: undefined,
    keys: fields.keys,
  }
}

function gapFixture(n: number) {
  const rand = rng(23)
  const { forward, reversed } = blocksOf(30_000_000, PILEUP_BP)
  const gapPositions = new Uint32Array(n * 2)
  const gapYs = new Uint16Array(n)
  const gapTypes = new Uint8Array(n)
  const gapFrequencies = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const deletion = rand() < 0.8
    const start = forward.start + Math.floor(rand() * PILEUP_BP)
    gapPositions[i * 2] = start
    gapPositions[i * 2 + 1] =
      start +
      (deletion ? 1 + geometric(rand, 3) : 50 + Math.floor(rand() * 2000))
    gapYs[i] = Math.floor(rand() * 160)
    gapTypes[i] = deletion ? GAP_DELETION : GAP_SKIP
    gapFrequencies[i] = deletion
      ? rand() < 0.7
        ? 255
        : Math.floor(rand() * 255)
      : 0
  }
  const region = { gapPositions, gapYs, gapTypes, gapFrequencies }
  const channels = (kind: number) =>
    pileupChannels({
      positions: gapPositions,
      stride: 2,
      rows: gapYs,
      kinds: gapTypes,
      kind,
      freqs: gapFrequencies,
    })
  return { region, channels, forward, reversed }
}

function mismatchFixture(n: number) {
  const rand = rng(37)
  const { forward, reversed } = blocksOf(30_000_000, PILEUP_BP)
  const bases = [65, 67, 71, 84]
  const mismatchPositions = new Uint32Array(n)
  const mismatchYs = new Uint16Array(n)
  const mismatchBases = new Uint8Array(n)
  const mismatchFrequencies = new Uint8Array(n)
  const mismatchQuals = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    mismatchPositions[i] = forward.start + Math.floor(rand() * PILEUP_BP)
    mismatchYs[i] = Math.floor(rand() * 160)
    mismatchBases[i] = rand() < 0.01 ? 78 : bases[Math.floor(rand() * 4)]!
    mismatchFrequencies[i] = rand() < 0.5 ? 255 : 3 + Math.floor(rand() * 60)
    mismatchQuals[i] = 10 + Math.floor(rand() * 50)
  }
  const region = {
    mismatchPositions,
    mismatchYs,
    mismatchBases,
    mismatchFrequencies,
    mismatchQuals,
  }
  const channels = pileupChannels({
    positions: mismatchPositions,
    stride: 1,
    rows: mismatchYs,
    freqs: mismatchFrequencies,
    quals: mismatchQuals,
    keys: mismatchBases,
  })
  return { region, channels, forward, reversed }
}

function pileupWarmFixtures(n: number) {
  const rand = rng(41)
  const { forward } = blocksOf(30_000_000, PILEUP_BP)
  const cellPositions = Uint32Array.from(
    { length: n },
    () => forward.start + Math.floor(rand() * PILEUP_BP),
  )
  const cellRows = Uint16Array.from({ length: n }, () =>
    Math.floor(rand() * 160),
  )
  const spans = new Uint32Array(n * 2)
  for (let i = 0; i < n; i++) {
    const start = forward.start + Math.floor(rand() * PILEUP_BP)
    spans[i * 2] = start
    spans[i * 2 + 1] = start + 1 + Math.floor(rand() * 400)
  }
  const gapTypes = new Uint8Array(n).fill(GAP_SKIP)
  return [
    {
      spec: SKIP_SPEC,
      channels: pileupChannels({
        positions: spans,
        stride: 2,
        rows: cellRows,
        kinds: gapTypes,
        kind: GAP_SKIP,
        freqs: new Uint8Array(n),
      }),
    },
    {
      spec: OVERLAP_SPEC,
      channels: pileupChannels({ positions: spans, stride: 2, rows: cellRows }),
    },
    {
      spec: QUALITY_SPEC,
      channels: pileupChannels({
        positions: cellPositions,
        stride: 1,
        rows: cellRows,
        keys: Uint8Array.from({ length: n }, () => Math.floor(rand() * 60)),
      }),
    },
    {
      spec: MODIFICATION_SPEC,
      channels: pileupChannels({
        positions: cellPositions,
        stride: 1,
        rows: cellRows,
        keys: runs(rand, n, 30),
      }),
    },
  ]
}

function rectFixture(n: number, outline: boolean) {
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
  const channels: RectChannelsLike = {
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
  return { channels, params, forward, reversed }
}

function cellFixture(n: number) {
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
  const params: CellParams = {
    rowHeight: FRAME.canvasHeight / samples,
    scrollTop: 0,
  }
  return { channels, params, forward, reversed }
}

type Painter = (ctx: MarkContext2D, block: RenderBlock) => void

type Walk = typeof walkRects

type ArmName =
  | 'hand'
  | 'control'
  | 'walker'
  | 'perShape'
  | 'placed'
  | 'placedFlat'
  | 'placedSplit'
  | 'splitTwins'
  | 'splitTwinsOut'
  | 'pileupShared'

const ARM_NAMES: readonly ArmName[] = [
  'hand',
  'control',
  'walker',
  'perShape',
  'placed',
  'placedFlat',
  'placedSplit',
  'splitTwins',
  'splitTwinsOut',
  'pileupShared',
]

interface Placement {
  name: ArmName
  at: (i: number) => readonly number[] | undefined
}

interface Shape {
  name: string
  entries: number
  forward: RenderBlock
  reversed: RenderBlock
  reference: Painter
  arms: { name: ArmName; paint: Painter }[]
  instances: readonly [from: number, to: number]
  placements: Placement[]
}

function paintWith<C, F, P>(
  paint: (
    ctx: MarkContext2D,
    channels: C,
    block: RenderBlock,
    frame: F,
    params: P,
  ) => void,
  channels: C,
  frame: F,
  params: P,
): Painter {
  return (ctx, block) => {
    paint(ctx, channels, block, frame, params)
  }
}

function walkWith(
  walk: Walk,
  plan: (block: RenderBlock) => WalkPlan,
  channels: WalkChannels,
): Painter {
  return (ctx, block) => {
    walk(ctx, plan(block), channels, channels.from, channels.to, undefined)
  }
}

function walkPlacement(
  name: ArmName,
  walk: Walk,
  plan: WalkPlan,
  channels: WalkChannels,
): Placement {
  const out = new Float64Array(4)
  return {
    name,
    at: i =>
      walk(undefined, plan, channels, i, i + 1, out) ? [...out] : undefined,
  }
}

async function loadCopy(copy: string): Promise<Walk> {
  const mod = (await import(`${import.meta.url}?copy=${copy}`)) as {
    walkRects: Walk
  }
  return mod.walkRects
}

interface Recording {
  calls: ReturnType<typeof recordingContext>['calls']
  styles: string[]
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

function record(paint: Painter, block: RenderBlock): Recording {
  const log = new StyleLog()
  paint(log, block)
  return { calls: log.inner.calls, styles: log.styles }
}

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

function placementDifference(
  shape: Shape,
  placement: Placement,
  painted: Recording,
) {
  const [from, to] = shape.instances
  let k = 0
  for (let i = from; i < to; i++) {
    const box = placement.at(i)
    if (box) {
      const q = painted.calls[k]
      if (
        !q ||
        Math.abs(box[0]! - q.x) > 1e-9 ||
        Math.abs(box[1]! - q.y) > 1e-9 ||
        Math.abs(box[2]! - q.w) > 1e-9 ||
        Math.abs(box[3]! - q.h) > 1e-9
      ) {
        return `instance ${i} placed (${box.join(', ')}), painted ${JSON.stringify(q)}`
      }
      k++
    }
  }
  return k === painted.calls.length
    ? undefined
    : `${k} placements against ${painted.calls.length} rects`
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

function exitOnIdentityFailure(shapes: Shape[]) {
  for (const shape of shapes) {
    for (const block of [shape.forward, shape.reversed]) {
      const orientation = block.reversed ? 'reversed' : 'forward'
      const [hand, ...rest] = shape.arms
      const handRecording = record(hand!.paint, block)
      const failures = [
        [
          'the production painter',
          firstDifference(record(shape.reference, block), handRecording),
        ],
        ...rest.map(arm => [
          arm.name,
          firstDifference(handRecording, record(arm.paint, block)),
        ]),
      ]
      for (const [against, diff] of failures) {
        if (diff) {
          console.error(
            `IDENTITY FAIL ${shape.name} ${shape.entries} ${orientation}: ${against} against hand: ${diff}`,
          )
          process.exit(1)
        }
      }
    }
  }
}

interface Walkers {
  shared: Walk
  span: Walk
  deletion: Walk
  mismatch: Walk
  rect: Walk
  cell: Walk
}

function buildShapes(
  n: number,
  outline: boolean,
  walkers: Walkers,
  state: RenderState,
) {
  const span = spanFixture(n)
  const spanWalk = spanChannels(span.channels)
  const spanPlanOf = (block: RenderBlock) => spanPlan(block, FRAME, span.params)

  const gaps = gapFixture(n)
  const deletion = gaps.channels(GAP_DELETION)
  const deletionWalk = pileupWalkChannels(deletion)
  const deletionPlanOf = (block: RenderBlock) =>
    pileupPlan(DELETION_SPEC, deletion, block, state)

  const mismatches = mismatchFixture(n)
  const mismatchWalk = pileupWalkChannels(mismatches.channels)
  const mismatchPlanOf = (block: RenderBlock) =>
    pileupPlan(MISMATCH_SPEC, mismatches.channels, block, state)

  const rects = rectFixture(n, outline)
  const rectWalk = rectWalkChannels(rects.channels)
  const rectPlanOf = (block: RenderBlock) =>
    rectPlan(block, FRAME, rects.params)

  const cells = cellFixture(n)
  const cellWalk = cellWalkChannels(cells.channels)
  const cellPlanOf = (block: RenderBlock) =>
    cellPlan(block, FRAME, cells.params)

  const walked = (
    shared: Walk,
    perShape: Walk,
    planOf: (block: RenderBlock) => WalkPlan,
    channels: WalkChannels,
  ) => [
    { name: 'walker' as const, paint: walkWith(shared, planOf, channels) },
    { name: 'perShape' as const, paint: walkWith(perShape, planOf, channels) },
  ]

  const walkPlacements = (
    shared: Walk,
    perShape: Walk,
    plan: WalkPlan,
    channels: WalkChannels,
  ) => [
    walkPlacement('walker', shared, plan, channels),
    walkPlacement('perShape', perShape, plan, channels),
  ]

  const shapes: Shape[] = [
    {
      name: 'span',
      entries: n,
      forward: span.forward,
      reversed: span.reversed,
      reference: paintWith(
        spanMark.paintBlock,
        span.channels,
        FRAME,
        span.params,
      ),
      arms: [
        {
          name: 'hand',
          paint: paintWith(spanHand, span.channels, FRAME, span.params),
        },
        {
          name: 'control',
          paint: paintWith(spanControl, span.channels, FRAME, span.params),
        },
        ...walked(walkers.shared, walkers.span, spanPlanOf, spanWalk),
        {
          name: 'splitTwins',
          paint: paintWith(spanSplitTwins, span.channels, FRAME, span.params),
        },
      ],
      instances: [spanWalk.from, spanWalk.to],
      placements: [
        ...walkPlacements(
          walkers.shared,
          walkers.span,
          spanPlanOf(span.forward),
          spanWalk,
        ),
        {
          name: 'splitTwins',
          at: i =>
            spanSplitTwinsInk(span.channels, span.forward, span.params, i),
        },
      ],
    },
    {
      name: 'deletion',
      entries: n,
      forward: gaps.forward,
      reversed: gaps.reversed,
      reference: (ctx, block) => {
        DELETION_MARK.paintBlock(ctx, gaps.region, block, state)
      },
      arms: [
        {
          name: 'hand',
          paint: paintWith(
            pileupHand(DELETION_SPEC).paintBlock,
            deletion,
            state,
            state,
          ),
        },
        {
          name: 'control',
          paint: paintWith(
            pileupControl(DELETION_SPEC).paintBlock,
            deletion,
            state,
            state,
          ),
        },
        ...walked(
          walkers.shared,
          walkers.deletion,
          deletionPlanOf,
          deletionWalk,
        ),
        {
          name: 'pileupShared',
          paint: paintWith(
            sharedPileupPainter(DELETION_SPEC),
            deletion,
            state,
            state,
          ),
        },
      ],
      instances: [deletionWalk.from, deletionWalk.to],
      placements: walkPlacements(
        walkers.shared,
        walkers.deletion,
        deletionPlanOf(gaps.forward),
        deletionWalk,
      ),
    },
    {
      name: 'mismatch',
      entries: n,
      forward: mismatches.forward,
      reversed: mismatches.reversed,
      reference: (ctx, block) => {
        MISMATCH_MARK.paintBlock(ctx, mismatches.region, block, state)
      },
      arms: [
        {
          name: 'hand',
          paint: paintWith(
            pileupHand(MISMATCH_SPEC).paintBlock,
            mismatches.channels,
            state,
            state,
          ),
        },
        {
          name: 'control',
          paint: paintWith(
            pileupControl(MISMATCH_SPEC).paintBlock,
            mismatches.channels,
            state,
            state,
          ),
        },
        ...walked(
          walkers.shared,
          walkers.mismatch,
          mismatchPlanOf,
          mismatchWalk,
        ),
        {
          name: 'pileupShared',
          paint: paintWith(
            sharedPileupPainter(MISMATCH_SPEC),
            mismatches.channels,
            state,
            state,
          ),
        },
      ],
      instances: [mismatchWalk.from, mismatchWalk.to],
      placements: walkPlacements(
        walkers.shared,
        walkers.mismatch,
        mismatchPlanOf(mismatches.forward),
        mismatchWalk,
      ),
    },
    {
      name: 'rect',
      entries: n,
      forward: rects.forward,
      reversed: rects.reversed,
      reference: paintWith(
        rectShape.paintBlock,
        rects.channels,
        FRAME,
        rects.params,
      ),
      arms: [
        {
          name: 'hand',
          paint: paintWith(rectHand, rects.channels, FRAME, rects.params),
        },
        {
          name: 'control',
          paint: paintWith(rectControl, rects.channels, FRAME, rects.params),
        },
        ...walked(walkers.shared, walkers.rect, rectPlanOf, rectWalk),
        {
          name: 'placed',
          paint: paintWith(rectPlaced, rects.channels, FRAME, rects.params),
        },
        {
          name: 'placedFlat',
          paint: paintWith(rectPlacedFlat, rects.channels, FRAME, rects.params),
        },
        {
          name: 'placedSplit',
          paint: paintWith(
            rectPlacedSplit,
            rects.channels,
            FRAME,
            rects.params,
          ),
        },
        {
          name: 'splitTwins',
          paint: paintWith(rectSplitTwins, rects.channels, FRAME, rects.params),
        },
        {
          name: 'splitTwinsOut',
          paint: paintWith(
            rectSplitTwinsOut,
            rects.channels,
            FRAME,
            rects.params,
          ),
        },
      ],
      instances: [0, rects.channels.count],
      placements: [
        ...walkPlacements(
          walkers.shared,
          walkers.rect,
          rectPlanOf(rects.forward),
          rectWalk,
        ),
        {
          name: 'placed',
          at: i =>
            rectPlacedInk(
              rects.channels,
              rects.forward,
              FRAME,
              rects.params,
              i,
            ),
        },
        {
          name: 'placedFlat',
          at: i =>
            rectPlacedFlatInk(
              rects.channels,
              rects.forward,
              FRAME,
              rects.params,
              i,
            ),
        },
        {
          name: 'placedSplit',
          at: i =>
            rectPlacedSplitInk(
              rects.channels,
              rects.forward,
              FRAME,
              rects.params,
              i,
            ),
        },
        {
          name: 'splitTwins',
          at: i =>
            rectSplitTwinsInk(
              rects.channels,
              rects.forward,
              FRAME,
              rects.params,
              i,
            ),
        },
        {
          name: 'splitTwinsOut',
          at: i =>
            rectSplitTwinsOutInk(
              rects.channels,
              rects.forward,
              FRAME,
              rects.params,
              i,
            ),
        },
      ],
    },
    {
      name: 'cell',
      entries: cells.channels.count,
      forward: cells.forward,
      reversed: cells.reversed,
      reference: paintWith(
        cellMark.paintBlock,
        cells.channels,
        FRAME,
        cells.params,
      ),
      arms: [
        {
          name: 'hand',
          paint: paintWith(cellHand, cells.channels, FRAME, cells.params),
        },
        {
          name: 'control',
          paint: paintWith(cellControl, cells.channels, FRAME, cells.params),
        },
        ...walked(walkers.shared, walkers.cell, cellPlanOf, cellWalk),
        {
          name: 'placed',
          paint: paintWith(cellPlaced, cells.channels, FRAME, cells.params),
        },
        {
          name: 'placedFlat',
          paint: paintWith(cellPlacedFlat, cells.channels, FRAME, cells.params),
        },
        {
          name: 'splitTwins',
          paint: paintWith(cellSplitTwins, cells.channels, FRAME, cells.params),
        },
        {
          name: 'splitTwinsOut',
          paint: paintWith(
            cellSplitTwinsOut,
            cells.channels,
            FRAME,
            cells.params,
          ),
        },
      ],
      instances: [0, cells.channels.count],
      placements: [
        ...walkPlacements(
          walkers.shared,
          walkers.cell,
          cellPlanOf(cells.forward),
          cellWalk,
        ),
        {
          name: 'placed',
          at: i =>
            cellPlacedInk(
              cells.channels,
              cells.forward,
              FRAME,
              cells.params,
              i,
            ),
        },
        {
          name: 'placedFlat',
          at: i =>
            cellPlacedFlatInk(
              cells.channels,
              cells.forward,
              FRAME,
              cells.params,
              i,
            ),
        },
        {
          name: 'splitTwins',
          at: i =>
            cellSplitTwinsInk(
              cells.channels,
              cells.forward,
              FRAME,
              cells.params,
              i,
            ),
        },
        {
          name: 'splitTwinsOut',
          at: i =>
            cellSplitTwinsOutInk(
              cells.channels,
              cells.forward,
              FRAME,
              cells.params,
              i,
            ),
        },
      ],
    },
  ]

  const warmers: Painter[] = pileupWarmFixtures(Math.min(n, 20_000)).flatMap(
    ({ spec, channels }) => {
      const walkChannels = pileupWalkChannels(channels)
      return [
        paintWith(pileupHand(spec).paintBlock, channels, state, state),
        paintWith(pileupControl(spec).paintBlock, channels, state, state),
        paintWith(sharedPileupPainter(spec), channels, state, state),
        walkWith(
          walkers.shared,
          block => pileupPlan(spec, channels, block, state),
          walkChannels,
        ),
      ]
    },
  )

  return { shapes, warmers, pileupBlocks: gaps }
}

function warm(built: ReturnType<typeof buildShapes>, times: number) {
  for (let w = 0; w < times; w++) {
    for (const shape of built.shapes) {
      for (const arm of shape.arms) {
        arm.paint(new CountingContext(), shape.forward)
      }
    }
    for (const warmer of built.warmers) {
      warmer(new CountingContext(), built.pileupBlocks.forward)
    }
  }
}

async function main() {
  const arg = (name: string) =>
    process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1]
  const size = arg('size') ?? '100k'
  const n = size === '1m' ? 1_000_000 : size === '100k' ? 100_000 : Number.NaN
  if (Number.isNaN(n)) {
    console.error('--size=100k or --size=1m')
    process.exit(1)
  }
  const rounds = Number(arg('rounds') ?? 25)
  const outline = process.argv.includes('--outline')

  const walkers: Walkers = {
    shared: await loadCopy('shared'),
    span: await loadCopy('span'),
    deletion: await loadCopy('deletion'),
    mismatch: await loadCopy('mismatch'),
    rect: await loadCopy('rect'),
    cell: await loadCopy('cell'),
  }
  const state = pileupState()
  const built = buildShapes(n, outline, walkers, state)
  const { shapes } = built

  warm(buildShapes(2_000, outline, walkers, state), 300)
  warm(built, 3)

  const expected = shapes.map(shape => {
    const signature = new CountingContext()
    shape.reference(signature, shape.forward)
    return signature
  })

  const best = shapes.map(shape => shape.arms.map(() => Infinity))
  for (let r = 0; r < rounds; r++) {
    for (let s = 0; s < shapes.length; s++) {
      const shapeIndex = (r + s) % shapes.length
      const shape = shapes[shapeIndex]!
      const { arms } = shape
      for (let k = 0; k < arms.length; k++) {
        const armIndex = (r + k) % arms.length
        const ctx = new CountingContext()
        const t0 = performance.now()
        arms[armIndex]!.paint(ctx, shape.forward)
        const ms = performance.now() - t0
        if (!sameCounts(ctx, expected[shapeIndex]!)) {
          console.error(
            `TIMED RUN DIFFERS ${shape.name} ${arms[armIndex]!.name} in round ${r}`,
          )
          process.exit(1)
        }
        best[shapeIndex]![armIndex] = Math.min(best[shapeIndex]![armIndex]!, ms)
      }
    }
  }

  exitOnIdentityFailure(shapes)
  for (const shape of shapes) {
    if (outline && shape.name === 'rect') {
      continue
    }
    const painted = record(shape.arms[0]!.paint, shape.forward)
    for (const placement of shape.placements) {
      const diff = placementDifference(shape, placement, painted)
      if (diff) {
        console.error(`PLACEMENT FAIL ${shape.name} ${placement.name}: ${diff}`)
        process.exit(1)
      }
    }
  }

  const power = execSync('cat /sys/class/power_supply/AC*/online')
    .toString()
    .trim()
  const uptime = execSync('uptime').toString().trim()
  const load1 = Number(/load average: ([\d.]+)/.exec(uptime)?.[1])
  const provisional = power !== '1' || !(load1 <= 6)
  console.log(`AC online: ${power}`)
  console.log(uptime)
  console.log(
    `${provisional ? 'PROVISIONAL: ' : ''}--size=${size}, ${rounds} interleaved rounds, min per arm${outline ? ', outlines on' : ''}`,
  )
  console.log(
    'identity: every arm matches hand and hand the production painter, both orientations; every placement matches the painting',
  )
  console.log('')
  console.log(
    `${'shape'.padEnd(10)}${'entries'.padStart(9)}${'painted'.padStart(9)}${'styles'.padStart(9)}${'hand'.padStart(20)}${ARM_NAMES.slice(
      1,
    )
      .map(name => name.padStart(14))
      .join('')}`,
  )
  for (const [s, shape] of shapes.entries()) {
    const want = expected[s]!
    const times = best[s]!
    const hand = times[0]!
    const cells = ARM_NAMES.slice(1).map(name => {
      const k = shape.arms.findIndex(arm => arm.name === name)
      return (k === -1 ? '-' : `${(times[k]! / hand).toFixed(2)}x`).padStart(14)
    })
    const handCell = `${hand.toFixed(2)}ms ${((hand / shape.entries) * 1e6).toFixed(1)}ns`
    console.log(
      `${shape.name.padEnd(10)}${String(shape.entries).padStart(9)}${String(want.fills + want.paths).padStart(9)}${String(want.styles).padStart(9)}${handCell.padStart(20)}${cells.join('')}`,
    )
  }
}

if (new URL(import.meta.url).searchParams.get('copy') === null) {
  await main()
}
