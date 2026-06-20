import {
  clipBlockForCanvas,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'

import { getMafColorPalette } from '../../LinearMafRenderer/util.ts'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { Theme } from '@mui/material'

interface DrawConservationState {
  conservationHeight: number
  canvasWidth: number
  theme: Theme
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
  ctx.fillStyle = getMafColorPalette(theme).matchColor
  for (let x = 0; x < width; x++) {
    const c = count[x]!
    if (c > 0) {
      const h = (sum[x]! / c) * conservationHeight
      ctx.fillRect(x, conservationHeight - h, 1, h)
    }
  }
}
