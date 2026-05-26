import type { Region } from '@jbrowse/core/util/types'

export function calcRegionCombinedOffsets(
  regions: Region[],
  bpPerPx: number,
  res: number,
) {
  const pxToBinFactor = bpPerPx / res
  const out: number[] = []
  let cumulativePixelOffset = 0
  for (const region of regions) {
    out.push(
      cumulativePixelOffset * pxToBinFactor - Math.floor(region.start / res),
    )
    cumulativePixelOffset += (region.end - region.start) / bpPerPx
  }
  return out
}
