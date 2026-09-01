import type { FeatureDensity } from '@jbrowse/core/data_adapters/BaseAdapter'

/** Uniform bins over a region, the shape a coverage-style band draws. */
export interface UniformDensityBins {
  /** features per bin, `binCount` long */
  depths: Float32Array
  maxDepth: number
  /** absolute bp of bin 0's left edge */
  startOffset: number
  binCount: number
  binSize: number
}

/**
 * Resample a density source's intervals onto uniform bins of `binSize` bp over
 * `[start, end)`. Each source interval is a count over its own span, so it is
 * spread as a rate — count per bp times the overlap — which keeps the total the
 * same whether the sidecar's bins are wider or narrower than the screen's.
 */
export function densityToUniformBins(
  density: FeatureDensity,
  { start, end }: { start: number; end: number },
  binSize: number,
): UniformDensityBins {
  const startOffset = Math.floor(start)
  const binCount = Math.max(1, Math.ceil((end - startOffset) / binSize))
  const depths = new Float32Array(binCount)
  const { starts, ends, scores } = density
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i]!
    const e = ends[i]!
    const span = e - s
    const score = scores[i]!
    if (span > 0 && Number.isFinite(score) && score > 0) {
      const rate = score / span
      const firstBin = Math.max(0, Math.floor((s - startOffset) / binSize))
      const lastBin = Math.min(
        binCount - 1,
        Math.floor((e - 1 - startOffset) / binSize),
      )
      for (let b = firstBin; b <= lastBin; b++) {
        const binStart = startOffset + b * binSize
        const overlap = Math.min(e, binStart + binSize) - Math.max(s, binStart)
        depths[b] = depths[b]! + rate * overlap
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
