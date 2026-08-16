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
import { makeScoreNormalizer } from '@jbrowse/wiggle-core'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'
import type { Theme } from '@mui/material'

interface DrawMafCoverageState {
  coverageHeight: number
  canvasWidth: number
  domainMax: number
  theme: Theme
}

/**
 * Draws the depth-bar + SNP layers of the MAF coverage band into a 2D
 * context. Shared by the on-screen `MafCoverageBand` and the SVG export
 * `renderSvg` paths so both call the same per-block loop over
 * alignments-core's `drawCoverageBins` + `drawSnpSegments`.
 */
export function drawMafCoverage(
  ctx: Ctx2D,
  blocks: RenderBlock[],
  regions: ReadonlyMap<number, MafRegionData>,
  state: DrawMafCoverageState,
) {
  const { coverageHeight, canvasWidth, domainMax, theme } = state
  if (!domainMax) {
    return
  }
  const normalize = makeScoreNormalizer(0, domainMax, false)
  const coverageColor = theme.palette.coverage
  const snpColors = {
    baseA: theme.palette.bases.A.main,
    baseC: theme.palette.bases.C.main,
    baseG: theme.palette.bases.G.main,
    baseT: theme.palette.bases.T.main,
    baseN: theme.palette.bases.N.main,
  }
  const interbaseColors = {
    insertion: theme.palette.insertion,
    softclip: theme.palette.insertion,
    hardclip: theme.palette.insertion,
  }
  forEachClippedBlock(
    ctx,
    blocks,
    canvasWidth,
    coverageHeight,
    block => regions.get(block.displayedRegionIndex)?.coverage,
    (coverage, block) => {
      const bpToX = makeBpMapper(block)
      drawCoverageBins(
        ctx,
        coverage.coveragePackedBuffer,
        normalize,
        coverageHeight,
        coverageColor,
        bpToX,
        canvasWidth,
        COVERAGE_BAR_SEAM_FUDGE_PX,
      )
      drawSnpSegments(
        ctx,
        coverage.snpPackedBuffer,
        normalize,
        coverage.coverageMaxDepth,
        coverageHeight,
        snpColors,
        bpToX,
        canvasWidth,
      )
      // `domainMax`, not this region's own `coverageMaxDepth`: the last argument
      // is the axis the bars are measured against, and the worker already baked
      // each segment as a fraction of `interbaseMaxCount` (the region's peak
      // depth). Passing the region peak divided that back out against itself, so
      // every bar drew at full half-band height whatever its count — too tall
      // next to depth bars the nice rounded domain had shortened, and a
      // different height per region for the same number of insertions. Unlike
      // `drawSnpSegments` above, whose `coverageMaxDepth` argument really is the
      // region peak it un-normalizes with before applying `normalize`.
      drawInterbaseSegments(
        ctx,
        coverage.interbasePackedBuffer,
        coverage.interbaseMaxCount,
        interbaseColors,
        bpToX,
        canvasWidth,
        coverageHeight,
        domainMax,
      )
      drawIndicators(
        ctx,
        coverage.indicatorPackedBuffer,
        interbaseColors,
        bpToX,
        canvasWidth,
      )
    },
  )
}
