import { bpOffsetInRegion } from '@jbrowse/core/util/Base1DUtils'

import type { LinkRegion } from '@jbrowse/render-core/marks'

interface ViewRegions {
  displayedRegions: readonly {
    start: number
    end: number
    reversed?: boolean
  }[]
  bpPerPx: number
  offsetPx: number
}

/**
 * The view's displayed regions as a mark drawing across the view places a
 * foot through them: each anchored at its bp under the view's left edge, or
 * its near end off screen, so a foot's offset from the anchor stays inside
 * float32 on the GPU, with the screen extent a breakend foot stops at.
 */
export function viewRegionTable({
  displayedRegions,
  bpPerPx,
  offsetPx,
}: ViewRegions): LinkRegion[] {
  let bpSoFar = 0
  return displayedRegions.map(region => {
    const leftPx = bpSoFar / bpPerPx - offsetPx
    const spanBp = region.end - region.start
    bpSoFar += spanBp
    const rightPx = leftPx + spanBp / bpPerPx
    const nearPx = Math.min(Math.max(leftPx, 0), rightPx)
    const anchorBp = Math.floor(
      region.reversed
        ? region.end - (nearPx - leftPx) * bpPerPx
        : region.start + (nearPx - leftPx) * bpPerPx,
    )
    return {
      anchorPx: leftPx + bpOffsetInRegion(region, anchorBp) / bpPerPx,
      anchorBp,
      signedPxPerBp: (region.reversed ? -1 : 1) / bpPerPx,
      leftPx,
      rightPx,
    }
  })
}
