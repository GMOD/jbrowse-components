import type { Region } from '@jbrowse/core/util/types'

export function computePercentile(features: { counts: number }[], p: number) {
  const sorted = features.map(f => f.counts).sort((a, b) => a - b)
  const idx = Math.floor((p / 100) * sorted.length)
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0
}

export function calcRegionCombinedOffsets(
  regions: Region[],
  bpPerPx: number,
  res: number,
) {
  const regionPixelOffsets: number[] = []
  let cumulativePixelOffset = 0
  for (const region of regions) {
    regionPixelOffsets.push(cumulativePixelOffset)
    cumulativePixelOffset += (region.end - region.start) / bpPerPx
  }
  const pxToBinFactor = bpPerPx / res
  return regions.map(
    (region, i) =>
      regionPixelOffsets[i]! * pxToBinFactor -
      Math.floor(region.start / res),
  )
}
