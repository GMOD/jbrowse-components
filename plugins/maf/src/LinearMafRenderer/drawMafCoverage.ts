import {
  COVERAGE_BAR_SEAM_FUDGE_PX,
  drawCoverageBins,
  drawIndicators,
  drawInterbaseSegments,
  drawSnpSegments,
} from '@jbrowse/alignments-core'
import {
  forEachClippedBlock,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'
import { orderCoverageBandLayers } from '@jbrowse/render-core/coverageBand'
import { SCALE_TYPE_LINEAR, makeScoreNormalizer } from '@jbrowse/wiggle-core'

import type { MafCoverageColors } from './coverageBandColors.ts'
import type {
  MafCoverageRegion,
  MafRegionData,
} from './mafRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { CoverageLayerId } from '@jbrowse/render-core/coverageBand'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

interface DrawMafCoverageState {
  coverageHeight: number
  canvasWidth: number
  domainMax: number
  colors: MafCoverageColors
}

// What every band painter needs beyond the region and the bp mapper, resolved
// once per draw rather than per block.
interface MafCoverageBandDraw {
  coverageHeight: number
  canvasWidth: number
  domainMax: number
  normalize: (depth: number) => number
  colors: MafCoverageColors
  snpColors: {
    baseA: string
    baseC: string
    baseG: string
    baseT: string
    baseN: string
  }
  interbaseColors: { insertion: string; softclip: string; hardclip: string }
}

type MafCoverageDrawFn = (
  ctx: Ctx2D,
  coverage: MafCoverageRegion,
  bpToX: (bp: number) => number,
  band: MafCoverageBandDraw,
) => void

// Each band layer's Canvas2D painter, resolved into render-core's paint order —
// the same list `GpuMafRenderer` builds its pass array from, so the fallback
// cannot paint the band in a different order than the GPU does. `modCov` is
// `undefined` because a MAF alignment carries no base-modification calls.
export const MAF_CANVAS_COVERAGE_DRAW: Record<
  CoverageLayerId,
  MafCoverageDrawFn | undefined
> = {
  coverage: (ctx, coverage, bpToX, band) => {
    drawCoverageBins(
      ctx,
      coverage.coveragePackedBuffer,
      band.normalize,
      coverage.coverageMaxDepth,
      band.coverageHeight,
      band.colors.coverage,
      bpToX,
      band.canvasWidth,
      // Per-bp: the worker packs one record per reference base and never
      // downsamples (see buildMafCoverageRegion), which is also what the GPU
      // pass's `binSize` uniform is fed.
      1,
      COVERAGE_BAR_SEAM_FUDGE_PX,
    )
  },
  snpCov: (ctx, coverage, bpToX, band) => {
    drawSnpSegments(
      ctx,
      coverage.snpPackedBuffer,
      band.normalize,
      coverage.coverageMaxDepth,
      band.coverageHeight,
      band.snpColors,
      bpToX,
      band.canvasWidth,
    )
  },
  modCov: undefined,
  // `domainMax`, not this region's own `coverageMaxDepth`: the last argument is
  // the axis the bars are measured against, and the worker already baked each
  // segment as a fraction of `interbaseMaxCount` (the region's peak depth).
  // Passing the region peak divided that back out against itself, so every bar
  // drew at full half-band height whatever its count — too tall next to depth
  // bars the nice rounded domain had shortened, and a different height per
  // region for the same number of insertions. Unlike `drawSnpSegments` above,
  // whose `coverageMaxDepth` argument really is the region peak it un-normalizes
  // with before applying `normalize`.
  interbase: (ctx, coverage, bpToX, band) => {
    drawInterbaseSegments(
      ctx,
      coverage.interbasePackedBuffer,
      coverage.interbaseMaxCount,
      band.interbaseColors,
      bpToX,
      band.canvasWidth,
      band.coverageHeight,
      band.domainMax,
    )
  },
  indicator: (ctx, coverage, bpToX, band) => {
    drawIndicators(
      ctx,
      coverage.indicatorPackedBuffer,
      band.interbaseColors,
      bpToX,
      band.canvasWidth,
    )
  },
}

const MAF_CANVAS_COVERAGE_LAYERS = orderCoverageBandLayers(
  MAF_CANVAS_COVERAGE_DRAW,
)

/**
 * Draws the depth-bar + SNP + interbase layers of the MAF coverage band into a
 * 2D context. The band's Canvas2D path: the fallback backend when no GPU is
 * available, and the SVG export, which draws once and has no backend to pick.
 * The GPU path is render-core's shared coverage passes, drawn from
 * `GpuMafRenderer` off the very buffers this reads — all four of them,
 * `coveragePackedBuffer` included, since the depth bars have one layout.
 */
export function drawMafCoverage(
  ctx: Ctx2D,
  blocks: RenderBlock[],
  regions: ReadonlyMap<number, MafRegionData>,
  state: DrawMafCoverageState,
) {
  const { coverageHeight, canvasWidth, domainMax, colors } = state
  if (!domainMax) {
    return
  }
  const band: MafCoverageBandDraw = {
    coverageHeight,
    canvasWidth,
    domainMax,
    normalize: makeScoreNormalizer(0, domainMax, SCALE_TYPE_LINEAR),
    colors,
    snpColors: {
      baseA: colors.baseA,
      baseC: colors.baseC,
      baseG: colors.baseG,
      baseT: colors.baseT,
      baseN: colors.baseN,
    },
    interbaseColors: {
      insertion: colors.insertion,
      softclip: colors.insertion,
      hardclip: colors.insertion,
    },
  }
  forEachClippedBlock(
    ctx,
    blocks,
    canvasWidth,
    coverageHeight,
    block => regions.get(block.displayedRegionIndex)?.coverage,
    (coverage, block) => {
      const bpToX = makeBpMapper(block)
      for (const draw of MAF_CANVAS_COVERAGE_LAYERS) {
        draw(ctx, coverage, bpToX, band)
      }
    },
  )
}
