import { isStateTreeNode, getSnapshot } from 'mobx-state-tree'
import { assembleLocStringFast } from '.'
import {
  BlockSet,
  ContentBlock,
  ElidedBlock,
  InterRegionPaddingBlock,
} from './blockTypes'
import type { Region } from './types'
import type { Region as RegionModel } from './types/mst'
import type { Instance } from 'mobx-state-tree'

export interface Base1DViewModel {
  offsetPx: number
  width: number
  displayedRegions: (Region | Instance<typeof RegionModel>)[]
  bpPerPx: number
  minimumBlockWidth: number
  interRegionPaddingWidth: number
}

export default function calculateStaticBlocks(
  model: Base1DViewModel,
  padding = true,
  elision = true,
  extra = 0,
  width = 800,
) {
  const {
    offsetPx,
    displayedRegions,
    bpPerPx,
    minimumBlockWidth,
    interRegionPaddingWidth,
    width: modelWidth,
  } = model

  const windowLeftBp = offsetPx * bpPerPx
  const windowRightBp = (offsetPx + modelWidth) * bpPerPx
  const blockSizePx = width
  const blockSizeBp = Math.ceil(blockSizePx * bpPerPx)
  // for each displayed region
  let regionBpOffset = 0
  const blocks = new BlockSet()
  for (
    let regionNumber = 0;
    regionNumber < displayedRegions.length;
    regionNumber++
  ) {
    const region = displayedRegions[regionNumber]!
    const {
      assemblyName,
      refName,
      start: regionStart,
      end: regionEnd,
      reversed,
    } = region

    const regionBlockCount = Math.ceil((regionEnd - regionStart) / blockSizeBp)
    const parentRegion = isStateTreeNode(region) ? getSnapshot(region) : region

    let windowRightBlockNum =
      Math.floor((windowRightBp - regionBpOffset) / blockSizeBp) + extra
    if (windowRightBlockNum >= regionBlockCount) {
      windowRightBlockNum = regionBlockCount - 1
    }

    let windowLeftBlockNum =
      Math.floor((windowLeftBp - regionBpOffset) / blockSizeBp) - extra
    if (windowLeftBlockNum < 0) {
      windowLeftBlockNum = 0
    }

    const regionWidthPx = (regionEnd - regionStart) / bpPerPx

    for (
      let blockNum = windowLeftBlockNum;
      blockNum <= windowRightBlockNum;
      blockNum += 1
    ) {
      let start: number
      let end: number
      let isLeftEndOfDisplayedRegion: boolean
      let isRightEndOfDisplayedRegion: boolean
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

      if (padding && regionNumber === 0 && blockNum === 0) {
        blocks.push(
          new InterRegionPaddingBlock({
            key: `${blockData.key}-beforeFirstRegion`,
            widthPx: width,
            offsetPx: blockData.offsetPx - width,
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
          regionBpOffset += interRegionPaddingWidth * bpPerPx
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
          regionBpOffset += interRegionPaddingWidth * bpPerPx
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
    }
    regionBpOffset += regionEnd - regionStart
  }
  return blocks
}
