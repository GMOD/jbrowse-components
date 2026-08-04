import type { Region } from '@jbrowse/core/util/types'

/**
 * Where each region sits on the screen axis, in fetch-time pixels measured from
 * the apex (data-x = 0).
 *
 * This comes from the view's own block layout (`ContentBlock.offsetPx`, minus
 * the apex's genome-pixel position `max(0, view.offsetPx)` — the same origin
 * `renderTransform` maps back to) rather than being re-derived here as a running
 * sum of region widths. A running sum silently assumes the regions the worker
 * was handed tile the axis with no gaps, and they don't: `dynamicBlocks`
 * *elides* any displayed region narrower than `minimumBlockWidth` (3px), and
 * `contentBlocks` drops elided blocks — while the ruler still gives them their
 * width. Summing widths therefore slid every region after an elided one leftward
 * of its true position, which shows up on whole-genome Hi-C over an assembly
 * with small scaffolds. Reading the layout instead is also gap-agnostic for
 * anything added later (inter-region padding, say).
 */
export function calcRegionScreenOffsetsPx(
  contentBlocks: { offsetPx: number }[],
  viewOffsetPx: number,
) {
  const apexGenomePx = Math.max(0, viewOffsetPx)
  return contentBlocks.map(b => b.offsetPx - apexGenomePx)
}

/**
 * Per-region bin-axis offset baked into stored positions:
 * `positionX = (bin1 + regionCombinedOffsets[r1]) * binWidth`.
 * Combines the region's pixel offset along the axis with its start expressed in
 * bins (`start / res`), so contacts read out as a continuous panel along the bin
 * axis regardless of region boundaries.
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
  regionOffsetsPx: number[],
  bpPerPx: number,
  res: number,
) {
  const pxToBinFactor = bpPerPx / res
  return regions.map(
    (region, i) => regionOffsetsPx[i]! * pxToBinFactor - region.start / res,
  )
}

/**
 * Pre-rotation data-x span of each region, in the same coordinate space as
 * `positions[]`, flattened as `[start0, end0, start1, end1, …]`. Used by hover
 * hit-test to bucket a cursor into the right region pair, and by the reversed-
 * region mirror.
 *
 * Divided by √2 because that collapses the 45° rotation applied at render time,
 * so a comparison against `ux`/`uy` lines up with region boundaries on screen.
 *
 * Start and end are both carried, rather than one `starts` array where entry
 * `r+1` doubles as region `r`'s end: that only holds when regions tile the axis
 * without gaps, which elided regions break (see `calcRegionScreenOffsetsPx`).
 */
export function calcRegionDataXBounds(
  regions: Region[],
  regionOffsetsPx: number[],
  bpPerPx: number,
) {
  const out: number[] = []
  for (const [i, region] of regions.entries()) {
    const startPx = regionOffsetsPx[i]!
    out.push(
      startPx / Math.SQRT2,
      (startPx + (region.end - region.start) / bpPerPx) / Math.SQRT2,
    )
  }
  return out
}

/**
 * Reflect a pre-rotation u coordinate within region `r`'s own span, which is
 * how a reversed displayed region is drawn: bp runs leftward inside that
 * region, but the region keeps its place on the axis.
 *
 * The reflection maps region `r`'s span **onto itself**, and that single
 * property is what makes mixed orientations work:
 *
 * - Block layout is untouched. `horizontallyFlip()` already reverses the
 *   `displayedRegions` array, and the worker lays regions out at the view's own
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
  regionDataXBounds: number[],
  r: number,
  u: number,
) {
  return regionDataXBounds[r * 2]! + regionDataXBounds[r * 2 + 1]! - u
}
