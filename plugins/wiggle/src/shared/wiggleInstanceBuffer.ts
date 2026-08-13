import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import {
  NO_PREV_START,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
} from '@jbrowse/wiggle-core'

import {
  INSTANCE_OFFSET_F32,
  INSTANCE_OFFSET_U32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS,
} from './shaders/wiggle.iface.generated.ts'

import type { SourceRenderData } from '@jbrowse/wiggle-core'

// Five of the ten instance words are neighbor-derived, and each group is read by
// exactly one pass: prevScore/nextScore only under RENDERING_TYPE_LINE,
// prevStartEnd/prevScoreLine only under RENDERING_TYPE_LINE_CENTER (both guarded
// in wiggle.slang's vs_main). Every other rendering — xyplot, density, scatter,
// i.e. the defaults — used to have the encoder compute and write both groups for
// a shader that never looks at either.
//
// So each layer is encoded for the one rendering it names, and `drawRegion`
// picks its pass off that same field — see SourceRenderData.renderingType for
// why the pass must not come from the render state instead. Words a pass doesn't
// read keep the zeroes ArrayBuffer hands out.
//
// Worth roughly halving a fill rendering's encode (2.5ms -> 1.3ms over a
// 128k-feature region, A/B'd in one process; measuring the two in separate
// processes is useless here, the same code varied 2.4-5.4ms). The line
// renderings still do their own group's work and come out about level. Modest in
// isolation, but this runs on the main thread, per region, and again for every
// region on any gpuProps change (see installPerRegionLifecycle) — and
// multi-wiggle multiplies it by the source count.
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
    const stepLine = source.renderingType === RENDERING_TYPE_LINE
    const centerLine = source.renderingType === RENDERING_TYPE_LINE_CENTER
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
      u32[off + INSTANCE_OFFSET_U32.startEnd] = currStart
      u32[off + INSTANCE_OFFSET_U32.startEnd + 1] = currEnd
      f32[off + INSTANCE_OFFSET_F32.score] = score
      u32[off + INSTANCE_OFFSET_U32.color] = colorsAbgr
        ? colorsAbgr[i]!
        : colorAbgr
      f32[off + INSTANCE_OFFSET_F32.rowIndex] = row
      if (centerLine) {
        // The center-line pass draws one segment per feature from the previous
        // feature's bp midpoint to this one's. It connects consecutive pairs
        // regardless of bp-adjacency, so the sporadic non-tiling bins reduced
        // BigWig data is full of don't dash the line — only a hole past
        // `gapLimitBp` breaks the run, encoded exactly like the source start so
        // the run restarts there instead of one chord spanning the hole.
        // prevStartEnd carries the previous feature's span (the shader averages
        // it in clip space, exactly as it does the current feature's, so the
        // joint lands on one point); prevScoreLine the previous real score
        // (prevScore is zeroed at gaps for the step-line, so the center-line
        // needs its own). NO_PREV_START is the shader's own constant, generated
        // in (adr-051), since this is the side that writes the value the shader
        // tests for.
        const prevLinked =
          i > 0 &&
          (currStart + currEnd) / 2 -
            (positions[pi - 2]! + positions[pi - 1]!) / 2 <=
            gapLimitBp
        u32[off + INSTANCE_OFFSET_U32.prevStartEnd] = prevLinked
          ? positions[pi - 2]!
          : NO_PREV_START
        u32[off + INSTANCE_OFFSET_U32.prevStartEnd + 1] = prevLinked
          ? positions[pi - 1]!
          : 0
        f32[off + INSTANCE_OFFSET_F32.prevScoreLine] = prevLinked
          ? scores[i - 1]!
          : 0
      } else if (stepLine) {
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
        const prevAdj = i > 0 && positions[pi - 1] === currStart
        const nextAdj = i < n - 1 && positions[pi + 2] === currEnd
        f32[off + INSTANCE_OFFSET_F32.prevScore] = prevAdj ? scores[i - 1]! : 0
        f32[off + INSTANCE_OFFSET_F32.nextScore] = nextAdj ? score : 0
      }
      off += INSTANCE_STRIDE_WORDS
    }
  }
  return buf
}
