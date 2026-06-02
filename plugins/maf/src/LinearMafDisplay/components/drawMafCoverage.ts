import {
  DEFAULT_CIGAR_OP_DRAW_COLORS,
  drawCoverageBins,
  drawIndicators,
  drawInterbaseSegments,
  drawSnpSegments,
} from '@jbrowse/alignments-core'
import {
  clipBlockForCanvas,
  makeBpMapper,
} from '@jbrowse/core/gpu/canvas2dUtils'
import { makeScoreNormalizer } from '@jbrowse/wiggle-core'

import type { MafRegionData } from '../../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { Theme } from '@mui/material'

interface DrawMafCoverageState {
  coverageHeight: number
  canvasWidth: number
  domainMax: number
  theme: Theme
}

/**
 * Draws the depth-bar + SNP layers of the MAF coverage band into a 2D
 * context. Shared by the on-screen `MafCoverageCanvas` and the SVG export
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
    ...DEFAULT_CIGAR_OP_DRAW_COLORS,
    baseA: theme.palette.bases.A.main,
    baseC: theme.palette.bases.C.main,
    baseG: theme.palette.bases.G.main,
    baseT: theme.palette.bases.T.main,
    baseN: theme.palette.bases.N.main,
  }
  for (const block of blocks) {
    const region = regions.get(block.displayedRegionIndex)
    const clip = region ? clipBlockForCanvas(block, canvasWidth) : null
    if (region && clip) {
      const bpToX = makeBpMapper(block)
      ctx.save()
      ctx.beginPath()
      ctx.rect(clip.scissorX, 0, clip.scissorW, coverageHeight)
      ctx.clip()
      drawCoverageBins(
        ctx,
        region.coverage.coveragePackedBuffer,
        normalize,
        coverageHeight,
        coverageColor,
        bpToX,
        canvasWidth,
      )
      drawSnpSegments(
        ctx,
        region.coverage.snpPackedBuffer,
        normalize,
        domainMax,
        coverageHeight,
        snpColors,
        bpToX,
        canvasWidth,
      )
      const interbaseColors = {
        insertion: theme.palette.insertion,
        softclip: theme.palette.insertion,
        hardclip: theme.palette.insertion,
      }
      drawInterbaseSegments(
        ctx,
        region.coverage.interbasePackedBuffer,
        region.coverage.interbaseMaxCount,
        interbaseColors,
        bpToX,
        canvasWidth,
      )
      drawIndicators(
        ctx,
        region.coverage.indicatorPackedBuffer,
        interbaseColors,
        bpToX,
        canvasWidth,
      )
      ctx.restore()
    }
  }
}
