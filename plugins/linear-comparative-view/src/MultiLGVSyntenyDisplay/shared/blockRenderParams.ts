import { splitPositionWithFrac } from '@jbrowse/core/gpu/webglUtils'

import type { RenderBlock } from '@jbrowse/core/gpu/renderBlock'

export interface BlockRenderParams {
  bpRangeHi: number
  bpRangeLo: number
  bpRangeLen: number
  regionScreenLeft: number
  regionScreenWidth: number
}

export function computeBlockRenderParams(
  block: RenderBlock,
): BlockRenderParams {
  const [bpStart, bpEnd] = block.bpRangeX
  const [bpRangeHi, bpRangeLo] = splitPositionWithFrac(bpStart)

  return {
    bpRangeHi,
    bpRangeLo,
    bpRangeLen: bpEnd - bpStart,
    regionScreenLeft: block.screenStartPx,
    regionScreenWidth: block.screenEndPx - block.screenStartPx,
  }
}
