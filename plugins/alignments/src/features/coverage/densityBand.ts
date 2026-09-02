import { packDensityRegion } from '@jbrowse/alignments-core'

import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'

/**
 * A density source's bins as the coverage band's own per-region payload, so the
 * band that draws read depth draws features-per-bin off the same buffer, the
 * same GPU pass and the same Canvas2D painter. A read holding no depth packs no
 * records, so the band draws nothing there rather than a floor.
 */
export function densityCoverageFields(
  density: FeatureDensity,
  binSize: number,
) {
  const packed = packDensityRegion(density, binSize)
  return {
    coveragePackedBuffer: packed ? packed.buffer : new ArrayBuffer(0),
    coverageMaxDepth: packed ? packed.maxDepth : 0,
    coverageBinSize: binSize,
  }
}
