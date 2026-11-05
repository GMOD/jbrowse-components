import type { ContentBlock } from '@jbrowse/core/util/blockTypes'
import type { VisibleRegion } from '@jbrowse/display-kit/regionHost'

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
