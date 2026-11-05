import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { Region } from '@jbrowse/core/util/types'
import type {
  BufferedVisibleRegion,
  VisibleRegion,
} from '@jbrowse/display-kit/regionHost'

/**
 * The view's content blocks in viewport terms: each block's bp span, the
 * displayed region it came from, and where it lands on screen given the
 * view's scroll.
 */
export function visibleRegionsOf(
  contentBlocks: readonly ContentBlock[],
  offsetPx: number,
): VisibleRegion[] {
  return contentBlocks.map(block => {
    const screenStartPx = block.offsetPx - offsetPx
    return {
      refName: block.refName,
      start: block.start,
      end: block.end,
      assemblyName: block.assemblyName,
      reversed: block.reversed,
      displayedRegionIndex: block.displayedRegionIndex!,
      screenStartPx,
      screenEndPx: screenStartPx + block.widthPx,
    }
  })
}

/**
 * Each visible region widened by half a screen on either side, clamped to the
 * displayed region it came from, with whole-base ends: the regions a display
 * fetches over, so a pan of half a screen needs no refetch.
 *
 * Orientation rides along with the fetch region, not just with the render
 * blocks: canvas records it on the rpcDataMap entry
 * (`LayoutRegionData.reversed`) because label overhang packs toward lower bp in
 * a flipped region. A flip mutates `displayedRegions`, so
 * DisplayedRegionsChange refetches and the recorded flag can't go stale.
 */
export function bufferedVisibleRegionsOf({
  visibleRegions,
  displayedRegions,
  width,
  bpPerPx,
}: {
  visibleRegions: readonly VisibleRegion[]
  displayedRegions: readonly Region[]
  width: number
  bpPerPx: number
}): BufferedVisibleRegion[] {
  const bufferBp = Math.ceil(width * bpPerPx * 0.5)
  return visibleRegions.map(vr => {
    const dr = displayedRegions[vr.displayedRegionIndex]!
    return {
      region: {
        refName: vr.refName,
        start: Math.max(dr.start, Math.floor(vr.start) - bufferBp),
        end: Math.min(dr.end, Math.ceil(vr.end) + bufferBp),
        assemblyName: vr.assemblyName,
        reversed: vr.reversed,
      },
      displayedRegionIndex: vr.displayedRegionIndex,
    }
  })
}
