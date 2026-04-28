import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'

import {
  BlockSet,
  ContentBlock,
  ElidedBlock,
  InterRegionPaddingBlock,
} from './blockTypes.ts'

import type { Region } from './types/index.ts'
import type { Region as RegionModel } from './types/mst.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

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
  const blockSizeBp = Math.ceil(width * bpPerPx)

  // Pre-calculate inverse values to avoid repeated divisions
  const invBpPerPx = 1 / bpPerPx
  const invBlockSizeBp = 1 / blockSizeBp
  // for each displayed region
  let regionBpOffset = 0
  const blocks = new BlockSet()
  for (
    let displayedRegionIndex = 0;
    displayedRegionIndex < displayedRegions.length;
    displayedRegionIndex++
  ) {
    const region = displayedRegions[displayedRegionIndex]!
    const {
      assemblyName,
      refName,
      start: regionStart,
      end: regionEnd,
      reversed,
    } = region

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

    const regionWidthPx = (regionEnd - regionStart) * invBpPerPx
    const lastBlockInWindow =
      windowRightBlockNum === regionBlockCount - 1 &&
      windowLeftBlockNum <= windowRightBlockNum

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
      const blockOffsetPx = (regionBpOffset + blockNum * blockSizeBp) * invBpPerPx
      const key = `${assemblyName}:${refName}:${start}:${end}:${displayedRegionIndex}${reversed ? ':rev' : ''}`

      if (padding && displayedRegionIndex === 0 && blockNum === 0) {
        blocks.push(
          new InterRegionPaddingBlock({
            key: `${key}-beforeFirstRegion`,
            widthPx: width,
            offsetPx: blockOffsetPx - width,
            variant: 'boundary',
          }),
        )
      }

      if (elision && regionWidthPx < minimumBlockWidth) {
        blocks.push(
          new ElidedBlock({
            assemblyName,
            refName,
            start,
            end,
            reversed,
            offsetPx: blockOffsetPx,
            parentRegion,
            displayedRegionIndex,
            widthPx,
            isLeftEndOfDisplayedRegion,
            isRightEndOfDisplayedRegion,
            key,
          }),
        )
      } else {
        blocks.push(
          new ContentBlock({
            assemblyName,
            refName,
            start,
            end,
            reversed,
            offsetPx: blockOffsetPx,
            parentRegion,
            displayedRegionIndex,
            widthPx,
            isLeftEndOfDisplayedRegion,
            isRightEndOfDisplayedRegion,
            key,
          }),
        )
      }

      if (padding) {
        if (
          regionWidthPx >= minimumBlockWidth &&
          isRightEndOfDisplayedRegion &&
          displayedRegionIndex < displayedRegions.length - 1
        ) {
          regionBpOffset += interRegionPaddingWidth * bpPerPx
          blocks.push(
            new InterRegionPaddingBlock({
              key: `${key}-rightpad`,
              widthPx: interRegionPaddingWidth,
              offsetPx: blockOffsetPx + widthPx,
            }),
          )
        }
        if (
          displayedRegionIndex === displayedRegions.length - 1 &&
          isRightEndOfDisplayedRegion
        ) {
          regionBpOffset += interRegionPaddingWidth * bpPerPx
          blocks.push(
            new InterRegionPaddingBlock({
              key: `${key}-afterLastRegion`,
              widthPx: width,
              offsetPx: blockOffsetPx + widthPx,
              variant: 'boundary',
            }),
          )
        }
      }
    }
    if (
      padding &&
      !lastBlockInWindow &&
      regionWidthPx >= minimumBlockWidth &&
      displayedRegionIndex < displayedRegions.length - 1
    ) {
      regionBpOffset += interRegionPaddingWidth * bpPerPx
    }
    regionBpOffset += regionEnd - regionStart
  }
  return blocks
}
