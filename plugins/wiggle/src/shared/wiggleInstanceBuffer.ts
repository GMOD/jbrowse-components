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
import {
  INSTANCE_OFFSET_F32 as CENTER_F32,
  INSTANCE_OFFSET_U32 as CENTER_U32,
  INSTANCE_STRIDE_BYTES as CENTER_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS as CENTER_STRIDE_WORDS,
} from './shaders/wiggleLineCenter.iface.generated.ts'
import { centerLinksToPrevious } from './wiggleComponentUtils.ts'

import type { SourceRenderData } from '@jbrowse/wiggle-core'

// Four per-instance records, one packer each: fill (20 bytes, xyplot, scatter
// and density), step line (32), center line (36) and whiskers band (44). Each
// packer returns an empty buffer for layers that aren't its rendering's, which
// is how a pass releases its buffer (GpuPerRegionRenderingBackend.upload), so
// switching plot type frees the layout that is no longer drawn.
//
// A record carries only what its own shader reads: every byte is multiplied by
// features x sources in one allocation against a 256MB maxBufferSize floor, so
// a field only another rendering reads lowers this one's zoom ceiling.

function totalOf(sources: SourceRenderData[], band = false) {
  let total = 0
  for (const source of sources) {
    if (!!source.band === band) {
      total += source.numFeatures
    }
  }
  return total
}

function renderingOf(sources: SourceRenderData[]) {
  return sources[0]?.renderingType
}

function colorOf(source: SourceRenderData) {
  return normalizedRgbToABGR(source.color[0], source.color[1], source.color[2])
}

function negColorOf(source: SourceRenderData) {
  return source.negColor
    ? normalizedRgbToABGR(...source.negColor)
    : colorOf(source)
}

// xyplot / density / scatter: startEnd, score, color, rowIndex.
export function packFillInstances(sources: SourceRenderData[]) {
  const type = renderingOf(sources)
  if (type === RENDERING_TYPE_LINE || type === RENDERING_TYPE_LINE_CENTER) {
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

// The step line: startEnd, score, prevScore, nextScore, color, rowIndex,
// negColor. The shader draws three segments per feature:
//   v0–v1: vertical at startX from prevScore → score (transition in)
//   v2–v3: horizontal at score across [startX, endX]
//   v4–v5: vertical at endX   from score → nextScore (transition out)
//
// prevScore=0 with a gap-before encodes "rise from the zero line."
// nextScore=0 with a gap-after encodes "drop to the zero line."
//
// When adjacent: prevScore = previous feature's score (smooth join); nextScore
// deliberately stays equal to the current score so v4–v5 collapses to a no-op —
// the *next* feature's v0–v1 draws the real transition. (Drawing it on both
// sides would double-stroke the seam.)
export function packLineInstances(sources: SourceRenderData[]) {
  if (renderingOf(sources) !== RENDERING_TYPE_LINE) {
    return new ArrayBuffer(0)
  }
  const buf = new ArrayBuffer(totalOf(sources) * LINE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let off = 0
  for (const source of sources) {
    if (source.band) {
      continue
    }
    const row = source.rowIndex
    const colorAbgr = colorOf(source)
    const negAbgr = negColorOf(source)
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
      u32[off + LINE_U32.startEnd] = currStart
      u32[off + LINE_U32.startEnd + 1] = currEnd
      f32[off + LINE_F32.score] = score
      f32[off + LINE_F32.prevScore] = prevAdj ? scores[i - 1]! : 0
      f32[off + LINE_F32.nextScore] = nextAdj ? score : 0
      u32[off + LINE_U32.color] = colorAbgr
      f32[off + LINE_F32.rowIndex] = row
      u32[off + LINE_U32.negColor] = negAbgr
      off += LINE_STRIDE_WORDS
    }
  }
  return buf
}

// The center line: startEnd, score, color, rowIndex, prevStartEnd, prevScore,
// negColor. The shader draws one segment per feature from the previous
// feature's bp midpoint to this one's. It connects consecutive pairs regardless
// of bp-adjacency, so the sporadic non-tiling bins reduced BigWig data is full
// of don't dash the line — only a hole past `gapLimitBp` breaks the run,
// encoded exactly like the source start (NO_PREV_START, the shader's own
// constant) so the run restarts there instead of one chord spanning the hole.
// prevStartEnd carries the previous feature's whole span, which the shader
// averages in clip space exactly as it does the current feature's, so the joint
// lands on one point.
export function packLineCenterInstances(sources: SourceRenderData[]) {
  if (renderingOf(sources) !== RENDERING_TYPE_LINE_CENTER) {
    return new ArrayBuffer(0)
  }
  const buf = new ArrayBuffer(totalOf(sources) * CENTER_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let off = 0
  for (const source of sources) {
    if (source.band) {
      continue
    }
    const row = source.rowIndex
    const colorAbgr = colorOf(source)
    const negAbgr = negColorOf(source)
    const positions = source.featurePositions
    const scores = source.featureScores
    const n = source.numFeatures
    // Read off the layer rather than recomputed here, so the sentinel this
    // writes and the break drawLineCenter takes are one decision
    // (buildSourceRenderData's layerGapLimitBp).
    const gapLimitBp = source.gapLimitBp ?? Number.POSITIVE_INFINITY
    for (let i = 0; i < n; i++) {
      const pi = i * 2
      const linked = centerLinksToPrevious(positions, i, gapLimitBp)
      u32[off + CENTER_U32.startEnd] = positions[pi]!
      u32[off + CENTER_U32.startEnd + 1] = positions[pi + 1]!
      f32[off + CENTER_F32.score] = scores[i]!
      u32[off + CENTER_U32.color] = colorAbgr
      f32[off + CENTER_F32.rowIndex] = row
      u32[off + CENTER_U32.prevStartEnd] = linked
        ? positions[pi - 2]!
        : NO_PREV_START
      u32[off + CENTER_U32.prevStartEnd + 1] = linked ? positions[pi - 1]! : 0
      f32[off + CENTER_F32.prevScore] = linked ? scores[i - 1]! : 0
      u32[off + CENTER_U32.negColor] = negAbgr
      off += CENTER_STRIDE_WORDS
    }
  }
  return buf
}

// Last source first: the band pass composites each instance behind what the
// target holds, so this order stacks overlaid bands as Canvas2D's in-order
// source-over does.
export function packBandInstances(sources: SourceRenderData[]) {
  const buf = new ArrayBuffer(totalOf(sources, true) * BAND_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let off = 0
  for (let s = sources.length - 1; s >= 0; s--) {
    const source = sources[s]!
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
