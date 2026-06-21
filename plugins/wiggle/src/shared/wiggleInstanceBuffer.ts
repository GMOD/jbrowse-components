import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'

import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32,
} from './shaders/wiggle.iface.generated.ts'

import type { SourceRenderData } from '@jbrowse/wiggle-core'

export function interleaveInstances(
  sources: SourceRenderData[],
  totalFeatures: number,
) {
  const buf = new ArrayBuffer(totalFeatures * INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let off = 0
  for (const source of sources) {
    const row = source.rowIndex
    const colorAbgr = normalizedRgbToABGR(
      source.color[0],
      source.color[1],
      source.color[2],
    )
    const positions = source.featurePositions
    const scores = source.featureScores
    const n = source.numFeatures
    for (let i = 0; i < n; i++) {
      const pi = i * 2
      const score = scores[i]!
      const currStart = positions[pi]!
      const currEnd = positions[pi + 1]!
      const prevAdj = i > 0 && positions[pi - 1] === currStart
      const nextAdj = i < n - 1 && positions[pi + 2] === currEnd
      u32[off + FIELD_OFFSET_F32.startEnd] = currStart
      u32[off + FIELD_OFFSET_F32.startEnd + 1] = currEnd
      f32[off + FIELD_OFFSET_F32.score] = score
      // The shader's line pass draws three segments per feature:
      //   v0–v1: vertical at startX from prevScore → score (transition in)
      //   v2–v3: horizontal at score across [startX, endX]
      //   v4–v5: vertical at endX   from score → nextScore (transition out)
      //
      // prevScore=0 with a gap-before encodes "rise from the zero line."
      // nextScore=0 with a gap-after encodes "drop to the zero line."
      //
      // When adjacent: prevScore = previous feature's score (smooth join);
      // nextScore deliberately stays equal to the current score so v4–v5
      // collapses to a no-op — the *next* feature's v0–v1 draws the real
      // transition. (Drawing it on both sides would double-stroke the seam.)
      f32[off + FIELD_OFFSET_F32.prevScore] = prevAdj ? scores[i - 1]! : 0
      f32[off + FIELD_OFFSET_F32.nextScore] = nextAdj ? score : 0
      u32[off + FIELD_OFFSET_F32.color] = colorAbgr
      f32[off + FIELD_OFFSET_F32.rowIndex] = row
      off += INSTANCE_STRIDE_F32
    }
  }
  return buf
}
