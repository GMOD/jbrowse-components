import type { HicAxisBlock, HicResultRegion } from './RenderHicDataRPC/types.ts'
import type { Region } from '@jbrowse/core/util/types'

interface AxisSourceBlock {
  refName: string
  start: number
  end: number
  displayedRegionIndex?: number
}

/**
 * Resolve each fetched block's position along the view's genomic axis, in bp —
 * see {@link HicAxisBlock} for why both fields have to travel to the worker.
 *
 * The axis is the concatenation of `displayedRegions` in display order, and a
 * region's axis start is the cumulative bp span of every region before it —
 * elided or not, since elision removes a region's *block* while the ruler still
 * gives it its width. Inter-region boundary padding exists only outside the
 * region run (before genome start / past genome end), so interior layout is
 * pure cumulative bp and the axis is invariant under pan and zoom: the whole
 * reason worker output can be genomic rather than fetch-time pixels.
 *
 * A block inside a reversed displayed region leads with its `end` (bp runs
 * leftward inside that region), so its axis edge is measured from the region's
 * own right end.
 *
 * `offsetBp` is returned relative to `originBp`, the leftmost fetched block's
 * axis position: instance positions are float32 on the GPU, and the axis of a
 * whole concatenated genome overflows their integer range, while offsets within
 * one fetched window never do. The model folds `originBp` back in — in double
 * precision — when it builds the per-frame view transform.
 */
export function calcAxisBlocks(
  blocks: AxisSourceBlock[],
  displayedRegions: { start: number; end: number; reversed?: boolean }[],
) {
  const regionAxisStart: number[] = []
  let acc = 0
  for (const r of displayedRegions) {
    regionAxisStart.push(acc)
    acc += r.end - r.start
  }
  const absolute = blocks.map(b => {
    const idx = b.displayedRegionIndex!
    const d = displayedRegions[idx]!
    const lead = d.reversed ? d.end - b.end : b.start - d.start
    return { refName: b.refName, offsetBp: regionAxisStart[idx]! + lead }
  })
  // blocks arrive in screen order, so the first is the leftmost on the axis
  const originBp = absolute[0]?.offsetBp ?? 0
  return {
    originBp,
    axisBlocks: absolute.map(({ refName, offsetBp }) => ({
      refName,
      offsetBp: offsetBp - originBp,
    })) as HicAxisBlock[],
  }
}

/**
 * Zip the framework's (renamed) regions back together with the view-side axis
 * layout, resolving the per-region geometry every consumer of the result reads.
 *
 * `combinedOffset` combines the region's axis offset (in bins, `offsetBp / res`)
 * with its start expressed in bins (`start / res`), so contacts read out as a
 * continuous panel along the bin axis regardless of region boundaries. `bin` is
 * an absolute chromosome bin index, so `bin * res` is true genomic bp;
 * subtracting the exact fractional start lands each cell at its real genomic
 * position, and the cancellation of the two large terms happens in double
 * precision before anything is cast to float32.
 *
 * `dataXStart`/`dataXEnd` are divided by √2 because that collapses the 45°
 * rotation applied at render time, so a comparison against `ux`/`uy` lines up
 * with region boundaries on screen.
 */
export function buildResultRegions(
  regions: Region[],
  axisBlocks: HicAxisBlock[],
  res: number,
): HicResultRegion[] {
  return regions.map((region, i) => {
    const { refName, offsetBp } = axisBlocks[i]!
    return {
      refName,
      dataXStart: offsetBp / Math.SQRT2,
      dataXEnd: (offsetBp + (region.end - region.start)) / Math.SQRT2,
      combinedOffset: (offsetBp - region.start) / res,
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
