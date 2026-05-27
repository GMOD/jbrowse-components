import type { Region } from '@jbrowse/core/util/types'

/**
 * Per-region bin-axis offset baked into stored positions:
 * `positionX = (bin1 + regionCombinedOffsets[r1]) * binWidth`.
 * Combines cumulative pixel-width of prior regions with the within-chr bin
 * index of this region's start, so contacts read out as a continuous panel
 * along the bin axis regardless of region boundaries.
 */
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

/**
 * Lookup key shared between the worker (which builds the index) and the
 * display (which queries it on hover). Keeping the format in one place
 * means a divergence would surface as a type error, not a silent miss.
 */
export function contactLookupKey(
  r1: number,
  r2: number,
  bin1: number,
  bin2: number,
) {
  return `${r1}|${r2}|${bin1}|${bin2}`
}

/**
 * Pre-rotation data-x position where each region starts, in the same
 * coordinate space as `positions[]`. Used by hover hit-test to bucket a
 * cursor into the right region pair.
 *
 * Equals cumulative `(end-start)/bpPerPx` divided by √2 — the √2 collapses
 * the 45° rotation applied at render time, so a comparison against `ux`/`uy`
 * lines up with region boundaries on screen.
 *
 * Length = regions.length + 1; index r is the start of region r, r+1 is its
 * end.
 */
export function calcRegionDataXStarts(regions: Region[], bpPerPx: number) {
  const out = [0]
  let cum = 0
  for (const region of regions) {
    cum += (region.end - region.start) / (bpPerPx * Math.SQRT2)
    out.push(cum)
  }
  return out
}
