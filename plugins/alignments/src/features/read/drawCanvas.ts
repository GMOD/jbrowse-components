import { getReadColor } from '../../LinearAlignmentsDisplay/colorUtils.ts'
import {
  bpToScreenX,
  pileupRowY,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

import type {
  DrawBlock,
  RenderState,
} from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

interface DrawReadsRegion {
  readPositions: Uint32Array
  readYs: Uint16Array
  readStrands: Int8Array
  readFlags: Uint16Array
  readPairOrientations: Uint8Array
  readTagColors: Uint32Array
  readMapqs: Uint8Array
  readAvgBaseQualities: Uint8Array
  readInsertSizes: Float32Array
  readChainHasSupp: Uint8Array | undefined
  insertSizeStats?: { upper: number; lower: number }
}

export function drawReads(
  ctx: Ctx2D,
  region: DrawReadsRegion,
  block: DrawBlock,
  bpLength: number,
  fullBlockWidth: number,
  state: RenderState,
) {
  const fH = state.featureHeight

  for (let i = 0; i < region.readFlags.length; i++) {
    const startBp = region.readPositions[i * 2]!
    const endBp = region.readPositions[i * 2 + 1]!
    const x1 = bpToScreenX(startBp, block, bpLength, fullBlockWidth)
    const x2 = bpToScreenX(endBp, block, bpLength, fullBlockWidth)
    const y = pileupRowY(region.readYs[i]!, state)
    const w = Math.max(1, x2 - x1)

    ctx.fillStyle = getReadColor(i, region, state.colorScheme, state.colors, {
      renderingMode: state.renderingMode,
      flipStrandLongReadChains: state.flipStrandLongReadChains,
    })
    ctx.fillRect(x1, y, w, fH)

    if (state.showOutline && w > 2) {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'
      ctx.lineWidth = 0.5
      ctx.strokeRect(x1, y, w, fH)
    }
  }
}
