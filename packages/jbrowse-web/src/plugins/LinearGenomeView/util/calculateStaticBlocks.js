import { assembleLocString } from '../../../util'

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
  const { offsetPx, bpPerPx, width, displayedRegions } = self
  if (!width)
    throw new Error('view has no width, cannot calculate displayed blocks')
  const windowLeftBp = offsetPx * bpPerPx
  const windowRightBp = (offsetPx + width) * bpPerPx
  const blockSizePx = Math.ceil(width / 200) * 200
  const blockSizeBp = Math.ceil(blockSizePx * bpPerPx)
  // for each displayed region
  let regionBpOffset = 0
  const blocks = []
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
    // if (windowRightBlockNum < 0) return // this region is not visible

    let windowLeftBlockNum = Math.floor(
      (windowLeftBp - regionBpOffset) / blockSizeBp,
    )
    if (windowLeftBlockNum < 0) windowLeftBlockNum = 0
    // if (windowLeftBlockNum >= regionBlockCount) return // this region is not visible

    for (
      let blockNum = windowLeftBlockNum;
      blockNum <= windowRightBlockNum;
      blockNum += 1
    ) {
      const newBlock = {
        refName: region.refName,
        start: region.start + blockNum * blockSizeBp,
        end: Math.min(region.end, region.start + (blockNum + 1) * blockSizeBp),
        offsetPx:
          (regionBpOffset + region.start + blockNum * blockSizeBp) / bpPerPx,
        parentRegion: region,
      }
      newBlock.key = assembleLocString(newBlock)
      newBlock.widthPx = Math.abs(newBlock.end - newBlock.start) / bpPerPx
      newBlock.isLeftEndOfDisplayedRegion = newBlock.start === region.start
      newBlock.isRightEndOfDisplayedRegion = newBlock.end === region.end
      blocks.push(newBlock)
    }

    regionBpOffset += region.end - region.start
  })

  return blocks
}

export default function calculateBlocks(view, reversed) {
  return reversed ? calculateBlocksReversed(view) : calculateBlocksForward(view)
}
