import { assembleLocString } from '@gmod/jbrowse-core/util'
import { BlockSet, ContentBlock, ElidedBlock } from './blockTypes'

export function calculateBlocksReversed(self, extra = 0) {
  return new BlockSet(
    calculateBlocksForward(self, extra).map(fwdBlock => {
      const { parentRegion } = fwdBlock
      const revBlock = new ContentBlock({
        ...fwdBlock,
        start: parentRegion.start + parentRegion.end - fwdBlock.end,
        end: parentRegion.start + parentRegion.end - fwdBlock.start,
      })
      revBlock.key = assembleLocString(revBlock)
      return revBlock
    }),
  )
}

export function calculateBlocksForward(self, extra = 0) {
  const { offsetPx, bpPerPx, width, effectiveRegions, minimumBlockWidth } = self
  if (!width)
    throw new Error('view has no width, cannot calculate displayed blocks')
  const windowLeftBp = offsetPx * bpPerPx
  const windowRightBp = (offsetPx + width) * bpPerPx
  const blockSizePx = Math.ceil(width / 200) * 200
  const blockSizeBp = Math.ceil(blockSizePx * bpPerPx)
  // for each displayed region
  let regionBpOffset = 0
  const blocks = new BlockSet()
  effectiveRegions.forEach(region => {
    // find the block numbers of the left and right window sides,
    // clamp those to the region range, and then make blocks for that range
    const regionBlockCount = Math.ceil(
      (region.end - region.start) / blockSizeBp,
    )

    let windowRightBlockNum =
      Math.floor((windowRightBp - regionBpOffset) / blockSizeBp) + extra
    if (windowRightBlockNum >= regionBlockCount)
      windowRightBlockNum = regionBlockCount - 1

    let windowLeftBlockNum =
      Math.floor((windowLeftBp - regionBpOffset) / blockSizeBp) - extra
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

export default function calculateBlocks(view, reversed, extra = 0) {
  return reversed
    ? calculateBlocksReversed(view, extra)
    : calculateBlocksForward(view, extra)
}
