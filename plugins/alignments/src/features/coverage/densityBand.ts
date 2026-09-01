import { packCoverageBinsForGpu } from '@jbrowse/alignments-core'
import { densityToUniformBins } from '@jbrowse/display-kit/densityBins'

import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'

// The span the source actually answered over, rather than the region it was
// asked about. Two reasons, and the second is the load-bearing one: a bin
// outside the answer is zero and draws nothing, and reading the region off the
// view would put this whole repack on `bufferedVisibleRegions`, which is a
// fresh array on every frame of every pan (display-kit/CLAUDE.md).
function binsExtent({ starts, ends }: FeatureDensity) {
  let start = Number.POSITIVE_INFINITY
  let end = 0
  for (let i = 0; i < starts.length; i++) {
    start = Math.min(start, starts[i]!)
    end = Math.max(end, ends[i]!)
  }
  return { start, end }
}

/**
 * A density source's bins as the coverage band's own per-region payload, so the
 * band that draws read depth draws features-per-bin off the same buffer, the
 * same GPU pass and the same Canvas2D painter. `densityToUniformBins` resamples
 * to `binSize` bp — one screen pixel's worth — and `packCoverageBinsForGpu` is
 * the layout both backends already read.
 */
export function densityCoverageFields(
  density: FeatureDensity,
  binSize: number,
) {
  const extent = binsExtent(density)
  const bins =
    extent.end > extent.start
      ? densityToUniformBins(density, extent, binSize)
      : undefined
  return {
    coveragePackedBuffer: bins
      ? packCoverageBinsForGpu(
          bins.depths,
          bins.maxDepth,
          bins.startOffset,
          bins.binCount,
          bins.binSize,
        )
      : new ArrayBuffer(0),
    coverageMaxDepth: bins ? bins.maxDepth : 0,
    coverageBinSize: binSize,
  }
}
