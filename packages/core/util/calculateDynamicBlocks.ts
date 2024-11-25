import { isStateTreeNode, getSnapshot } from 'mobx-state-tree'
import { assembleLocStringFast } from '.'
import {
  BlockSet,
  ContentBlock,
  ElidedBlock,
  InterRegionPaddingBlock,
} from './blockTypes'
import { intersection2 } from './range'
import type { Base1DViewModel } from './calculateStaticBlocks'

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
  const blocks = new BlockSet()
  let displayedRegionLeftPx = 0
  const windowLeftPx = offsetPx
  const windowRightPx = windowLeftPx + width
  for (
    let regionNumber = 0;
    regionNumber < displayedRegions.length;
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
    const displayedRegionRightPx =
      displayedRegionLeftPx + (regionEnd - regionStart) / bpPerPx

    const regionWidthPx = (regionEnd - regionStart) / bpPerPx
    const parentRegion = isStateTreeNode(region) ? getSnapshot(region) : region

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
        blockOffsetPx = displayedRegionLeftPx + (regionEnd - end) / bpPerPx
      } else {
        start = (leftPx - displayedRegionLeftPx) * bpPerPx + regionStart
        end = Math.min(
          regionEnd,
          (rightPx - displayedRegionLeftPx) * bpPerPx + regionStart,
        )
        isLeftEndOfDisplayedRegion = start === regionStart
        isRightEndOfDisplayedRegion = end === regionEnd
        blockOffsetPx = displayedRegionLeftPx + (start - regionStart) / bpPerPx
      }
      const widthPx = (end - start) / bpPerPx
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
        key: '',
      }
      blockData.key = `${assembleLocStringFast(blockData)}-${regionNumber}${
        reversed ? '-reversed' : ''
      }`

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
        // insert a inter-region padding block if we are crossing a displayed region
        if (
          regionWidthPx >= minimumBlockWidth &&
          blockData.isRightEndOfDisplayedRegion &&
          regionNumber < displayedRegions.length - 1
        ) {
          blocks.push(
            new InterRegionPaddingBlock({
              key: `${blockData.key}-rightpad`,
              widthPx: interRegionPaddingWidth,
              offsetPx: blockData.offsetPx + blockData.widthPx,
            }),
          )
          displayedRegionLeftPx += interRegionPaddingWidth
        }

        if (
          regionNumber === displayedRegions.length - 1 &&
          blockData.isRightEndOfDisplayedRegion
        ) {
          blockOffsetPx = blockData.offsetPx + blockData.widthPx
          blocks.push(
            new InterRegionPaddingBlock({
              key: `${blockData.key}-afterLastRegion`,
              widthPx: width - blockOffsetPx + offsetPx,
              offsetPx: blockOffsetPx,
              variant: 'boundary',
            }),
          )
        }
      }
    }
    displayedRegionLeftPx += (regionEnd - regionStart) / bpPerPx
  }
  return blocks
}
