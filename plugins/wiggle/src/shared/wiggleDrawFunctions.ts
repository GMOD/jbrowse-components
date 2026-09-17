import { abgrToCssRgba, setAbgrFill } from '@jbrowse/core/util/colorBits'
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
  // Score the bars pivot around / density gradient centers on (bicolorPivot).
  origin: number
}

// Per-instance colors (whiskers bands) exist on every layer the GPU encodes
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
  origin,
  r,
  g,
  b,
  rampLut,
}: RowDraw & { r: number; g: number; b: number; rampLut: Uint8Array | null }) {
  const colorFn = rampLut
    ? makeDensityLutFillFn(
        domainY[0],
        domainY[1],
        scaleType,
        rampLut,
        origin,
        symlogConstant,
      )
    : makeDensityRgbStringFn(
        domainY[0],
        domainY[1],
        scaleType,
        r,
        g,
        b,
        origin,
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

// Single connected polyline per contiguous run of features. moveTo only at
// the start of a new run (first feature, or whenever there's a gap to the
// previous feature). Inside a run we lineTo through (x1,scoreY)→(x2,scoreY)
// for each feature; the implicit continuation between iterations draws the
// vertical step at the junction. Drop-to-zero is just another lineTo when
// the next feature is non-adjacent.
//
// A per-instance color change also ends a stroke batch: the accumulated path is
// stroked and reopened from the pen position, so the segment carries the color
// of the feature it belongs to. That matches the shader, which colors all three
// of a feature's segments (transition-in, horizontal, transition-out) from that
// instance's packed color.
export function drawLine({
  ctx,
  source,
  block,
  rowHeight,
  rowTop,
  domainY,
  scaleType,
  symlogConstant,
  rgb,
  lineWidth,
}: RowDraw & { rgb: string; lineWidth: number }) {
  const n = source.numFeatures
  if (n === 0) {
    return
  }
  const colorsAbgr = source.colorsAbgr
  if (!colorsAbgr) {
    ctx.strokeStyle = rgb
  }
  ctx.lineWidth = lineWidth
  const path = new CappedPath(ctx, 'stroke')
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType, symlogConstant)
  const zeroY = scoreToY(0) + rowTop
  const positions = source.featurePositions
  const scores = source.featureScores
  const toX = makeBpMapper(block)

  let inRun = false
  let lastAbgr = NO_COLOR
  let penX = 0
  let penY = 0
  for (let i = 0; i < n; i++) {
    const startBp = positions[i * 2]!
    const endBp = positions[i * 2 + 1]!
    const x1 = toX(startBp)
    const x2 = toX(endBp)
    const scoreY = scoreToY(scores[i]!) + rowTop

    if (colorsAbgr) {
      const c = colorsAbgr[i]!
      if (c !== lastAbgr) {
        path.flush()
        if (inRun) {
          ctx.moveTo(penX, penY)
        }
        ctx.strokeStyle = abgrToCssRgba(c)
        lastAbgr = c
      }
    }
    if (path.add() && inRun) {
      ctx.moveTo(penX, penY)
    }

    if (inRun) {
      ctx.lineTo(x1, scoreY)
    } else {
      ctx.moveTo(x1, zeroY)
      ctx.lineTo(x1, scoreY)
      inRun = true
    }
    ctx.lineTo(x2, scoreY)
    penX = x2
    penY = scoreY

    const nextStartBp = i < n - 1 ? positions[(i + 1) * 2]! : -1
    const gapAfter = nextStartBp !== endBp
    if (gapAfter) {
      ctx.lineTo(x2, zeroY)
      penY = zeroY
      inRun = false
    }
  }
  path.flush()
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
  rgb,
  lineWidth,
}: RowDraw & { rgb: string; lineWidth: number }) {
  const n = source.numFeatures
  if (n === 0) {
    return
  }
  const colorsAbgr = source.colorsAbgr
  if (!colorsAbgr) {
    ctx.strokeStyle = rgb
  }
  ctx.lineWidth = lineWidth
  // Round joins/caps match the GPU capsule so sharp bends don't nick.
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const path = new CappedPath(ctx, 'stroke')
  const scoreToY = makeScoreToY(rowHeight, domainY, scaleType, symlogConstant)
  const positions = source.featurePositions
  const scores = source.featureScores
  const toX = makeBpMapper(block)
  const gapLimitBp = source.gapLimitBp ?? Number.POSITIVE_INFINITY
  let lastAbgr = NO_COLOR
  let penX = 0
  let penY = 0
  for (let i = 0; i < n; i++) {
    const pi = i * 2
    const cx = (toX(positions[pi]!) + toX(positions[pi + 1]!)) / 2
    const cy = scoreToY(scores[i]!) + rowTop
    // Measured in bp, not px: the GPU encodes the same break from bp positions,
    // and a px comparison would drift from it wherever a block is clipped.
    const linked = centerLinksToPrevious(positions, i, gapLimitBp)
    // Each segment runs from the previous midpoint to this one and takes this
    // instance's color, same as the shader's per-feature capsule.
    if (colorsAbgr) {
      const c = colorsAbgr[i]!
      if (c !== lastAbgr) {
        path.flush()
        if (linked) {
          ctx.moveTo(penX, penY)
        }
        ctx.strokeStyle = abgrToCssRgba(c)
        lastAbgr = c
      }
    }
    if (path.add() && linked) {
      ctx.moveTo(penX, penY)
    }
    if (linked) {
      ctx.lineTo(cx, cy)
    } else {
      // zero-length subpath = a round-capped dot, matching the shader's
      // collapsed capsule; the next linked point extends it into a line
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx, cy)
    }
    penX = cx
    penY = cy
  }
  path.flush()
}

// Bins per closed polygon, so a long run still fits `CappedPath`'s per-path
// shape budget; consecutive polygons abut inside one fill, which leaves no seam.
const BAND_BINS_PER_POLYGON = 1000

// The whiskers band as one polygon per run: along each bin's max, back along
// its min. Runs break where the stroke over them does — bp adjacency for the
// step line, `gapLimitBp` for the interpolated one. A band crossing the pivot
// fills twice, clipped above in `color` and below in `negColor`, with the
// clip on a device pixel so the two fills meet without a seam.
export function drawWhiskerBand({
  ctx,
  source,
  block,
  rowHeight,
  rowTop,
  domainY,
  scaleType,
  symlogConstant,
  origin,
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

  let above = false
  let below = false
  for (let i = 0; i < n; i++) {
    above ||= maxScores[i]! >= origin
    below ||= minScores[i]! < origin
  }
  const posFill = cssRgba(source.color, WHISKER_BAND_OPACITY)
  const negFill = cssRgba(band.negColor, WHISKER_BAND_OPACITY)
  if (above && below) {
    const dpr = getDpr()
    const pivotY = Math.round((scoreToY(origin) + rowTop) * dpr) / dpr
    const rowBottom = rowTop + rowHeight
    withClip(ctx, -1e6, rowTop - 1, 2e6, pivotY - rowTop + 1, () => {
      ctx.fillStyle = posFill
      trace()
    })
    withClip(ctx, -1e6, pivotY, 2e6, rowBottom - pivotY + 1, () => {
      ctx.fillStyle = negFill
      trace()
    })
  } else {
    ctx.fillStyle = below ? negFill : posFill
    trace()
  }
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
