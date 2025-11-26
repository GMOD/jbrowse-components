import { getSnapshot, isStateTreeNode } from 'mobx-state-tree'

import {
  BlockSet,
  ContentBlock,
  ElidedBlock,
  InterRegionPaddingBlock,
} from './blockTypes.ts'
import { intersection2 } from './range.ts'

import type { Base1DViewModel } from './calculateStaticBlocks.ts'

/**
 * returns a BlockSet of which the `blocks` attribute is an array of 'dynamic
 * blocks', which are blocks representing only the regions that are visible in
 * the view right now. these are mostly used by tracks for which static blocks
 * are not feasible.
 *
 * each block is a plain JS object like:
 *   `{ refName, start, end, offsetPx, reversed? }`
 *
 * start and end are in bp, and start is always less than end, but if reversed
 * is true, startBp will be on the right side of the visible region.
 *
 * offsetPx is the number of pixels from the left edge of the view to the left
 * edge of the region
 *
 * NOTE: start, end, and offsetPx may all be fractional!
 *
 * @returns BlockSet of `{ refName, startBp, end, offset, reversed? }`
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

  // Track cumulative position across all displayed regions
  let displayedRegionLeftPx = 0

  // Define the visible window
  const windowLeftPx = offsetPx
  const windowRightPx = windowLeftPx + width

  // Process each displayed region
  for (
    let regionNumber = 0, l = displayedRegions.length;
    regionNumber < l;
    regionNumber++
  ) {
    const region = displayedRegions[regionNumber]
    const {
      assemblyName,
      refName,
      start: regionStart,
      end: regionEnd,
      reversed,
    } = region!
    const regionWidthPx = (regionEnd - regionStart) * invBpPerPx
    const displayedRegionRightPx = displayedRegionLeftPx + regionWidthPx
    const parentRegion = isStateTreeNode(region) ? getSnapshot(region) : region

    const [leftPx, rightPx] = intersection2(
      windowLeftPx,
      windowRightPx,
      displayedRegionLeftPx,
      displayedRegionRightPx,
    )
    // Track whether this region ends at its right edge (even if offscreen)
    const regionEndsAtRightEdge = displayedRegionRightPx <= windowRightPx

    if (leftPx !== undefined && rightPx !== undefined) {
      // This displayed region overlaps the view, create one block for the visible portion
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
      const blockData = {
        assemblyName,
        refName,
        start,
        end,
        reversed,
        offsetPx: blockOffsetPx,
        parentRegion,
        regionNumber,
        widthPx,
        isLeftEndOfDisplayedRegion,
        isRightEndOfDisplayedRegion,
        key: `{${assemblyName}}${refName}:${start + 1}${start + 1 === end ? '' : `..${end}`}${reversed ? '[rev]' : ''}-${regionNumber}${reversed ? '-reversed' : ''}`,
      }

      if (padding && blocks.length === 0 && isLeftEndOfDisplayedRegion) {
        blocks.push(
          new InterRegionPaddingBlock({
            key: `${blockData.key}-beforeFirstRegion`,
            widthPx: -offsetPx,
            offsetPx: blockData.offsetPx + offsetPx,
            variant: 'boundary',
          }),
        )
      }

      if (elision && regionWidthPx < minimumBlockWidth) {
        blocks.push(new ElidedBlock(blockData))
      } else {
        blocks.push(new ContentBlock(blockData))
      }

      if (padding) {
        // Add inter-region padding block if we're at the end of a visible region
        if (
          regionWidthPx >= minimumBlockWidth &&
          regionNumber < displayedRegions.length - 1 &&
          blockData.isRightEndOfDisplayedRegion
        ) {
          blocks.push(
            new InterRegionPaddingBlock({
              key: `${blockData.key}-rightpad`,
              widthPx: interRegionPaddingWidth,
              offsetPx: blockData.offsetPx + blockData.widthPx,
            }),
          )
        }

        if (
          regionNumber === displayedRegions.length - 1 &&
          blockData.isRightEndOfDisplayedRegion
        ) {
          const finalOffsetPx = blockData.offsetPx + blockData.widthPx
          blocks.push(
            new InterRegionPaddingBlock({
              key: `${blockData.key}-afterLastRegion`,
              widthPx: width - finalOffsetPx + offsetPx,
              offsetPx: finalOffsetPx,
              variant: 'boundary',
            }),
          )
        }
      }
    }

    // Add inter-region padding to offset calculation for all regions that end
    // before or at the right edge of the window, even if completely offscreen
    const shouldPad =
      padding &&
      regionEndsAtRightEdge &&
      regionWidthPx >= minimumBlockWidth &&
      regionNumber < displayedRegions.length - 1

    const regionOffset = (regionEnd - regionStart) * invBpPerPx
    const paddingOffset = shouldPad ? interRegionPaddingWidth : 0
    displayedRegionLeftPx = displayedRegionLeftPx + regionOffset + paddingOffset
  }
  return blocks
}
