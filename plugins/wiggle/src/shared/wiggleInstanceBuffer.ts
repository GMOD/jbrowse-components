import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import { NO_PREV_START } from '@jbrowse/wiggle-core'

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
    // Per-instance colors (bicolor whiskers); falls back to the single per-layer
    // colorAbgr when absent.
    const colorsAbgr = source.colorsAbgr
    const n = source.numFeatures
    // Center-to-center distance past which the center-line treats the span as a
    // hole. Read off the layer rather than recomputed here, so the sentinel this
    // writes and the break drawLineCenter takes are one decision, not two that
    // can drift (see buildSourceRenderData's layerGapLimitBp).
    const gapLimitBp = source.gapLimitBp ?? Number.POSITIVE_INFINITY
    for (let i = 0; i < n; i++) {
      const pi = i * 2
      const score = scores[i]!
      const currStart = positions[pi]!
      const currEnd = positions[pi + 1]!
      const prevAdj = i > 0 && positions[pi - 1] === currStart
      const nextAdj = i < n - 1 && positions[pi + 2] === currEnd
      // A hole ahead of this feature is encoded exactly like the source start:
      // NO_PREV_START collapses the capsule, so the run restarts here instead of
      // one chord spanning the hole. Only the center-line pass reads
      // prevStartEnd/prevScoreLine, so this costs the other modes nothing.
      const prevLinked =
        i > 0 &&
        (currStart + currEnd) / 2 -
          (positions[pi - 2]! + positions[pi - 1]!) / 2 <=
          gapLimitBp
      u32[off + FIELD_OFFSET_F32.startEnd] = currStart
      u32[off + FIELD_OFFSET_F32.startEnd + 1] = currEnd
      f32[off + FIELD_OFFSET_F32.score] = score
      // Center-line pass (RENDERING_TYPE_LINE_CENTER) draws one segment per
      // feature from the previous feature's bp midpoint to this one's. It
      // connects consecutive pairs regardless of bp-adjacency, so the sporadic
      // non-tiling bins reduced BigWig data is full of don't dash the line —
      // only a hole past `gapLimitBp` breaks the run. prevStartEnd carries the
      // previous feature's span
      // (the shader averages it in clip space, exactly as it does the current
      // feature's, so the joint lands on one point); prevScoreLine the previous
      // real score (prevScore is zeroed at gaps for the step-line, so the
      // center-line needs its own). NO_PREV_START marks the source start — or a
      // hole wider than gapLimitBp — so the shader collapses that quad to
      // nothing; it is the shader's own constant, generated in (adr-051), since
      // this is the side that writes the value the shader tests for. Both
      // unused by other modes.
      u32[off + FIELD_OFFSET_F32.prevStartEnd] = prevLinked
        ? positions[pi - 2]!
        : NO_PREV_START
      u32[off + FIELD_OFFSET_F32.prevStartEnd + 1] = prevLinked
        ? positions[pi - 1]!
        : 0
      f32[off + FIELD_OFFSET_F32.prevScoreLine] = prevLinked
        ? scores[i - 1]!
        : 0
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
      u32[off + FIELD_OFFSET_F32.color] = colorsAbgr
        ? colorsAbgr[i]!
        : colorAbgr
      f32[off + FIELD_OFFSET_F32.rowIndex] = row
      off += INSTANCE_STRIDE_F32
    }
  }
  return buf
}
