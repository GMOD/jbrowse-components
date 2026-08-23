import {
  COVERAGE_BAR_SEAM_FUDGE_PX,
  drawCoverageBins,
  drawIndicators,
  drawInterbaseSegments,
  drawSnpSegments,
  packCoverageBinsCanvas2D,
} from '@jbrowse/alignments-core'
import {
  forEachClippedBlock,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'
import { SCALE_TYPE_LINEAR, makeScoreNormalizer } from '@jbrowse/wiggle-core'

import type { MafCoverageColors } from './coverageBandColors.ts'
import type { MafRegionData } from './mafRenderingBackendTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

interface DrawMafCoverageState {
  coverageHeight: number
  canvasWidth: number
  domainMax: number
  colors: MafCoverageColors
}

/**
 * Draws the depth-bar + SNP + interbase layers of the MAF coverage band into a
 * 2D context. The band's Canvas2D path: the fallback backend when no GPU is
 * available, and the SVG export, which draws once and has no backend to pick.
 * The GPU path is render-core's shared coverage passes, drawn from
 * `GpuMafRenderer` off the very buffers this reads.
 *
 * `coveragePackedBuffer` is NOT one of them: the worker ships the GPU depth-bar
 * layout (relDepth), and `drawCoverageBins` reads raw depths, so the raw-depth
 * buffer is built here from `coverageDepths` at draw time. One linear pass per
 * region per draw, which is what the alignments display's Canvas2D backend also
 * does — memoized there per region, un-memoized here because this path already
 * walks every cell of every visible block and one pass over the depths does not
 * register beside it.
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
  const normalize = makeScoreNormalizer(0, domainMax, SCALE_TYPE_LINEAR)
  const snpColors = {
    baseA: colors.baseA,
    baseC: colors.baseC,
    baseG: colors.baseG,
    baseT: colors.baseT,
    baseN: colors.baseN,
  }
  const interbaseColors = {
    insertion: colors.insertion,
    softclip: colors.insertion,
    hardclip: colors.insertion,
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
        packCoverageBinsCanvas2D(
          coverage.coverageDepths,
          coverage.coverageStartPos,
        ),
        normalize,
        coverageHeight,
        colors.coverage,
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
