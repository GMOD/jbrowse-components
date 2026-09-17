import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'
import {
  NO_PREV_START,
  RENDERING_TYPE_LINE,
  RENDERING_TYPE_LINE_CENTER,
} from '@jbrowse/wiggle-core'

import {
  INSTANCE_OFFSET_F32 as FILL_F32,
  INSTANCE_OFFSET_U32 as FILL_U32,
  INSTANCE_STRIDE_BYTES as FILL_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS as FILL_STRIDE_WORDS,
} from './shaders/wiggle.iface.generated.ts'
import {
  INSTANCE_OFFSET_F32 as BAND_F32,
  INSTANCE_OFFSET_U32 as BAND_U32,
  INSTANCE_STRIDE_BYTES as BAND_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS as BAND_STRIDE_WORDS,
} from './shaders/wiggleBand.iface.generated.ts'
import {
  INSTANCE_OFFSET_F32 as LINE_F32,
  INSTANCE_OFFSET_U32 as LINE_U32,
  INSTANCE_STRIDE_BYTES as LINE_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS as LINE_STRIDE_WORDS,
} from './shaders/wiggleLine.iface.generated.ts'
import { centerLinksToPrevious } from './wiggleComponentUtils.ts'

import type { SourceRenderData } from '@jbrowse/wiggle-core'

// Three per-instance records, one packer each. A region's layers feed the fill
// record or the line record, whichever matches the rendering they were built
// for, and a line plot's whiskers band layers feed the band record besides. The other returns an empty buffer, which is how a pass releases its
// buffer (see GpuPerRegionRenderingBackend.upload — an empty pack IS the
// release), so switching plot type frees the layout that is no longer drawn
// instead of leaving a stale one bound. The fill record serves three entry
// shaders (wiggle.slang's xyplot/scatter and wiggleDensity.slang, which draws
// off the fill pass's buffer), the line record two passes of one shader.
//
// Splitting them is what lets the filled renderings — xyplot, density, scatter,
// i.e. the defaults — stop carrying the neighbour fields only the two stroked
// ones read. That is half the bytes per feature (20 vs 40), and on a
// 1000-source multiwiggle at a 1Mb view it is 82MB rather than 164MB in a single
// per-region allocation, against a maxBufferSize floor of 256MB. It roughly
// halves the encode too, which is main-thread work redone for every region
// whenever gpuProps changes (a colour, a sort, a subtrack toggle).

function totalOf(sources: SourceRenderData[], band = false) {
  let total = 0
  for (const source of sources) {
    if (!!source.band === band) {
      total += source.numFeatures
    }
  }
  return total
}

function isLine(sources: SourceRenderData[]) {
  const type = sources[0]?.renderingType
  return type === RENDERING_TYPE_LINE || type === RENDERING_TYPE_LINE_CENTER
}

function colorOf(source: SourceRenderData) {
  return normalizedRgbToABGR(source.color[0], source.color[1], source.color[2])
}

function negColorOf(source: SourceRenderData) {
  return source.negColor
    ? normalizedRgbToABGR(...source.negColor)
    : colorOf(source)
}

// xyplot / density / scatter: startEnd, score, color, rowIndex. No feature here
// reads a neighbour, which is the whole reason this record is five words.
export function packFillInstances(sources: SourceRenderData[]) {
  if (isLine(sources)) {
    return new ArrayBuffer(0)
  }
  const buf = new ArrayBuffer(totalOf(sources) * FILL_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let off = 0
  for (const source of sources) {
    const row = source.rowIndex
    const colorAbgr = colorOf(source)
    const positions = source.featurePositions
    const scores = source.featureScores
    // Per-instance colors (bicolor whiskers); falls back to the single per-layer
    // colorAbgr when absent.
    const colorsAbgr = source.colorsAbgr
    const n = source.numFeatures
    for (let i = 0; i < n; i++) {
      const pi = i * 2
      u32[off + FILL_U32.startEnd] = positions[pi]!
      u32[off + FILL_U32.startEnd + 1] = positions[pi + 1]!
      f32[off + FILL_F32.score] = scores[i]!
      u32[off + FILL_U32.color] = colorsAbgr ? colorsAbgr[i]! : colorAbgr
      f32[off + FILL_F32.rowIndex] = row
      off += FILL_STRIDE_WORDS
    }
  }
  return buf
}

// line / linecenter. One record serves both because they share a shader module,
// but each reads only its own neighbour fields — the step-line prevScore and
// nextScore, the center-line prevStartEnd and prevScoreLine — so only those are
// written and the other pair keeps the zeroes ArrayBuffer hands out.
export function packLineInstances(sources: SourceRenderData[]) {
  if (!isLine(sources)) {
    return new ArrayBuffer(0)
  }
  const buf = new ArrayBuffer(totalOf(sources) * LINE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let off = 0
  for (const source of sources.filter(s => !s.band)) {
    const row = source.rowIndex
    const colorAbgr = colorOf(source)
    const negAbgr = negColorOf(source)
    const positions = source.featurePositions
    const scores = source.featureScores
    const n = source.numFeatures
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
      u32[off + LINE_U32.startEnd] = currStart
      u32[off + LINE_U32.startEnd + 1] = currEnd
      f32[off + LINE_F32.score] = score
      u32[off + LINE_U32.color] = colorAbgr
      u32[off + LINE_U32.negColor] = negAbgr
      f32[off + LINE_F32.rowIndex] = row
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
        const prevLinked = centerLinksToPrevious(positions, i, gapLimitBp)
        u32[off + LINE_U32.prevStartEnd] = prevLinked
          ? positions[pi - 2]!
          : NO_PREV_START
        u32[off + LINE_U32.prevStartEnd + 1] = prevLinked
          ? positions[pi - 1]!
          : 0
        f32[off + LINE_F32.prevScoreLine] = prevLinked ? scores[i - 1]! : 0
      } else {
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
        f32[off + LINE_F32.prevScore] = prevAdj ? scores[i - 1]! : 0
        f32[off + LINE_F32.nextScore] = nextAdj ? score : 0
      }
      off += LINE_STRIDE_WORDS
    }
  }
  return buf
}

export function packBandInstances(sources: SourceRenderData[]) {
  const buf = new ArrayBuffer(totalOf(sources, true) * BAND_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let off = 0
  for (const source of sources) {
    const { band } = source
    if (band) {
      const positions = source.featurePositions
      const maxScores = source.featureScores
      const { minScores } = band
      const posAbgr = colorOf(source)
      const negAbgr = negColorOf(source)
      const centerLine = source.renderingType === RENDERING_TYPE_LINE_CENTER
      const gapLimitBp = source.gapLimitBp ?? Number.POSITIVE_INFINITY
      for (let i = 0; i < source.numFeatures; i++) {
        const linked =
          centerLine && centerLinksToPrevious(positions, i, gapLimitBp)
        u32[off + BAND_U32.startEnd] = positions[i * 2]!
        u32[off + BAND_U32.startEnd + 1] = positions[i * 2 + 1]!
        u32[off + BAND_U32.prevStartEnd] = linked
          ? positions[i * 2 - 2]!
          : NO_PREV_START
        u32[off + BAND_U32.prevStartEnd + 1] = linked
          ? positions[i * 2 - 1]!
          : 0
        f32[off + BAND_F32.minScore] = minScores[i]!
        f32[off + BAND_F32.maxScore] = maxScores[i]!
        f32[off + BAND_F32.prevMinScore] = linked ? minScores[i - 1]! : 0
        f32[off + BAND_F32.prevMaxScore] = linked ? maxScores[i - 1]! : 0
        u32[off + BAND_U32.posColor] = posAbgr
        u32[off + BAND_U32.negColor] = negAbgr
        f32[off + BAND_F32.rowIndex] = source.rowIndex
        off += BAND_STRIDE_WORDS
      }
    }
  }
  return buf
}
