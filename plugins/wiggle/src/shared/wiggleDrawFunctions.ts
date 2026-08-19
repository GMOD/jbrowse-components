import { abgrToCssRgba, setAbgrFill } from '@jbrowse/core/util/colorBits'
import { makeBpMapper, spanLeft } from '@jbrowse/render-core/canvas2dUtils'
import { appendPointMarker, makeScoreNormalizer } from '@jbrowse/wiggle-core'

import { WIGGLE_FUDGE_FACTOR, WIGGLE_MIN_PX } from '../util.ts'
import { makeDensityRgbStringFn } from './getDensityColor.ts'

import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { WiggleScaleType } from '@jbrowse/wiggle-core'
import type { SourceRenderData } from '@jbrowse/wiggle-core'

// One source's features painted into one block's row. Shared by every render
// mode; each mode adds its own color/size fields (see the per-fn args below).
// Built once per source per block, so spreading into it isn't a hot path.
interface RowDraw {
  ctx: Ctx2D
  source: SourceRenderData
  block: RenderBlock
  rowHeight: number
  rowTop: number
  domainY: [number, number]
  scaleType: WiggleScaleType
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
  scaleType: WiggleScaleType,
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
    const w = Math.max(WIGGLE_MIN_PX, Math.abs(x2 - x1) + WIGGLE_FUDGE_FACTOR)
    // bar grows from the score baseline (originY) up or down to the score
    ctx.fillRect(
      spanLeft(x1, x2, w),
      Math.min(scoreY, originY),
      w,
      Math.abs(originY - scoreY),
    )
  }
}

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
}: RowDraw & { r: number; g: number; b: number }) {
  const colorFn = makeDensityRgbStringFn(
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
  for (let i = 0; i < n; i++) {
    const x1 = toX(positions[i * 2]!)
    const x2 = toX(positions[i * 2 + 1]!)
    const w = Math.max(WIGGLE_MIN_PX, Math.abs(x2 - x1) + WIGGLE_FUDGE_FACTOR)
    ctx.fillStyle = colorFn(scores[i]!)
    ctx.fillRect(spanLeft(x1, x2, w), rowTop, w, rowHeight)
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
  ctx.beginPath()
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
        if (lastAbgr !== NO_COLOR) {
          ctx.stroke()
          ctx.beginPath()
          if (inRun) {
            ctx.moveTo(penX, penY)
          }
        }
        ctx.strokeStyle = abgrToCssRgba(c)
        lastAbgr = c
      }
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
  ctx.stroke()
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
  ctx.beginPath()
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
    const linked =
      i > 0 &&
      (positions[pi]! + positions[pi + 1]!) / 2 -
        (positions[pi - 2]! + positions[pi - 1]!) / 2 <=
        gapLimitBp
    // Each segment runs from the previous midpoint to this one and takes this
    // instance's color, same as the shader's per-feature capsule.
    if (colorsAbgr) {
      const c = colorsAbgr[i]!
      if (c !== lastAbgr) {
        if (lastAbgr !== NO_COLOR) {
          ctx.stroke()
          ctx.beginPath()
          if (linked) {
            ctx.moveTo(penX, penY)
          }
        }
        ctx.strokeStyle = abgrToCssRgba(c)
        lastAbgr = c
      }
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
  ctx.stroke()
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
  // Points don't connect, so a per-instance color change just flushes the
  // accumulated batch and opens a fresh path.
  ctx.beginPath()
  let lastAbgr = NO_COLOR
  for (let i = 0; i < n; i++) {
    if (colorsAbgr) {
      const c = colorsAbgr[i]!
      if (c !== lastAbgr) {
        if (lastAbgr !== NO_COLOR) {
          ctx.fill()
          ctx.beginPath()
        }
        setAbgrFill(ctx, c)
        lastAbgr = c
      }
    }
    const cx = (toX(positions[i * 2]!) + toX(positions[i * 2 + 1]!)) / 2
    const scoreY = scoreToY(scores[i]!) + rowTop
    appendPointMarker(ctx, cx, scoreY, pointSize)
  }
  ctx.fill()
}
