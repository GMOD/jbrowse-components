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
  const {
    offsetPx,
    displayedRegions,
    bpPerPx,
    width,
    minimumBlockWidth,
    interRegionPaddingWidth,
  } = model

  if (!width) {
    throw new Error('view has no width, cannot calculate displayed blocks')
  }

  // Pre-calculate inverse to avoid repeated divisions
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
    const region = displayedRegions[displayedRegionIndex]
    const {
      assemblyName,
      refName,
      start: regionStart,
      end: regionEnd,
      reversed,
    } = region!
    const regionWidthPx = (regionEnd - regionStart) * invBpPerPx
    const displayedRegionRightPx = displayedRegionLeftPx + regionWidthPx
    const rightEndVisible =
      windowRightPx >= displayedRegionRightPx &&
      windowLeftPx < displayedRegionRightPx

    const [leftPx, rightPx] = intersection2(
      windowLeftPx,
      windowRightPx,
      displayedRegionLeftPx,
      displayedRegionRightPx,
    )
    if (leftPx !== undefined && rightPx !== undefined) {
      // this displayed region overlaps the view, so make a record for it
      let start: number
      let end: number
      let isLeftEndOfDisplayedRegion: boolean
      let isRightEndOfDisplayedRegion: boolean
      let blockOffsetPx: number
      if (reversed) {
        start = Math.max(
          regionStart,
          regionEnd - (rightPx - displayedRegionLeftPx) * bpPerPx,
        )
        end = regionEnd - (leftPx - displayedRegionLeftPx) * bpPerPx
        isLeftEndOfDisplayedRegion = end === regionEnd
        isRightEndOfDisplayedRegion = start === regionStart
        blockOffsetPx = displayedRegionLeftPx + (regionEnd - end) * invBpPerPx
      } else {
        start = (leftPx - displayedRegionLeftPx) * bpPerPx + regionStart
        end = Math.min(
          regionEnd,
          (rightPx - displayedRegionLeftPx) * bpPerPx + regionStart,
        )
        isLeftEndOfDisplayedRegion = start === regionStart
        isRightEndOfDisplayedRegion = end === regionEnd
        blockOffsetPx =
          displayedRegionLeftPx + (start - regionStart) * invBpPerPx
      }
      const widthPx = (end - start) * invBpPerPx
      const key = `${assemblyName}:${refName}:${start}:${end}:${displayedRegionIndex}${reversed ? ':rev' : ''}`

      if (padding && blocks.length === 0 && isLeftEndOfDisplayedRegion) {
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

      if (padding) {
        if (
          regionWidthPx >= minimumBlockWidth &&
          isRightEndOfDisplayedRegion &&
          displayedRegionIndex < displayedRegions.length - 1
        ) {
          blocks.push(
            makeInterRegionPaddingBlock({
              key: `${key}-rightpad`,
              widthPx: interRegionPaddingWidth,
              offsetPx: blockOffsetPx + widthPx,
            }),
          )
          displayedRegionLeftPx += interRegionPaddingWidth
        }

        if (
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
    }
    if (
      padding &&
      !rightEndVisible &&
      regionWidthPx >= minimumBlockWidth &&
      displayedRegionIndex < displayedRegions.length - 1
    ) {
      displayedRegionLeftPx += interRegionPaddingWidth
    }
    displayedRegionLeftPx += regionWidthPx
  }
  return blocks
}
