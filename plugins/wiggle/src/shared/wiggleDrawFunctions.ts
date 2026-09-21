import { setAbgrFill } from '@jbrowse/core/util/colorBits'
import {
  CANVAS_SEAM_PX,
  CappedPath,
  getDpr,
  makeBpMapper,
  spanLeft,
  withClip,
} from '@jbrowse/render-core/canvas2dUtils'
import {
  drawnRowHeightPx,
  rowBandOffsetPx,
} from '@jbrowse/render-core/shaders/rowRect'
import { appendPointMarker, makeScoreNormalizer } from '@jbrowse/wiggle-core'

import { WIGGLE_MIN_PX } from '../util.ts'
import {
  makeDensityLutFillFn,
  makeDensityRgbStringFn,
} from './getDensityColor.ts'
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
  // The lowest cut, and the white of the two-sided density fade.
  pivot: number
  // Where a line's and band's colour changes, ascending, `pivot` first, and
  // the colour of each band between two of them.
  cuts: number[]
  innerColors: [number, number, number][]
}

// Per-instance colors (summary bands) exist on every layer the GPU encodes
// them for, so each draw fn must honor them or the Canvas2D fallback and the
// SVG export diverge from the on-screen shader. A band holds only two packed
// values, so switching on change batches into a couple of runs rather than one
// state change per feature. `-1` can't collide with a u32 ABGR value.
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

export function drawXYPlot({
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
}: RowDraw & { rgb: string }) {
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType, symlogConstant)
  const originY = scoreToY(origin) + rowTop
  const positions = source.featurePositions
  const scores = source.featureScores
  const colorsAbgr = source.colorsAbgr
  let lastAbgr = NO_COLOR
  if (!colorsAbgr) {
    ctx.fillStyle = rgb
  }
  const toX = makeBpMapper(block)
  const n = source.numFeatures
  for (let i = 0; i < n; i++) {
    if (colorsAbgr) {
      const c = colorsAbgr[i]!
      if (c !== lastAbgr) {
        setAbgrFill(ctx, c)
        lastAbgr = c
      }
    }
    const x1 = toX(positions[i * 2]!)
    const x2 = toX(positions[i * 2 + 1]!)
    const scoreY = scoreToY(scores[i]!) + rowTop
    const w = Math.max(WIGGLE_MIN_PX, Math.abs(x2 - x1) + CANVAS_SEAM_PX)
    // bar grows from the score baseline (originY) up or down to the score
    ctx.fillRect(
      spanLeft(x1, x2, w),
      Math.min(scoreY, originY),
      w,
      Math.abs(originY - scoreY),
    )
  }
}

// `rampLut` is the named-ramp mode (the resolved `densityColorRamp` LUT): when
// present the row colours through it, matching the LUT texture the GPU pass
// samples, and the per-row track colour goes unused — a single LUT is exactly
// what cannot vary per row.
export function drawDensity({
  ctx,
  source,
  block,
  rowHeight,
  rowTop,
  domainY,
  scaleType,
  symlogConstant,
  pivot,
  r,
  g,
  b,
  rampLut,
  rampMid,
}: RowDraw & {
  r: number
  g: number
  b: number
  rampLut: Uint8Array | null
  rampMid: number | undefined
}) {
  const colorFn = rampLut
    ? makeDensityLutFillFn(
        domainY[0],
        domainY[1],
        scaleType,
        rampLut,
        rampMid,
        symlogConstant,
      )
    : makeDensityRgbStringFn(
        domainY[0],
        domainY[1],
        scaleType,
        r,
        g,
        b,
        pivot,
        symlogConstant,
      )
  const positions = source.featurePositions
  const scores = source.featureScores
  const toX = makeBpMapper(block)
  const n = source.numFeatures
  // Density tiles its rows edge to edge, so rowProportion is 1.
  const bandHeight = drawnRowHeightPx(rowHeight, 1)
  const bandTop = rowTop + rowBandOffsetPx(rowHeight, 1)
  for (let i = 0; i < n; i++) {
    const x1 = toX(positions[i * 2]!)
    const x2 = toX(positions[i * 2 + 1]!)
    const w = Math.max(WIGGLE_MIN_PX, Math.abs(x2 - x1) + CANVAS_SEAM_PX)
    ctx.fillStyle = colorFn(scores[i]!)
    ctx.fillRect(spanLeft(x1, x2, w), bandTop, w, bandHeight)
  }
}

// The part of the segment from y0 to y1, as a fraction of it, inside the band
// top < y <= bottom; undefined where it misses. A band owns its lower edge,
// so a line lying on a cut takes the colour above it, as the shader does.
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

// Keeps the part of each segment inside one band, cut where it crosses the
// band's edges, so a line stroked once per band changes colour where the
// shader's does.
class BandPen {
  private x = 0
  private y = 0
  private drawing = false

  constructor(
    private ctx: MarkContext2D,
    private path: CappedPath,
    private top: number,
    private bottom: number,
  ) {}

  moveTo(x: number, y: number) {
    this.x = x
    this.y = y
    this.drawing = false
  }

  lineTo(x: number, y: number) {
    const span = bandSpan(this.y, y, this.top, this.bottom)
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
    const path = new CappedPath(ctx, 'stroke')
    trace(new BandPen(ctx, path, top, bottom))
    path.flush()
  }
}

function lineRgb([r, g, b]: [number, number, number]) {
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`
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
  const zeroY = scoreToY(0) + rowTop
  const positions = source.featurePositions
  const scores = source.featureScores
  const toX = makeBpMapper(block)
  strokeByBands(
    ctx,
    cuts.map(cut => scoreToY(cut) + rowTop),
    bandStyles(negRgb, innerColors, rgb, lineRgb),
    pen => {
      let inRun = false
      for (let i = 0; i < n; i++) {
        const endBp = positions[i * 2 + 1]!
        const x1 = toX(positions[i * 2]!)
        const x2 = toX(endBp)
        const scoreY = scoreToY(scores[i]!) + rowTop
        if (!inRun) {
          pen.moveTo(x1, zeroY)
          inRun = true
        }
        pen.lineTo(x1, scoreY)
        pen.lineTo(x2, scoreY)
        if (i === n - 1 || positions[(i + 1) * 2] !== endBp) {
          pen.lineTo(x2, zeroY)
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
  strokeByBands(
    ctx,
    cuts.map(cut => scoreToY(cut) + rowTop),
    bandStyles(negRgb, innerColors, rgb, lineRgb),
    pen => {
      for (let i = 0; i < n; i++) {
        const cx = (toX(positions[i * 2]!) + toX(positions[i * 2 + 1]!)) / 2
        const cy = scoreToY(scores[i]!) + rowTop
        if (!centerLinksToPrevious(positions, i, gapLimitBp)) {
          pen.moveTo(cx, cy)
        }
        pen.lineTo(cx, cy)
      }
    },
  )
}

// Keeps a long run inside CappedPath's per-path budget.
const BAND_BINS_PER_POLYGON = 1000

// One polygon per run, broken where the line over it breaks. Each cut's clip
// sits on a device pixel so neighbouring colours meet without a seam.
export function drawWhiskerBand({
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

  const bandCount = cuts.length + 1
  const touched = Array.from({ length: bandCount }, () => false)
  for (let i = 0; i < n; i++) {
    const lowest = cutBand(minScores[i]!, cuts)
    const highest = cutBand(maxScores[i]!, cuts)
    for (let k = lowest; k <= highest; k++) {
      touched[k] = true
    }
  }
  const fills = bandStyles(
    cssRgba(source.negColor ?? source.color, WHISKER_BAND_OPACITY),
    innerColors,
    cssRgba(source.color, WHISKER_BAND_OPACITY),
    rgb => cssRgba(rgb, WHISKER_BAND_OPACITY),
  )
  const drawn = fills.filter((_, k) => touched[k])
  if (drawn.every(fill => fill === drawn[0])) {
    ctx.fillStyle = drawn[0] ?? fills[0]!
    trace()
  } else {
    const dpr = getDpr()
    const rowBottom = rowTop + rowHeight
    const snapped = cuts.map(
      cut => Math.round((scoreToY(cut) + rowTop) * dpr) / dpr,
    )
    for (const [k, { top, bottom }] of [
      ...bandEdges(snapped).entries(),
    ].reverse()) {
      if (touched[k]) {
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

// The band a score is in: how many cuts it is at or past.
function cutBand(score: number, cuts: number[]) {
  let band = 0
  while (band < cuts.length && score >= cuts[band]!) {
    band++
  }
  return band
}

function cssRgba([r, g, b]: [number, number, number], alpha: number) {
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${alpha})`
}

export function drawScatter({
  ctx,
  source,
  block,
  rowHeight,
  rowTop,
  domainY,
  scaleType,
  symlogConstant,
  rgb,
  pointSize,
}: RowDraw & { rgb: string; pointSize: number }) {
  const colorsAbgr = source.colorsAbgr
  if (!colorsAbgr) {
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
  for (let i = 0; i < n; i++) {
    if (colorsAbgr) {
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
    appendPointMarker(ctx, cx, scoreY, pointSize)
  }
  path.flush()
}
