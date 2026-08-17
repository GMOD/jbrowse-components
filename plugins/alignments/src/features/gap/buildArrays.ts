import {
  GAP_DELETION,
  GAP_SKIP,
} from '../../shaders/slang/gap.consts.generated.ts'

import type { GapData } from '../../shared/webglRpcTypes.ts'

export function buildGapArrays(gaps: GapData[], regionStart: number) {
  const filtered = gaps.filter(g => g.end > regionStart)
  const gapPositions = new Uint32Array(filtered.length * 2)
  const gapTypes = new Uint8Array(filtered.length)
  const gapReadIndices = new Uint32Array(filtered.length)
  for (let i = 0; i < filtered.length; i++) {
    const g = filtered[i]!
    // store the true absolute start (not clamped to regionStart): the GPU/canvas
    // rasterizer clips off-screen geometry, and clamping corrupted the hit-test
    // position/length for gaps beginning left of the view
    gapPositions[i * 2] = g.start
    gapPositions[i * 2 + 1] = g.end
    gapTypes[i] = g.type === 'deletion' ? GAP_DELETION : GAP_SKIP
    gapReadIndices[i] = g.readIndex
  }
  return { gapPositions, gapTypes, gapReadIndices }
}
