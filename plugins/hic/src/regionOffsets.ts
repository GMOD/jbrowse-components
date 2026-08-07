import type { HicResultRegion, HicViewBlock } from './RenderHicDataRPC/types.ts'
import type { Region } from '@jbrowse/core/util/types'

/**
 * Capture what the view knows about each content block, for the worker that
 * cannot see it — see {@link HicViewBlock} for why both fields have to travel.
 *
 * `offsetPx` comes from the view's own block layout (`ContentBlock.offsetPx`,
 * minus the apex's genome-pixel position `max(0, view.offsetPx)` — the same
 * origin `renderTransform` maps back to) rather than being re-derived in the
 * worker as a running sum of region widths. A running sum silently assumes the
 * regions tile the axis with no gaps, and they don't: `dynamicBlocks` *elides*
 * any displayed region narrower than `minimumBlockWidth` (3px) and
 * `contentBlocks` drops elided blocks, while the ruler still gives them their
 * width. Summing widths therefore slid every region after an elided one leftward
 * of its true position, which shows up on whole-genome Hi-C over an assembly
 * with small scaffolds. Reading the layout instead is also gap-agnostic for
 * anything added later (inter-region padding, say).
 */
export function calcViewBlocks(
  contentBlocks: { refName: string; offsetPx: number }[],
  viewOffsetPx: number,
): HicViewBlock[] {
  const apexGenomePx = Math.max(0, viewOffsetPx)
  return contentBlocks.map(b => ({
    refName: b.refName,
    offsetPx: b.offsetPx - apexGenomePx,
  }))
}

/**
 * Zip the framework's (renamed) regions back together with the view-side
 * layout, resolving the per-region geometry every consumer of the result reads.
 *
 * `combinedOffset` combines the region's pixel offset along the axis with its
 * start expressed in bins (`start / res`), so contacts read out as a continuous
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
 *
 * `dataXStart`/`dataXEnd` are divided by √2 because that collapses the 45°
 * rotation applied at render time, so a comparison against `ux`/`uy` lines up
 * with region boundaries on screen.
 */
export function buildResultRegions(
  regions: Region[],
  viewBlocks: HicViewBlock[],
  bpPerPx: number,
  res: number,
): HicResultRegion[] {
  const pxToBinFactor = bpPerPx / res
  return regions.map((region, i) => {
    const { refName, offsetPx } = viewBlocks[i]!
    return {
      refName,
      dataXStart: offsetPx / Math.SQRT2,
      dataXEnd: (offsetPx + (region.end - region.start) / bpPerPx) / Math.SQRT2,
      combinedOffset: offsetPx * pxToBinFactor - region.start / res,
      reversed: !!region.reversed,
    }
  })
}

/**
 * Reflect a pre-rotation u coordinate within a region's own span, which is how
 * a reversed displayed region is drawn: bp runs leftward inside that region, but
 * the region keeps its place on the axis.
 *
 * The reflection maps the region's span **onto itself**, and that single
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
export function mirrorU(region: HicResultRegion, u: number) {
  return region.dataXStart + region.dataXEnd - u
}
