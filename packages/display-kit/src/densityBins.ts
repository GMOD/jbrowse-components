import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'

/** Uniform bins over a region, the shape a coverage-style band draws. */
export interface UniformDensityBins {
  /** the source's value per bin, `binCount` long */
  depths: Float32Array
  maxDepth: number
  /** absolute bp of bin 0's left edge */
  startOffset: number
  binCount: number
  binSize: number
}

/**
 * Resample a density source's intervals onto uniform bins of `binSize` bp over
 * `[start, end)`, each bin the area-weighted mean of the values overlapping it
 * and a gap counting as 0. A bigWig's own zoom levels are means over their
 * span, so a bin reads as the same quantity at every zoom: features per sidecar
 * bin for a `make-density` file, read depth for a coverage one.
 */
export function densityToUniformBins(
  density: FeatureDensity,
  { start, end }: { start: number; end: number },
  binSize: number,
): UniformDensityBins {
  const startOffset = Math.floor(start)
  const regionEnd = Math.ceil(end)
  const binCount = Math.max(1, Math.ceil((regionEnd - startOffset) / binSize))
  const depths = new Float32Array(binCount)
  const { starts, ends, scores } = density
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i]!
    const e = ends[i]!
    const score = scores[i]!
    if (e > s && Number.isFinite(score) && score > 0) {
      const firstBin = Math.max(0, Math.floor((s - startOffset) / binSize))
      const lastBin = Math.min(
        binCount - 1,
        Math.floor((e - 1 - startOffset) / binSize),
      )
      for (let b = firstBin; b <= lastBin; b++) {
        const binStart = startOffset + b * binSize
        const binWidth = Math.min(binSize, regionEnd - binStart)
        const overlap = Math.min(e, binStart + binWidth) - Math.max(s, binStart)
        depths[b] = depths[b]! + (score * overlap) / binWidth
      }
    }
  }
  let maxDepth = 0
  for (const depth of depths) {
    maxDepth = depth > maxDepth ? depth : maxDepth
  }
  return { depths, maxDepth, startOffset, binCount, binSize }
}

/** One bin per screen pixel, never finer than a base. */
export function densityBinSize(bpPerPx: number) {
  return Math.max(1, Math.round(bpPerPx))
}
