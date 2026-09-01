import {
  COVERAGE_BAR_SEAM_FUDGE_PX,
  drawCoverageBins,
  packCoverageBinsForGpu,
} from '@jbrowse/alignments-core'
import {
  densityBinSize,
  densityToUniformBins,
} from '@jbrowse/display-kit/densityBins'
import {
  forEachClippedBlock,
  makeBpMapper,
} from '@jbrowse/render-core/canvas2dUtils'

import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'
import type { RenderBlock } from '@jbrowse/render-core/renderBlock'

/**
 * One region's density bars, in the packed layout the coverage band already
 * draws from (`packCoverageBinsForGpu`): absolute genomic position plus
 * depth/maxDepth per bin. Reusing that layout is what lets the band go through
 * `drawCoverageBins`, which owns the reversed-block edge ordering and the
 * sub-pixel bar widening this band needs at exactly the zooms it appears at.
 */
export interface DensityBandRegion {
  buffer: ArrayBuffer
  maxDepth: number
  binSize: number
}

/** Every region's bars plus the peak they are measured against. */
export interface DensityBandLayer {
  regions: ReadonlyMap<number, DensityBandRegion>
  maxDepth: number
}

/**
 * The bp the source's intervals actually cover. The bins are binned over this
 * rather than over the visible region so the layer depends only on the density
 * read and the settled bp/px — `visibleRegions` rebuilds on every frame of
 * every gesture, and a layer keyed off it would repack the buffers with it.
 */
function densitySpan({ starts, ends }: FeatureDensity) {
  let start = Number.POSITIVE_INFINITY
  let end = Number.NEGATIVE_INFINITY
  for (let i = 0; i < starts.length; i++) {
    start = Math.min(start, starts[i]!)
    end = Math.max(end, ends[i]!)
  }
  return start < end ? { start, end } : undefined
}

export function densityBandRegion(density: FeatureDensity, bpPerPx: number) {
  const span = densitySpan(density)
  const binSize = densityBinSize(bpPerPx)
  const bins = span ? densityToUniformBins(density, span, binSize) : undefined
  return bins && bins.maxDepth > 0
    ? {
        buffer: packCoverageBinsForGpu(
          bins.depths,
          bins.maxDepth,
          bins.startOffset,
          bins.binCount,
          binSize,
        ),
        maxDepth: bins.maxDepth,
        binSize,
      }
    : undefined
}

/**
 * Resample every held density read onto screen-pixel bins and pack it. The peak
 * is display-wide rather than per-region: two regions on screen are drawn
 * against one axis, so a quiet contig next to a busy one reads as quiet instead
 * of filling the band on its own.
 */
export function densityBandLayer(
  bins: ReadonlyMap<number, FeatureDensity>,
  bpPerPx: number,
): DensityBandLayer {
  const regions = new Map<number, DensityBandRegion>()
  let maxDepth = 0
  for (const [displayedRegionIndex, density] of bins) {
    const region = densityBandRegion(density, bpPerPx)
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
    color: string
    readout?: string
    /** the page behind the band, haloed round the readout where a bar is */
    backing?: string
  },
) {
  const { canvasWidth, bandHeight, color, readout, backing } = state
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
    if (readout) {
      ctx.font = `${READOUT_FONT_PX}px sans-serif`
      ctx.textBaseline = 'top'
      if (backing) {
        ctx.strokeStyle = backing
        ctx.lineWidth = 3
        ctx.lineJoin = 'round'
        ctx.strokeText(readout, READOUT_PAD_PX, READOUT_PAD_PX)
      }
      ctx.fillStyle = color
      ctx.fillText(readout, READOUT_PAD_PX, READOUT_PAD_PX)
    }
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
