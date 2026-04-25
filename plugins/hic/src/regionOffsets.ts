import type { Region } from '@jbrowse/core/util/types'

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
      (regionPixelOffsets[i] ?? 0) * pxToBinFactor -
      Math.floor(region.start / res),
  )
}
