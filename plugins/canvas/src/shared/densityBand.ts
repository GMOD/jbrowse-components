import {
  COVERAGE_BAR_SEAM_FUDGE_PX,
  densityBinSize,
  drawCoverageBins,
  packDensityRegion,
} from '@jbrowse/alignments-core'
import {
  forEachClippedBlock,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'

import type { PackedDensityRegion } from '@jbrowse/alignments-core'
import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * What the band takes off a palette: the bars and readout in the secondary
 * text color, and the page color haloed round the readout where a bar is.
 */
export interface DensityBandInk {
  text: { secondary: string }
  background: { paper: string }
}

/** Every region's bars plus the peak they are measured against. */
export interface DensityBandLayer {
  regions: ReadonlyMap<number, PackedDensityRegion>
  maxDepth: number
}

/**
 * Every held density read packed at one bin per screen pixel, through the
 * layout the coverage band already draws from (`packCoverageBinsForGpu`), which
 * is what lets the band go through `drawCoverageBins` and its sub-pixel bar
 * widening. The peak is display-wide rather than per-region: two regions on
 * screen are drawn against one axis, so a quiet contig next to a busy one reads
 * as quiet instead of filling the band on its own.
 */
export function densityBandLayer(
  bins: ReadonlyMap<number, FeatureDensity>,
  bpPerPx: number,
): DensityBandLayer {
  const regions = new Map<number, PackedDensityRegion>()
  const binSize = densityBinSize(bpPerPx)
  let maxDepth = 0
  for (const [displayedRegionIndex, density] of bins) {
    const region = packDensityRegion(density, binSize)
    if (region) {
      regions.set(displayedRegionIndex, region)
      maxDepth = Math.max(maxDepth, region.maxDepth)
    }
  }
  return { regions, maxDepth }
}

/**
 * Paint the features-per-bin band. Canvas2D on every backend and in the SVG
 * export: it stands in for features the gate refused, so there is no per-region
 * GPU payload to hang it off — `rpcDataMap` is empty by construction wherever
 * this draws — and it composites over whichever backend drew nothing, the way
 * the multi-row indel glyphs do.
 */
export function drawDensityBand(
  ctx: Ctx2D,
  blocks: readonly RenderBlock[],
  layer: DensityBandLayer,
  state: {
    canvasWidth: number
    bandHeight: number
    readout: string
    palette: DensityBandInk
  },
) {
  const { canvasWidth, bandHeight, readout } = state
  const color = state.palette.text.secondary
  const backing = state.palette.background.paper
  const { regions, maxDepth } = layer
  if (maxDepth > 0) {
    const normalize = (depth: number) => depth / maxDepth
    forEachClippedBlock(
      ctx,
      blocks,
      canvasWidth,
      bandHeight,
      block => regions.get(block.displayedRegionIndex),
      (region, block) => {
        drawCoverageBins(
          ctx,
          region.buffer,
          normalize,
          region.maxDepth,
          bandHeight,
          color,
          makeBpMapper(block),
          canvasWidth,
          region.binSize,
          COVERAGE_BAR_SEAM_FUDGE_PX,
        )
      },
    )
  }
  if (readout) {
    ctx.font = `${READOUT_FONT_PX}px sans-serif`
    ctx.textBaseline = 'top'
    ctx.strokeStyle = backing
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.strokeText(readout, READOUT_PAD_PX, READOUT_PAD_PX)
    ctx.fillStyle = color
    ctx.fillText(readout, READOUT_PAD_PX, READOUT_PAD_PX)
  }
}

const READOUT_FONT_PX = 11
const READOUT_PAD_PX = 4

/** Two figures for a mean under 10, whole numbers above: `0.034`, `3.1`, `120`. */
export function formatDensity(value: number) {
  return value >= 10
    ? String(Math.round(value))
    : value >= 1
      ? value.toFixed(1)
      : value.toPrecision(2)
}
