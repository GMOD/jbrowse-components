import type { Region } from '@jbrowse/core/util/types'

/**
 * Per-region bin-axis offset baked into stored positions:
 * `positionX = (bin1 + regionCombinedOffsets[r1]) * binWidth`.
 * Combines cumulative pixel-width of prior regions with this region's start
 * expressed in bins (`start / res`), so contacts read out as a continuous
 * panel along the bin axis regardless of region boundaries.
 *
 * The start term is the exact `start / res`, NOT `Math.floor(start / res)`.
 * Flooring snaps data-x=0 to the bin *containing* the block's left edge, but
 * `renderTransform` draws data-x=0 at the block's actual (fractional) start —
 * so a floor shifts the whole matrix `(start % res) / bpPerPx` px right of the
 * ruler (up to one bin), and the shift jitters as `contentBlocks.start` moves
 * while panning. `bin` is an absolute chromosome bin index, so `bin * res` is
 * true genomic bp; subtracting the exact fractional start lands each cell at
 * its real genomic position.
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
    out.push(cumulativePixelOffset * pxToBinFactor - region.start / res)
    cumulativePixelOffset += (region.end - region.start) / bpPerPx
  }
  return out
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

/**
 * Reflect a pre-rotation u coordinate within region `r`'s own span, which is
 * how a reversed displayed region is drawn: bp runs leftward inside that
 * region, but the region keeps its place on the axis.
 *
 * The reflection maps `[starts[r], starts[r+1]]` **onto itself**, and that
 * single property is what makes mixed orientations work:
 *
 * - Block layout is untouched. `horizontallyFlip()` already reverses the
 *   `displayedRegions` array, and the worker lays regions out at cumulative
 *   offsets in that screen order. A whole-view mirror would re-reverse them;
 *   this never moves a region.
 * - Cross-region contacts keep `u1 ≤ u2` for free. Endpoints stay inside
 *   their own regions, so with `region1Idx ≤ region2Idx` the order can't
 *   invert — only a contact whose endpoints share one reversed region needs
 *   the pair swapped (see `executeRenderHicData`).
 *
 * It is its own inverse, so hover un-mirrors with the same call
 * (`contactLookup.ts`).
 */
export function mirrorUInRegion(
  regionDataXStarts: number[],
  r: number,
  u: number,
) {
  return regionDataXStarts[r]! + regionDataXStarts[r + 1]! - u
}
