/* eslint-disable @typescript-eslint/no-explicit-any */
import { intersection2 } from '@gmod/jbrowse-core/util/range'
import { assembleLocString } from '@gmod/jbrowse-core/util'
import { BlockSet, ContentBlock } from './blockTypes'

const interRegionPaddingWidth = 0

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
export default function calculateDynamicBlocks(model: any) {
  const { offsetPx, width, displayedRegions, bpPerPx } = model
  const blocks = new BlockSet()
  let displayedRegionLeftPx = 0
  const windowLeftPx = offsetPx
  const windowRightPx = windowLeftPx + width
  displayedRegions.forEach((region: any, regionNumber: any) => {
    const {
      assemblyName,
      refName,
      start: regionStart,
      end: regionEnd,
      reversed,
    } = region
    const displayedRegionRightPx =
      displayedRegionLeftPx + (regionEnd - regionStart) / bpPerPx

    if (
      displayedRegionLeftPx < windowRightPx &&
      displayedRegionRightPx > windowLeftPx
    ) {
      // this displayed region overlaps the view, so make a record for it
      const [leftPx, rightPx] = intersection2(
        windowLeftPx,
        windowRightPx,
        displayedRegionLeftPx,
        displayedRegionRightPx,
      )
      let start
      let end
      let isLeftEndOfDisplayedRegion
      let isRightEndOfDisplayedRegion
      let blockOffsetPx
      if (reversed) {
        start = regionEnd - (rightPx - displayedRegionLeftPx) * bpPerPx
        end = regionEnd - (leftPx - displayedRegionLeftPx) * bpPerPx
        isLeftEndOfDisplayedRegion = end === regionEnd
        isRightEndOfDisplayedRegion = start === regionStart
        blockOffsetPx = displayedRegionLeftPx + (regionEnd - end) / bpPerPx
      } else {
        start = (leftPx - displayedRegionLeftPx) * bpPerPx + regionStart
        end = (rightPx - displayedRegionLeftPx) * bpPerPx + regionStart
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
        parentRegion: region,
        widthPx,
        isLeftEndOfDisplayedRegion,
        isRightEndOfDisplayedRegion,
        key: '',
      }
      blockData.key = `${assembleLocString(blockData)}${
        reversed ? '-reversed' : ''
      }`

      blocks.push(new ContentBlock(blockData))
    }
    displayedRegionLeftPx += interRegionPaddingWidth
    displayedRegionLeftPx += (regionEnd - regionStart) / bpPerPx
  })
  return blocks
}
