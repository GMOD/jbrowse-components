import { YSCALEBAR_LABEL_OFFSET, niceNum } from '@jbrowse/alignments-core'

import { computeBlockRenderParams } from './multiSyntenyGpuData.ts'

import type { BlockRenderParams } from './multiSyntenyGpuData.ts'
import type { BaseBlock } from '@jbrowse/core/util/blockTypes'

export function fillSyntenyUniforms(
  f: Float32Array,
  width: number,
  height: number,
  rowHeight: number,
  bpRangeHi: number,
  bpRangeLo: number,
  bpRangeLen: number,
  regionScreenLeft: number,
  regionScreenWidth: number,
  rowPadding: number,
  coverageHeight: number,
  depthScale: number,
  coverageColor?: [number, number, number],
) {
  f[0] = width
  f[1] = height
  f[2] = rowHeight
  f[3] = coverageHeight
  f[4] = bpRangeHi
  f[5] = bpRangeLo
  f[6] = bpRangeLen
  f[7] = regionScreenLeft
  f[8] = regionScreenWidth
  f[9] = 0
  f[10] = rowPadding
  f[11] = YSCALEBAR_LABEL_OFFSET
  f[12] = depthScale
  f[13] = coverageColor ? coverageColor[0] : 0.6
  f[14] = coverageColor ? coverageColor[1] : 0.6
  f[15] = coverageColor ? coverageColor[2] : 0.6
}

export function computeDepthScale(globalMaxDepth: number) {
  const nicedMax = globalMaxDepth > 0 ? niceNum(globalMaxDepth) : 1
  const depthScale = globalMaxDepth > 0 ? globalMaxDepth / nicedMax : 1
  return depthScale
}

export function computeGlobalMaxDepth<T extends { coverageMaxDepth: number }>(
  contentBlocks: BaseBlock[],
  getRegion: (block: BaseBlock) => T | undefined,
) {
  let max = 0
  for (const block of contentBlocks) {
    const region = getRegion(block)
    if (region && region.coverageMaxDepth > max) {
      max = region.coverageMaxDepth
    }
  }
  return max
}

export function getRegionForBlock<T>(
  block: BaseBlock,
  regionKeyMap: Map<number, string>,
  regions: Map<string, T>,
) {
  if (block.regionNumber === undefined) {
    return undefined
  }
  const key = regionKeyMap.get(block.regionNumber)
  if (!key) {
    return undefined
  }
  return regions.get(key)
}

export function* visibleBlocks<T>(
  contentBlocks: BaseBlock[],
  regionKeyMap: Map<number, string>,
  regions: Map<string, T>,
  viewOffsetPx: number,
  viewWidth: number,
): Generator<[T, BlockRenderParams]> {
  for (const block of contentBlocks) {
    const region = getRegionForBlock(block, regionKeyMap, regions)
    if (!region) {
      continue
    }

    const params = computeBlockRenderParams(block, viewOffsetPx)
    if (
      params.regionScreenLeft + params.regionScreenWidth < 0 ||
      params.regionScreenLeft > viewWidth
    ) {
      continue
    }

    yield [region, params]
  }
}
