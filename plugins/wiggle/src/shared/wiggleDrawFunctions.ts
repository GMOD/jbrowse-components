import {
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
import { BandPen, thresholdBandOf } from '@jbrowse/render-core/marks'
import { denormalizeScore, rampMidNorm } from '@jbrowse/render-core/scoreScale'
import { clipSide } from '@jbrowse/render-core/shaders/clipStrip'
import {
  CLIP_STRIP_COLOR,
  CLIP_STRIP_PX,
} from '@jbrowse/render-core/shaders/clipStripConsts'
import { rampMidT } from '@jbrowse/render-core/shaders/colorRampLut'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '@jbrowse/render-core/shaders/rowRect'
import { normalizeScoreUnclamped } from '@jbrowse/render-core/shaders/scoreScale'
import { appendPointMarker, makeScoreNormalizer } from '@jbrowse/wiggle-core'

import { WIGGLE_MIN_PX } from '../util.ts'
import { makeDensityLutFillFn } from './getDensityColor.ts'
import { WHISKER_BAND_OPACITY } from './shaders/wiggleBand.consts.generated.ts'
import { centerLinksToPrevious } from './wiggleComponentUtils.ts'

import type { MarkContext2D } from '@jbrowse/render-core/marks'
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
  rowHeight: number,
  domainY: [number, number],
  scaleType: ScaleTypeCode,
  symlogConstant: number,
) {
  const normalize = makeScoreNormalizer(
    domainY[0],
    domainY[1],
    scaleType,
    symlogConstant,
  )
  return (score: number) => (1 - normalize(score)) * rowHeight
}

// `wiggleCommon.slang`'s `rowColorYPx`: a cut, and the line a line rendering
// is colored along, placed unclamped, so a value the domain excludes keeps its
// side of every cut rather than taking the row edge's.
function makeColorToY(
  rowHeight: number,
  domainY: [number, number],
  scaleType: ScaleTypeCode,
  symlogConstant: number,
) {
  return (cut: number) => {
    const norm = normalizeScoreUnclamped(
      cut,
      domainY[0],
      domainY[1],
      scaleType,
      symlogConstant,
    )
    return (1 - norm) * rowHeight
  }
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
    symlogConstant,
    origin,
    rgb,
  } = row
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType, symlogConstant)
  const originY = scoreToY(origin) + rowTop
  const positions = source.featurePositions
  const scores = source.featureScores
  const rampFill = makeRampFill(row)
  const colorsAbgr = rampFill ? undefined : source.colorsAbgr
  let lastAbgr = NO_COLOR
  if (!colorsAbgr && !rampFill) {
    ctx.fillStyle = rgb
  }
  const toX = makeBpMapper(block)
  const n = source.numFeatures
  let clipped = false
  for (let i = 0; i < n; i++) {
    if (rampFill) {
      ctx.fillStyle = rampFill(scores[i]!)
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
    const top = side > 0 ? rowTop : rowTop + rowHeight - CLIP_STRIP_PX
    ctx.fillRect(spanLeft(x1, x2, w), top, w, CLIP_STRIP_PX)
  }
}

export function drawDensity(row: RowDraw & { rgb: string }) {
  const { ctx, source, block, rowHeight, rowTop, rgb } = row
  const rampFill = makeRampFill(row)
  const colorsAbgr = rampFill ? undefined : source.colorsAbgr
  let lastAbgr = NO_COLOR
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
      ctx.fillStyle = rampFill(scores[i]!)
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

function strokeByBands(
  ctx: MarkContext2D,
  cutYs: number[],
  styles: string[],
  trace: (pen: BandPen) => void,
) {
  const passes = styles.every(style => style === styles[0])
    ? [
        {
          top: Number.NEGATIVE_INFINITY,
          bottom: Number.POSITIVE_INFINITY,
          style: styles[0]!,
        },
      ]
    : bandEdges(cutYs)
        .map((edges, k) => ({ ...edges, style: styles[k]! }))
        .reverse()
  for (const { top, bottom, style } of passes) {
    ctx.strokeStyle = style
    const pen = new BandPen(ctx, top, bottom)
    trace(pen)
    pen.end()
  }
}

// How many bands a gradient's line and min-max band are stroked in on Canvas2D
// and in the SVG export, where the GPU reads the ramp per fragment: neighbours
// this narrow differ by a LUT step or two.
export const RAMP_LINE_BANDS = 32

/**
 * A line row under a gradient as the threshold the line painters already
 * stroke: `RAMP_LINE_BANDS` bands evenly across the part of the y domain the
 * row's values (and the origin a step line drops to) reach, each in the
 * ramp's color at its middle, so a line over a sliver of the ramp still steps
 * through it finely. A domain with no range is the GPU's step: the start color at the
 * domain, the end color above it. Any other row passes through.
 */
export function rampAsBands<R extends RowDraw>(row: R): R {
  const { rampLut, rampMid, domainY, scaleType, symlogConstant, source } = row
  if (!rampLut) {
    return row
  }
  const [min, max] = domainY
  const mid = rampMidNorm(min, max, scaleType, rampMid, symlogConstant)
  const lutColor = (t: number): [number, number, number] => {
    const i = Math.min(Math.max(Math.round(rampMidT(t, mid) * 255), 0), 255) * 4
    return [rampLut[i]! / 255, rampLut[i + 1]! / 255, rampLut[i + 2]! / 255]
  }
  if (!(max > min)) {
    return {
      ...row,
      cuts: [min + Math.abs(min) * 1e-6 + 1e-12],
      innerColors: [],
      source: { ...source, negColor: lutColor(0), color: lutColor(1) },
    }
  }
  const normOf = (score: number) =>
    Math.min(
      Math.max(
        normalizeScoreUnclamped(score, min, max, scaleType, symlogConstant),
        0,
      ),
      1,
    )
  let lo = 1
  let hi = 0
  const reach = (score: number) => {
    if (Number.isFinite(score)) {
      const t = normOf(score)
      lo = Math.min(lo, t)
      hi = Math.max(hi, t)
    }
  }
  for (let i = 0; i < source.numFeatures; i++) {
    reach(source.featureScores[i]!)
    if (source.band) {
      reach(source.band.minScores[i]!)
    }
  }
  if (source.gapScore !== undefined) {
    reach(source.gapScore)
  }
  if (lo > hi) {
    return row
  }
  const n = RAMP_LINE_BANDS
  const tOf = (k: number) => lo + ((hi - lo) * k) / n
  const colors =
    hi > lo
      ? Array.from({ length: n }, (_, k) => lutColor(tOf(k + 0.5)))
      : [lutColor(lo)]
  return {
    ...row,
    cuts: Array.from({ length: colors.length - 1 }, (_, k) =>
      denormalizeScore(tOf(k + 1), min, max, scaleType, symlogConstant),
    ),
    innerColors: colors.slice(1, -1),
    source: { ...source, negColor: colors[0]!, color: colors.at(-1)! },
  }
}

export function drawLine({
  ctx,
  source,
  block,
  rowHeight,
  rowTop,
  domainY,
  scaleType,
  symlogConstant,
  cuts,
  innerColors,
  rgb,
  negRgb,
  lineWidth,
}: RowDraw & { rgb: string; negRgb: string; lineWidth: number }) {
  const n = source.numFeatures
  if (n === 0) {
    return
  }
  ctx.lineWidth = lineWidth
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType, symlogConstant)
  const colorToY = makeColorToY(rowHeight, domainY, scaleType, symlogConstant)
  const gapY = scoreToY(source.gapScore ?? 0) + rowTop
  const positions = source.featurePositions
  const scores = source.featureScores
  const toX = makeBpMapper(block)
  strokeByBands(
    ctx,
    cuts.map(cut => colorToY(Math.fround(cut)) + rowTop),
    bandStyles(negRgb, innerColors, rgb, normalizedRgbToCss),
    pen => {
      let inRun = false
      for (let i = 0; i < n; i++) {
        const endBp = positions[i * 2 + 1]!
        const x1 = toX(positions[i * 2]!)
        const x2 = toX(endBp)
        const scoreY = scoreToY(scores[i]!) + rowTop
        const scoreColorY = colorToY(scores[i]!) + rowTop
        if (!inRun) {
          pen.moveTo(x1, gapY)
          inRun = true
        }
        pen.lineTo(x1, scoreY)
        pen.recolor(scoreColorY)
        pen.lineTo(x2, scoreY, scoreColorY)
        pen.recolor(scoreY)
        if (i === n - 1 || positions[(i + 1) * 2] !== endBp) {
          pen.lineTo(x2, gapY)
          inRun = false
        }
      }
    },
  )
}

// Point-to-point line: connects the score at each feature's bp midpoint to its
// neighbor's, instead of the stepped bar-tops drawLine traces. Connects
// consecutive pairs regardless of bp-adjacency, so sporadic non-tiling bins in
// reduced data don't dash the line — only a hole wider than `gapLimitBp` breaks
// the run, and that threshold is the layer's own (see buildSourceRenderData), so
// this and the GPU's NO_PREV_START encoding break in the same places.
//
// A break opens a new subpath with a zero-length segment rather than a bare
// moveTo: under the round caps this mode already sets, that paints a dot, which
// is what the shader's collapsed capsule draws at the same spot. Without it an
// isolated point between two holes would vanish on Canvas2D and show on the GPU.
export function drawLineCenter({
  ctx,
  source,
  block,
  rowHeight,
  rowTop,
  domainY,
  scaleType,
  symlogConstant,
  cuts,
  innerColors,
  rgb,
  negRgb,
  lineWidth,
}: RowDraw & { rgb: string; negRgb: string; lineWidth: number }) {
  const n = source.numFeatures
  if (n === 0) {
    return
  }
  ctx.lineWidth = lineWidth
  // Round joins/caps match the GPU capsule so sharp bends don't nick.
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType, symlogConstant)
  const positions = source.featurePositions
  const scores = source.featureScores
  const toX = makeBpMapper(block)
  const gapLimitBp = source.gapLimitBp ?? Number.POSITIVE_INFINITY
  const colorToY = makeColorToY(rowHeight, domainY, scaleType, symlogConstant)
  strokeByBands(
    ctx,
    cuts.map(cut => colorToY(Math.fround(cut)) + rowTop),
    bandStyles(negRgb, innerColors, rgb, normalizedRgbToCss),
    pen => {
      for (let i = 0; i < n; i++) {
        const cx = (toX(positions[i * 2]!) + toX(positions[i * 2 + 1]!)) / 2
        const cy = scoreToY(scores[i]!) + rowTop
        const colorY = colorToY(scores[i]!) + rowTop
        if (!centerLinksToPrevious(positions, i, gapLimitBp)) {
          pen.moveTo(cx, cy, colorY)
        }
        pen.lineTo(cx, cy, colorY)
      }
    },
  )
}

// Keeps a long run inside CappedPath's per-path budget.
const BAND_BINS_PER_POLYGON = 1000

// One polygon per run, broken where the line over it breaks. Each cut's clip
// sits on a device pixel so neighbouring colors meet without a seam.
export function drawMinMaxBand({
  ctx,
  source,
  block,
  rowHeight,
  rowTop,
  domainY,
  scaleType,
  symlogConstant,
  cuts,
  innerColors,
  interpolated,
}: RowDraw & { interpolated: boolean }) {
  const { band, numFeatures: n } = source
  if (!band || n === 0) {
    return
  }
  const positions = source.featurePositions
  const maxScores = source.featureScores
  const { minScores } = band
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType, symlogConstant)
  const toX = makeBpMapper(block)
  const gapLimitBp = source.gapLimitBp ?? Number.POSITIVE_INFINITY
  const linked = (i: number) =>
    interpolated
      ? centerLinksToPrevious(positions, i, gapLimitBp)
      : positions[i * 2 - 1] === positions[i * 2]

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
    const cutToY = makeColorToY(rowHeight, domainY, scaleType, symlogConstant)
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
  const {
    ctx,
    source,
    block,
    rowHeight,
    rowTop,
    domainY,
    scaleType,
    symlogConstant,
    rgb,
    diameterPx,
  } = row
  const rampFill = makeRampFill(row)
  const colorsAbgr = rampFill ? undefined : source.colorsAbgr
  if (!colorsAbgr && !rampFill) {
    ctx.fillStyle = rgb
  }
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType, symlogConstant)
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
