import {
  abgrBlue,
  abgrGreen,
  abgrRed,
  normalizedRgbToCss,
  normalizedRgbToCssRgba,
  setAbgrFill,
} from '@jbrowse/core/util/colorBits'
import {
  CANVAS_SEAM_PX,
  CappedPath,
  getDpr,
  makeBpMapper,
  spanLeft,
  withClip,
} from '@jbrowse/render-core/canvas2dUtils'
import {
  BandPen,
  interleavedSpans,
  lineColorYPx,
  rampAsThreshold,
  rowLineFrame,
  thresholdBandOf,
  traceCenter,
  traceStep,
} from '@jbrowse/render-core/marks'
import {
  SCALE_TYPE_LOG,
  SCALE_TYPE_SYMLOG,
  makeUnclampedScoreNormalizer,
} from '@jbrowse/render-core/scoreScale'
import {
  clipSide,
  clipStripTopPx,
} from '@jbrowse/render-core/shaders/clipStrip'
import {
  CLIP_STRIP_COLOR,
  CLIP_STRIP_PX,
} from '@jbrowse/render-core/shaders/clipStripConsts'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '@jbrowse/render-core/shaders/rowRect'
import { appendPointMarker, makeScoreNormalizer } from '@jbrowse/wiggle-core'

import { WIGGLE_MIN_PX } from '../util.ts'
import { makeDensityLutFillFn } from './getDensityColor.ts'
import { WHISKER_BAND_OPACITY } from './shaders/wiggleBand.consts.generated.ts'

import type {
  LineFrame,
  MarkContext2D,
  MarkValueScaleType,
} from '@jbrowse/render-core/marks'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { ScaleTypeCode } from '@jbrowse/render-core/scoreScale'
import type { SourceRenderData } from '@jbrowse/wiggle-core'

// One source's features painted into one block's row. Shared by every render
// mode; each mode adds its own color/size fields (see the per-fn args below).
// Built once per source per block, so spreading into it isn't a hot path.
export interface RowDraw {
  ctx: MarkContext2D
  source: SourceRenderData
  block: RenderBlock
  rowHeight: number
  rowTop: number
  domainY: [number, number]
  scaleType: ScaleTypeCode
  // symlog's linear-region width, already resolved from the domain. Unread by
  // the other scales, but carried on every row draw so the Canvas2D fallback
  // and the SVG export normalize with the number the shader was handed.
  symlogConstant: number
  // The score xyplot bars grow from.
  origin: number
  // Where a line's and band's color changes, ascending, and
  // the color of each band between two of them.
  cuts: number[]
  innerColors: [number, number, number][]
  // A gradient's table: bars, points and density color through it, matching
  // the LUT texture the GPU samples, and the row's own color goes unused.
  rampLut: Uint8Array | null
  // The score at the gradient's middle stop.
  rampMid: number | undefined
}

// Every painter honours a layer's per-instance colors, or Canvas2D and the
// SVG export diverge from the shader. A band holds one packed value per color
// band, so switching fill only on a change batches the features into runs.
// `-1` can't collide with a u32 ABGR value.
const NO_COLOR = -1

function makeScoreToY(
  makeNormalizer: typeof makeScoreNormalizer,
  { rowHeight, domainY, scaleType, symlogConstant }: RowDraw,
) {
  const normalize = makeNormalizer(
    domainY[0],
    domainY[1],
    scaleType,
    symlogConstant,
  )
  return (score: number) => (1 - normalize(score)) * rowHeight
}

function makeRampFill({
  domainY,
  scaleType,
  symlogConstant,
  rampLut,
  rampMid,
}: RowDraw) {
  return rampLut
    ? makeDensityLutFillFn(
        domainY[0],
        domainY[1],
        scaleType,
        rampLut,
        rampMid,
        symlogConstant,
      )
    : undefined
}

export function drawXYPlot(row: RowDraw & { rgb: string }) {
  const {
    ctx,
    source,
    block,
    rowHeight,
    rowTop,
    domainY,
    scaleType,
    origin,
    rgb,
  } = row
  const scoreToY = makeScoreToY(makeScoreNormalizer, row)
  const originY = scoreToY(origin) + rowTop
  const positions = source.featurePositions
  const scores = source.featureScores
  const rampFill = makeRampFill(row)
  const colorsAbgr = rampFill ? undefined : source.colorsAbgr
  let lastAbgr = NO_COLOR
  let lastFill = ''
  if (!colorsAbgr && !rampFill) {
    ctx.fillStyle = rgb
  }
  const toX = makeBpMapper(block)
  const n = source.numFeatures
  let clipped = false
  for (let i = 0; i < n; i++) {
    if (rampFill) {
      const fill = rampFill(scores[i]!)
      if (fill !== lastFill) {
        ctx.fillStyle = fill
        lastFill = fill
      }
    } else if (colorsAbgr) {
      const c = colorsAbgr[i]!
      if (c !== lastAbgr) {
        setAbgrFill(ctx, c)
        lastAbgr = c
      }
    }
    const x1 = toX(positions[i * 2]!)
    const x2 = toX(positions[i * 2 + 1]!)
    const score = scores[i]!
    const scoreY = scoreToY(score) + rowTop
    const w = Math.max(WIGGLE_MIN_PX, Math.abs(x2 - x1) + CANVAS_SEAM_PX)
    // bar grows from the score baseline (originY) up or down to the score
    ctx.fillRect(
      spanLeft(x1, x2, w),
      Math.min(scoreY, originY),
      w,
      Math.abs(originY - scoreY),
    )
    clipped ||= clipSide(score, domainY[0], domainY[1], scaleType) !== 0
  }
  if (!clipped) {
    return
  }
  // After every bar, so no neighbour widened to the min-width floor covers a
  // strip; the shader draws each strip right after its own bar, where the
  // next bar can.
  setAbgrFill(ctx, CLIP_STRIP_COLOR)
  for (let i = 0; i < n; i++) {
    const side = clipSide(scores[i]!, domainY[0], domainY[1], scaleType)
    if (side === 0) {
      continue
    }
    const x1 = toX(positions[i * 2]!)
    const x2 = toX(positions[i * 2 + 1]!)
    const w = Math.max(WIGGLE_MIN_PX, Math.abs(x2 - x1) + CANVAS_SEAM_PX)
    ctx.fillRect(
      spanLeft(x1, x2, w),
      clipStripTopPx(side, rowTop, rowHeight),
      w,
      CLIP_STRIP_PX,
    )
  }
}

export function drawDensity(row: RowDraw & { rgb: string }) {
  const { ctx, source, block, rowHeight, rowTop, rgb } = row
  const rampFill = makeRampFill(row)
  const colorsAbgr = rampFill ? undefined : source.colorsAbgr
  let lastAbgr = NO_COLOR
  let lastFill = ''
  if (!colorsAbgr && !rampFill) {
    ctx.fillStyle = rgb
  }
  const positions = source.featurePositions
  const scores = source.featureScores
  const toX = makeBpMapper(block)
  const n = source.numFeatures
  // Density tiles its rows edge to edge, so rowProportion is 1.
  const bandHeight = drawnRowHeightPx(rowHeight, 1)
  const bandTop = rowTop + rowBandOffsetPx(rowHeight, 1)
  for (let i = 0; i < n; i++) {
    if (rampFill) {
      const fill = rampFill(scores[i]!)
      if (fill !== lastFill) {
        ctx.fillStyle = fill
        lastFill = fill
      }
    } else if (colorsAbgr) {
      const c = colorsAbgr[i]!
      if (c !== lastAbgr) {
        setAbgrFill(ctx, c)
        lastAbgr = c
      }
    }
    const x1 = toX(positions[i * 2]!)
    const x2 = toX(positions[i * 2 + 1]!)
    const w = Math.max(WIGGLE_MIN_PX, Math.abs(x2 - x1) + CANVAS_SEAM_PX)
    ctx.fillRect(spanLeft(x1, x2, w), bandTop, w, bandHeight)
  }
}

// Each band's screen edges, lowest band first (painted highest first, as the
// positive side always was): band k lies between cut k and
// cut k-1, and the lowest and highest run to the row's ends.
function bandEdges(cutYs: number[]) {
  return Array.from({ length: cutYs.length + 1 }, (_, k) => ({
    top: k < cutYs.length ? cutYs[k]! : Number.NEGATIVE_INFINITY,
    bottom: k > 0 ? cutYs[k - 1]! : Number.POSITIVE_INFINITY,
  }))
}

function bandStyles(
  negStyle: string,
  innerColors: [number, number, number][],
  posStyle: string,
  style: (rgb: [number, number, number]) => string,
) {
  return [negStyle, ...innerColors.map(style), posStyle]
}

type LineRowDraw = RowDraw & { rgb: string; negRgb: string; lineWidth: number }

function strokeByBands(
  row: LineRowDraw,
  trace: (pen: BandPen, frame: LineFrame) => void,
) {
  const { ctx, cuts, innerColors, rgb, negRgb, lineWidth } = row
  ctx.lineWidth = lineWidth
  const frame = rowLineFrame(
    row.block,
    row.rowTop,
    row.rowHeight,
    row.domainY,
    row.scaleType,
    row.symlogConstant,
  )
  const styles = bandStyles(negRgb, innerColors, rgb, normalizedRgbToCss)
  const passes = styles.every(style => style === styles[0])
    ? [
        {
          top: Number.NEGATIVE_INFINITY,
          bottom: Number.POSITIVE_INFINITY,
          style: styles[0]!,
        },
      ]
    : bandEdges(cuts.map(cut => lineColorYPx(frame, Math.fround(cut), 0)))
        .map((edges, k) => ({ ...edges, style: styles[k]! }))
        .reverse()
  for (const { top, bottom, style } of passes) {
    ctx.strokeStyle = style
    const pen = new BandPen(ctx, top, bottom)
    trace(pen, frame)
    pen.end()
  }
}

function sourceSpans(source: SourceRenderData) {
  return interleavedSpans(
    source.featurePositions,
    source.featureScores,
    source.numFeatures,
  )
}

function scaleNameOf(scaleType: ScaleTypeCode): MarkValueScaleType {
  return scaleType === SCALE_TYPE_LOG
    ? 'log'
    : scaleType === SCALE_TYPE_SYMLOG
      ? 'symlog'
      : 'linear'
}

function normalizedRgbOf(abgr: number): [number, number, number] {
  return [abgrRed(abgr) / 255, abgrGreen(abgr) / 255, abgrBlue(abgr) / 255]
}

/**
 * A line row under a gradient as the threshold the line painters already
 * stroke: render-core's `rampAsThreshold` over the scores the row reaches,
 * the origin a step line drops to included. Any other row passes through.
 */
export function rampAsBands<R extends RowDraw>(row: R): R {
  const { rampLut, rampMid, domainY, scaleType, symlogConstant, source } = row
  if (!rampLut) {
    return row
  }
  const { numFeatures, band, gapScore } = source
  let low = Number.POSITIVE_INFINITY
  let high = Number.NEGATIVE_INFINITY
  for (const scores of band
    ? [source.featureScores, band.minScores]
    : [source.featureScores]) {
    for (let i = 0; i < numFeatures; i++) {
      const score = scores[i]!
      if (Number.isFinite(score)) {
        low = Math.min(low, score)
        high = Math.max(high, score)
      }
    }
  }
  if (gapScore !== undefined && Number.isFinite(gapScore)) {
    low = Math.min(low, gapScore)
    high = Math.max(high, gapScore)
  }
  const { cuts, colors } = rampAsThreshold(
    {
      domain: domainY,
      scale: scaleNameOf(scaleType),
      lut: rampLut,
      mid: rampMid,
    },
    low,
    high,
    symlogConstant,
  )
  const rgbs = Array.from(colors, normalizedRgbOf)
  return {
    ...row,
    cuts: [...cuts],
    innerColors: rgbs.slice(1, -1),
    source: { ...source, negColor: rgbs[0]!, color: rgbs.at(-1)! },
  }
}

// A layer's spans are one row and one series, so render-core's step breaks
// exactly where the bins stop abutting, dropping to the layer's gap score.
export function drawLine(row: LineRowDraw) {
  const { source } = row
  if (source.numFeatures > 0) {
    const spans = sourceSpans(source)
    const gapScore = source.gapScore ?? 0
    strokeByBands(row, (pen, frame) => {
      traceStep(pen, spans, frame, undefined, gapScore)
    })
  }
}

// Point-to-point line through each bin's midpoint. A layer carries no `gapBp`,
// so every consecutive pair is joined, a hole included: sporadic non-tiling
// bins in reduced data don't dash the line.
export function drawLineCenter(row: LineRowDraw) {
  const { ctx, source } = row
  if (source.numFeatures > 0) {
    // Round joins/caps match the GPU capsule so sharp bends don't nick.
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    const spans = sourceSpans(source)
    strokeByBands(row, (pen, frame) => {
      traceCenter(pen, spans, frame, undefined)
    })
  }
}

// Keeps a long run inside CappedPath's per-path budget.
const BAND_BINS_PER_POLYGON = 1000

// One polygon per run, broken where the line over it breaks. Each cut's clip
// sits on a device pixel so neighbouring colors meet without a seam.
export function drawMinMaxBand(row: RowDraw & { interpolated: boolean }) {
  const {
    ctx,
    source,
    block,
    rowHeight,
    rowTop,
    cuts,
    innerColors,
    interpolated,
  } = row
  const { band, numFeatures: n } = source
  if (!band || n === 0) {
    return
  }
  const positions = source.featurePositions
  const maxScores = source.featureScores
  const { minScores } = band
  const scoreToY = makeScoreToY(makeScoreNormalizer, row)
  const toX = makeBpMapper(block)
  const linked = (i: number) =>
    interpolated || positions[i * 2 - 1] === positions[i * 2]

  const polygons: [number, number][] = []
  let start = 0
  for (let i = 1; i <= n; i++) {
    const joins = i < n && linked(i)
    if (!joins || i - start === BAND_BINS_PER_POLYGON) {
      if (!interpolated || i - start > 1) {
        polygons.push([start, i])
      }
      start = joins && interpolated ? i - 1 : i
    }
  }

  const centerX = (i: number) =>
    (toX(positions[i * 2]!) + toX(positions[i * 2 + 1]!)) / 2
  const trace = () => {
    const path = new CappedPath(ctx, 'fill')
    for (const [s, e] of polygons) {
      for (let i = s; i < e; i++) {
        path.add()
      }
      if (interpolated) {
        ctx.moveTo(centerX(s), scoreToY(maxScores[s]!) + rowTop)
        for (let i = s + 1; i < e; i++) {
          ctx.lineTo(centerX(i), scoreToY(maxScores[i]!) + rowTop)
        }
        for (let i = e - 1; i >= s; i--) {
          ctx.lineTo(centerX(i), scoreToY(minScores[i]!) + rowTop)
        }
      } else {
        ctx.moveTo(toX(positions[s * 2]!), scoreToY(maxScores[s]!) + rowTop)
        for (let i = s; i < e; i++) {
          const y = scoreToY(maxScores[i]!) + rowTop
          ctx.lineTo(toX(positions[i * 2]!), y)
          ctx.lineTo(toX(positions[i * 2 + 1]!), y)
        }
        for (let i = e - 1; i >= s; i--) {
          const y = scoreToY(minScores[i]!) + rowTop
          ctx.lineTo(toX(positions[i * 2 + 1]!), y)
          ctx.lineTo(toX(positions[i * 2]!), y)
        }
      }
      ctx.closePath()
    }
    path.flush()
  }

  let low = Number.POSITIVE_INFINITY
  let high = Number.NEGATIVE_INFINITY
  for (let i = 0; i < n; i++) {
    if (minScores[i]! < low) {
      low = minScores[i]!
    }
    if (maxScores[i]! > high) {
      high = maxScores[i]!
    }
  }
  const lowest = thresholdBandOf(low, cuts)
  const highest = thresholdBandOf(high, cuts)
  const fills = bandStyles(
    normalizedRgbToCssRgba(
      source.negColor ?? source.color,
      WHISKER_BAND_OPACITY,
    ),
    innerColors,
    normalizedRgbToCssRgba(source.color, WHISKER_BAND_OPACITY),
    rgb => normalizedRgbToCssRgba(rgb, WHISKER_BAND_OPACITY),
  )
  const drawn = fills.slice(lowest, highest + 1)
  if (drawn.every(fill => fill === drawn[0])) {
    ctx.fillStyle = drawn[0] ?? fills[0]!
    trace()
  } else {
    const dpr = getDpr()
    const rowBottom = rowTop + rowHeight
    // `wiggleCommon.slang`'s `rowColorYPx`: a cut placed unclamped, so a
    // value the domain excludes keeps its side of every cut rather than
    // taking the row edge's.
    const cutToY = makeScoreToY(makeUnclampedScoreNormalizer, row)
    const snapped = cuts.map(
      cut => Math.round((cutToY(Math.fround(cut)) + rowTop) * dpr) / dpr,
    )
    for (const [k, { top, bottom }] of [
      ...bandEdges(snapped).entries(),
    ].reverse()) {
      if (k >= lowest && k <= highest) {
        const clipTop = Math.max(top, rowTop - 1)
        const clipBottom = Math.min(bottom, rowBottom + 1)
        withClip(ctx, -1e6, clipTop, 2e6, clipBottom - clipTop, () => {
          ctx.fillStyle = fills[k]!
          trace()
        })
      }
    }
  }
}

export function drawScatter(
  row: RowDraw & { rgb: string; diameterPx: number },
) {
  const { ctx, source, block, rowTop, rgb, diameterPx } = row
  const rampFill = makeRampFill(row)
  const colorsAbgr = rampFill ? undefined : source.colorsAbgr
  if (!colorsAbgr && !rampFill) {
    ctx.fillStyle = rgb
  }
  const scoreToY = makeScoreToY(makeScoreNormalizer, row)
  const positions = source.featurePositions
  const scores = source.featureScores
  const toX = makeBpMapper(block)
  const n = source.numFeatures
  // Every feature draws as a point marker (square/disc via appendPointMarker)
  // centered on the bp midpoint. Mirrors the GPU wiggle.slang scatter branch.
  const path = new CappedPath(ctx, 'fill')
  let lastAbgr = NO_COLOR
  let lastFill = ''
  for (let i = 0; i < n; i++) {
    if (rampFill) {
      const fill = rampFill(scores[i]!)
      if (fill !== lastFill) {
        path.flush()
        ctx.fillStyle = fill
        lastFill = fill
      }
    } else if (colorsAbgr) {
      const c = colorsAbgr[i]!
      if (c !== lastAbgr) {
        path.flush()
        setAbgrFill(ctx, c)
        lastAbgr = c
      }
    }
    path.add()
    const cx = (toX(positions[i * 2]!) + toX(positions[i * 2 + 1]!)) / 2
    const scoreY = scoreToY(scores[i]!) + rowTop
    appendPointMarker(ctx, cx, scoreY, diameterPx)
  }
  path.flush()
}
