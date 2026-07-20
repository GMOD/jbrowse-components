import { coverageLayout } from '@jbrowse/alignments-core'
import {
  clipBlockForCanvas,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'

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
 * Shared by the on-screen axis (`MafConservationYScale`) and SVG export.
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
 */
export function accumulateConservation(
  sum: Float32Array,
  count: Uint32Array,
  identityScores: Float32Array,
  coverageStartPos: number,
  bpToX: (bp: number) => number,
  width: number,
) {
  for (let i = 0; i < identityScores.length; i++) {
    const v = identityScores[i]!
    if (!Number.isNaN(v)) {
      const bp = coverageStartPos + i
      const xa = bpToX(bp)
      const xb = bpToX(bp + 1)
      let lo = Math.floor(Math.min(xa, xb))
      let hi = Math.max(lo + 1, Math.ceil(Math.max(xa, xb)))
      if (lo < 0) {
        lo = 0
      }
      if (hi > width) {
        hi = width
      }
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
      accumulateConservation(
        sum,
        count,
        coverage.identityScores,
        coverage.coverageStartPos,
        makeBpMapper(block),
        width,
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
