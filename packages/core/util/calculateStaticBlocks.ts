import { assembleLocString } from '.'
import { Region } from './types'
import {
  BlockSet,
  ContentBlock,
  ElidedBlock,
  InterRegionPaddingBlock,
} from './blockTypes'

const interRegionPaddingWidth = 2

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function calculateBlocks(self: any, extra = 0) {
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

  displayedRegions.forEach((region: Region, index: number) => {
    // find the block numbers of the left and right window sides,
    // clamp those to the region range, and then make blocks for that range
    const {
      assemblyName,
      refName,
      start: regionStart,
      end: regionEnd,
      reversed,
    } = region
    const regionBlockCount = Math.ceil((regionEnd - regionStart) / blockSizeBp)

    let windowRightBlockNum =
      Math.floor((windowRightBp - regionBpOffset) / blockSizeBp) + extra
    if (windowRightBlockNum >= regionBlockCount)
      windowRightBlockNum = regionBlockCount - 1

    let windowLeftBlockNum =
      Math.floor((windowLeftBp - regionBpOffset) / blockSizeBp) - extra
    if (windowLeftBlockNum < 0) windowLeftBlockNum = 0

    const regionWidthPx = (regionEnd - regionStart) / bpPerPx

    for (
      let blockNum = windowLeftBlockNum;
      blockNum <= windowRightBlockNum;
      blockNum += 1
    ) {
      let start
      let end
      let isLeftEndOfDisplayedRegion
      let isRightEndOfDisplayedRegion
      if (reversed) {
        start = Math.max(regionStart, regionEnd - (blockNum + 1) * blockSizeBp)
        end = regionEnd - blockNum * blockSizeBp
        isLeftEndOfDisplayedRegion = end === regionEnd
        isRightEndOfDisplayedRegion = start === regionStart
      } else {
        start = regionStart + blockNum * blockSizeBp
        end = Math.min(regionEnd, regionStart + (blockNum + 1) * blockSizeBp)
        isLeftEndOfDisplayedRegion = start === regionStart
        isRightEndOfDisplayedRegion = end === regionEnd
      }
      const widthPx = (end - start) / bpPerPx
      const blockData = {
        assemblyName,
        refName,
        start,
        end,
        reversed,
        offsetPx: (regionBpOffset + blockNum * blockSizeBp) / bpPerPx,
        parentRegion: region,
        widthPx,
        isLeftEndOfDisplayedRegion,
        isRightEndOfDisplayedRegion,
        key: '',
      }
      const locstring = assembleLocString(blockData)
      blockData.key = `${locstring}-${index}-${reversed ? '-reversed' : ''}`
      if (index === 0 && blockNum === 0) {
        blocks.push(
          new InterRegionPaddingBlock({
            key: `${blockData.key}-beforeFirstRegion`,
            widthPx: width,
            offsetPx: blockData.offsetPx - width,
            variant: 'boundary',
          }),
        )
      }
      if (regionWidthPx < minimumBlockWidth) {
        blocks.push(new ElidedBlock(blockData))
      } else {
        blocks.push(new ContentBlock(blockData))
      }

      // insert a inter-region padding block if we are crossing a displayed region
      if (
        regionWidthPx >= minimumBlockWidth &&
        blockData.isRightEndOfDisplayedRegion &&
        index < displayedRegions.length - 1
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
        index === displayedRegions.length - 1 &&
        blockData.isRightEndOfDisplayedRegion
      ) {
        blocks.push(
          new InterRegionPaddingBlock({
            key: `${blockData.key}-afterLastRegion`,
            widthPx: width,
            offsetPx: blockData.offsetPx + blockData.widthPx,
            variant: 'boundary',
          }),
        )
      }
    }
    regionBpOffset += interRegionPaddingWidth * bpPerPx
    regionBpOffset += regionEnd - regionStart
  })
  return blocks
}
