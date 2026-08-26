import { coverageLayout } from '@jbrowse/alignments-core'
import {
  clipBlockForCanvas,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'

import { paintedBpRange } from './paintedBpRange.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { CodonConservationBar } from './computeVisibleCodons.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { YScaleTicks } from '@jbrowse/wiggle-core'
import type { Theme } from '@mui/material'

interface DrawConservationState {
  conservationHeight: number
  canvasWidth: number
  theme: Theme
}

/**
 * Fixed 0–100% identity Y-axis ticks for the conservation band, inset by the
 * same `coverageLayout` margin the band drawing uses so the top/bottom labels
 * align with the band edges instead of being clipped at the SVG boundary.
 * Shared by the on-screen axis (`MafConservationBand`) and SVG export.
 */
export function conservationTicks(conservationHeight: number): YScaleTicks {
  const { effectiveH, bottom } = coverageLayout(conservationHeight)
  const yTop = bottom - effectiveH
  return {
    yTop,
    yBottom: bottom,
    items: [
      { value: 100, y: yTop, label: '100%' },
      { value: 50, y: (yTop + bottom) / 2, label: '50%' },
      { value: 0, y: bottom, label: '0%' },
    ],
  }
}

/**
 * Splat one block's per-bp `identityScores` into per-pixel `sum`/`count`
 * accumulators: each reference base paints every pixel its `[bpToX(bp),
 * bpToX(bp+1)]` span covers (≥1 pixel), so the resulting `sum[x]/count[x]` is
 * the mean identity of the bases under pixel `x`. Zoomed in, one base covers
 * many pixels (solid); zoomed out, many bases share one pixel (averaged — the
 * sliding window). `NaN` (unclassifiable) positions are skipped. Pure +
 * accumulator-mutating so it's unit-testable with a plain `bpToX`.
 *
 * `[xLo, xHi)` is the block's own pixel span (`clip.scissorX` ..
 * `+scissorW`), NOT the whole canvas: the fetched region is the *buffered*
 * one, so its out-of-block bp map past the block's screen edges and would
 * otherwise paint over the neighboring region — see `drawConservation`.
 *
 * `[bpLo, bpHi)` skips the scores that lie outside the block entirely. It is a
 * pure fast-path bound and only has to be *conservative*: the per-position
 * `lo`/`hi` clamp above stays the authority on what actually paints, so slack
 * costs a little work and never changes the result. Worth having because the
 * buffered region is twice the visible span, so about half of the array was
 * being mapped and then discarded — once per render block, every frame.
 *
 * Which is why the two ends round outward — `floor` the low, `ceil` the high.
 * `bpLo` is routinely fractional: it comes off `paintedBpRange`, whose block is
 * a *dynamic* block, whose `start` is `regionStart + leftPx * bpPerPx` (the
 * sibling `bufferedRegions` getter rounds, `visibleRegions` deliberately does
 * not). A base covers `[bp, bp+1)`, so a fractional `bpLo` still sits inside
 * the base below it, and rounding that end up dropped the leftmost column's
 * base from its own pixel.
 */
export function accumulateConservation(
  sum: Float32Array,
  count: Uint32Array,
  identityScores: Float32Array,
  coverageStartPos: number,
  bpToX: (bp: number) => number,
  xLo: number,
  xHi: number,
  bpLo = -Infinity,
  bpHi = Infinity,
) {
  const from = Math.max(0, Math.floor(bpLo - coverageStartPos))
  const to = Math.min(identityScores.length, Math.ceil(bpHi - coverageStartPos))
  for (let i = from; i < to; i++) {
    const v = identityScores[i]!
    if (!Number.isNaN(v)) {
      const bp = coverageStartPos + i
      const xa = bpToX(bp)
      const xb = bpToX(bp + 1)
      const cellLeft = Math.floor(Math.min(xa, xb))
      const lo = Math.max(xLo, cellLeft)
      const hi = Math.min(
        xHi,
        Math.max(cellLeft + 1, Math.ceil(Math.max(xa, xb))),
      )
      for (let px = lo; px < hi; px++) {
        sum[px]! += v
        count[px]! += 1
      }
    }
  }
}

/**
 * Draw the conservation band: per-pixel percent identity (0..1) to the
 * reference, as a column chart filling from the baseline up (taller = more
 * conserved). Reads the raw `identityScores` shipped with the coverage region
 * and aggregates per pixel — each reference base is splatted across every pixel
 * its span covers, so the bar is the mean identity of the bases under that
 * pixel (the sliding window is one pixel's worth of bp). `NaN` positions
 * (depth 0 / ref `N`) are skipped, so unalignable regions read as empty rather
 * than 0%. Shared by the on-screen canvas and SVG export, like `drawMafCoverage`.
 *
 * Each block accumulates only into its own scissor columns. The alternative —
 * `forEachClippedBlock`'s ctx clip — can't work here: the per-pixel means are
 * summed across every block first and painted in one pass at the end, so the
 * bound has to be on the accumulate, not the paint.
 */
export function drawConservation(
  ctx: Ctx2D,
  blocks: RenderBlock[],
  regions: ReadonlyMap<number, MafRegionData>,
  state: DrawConservationState,
) {
  const { conservationHeight, canvasWidth, theme } = state
  const width = Math.ceil(canvasWidth)
  if (width <= 0) {
    return
  }
  // Per-pixel mean identity, accumulated across all visible blocks.
  const sum = new Float32Array(width)
  const count = new Uint32Array(width)
  for (const block of blocks) {
    const coverage = regions.get(block.displayedRegionIndex)?.coverage
    const clip = coverage ? clipBlockForCanvas(block, canvasWidth) : null
    if (coverage && clip) {
      const { bpLo, bpHi } = paintedBpRange(block, clip)
      accumulateConservation(
        sum,
        count,
        coverage.identityScores,
        coverage.coverageStartPos,
        makeBpMapper(block),
        clip.scissorX,
        clip.scissorX + clip.scissorW,
        bpLo,
        bpHi,
      )
    }
  }
  // The coverage palette color (grey[700]) — a readable, theme-driven
  // quantitative-profile fill; the 0-100% Y-axis distinguishes it from the
  // depth coverage band above.
  // Inset the band by YSCALEBAR_LABEL_OFFSET (via coverageLayout, matching the
  // depth coverage band) so the 0%/100% ticks align with the band edges instead
  // of being clipped at the SVG boundary.
  const { effectiveH, bottom } = coverageLayout(conservationHeight)
  ctx.fillStyle = theme.palette.coverage
  for (let x = 0; x < width; x++) {
    const c = count[x]!
    if (c > 0) {
      const h = (sum[x]! / c) * effectiveH
      ctx.fillRect(x, bottom - h, 1, h)
    }
  }
}

/**
 * Draw the codon-level conservation band: one bar per reference codon spanning
 * its pixel cell, at a height set by the fraction of aligned species whose amino
 * acid matches the reference (protein-level identity — see
 * `computeCodonConservation`). Only the CDS carries codons, so the band is empty
 * outside coding exons rather than 0%; `NaN` fractions (no translatable species)
 * are skipped like a `NaN` per-base identity. Shares the `coverageLayout` inset
 * + palette with the per-base band so the two modes read identically apart from
 * codon vs base resolution.
 */
export function drawCodonConservation(
  ctx: Ctx2D,
  bars: CodonConservationBar[],
  state: DrawConservationState,
) {
  const { conservationHeight, theme } = state
  const { effectiveH, bottom } = coverageLayout(conservationHeight)
  ctx.fillStyle = theme.palette.coverage
  for (const bar of bars) {
    if (!Number.isNaN(bar.fraction)) {
      const h = bar.fraction * effectiveH
      // ≥1px wide so a single-base exon-boundary codon piece still paints.
      ctx.fillRect(bar.xLeft, bottom - h, Math.max(1, bar.width), h)
    }
  }
}
