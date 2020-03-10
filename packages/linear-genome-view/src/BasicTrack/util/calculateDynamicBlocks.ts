import { intersection2 } from '@gmod/jbrowse-core/util/range'
import { assembleLocString } from '@gmod/jbrowse-core/util'
import { Instance } from 'mobx-state-tree'
import {
  BlockSet,
  ContentBlock,
  ElidedBlock,
  InterRegionPaddingBlock,
} from './blockTypes'
import { LinearGenomeViewStateModel } from '../../LinearGenomeView'

const interRegionPaddingWidth = 2

type LGV = Instance<LinearGenomeViewStateModel>

/**
 * returns an array of 'dynamic blocks', which are blocks representing only the regions that
 * are visible in the view right now. these are mostly used by tracks for which static blocks
 * are not feasible.
 *
 * each region is a plain JS object like:
 *   { refName, startBp, endBp, offsetPx, horizontallyFlipped? }
 *
 * startBp is always less than endBp, but if horizontallyFlipped is true, startBp will be on the
 * right side of the visible region.
 * offsetPx is the number of pixels from the left edge of the view to the left edge of the region
 *
 * NOTE: startBp, endBp, and offsetPx may all be fractional!
 *
 * @returns {Array} of ` { refName, startBp, endBp, offsetPx, horizontallyFlipped? }`
 */
export default function calculateDynamicBlocks(
  model: LGV,
  horizontallyFlipped: boolean,
) {
  const {
    offsetPx,
    viewingRegionWidth: width,
    displayedRegions,
    bpPerPx,
    minimumBlockWidth,
  } = model
  const blocks = new BlockSet()
  let displayedRegionLeftPx = 0
  const windowLeftPx = offsetPx
  const windowRightPx = windowLeftPx + width
  for (let i = 0; i < displayedRegions.length; i += 1) {
    const parentRegion = displayedRegions[i]
    const { assemblyName, start, end, refName } = parentRegion
    const parentRegionWidthPx = (end - start) / bpPerPx
    const displayedRegionRightPx =
      displayedRegionLeftPx + (end - start) / bpPerPx
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
      let startBp
      let endBp
      let isLeftEndOfDisplayedRegion
      let isRightEndOfDisplayedRegion
      let blockOffsetPx
      if (horizontallyFlipped) {
        endBp = Math.min(
          end - (leftPx - displayedRegionLeftPx) * bpPerPx,
          parentRegion.end,
        )
        startBp = Math.max(
          end - (rightPx - displayedRegionLeftPx) * bpPerPx,
          parentRegion.start,
        )
        isRightEndOfDisplayedRegion = startBp === parentRegion.start
        isLeftEndOfDisplayedRegion = endBp === parentRegion.end
        blockOffsetPx = displayedRegionLeftPx + (end - endBp) / bpPerPx
      } else {
        startBp = Math.max(
          (leftPx - displayedRegionLeftPx) * bpPerPx + start,
          parentRegion.start,
        )
        endBp = Math.min(
          (rightPx - displayedRegionLeftPx) * bpPerPx + start,
          parentRegion.end,
        )
        isLeftEndOfDisplayedRegion = startBp === parentRegion.start
        isRightEndOfDisplayedRegion = endBp === parentRegion.end
        blockOffsetPx = displayedRegionLeftPx + (startBp - start) / bpPerPx
      }

      const widthPx = Math.abs(endBp - startBp) / bpPerPx
      const blockData = {
        assemblyName,
        refName,
        start: startBp,
        end: endBp,
        parentRegion,
        offsetPx: blockOffsetPx,
        isLeftEndOfDisplayedRegion,
        isRightEndOfDisplayedRegion,
        widthPx,
        key: '',
      }
      blockData.key = assembleLocString(blockData)
      if (blocks.length === 0 && isLeftEndOfDisplayedRegion) {
        blocks.push(
          new InterRegionPaddingBlock({
            key: `${blockData.key}-beforeFirstRegion`,
            widthPx: -offsetPx,
            offsetPx: blockData.offsetPx + offsetPx,
            variant: 'boundary',
          }),
        )
      }
      if (parentRegionWidthPx < minimumBlockWidth) {
        blocks.push(new ElidedBlock(blockData))
      } else {
        blocks.push(new ContentBlock(blockData))
      }
      // insert a inter-region padding block if we are crossing a displayed region
      if (
        parentRegionWidthPx >= minimumBlockWidth &&
        blockData.isRightEndOfDisplayedRegion &&
        i < displayedRegions.length - 1
      ) {
        blocks.push(
          new InterRegionPaddingBlock({
            key: `${blockData.key}-${i}-rightpad`,
            widthPx: interRegionPaddingWidth,
            offsetPx: blockData.offsetPx + blockData.widthPx,
          }),
        )
      }
      if (
        i === displayedRegions.length - 1 &&
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
    displayedRegionLeftPx += interRegionPaddingWidth
    displayedRegionLeftPx += (end - start) / bpPerPx
  }
  return blocks
}
