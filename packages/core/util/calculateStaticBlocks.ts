import { getSnapshot, isStateTreeNode } from 'mobx-state-tree'

import {
  BlockSet,
  ContentBlock,
  ElidedBlock,
  InterRegionPaddingBlock,
} from './blockTypes.ts'

import type { BlockData } from './blockCalculationHelpers.ts'
import type { Region } from './types'
import type { Region as RegionModel } from './types/mst.ts'
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

  // Define the visible window in base pairs
  const windowLeftBp = offsetPx * bpPerPx
  const windowRightBp = (offsetPx + modelWidth) * bpPerPx

  // Define block size for static blocks
  const blockSizePx = width
  const blockSizeBp = Math.ceil(blockSizePx * bpPerPx)

  // Pre-calculate inverse values to avoid repeated divisions
  const invBpPerPx = 1 / bpPerPx
  const invBlockSizeBp = 1 / blockSizeBp

  // Track cumulative position across all displayed regions (in base pairs)
  let regionBpOffset = 0
  const blocks = new BlockSet()

  // Process each displayed region
  for (
    let regionNumber = 0, l = displayedRegions.length;
    regionNumber < l;
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

    const regionWidthPx = (regionEnd - regionStart) * invBpPerPx
    const regionBlockCount = Math.ceil(
      (regionEnd - regionStart) * invBlockSizeBp,
    )
    const parentRegion = isStateTreeNode(region) ? getSnapshot(region) : region

    let windowRightBlockNum =
      Math.floor((windowRightBp - regionBpOffset) * invBlockSizeBp) + extra
    if (windowRightBlockNum >= regionBlockCount) {
      windowRightBlockNum = regionBlockCount - 1
    }

    let windowLeftBlockNum =
      Math.floor((windowLeftBp - regionBpOffset) * invBlockSizeBp) - extra
    if (windowLeftBlockNum < 0) {
      windowLeftBlockNum = 0
    }

    let lastBlockData: BlockData | null = null

    // Create multiple fixed-size blocks for this region
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
      const widthPx = (end - start) * invBpPerPx
      const blockData = {
        assemblyName,
        refName,
        start,
        end,
        reversed,
        offsetPx:
          regionBpOffset * invBpPerPx + blockNum * blockSizeBp * invBpPerPx,
        parentRegion,
        regionNumber,
        widthPx,
        isLeftEndOfDisplayedRegion,
        isRightEndOfDisplayedRegion,
        key: `{${assemblyName}}${refName}:${start + 1}${start + 1 === end ? '' : `..${end}`}${reversed ? '[rev]' : ''}-${regionNumber}${reversed ? '-reversed' : ''}`,
      }

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

      lastBlockData = blockData
    }

    // After the block loop, add padding blocks if the last block ended at the region boundary
    if (padding && lastBlockData) {
      if (
        regionWidthPx >= minimumBlockWidth &&
        regionNumber < displayedRegions.length - 1 &&
        lastBlockData.isRightEndOfDisplayedRegion
      ) {
        blocks.push(
          new InterRegionPaddingBlock({
            key: `${lastBlockData.key}-rightpad`,
            widthPx: interRegionPaddingWidth,
            offsetPx: lastBlockData.offsetPx + lastBlockData.widthPx,
          }),
        )
      }
      if (
        regionNumber === displayedRegions.length - 1 &&
        lastBlockData.isRightEndOfDisplayedRegion
      ) {
        blocks.push(
          new InterRegionPaddingBlock({
            key: `${lastBlockData.key}-afterLastRegion`,
            widthPx: width,
            offsetPx: lastBlockData.offsetPx + lastBlockData.widthPx,
            variant: 'boundary',
          }),
        )
      }
    }

    // Accumulate offset for next region
    const shouldPad =
      padding &&
      !!lastBlockData?.isRightEndOfDisplayedRegion &&
      regionWidthPx >= minimumBlockWidth &&
      regionNumber < displayedRegions.length - 1

    const regionOffsetBp = regionEnd - regionStart
    const paddingOffsetBp = shouldPad ? interRegionPaddingWidth * bpPerPx : 0
    regionBpOffset = regionBpOffset + regionOffsetBp + paddingOffsetBp
  }
  return blocks
}
