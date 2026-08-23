import { BlockSet } from './blockTypes.ts'

import type { Region } from './types/data.ts'
import type { Region as RegionModel } from './types/mst.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

export interface Base1DViewModel {
  offsetPx: number
  width: number
  displayedRegions: (Region | Instance<typeof RegionModel>)[]
  bpPerPx: number
  minimumBlockWidth: number
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
    width: modelWidth,
  } = model

  const windowLeftBp = offsetPx * bpPerPx
  const windowRightBp = (offsetPx + modelWidth) * bpPerPx
  const blockSizeBp = Math.ceil(blockSizeCssPx * bpPerPx)

  const invBpPerPx = 1 / bpPerPx
  const invBlockSizeBp = 1 / blockSizeBp
  let regionBpOffset = 0
  const blocks = new BlockSet()
  for (
    let displayedRegionIndex = 0;
    displayedRegionIndex < displayedRegions.length;
    displayedRegionIndex++
  ) {
    // Regions are laid out left to right, so once the cursor passes the window's
    // right edge nothing further can contribute a block — and the trailing
    // padding block needs the last region to be in view anyway. A whole-genome
    // view holds one region per refName, so without this the loop (and its five
    // MST observable reads per region) runs thousands of times per zoom frame to
    // emit a handful of blocks.
    if (regionBpOffset > windowRightBp) {
      break
    }
    const {
      assemblyName,
      refName,
      start: regionStart,
      end: regionEnd,
      reversed,
    } = displayedRegions[displayedRegionIndex]!

    const regionBlockCount = Math.ceil(
      (regionEnd - regionStart) * invBlockSizeBp,
    )

    const windowRightBlockNum = Math.min(
      Math.floor((windowRightBp - regionBpOffset) * invBlockSizeBp),
      regionBlockCount - 1,
    )
    const windowLeftBlockNum = Math.max(
      Math.floor((windowLeftBp - regionBpOffset) * invBlockSizeBp),
      0,
    )

    const regionWidthPx = (regionEnd - regionStart) * invBpPerPx

    for (
      let blockNum = windowLeftBlockNum;
      blockNum <= windowRightBlockNum;
      blockNum++
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
        blocks.push({
          type: 'InterRegionPaddingBlock',
          key: `${key}-beforeFirstRegion`,
          widthPx: blockSizeCssPx,
          offsetPx: blockOffsetPx - blockSizeCssPx,
          variant: 'boundary',
        })
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
          ? { ...data, type: 'ElidedBlock' }
          : { ...data, type: 'ContentBlock' },
      )

      if (
        padding &&
        displayedRegionIndex === displayedRegions.length - 1 &&
        isRightEndOfDisplayedRegion
      ) {
        blocks.push({
          type: 'InterRegionPaddingBlock',
          key: `${key}-afterLastRegion`,
          widthPx: blockSizeCssPx,
          offsetPx: blockOffsetPx + widthPx,
          variant: 'boundary',
        })
      }
    }
    regionBpOffset += regionEnd - regionStart
  }
  return blocks
}
