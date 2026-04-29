import {
  BlockSet,
  makeContentBlock,
  makeElidedBlock,
  makeInterRegionPaddingBlock,
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

const blockSizeCssPx = 800

export default function calculateStaticBlocks(
  model: Base1DViewModel,
  padding = true,
  elision = true,
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
  const blockSizeBp = Math.ceil(blockSizeCssPx * bpPerPx)

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

    let windowRightBlockNum = Math.floor(
      (windowRightBp - regionBpOffset) * invBlockSizeBp,
    )
    if (windowRightBlockNum >= regionBlockCount) {
      windowRightBlockNum = regionBlockCount - 1
    }

    let windowLeftBlockNum = Math.floor(
      (windowLeftBp - regionBpOffset) * invBlockSizeBp,
    )
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
      const isLeftEndOfDisplayedRegion = blockNum === 0
      const isRightEndOfDisplayedRegion = blockNum === regionBlockCount - 1
      let start: number
      let end: number
      if (reversed) {
        start = Math.max(regionStart, regionEnd - (blockNum + 1) * blockSizeBp)
        end = regionEnd - blockNum * blockSizeBp
      } else {
        start = regionStart + blockNum * blockSizeBp
        end = Math.min(regionEnd, regionStart + (blockNum + 1) * blockSizeBp)
      }
      const widthPx = (end - start) * invBpPerPx
      const blockOffsetPx =
        (regionBpOffset + blockNum * blockSizeBp) * invBpPerPx
      const key = `${assemblyName}:${refName}:${start}:${end}:${displayedRegionIndex}${reversed ? ':rev' : ''}`

      if (padding && displayedRegionIndex === 0 && blockNum === 0) {
        blocks.push(
          makeInterRegionPaddingBlock({
            key: `${key}-beforeFirstRegion`,
            widthPx: blockSizeCssPx,
            offsetPx: blockOffsetPx - blockSizeCssPx,
            variant: 'boundary',
          }),
        )
      }

      const data = {
        assemblyName,
        refName,
        start,
        end,
        reversed,
        offsetPx: blockOffsetPx,
        displayedRegionIndex,
        widthPx,
        isLeftEndOfDisplayedRegion,
        isRightEndOfDisplayedRegion,
        key,
      }
      blocks.push(
        elision && regionWidthPx < minimumBlockWidth
          ? makeElidedBlock(data)
          : makeContentBlock(data),
      )

      if (padding) {
        if (
          regionWidthPx >= minimumBlockWidth &&
          isRightEndOfDisplayedRegion &&
          displayedRegionIndex < displayedRegions.length - 1
        ) {
          regionBpOffset += interRegionPaddingWidth * bpPerPx
          blocks.push(
            makeInterRegionPaddingBlock({
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
            makeInterRegionPaddingBlock({
              key: `${key}-afterLastRegion`,
              widthPx: blockSizeCssPx,
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
