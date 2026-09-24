import {
  GAP_DELETION,
  GAP_SKIP,
} from '../../shaders/slang/gap.consts.generated.ts'

import type { GapData } from '../../shared/webglRpcTypes.ts'

export function buildGapArrays(gaps: GapData[]) {
  const gapPositions = new Uint32Array(gaps.length * 2)
  const gapTypes = new Uint8Array(gaps.length)
  const gapReadIndices = new Uint32Array(gaps.length)
  for (let i = 0; i < gaps.length; i++) {
    const g = gaps[i]!
    gapPositions[i * 2] = g.start
    gapPositions[i * 2 + 1] = g.end
    gapTypes[i] = g.type === 'deletion' ? GAP_DELETION : GAP_SKIP
    gapReadIndices[i] = g.readIndex
  }
  return { gapPositions, gapTypes, gapReadIndices }
}
