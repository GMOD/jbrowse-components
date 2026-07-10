import {
  BlockSet,
  makeContentBlock,
  makeElidedBlock,
  makeInterRegionPaddingBlock,
} from './blockTypes.ts'
import { intersection2 } from './range.ts'

import type { Base1DViewModel } from './calculateStaticBlocks.ts'

/**
 * Returns a BlockSet covering only the regions currently visible in the view.
 * Used by tracks where static blocks are not feasible. start/end/offsetPx may
 * be fractional.
 */
export default function calculateDynamicBlocks(
  model: Base1DViewModel,
  padding = true,
  elision = true,
) {
  const { offsetPx, displayedRegions, bpPerPx, width, minimumBlockWidth } =
    model

  // A zero-width view yields an empty BlockSet: intersection2 rejects the
  // degenerate window, so the loop pushes nothing. Mirrors calculateStaticBlocks
  // rather than throwing inside what callers read as a MobX computed.
  const invBpPerPx = 1 / bpPerPx
  const blocks = new BlockSet()
  let displayedRegionLeftPx = 0
  const windowLeftPx = offsetPx
  const windowRightPx = windowLeftPx + width
  for (
    let displayedRegionIndex = 0;
    displayedRegionIndex < displayedRegions.length;
    displayedRegionIndex++
  ) {
    const {
      assemblyName,
      refName,
      start: regionStart,
      end: regionEnd,
      reversed,
    } = displayedRegions[displayedRegionIndex]!
    const regionWidthPx = (regionEnd - regionStart) * invBpPerPx
    const displayedRegionRightPx = displayedRegionLeftPx + regionWidthPx
    const [leftPx, rightPx] = intersection2(
      windowLeftPx,
      windowRightPx,
      displayedRegionLeftPx,
      displayedRegionRightPx,
    )
    if (leftPx !== undefined && rightPx !== undefined) {
      // Pixel comparisons avoid the bpPerPx round-trip float drift that can
      // make end !== regionEnd even when the full region is in view.
      const isLeftEndOfDisplayedRegion = leftPx <= displayedRegionLeftPx
      const isRightEndOfDisplayedRegion = rightPx >= displayedRegionRightPx
      // bp spanned between the region's left edge and the clipped block edges
      const leftBp = (leftPx - displayedRegionLeftPx) * bpPerPx
      const rightBp = (rightPx - displayedRegionLeftPx) * bpPerPx
      const start = reversed
        ? Math.max(regionStart, regionEnd - rightBp)
        : regionStart + leftBp
      const end = reversed
        ? regionEnd - leftBp
        : Math.min(regionEnd, regionStart + rightBp)
      // both reversed/forward offset formulae reduce algebraically to leftPx
      const blockOffsetPx = leftPx
      const widthPx = (end - start) * invBpPerPx
      const key = `${assemblyName}:${refName}:${start}:${end}:${displayedRegionIndex}${reversed ? ':rev' : ''}`

      if (padding && displayedRegionIndex === 0 && isLeftEndOfDisplayedRegion) {
        blocks.push(
          makeInterRegionPaddingBlock({
            key: `${key}-beforeFirstRegion`,
            widthPx: -offsetPx,
            offsetPx: blockOffsetPx + offsetPx,
            variant: 'boundary',
          }),
        )
      }

      const data = {
        assemblyName,
        refName,
        start,
        end,
        reversed,
        offsetPx: blockOffsetPx,
        displayedRegionIndex,
        widthPx,
        isLeftEndOfDisplayedRegion,
        isRightEndOfDisplayedRegion,
        key,
      }
      blocks.push(
        elision && regionWidthPx < minimumBlockWidth
          ? makeElidedBlock(data)
          : makeContentBlock(data),
      )

      if (
        padding &&
        displayedRegionIndex === displayedRegions.length - 1 &&
        isRightEndOfDisplayedRegion
      ) {
        const afterOffsetPx = blockOffsetPx + widthPx
        blocks.push(
          makeInterRegionPaddingBlock({
            key: `${key}-afterLastRegion`,
            widthPx: width - afterOffsetPx + offsetPx,
            offsetPx: afterOffsetPx,
            variant: 'boundary',
          }),
        )
      }
    }
    displayedRegionLeftPx += regionWidthPx
  }
  return blocks
}
