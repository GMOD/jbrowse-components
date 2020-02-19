import { intersection2 } from '@gmod/jbrowse-core/util/range'
import { assembleLocString } from '@gmod/jbrowse-core/util'
import { Instance } from 'mobx-state-tree'
import { ContentBlock, ElidedBlock, BlockSet } from './blockTypes'
import { LinearGenomeViewStateModel } from '../../LinearGenomeView'

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
 * do not assume that the regions are contiguous in pixel space, the view might decide to put decorations
 * or padding in between them
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
        endBp = end - (leftPx - displayedRegionLeftPx) * bpPerPx
        startBp = end - (rightPx - displayedRegionLeftPx) * bpPerPx
        isRightEndOfDisplayedRegion = startBp === parentRegion.start
        isLeftEndOfDisplayedRegion = endBp === parentRegion.end
        blockOffsetPx = displayedRegionLeftPx + (end - endBp) / bpPerPx
      } else {
        startBp = (leftPx - displayedRegionLeftPx) * bpPerPx + start
        endBp = (rightPx - displayedRegionLeftPx) * bpPerPx + start
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
      if (widthPx < minimumBlockWidth) {
        blocks.push(new ElidedBlock(blockData))
      } else {
        blocks.push(new ContentBlock(blockData))
      }
    }
    displayedRegionLeftPx += (end - start) / bpPerPx
  }
  return blocks
}
