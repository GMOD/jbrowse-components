import { splitPositionWithFrac } from '@jbrowse/core/gpu/webglUtils'

import type { ContentBlock } from '@jbrowse/core/util/blockTypes'

export interface BlockRenderParams {
  bpRangeHi: number
  bpRangeLo: number
  bpRangeLen: number
  regionScreenLeft: number
  regionScreenWidth: number
}

export function computeBlockRenderParams(
  block: ContentBlock,
  viewOffsetPx: number,
): BlockRenderParams {
  const [bpRangeHi, bpRangeLo] = splitPositionWithFrac(block.start)
  const bpRangeLen = block.end - block.start
  const regionScreenLeft = block.offsetPx - viewOffsetPx
  const regionScreenWidth = block.widthPx

  return {
    bpRangeHi,
    bpRangeLo,
    bpRangeLen,
    regionScreenLeft,
    regionScreenWidth,
  }
}
