import { assembleLocString } from '@gmod/jbrowse-core/util'
import { BlockSet, ContentBlock, ElidedBlock } from './blockTypes'

export function calculateBlocksReversed(self) {
  return calculateBlocksForward(self).map(fwdBlock => {
    const { parentRegion } = fwdBlock
    const revBlock = {
      ...fwdBlock,
      start: parentRegion.end - fwdBlock.end,
      end: parentRegion.end - fwdBlock.start,
    }
    revBlock.key = assembleLocString(revBlock)
    return revBlock
  })
}

export function calculateBlocksForward(self) {
  const { offsetPx, bpPerPx, width, displayedRegions, minimumBlockWidth } = self
  if (!width)
    throw new Error('view has no width, cannot calculate displayed blocks')
  const windowLeftBp = offsetPx * bpPerPx
  const windowRightBp = (offsetPx + width) * bpPerPx
  const blockSizePx = Math.ceil(width / 200) * 200
  const blockSizeBp = Math.ceil(blockSizePx * bpPerPx)
  // for each displayed region
  let regionBpOffset = 0
  const blocks = new BlockSet()
  displayedRegions.forEach(region => {
    // find the block numbers of the left and right window sides,
    // clamp those to the region range, and then make blocks for that range
    const regionBlockCount = Math.ceil(
      (region.end - region.start) / blockSizeBp,
    )

    let windowRightBlockNum = Math.floor(
      (windowRightBp - regionBpOffset) / blockSizeBp,
    )
    if (windowRightBlockNum >= regionBlockCount)
      windowRightBlockNum = regionBlockCount - 1

    let windowLeftBlockNum = Math.floor(
      (windowLeftBp - regionBpOffset) / blockSizeBp,
    )
    if (windowLeftBlockNum < 0) windowLeftBlockNum = 0

    for (
      let blockNum = windowLeftBlockNum;
      blockNum <= windowRightBlockNum;
      blockNum += 1
    ) {
      const start = region.start + blockNum * blockSizeBp
      const end = Math.min(
        region.end,
        region.start + (blockNum + 1) * blockSizeBp,
      )
      const widthPx = Math.abs(end - start) / bpPerPx
      const blockData = {
        assemblyName: region.assemblyName,
        refName: region.refName,
        start,
        end,
        offsetPx: (regionBpOffset + blockNum * blockSizeBp) / bpPerPx,
        parentRegion: region,
        widthPx,
        isLeftEndOfDisplayedRegion: start === region.start,
        isRightEndOfDisplayedRegion: end === region.end,
      }
      blockData.key = assembleLocString(blockData)
      if (widthPx < minimumBlockWidth) {
        blocks.push(new ElidedBlock(blockData))
      } else {
        blocks.push(new ContentBlock(blockData))
      }
    }

    regionBpOffset += region.end - region.start
  })

  return blocks
}

export default function calculateBlocks(view, reversed) {
  return reversed ? calculateBlocksReversed(view) : calculateBlocksForward(view)
}
