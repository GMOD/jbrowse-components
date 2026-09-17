// PROTOTYPES, measured by instanceBuffer.bench.ts and drawn by no shader. Each
// packs the fields the production record carries minus the ones a per-row
// colour table or a per-rendering record would make redundant, so the bench
// can price bytes and encode time before anyone writes the Slang.
//
// Row word: `row << 1 | side`, side 1 below the pivot. Every colour a
// production record carries is `table[row][side]` in the cases the bench
// checks, which is what lets the colour leave the instance.
import {
  cssColorToNormalizedRgb,
  normalizedRgbToABGR,
} from '@jbrowse/core/util/colorBits'
import { NO_PREV_START, RENDERING_TYPE_LINE_CENTER } from '@jbrowse/wiggle-core'

import {
  centerLinksToPrevious,
  isOverlayMode,
} from '../src/shared/wiggleComponentUtils.ts'

import type { WiggleGpuProps } from '../src/shared/buildSourceRenderData.ts'
import type { RawFeatureArrays } from '../src/util.ts'
import type { SourceRenderData } from '@jbrowse/wiggle-core'

function countOf(sources: SourceRenderData[], band: boolean) {
  let total = 0
  for (const s of sources) {
    if (!!s.band === band) {
      total += s.numFeatures
    }
  }
  return total
}

function colorOf(source: SourceRenderData) {
  return normalizedRgbToABGR(source.color[0], source.color[1], source.color[2])
}

// What a colour change would upload instead of re-encoding every region: two
// ABGR words per row, 8 bytes a row, straight off gpuProps — the same rule
// buildSourceRenderData applies per layer (a source's own colour above the
// pivot, the shared negColor below it, the pos colour on both sides in overlay).
export function buildRowColorTable(gpuProps: WiggleGpuProps) {
  const { sources, renderingType } = gpuProps
  const overlay = isOverlayMode(renderingType)
  const defaultPos = cssColorToNormalizedRgb(gpuProps.posColor)
  const defaultNeg = normalizedRgbToABGR(
    ...cssColorToNormalizedRgb(gpuProps.negColor),
  )
  const table = new Uint32Array(sources.length * 2)
  for (let i = 0; i < sources.length; i++) {
    const color = sources[i]!.color
    const pos = normalizedRgbToABGR(
      ...(color ? cssColorToNormalizedRgb(color) : defaultPos),
    )
    table[i * 2] = pos
    table[i * 2 + 1] = overlay ? pos : defaultNeg
  }
  return table
}

// fill, 16 bytes: startEnd, score, row word. Side is the score's own against
// the pivot, which the shader has as the `origin` uniform.
export function packFill16(sources: SourceRenderData[], pivot: number) {
  const buf = new ArrayBuffer(countOf(sources, false) * 16)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let off = 0
  for (const source of sources) {
    const rowWord = source.rowIndex << 1
    const positions = source.featurePositions
    const scores = source.featureScores
    const n = source.numFeatures
    for (let i = 0; i < n; i++) {
      const score = scores[i]!
      u32[off] = positions[i * 2]!
      u32[off + 1] = positions[i * 2 + 1]!
      f32[off + 2] = score
      u32[off + 3] = score >= pivot ? rowWord : rowWord | 1
      off += 4
    }
  }
  return buf
}

// step line, colours kept, 32 bytes: startEnd, score, prevScore, nextScore,
// color, rowIndex, negColor.
export function packStepLine32(sources: SourceRenderData[]) {
  const buf = new ArrayBuffer(countOf(sources, false) * 32)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let off = 0
  for (const source of sources) {
    if (source.band) {
      continue
    }
    const row = source.rowIndex
    const colorAbgr = colorOf(source)
    const negAbgr = source.negColor
      ? normalizedRgbToABGR(...source.negColor)
      : colorAbgr
    const positions = source.featurePositions
    const scores = source.featureScores
    const n = source.numFeatures
    for (let i = 0; i < n; i++) {
      const pi = i * 2
      const score = scores[i]!
      const currStart = positions[pi]!
      const currEnd = positions[pi + 1]!
      u32[off] = currStart
      u32[off + 1] = currEnd
      f32[off + 2] = score
      f32[off + 3] =
        i > 0 && positions[pi - 1] === currStart ? scores[i - 1]! : 0
      f32[off + 4] = i < n - 1 && positions[pi + 2] === currEnd ? score : 0
      u32[off + 5] = colorAbgr
      f32[off + 6] = row
      u32[off + 7] = negAbgr
      off += 8
    }
  }
  return buf
}

// step line, colour table, 24 bytes: startEnd, score, prevScore, nextScore,
// row word.
export function packStepLine24(sources: SourceRenderData[]) {
  const buf = new ArrayBuffer(countOf(sources, false) * 24)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let off = 0
  for (const source of sources) {
    if (source.band) {
      continue
    }
    const rowWord = source.rowIndex << 1
    const positions = source.featurePositions
    const scores = source.featureScores
    const n = source.numFeatures
    for (let i = 0; i < n; i++) {
      const pi = i * 2
      const score = scores[i]!
      const currStart = positions[pi]!
      const currEnd = positions[pi + 1]!
      u32[off] = currStart
      u32[off + 1] = currEnd
      f32[off + 2] = score
      f32[off + 3] =
        i > 0 && positions[pi - 1] === currStart ? scores[i - 1]! : 0
      f32[off + 4] = i < n - 1 && positions[pi + 2] === currEnd ? score : 0
      u32[off + 5] = rowWord
      off += 6
    }
  }
  return buf
}

// center line, colours kept, 36 bytes: startEnd, score, color, rowIndex,
// prevStartEnd, prevScoreLine, negColor.
export function packCenterLine36(sources: SourceRenderData[]) {
  const buf = new ArrayBuffer(countOf(sources, false) * 36)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let off = 0
  for (const source of sources) {
    if (source.band) {
      continue
    }
    const row = source.rowIndex
    const colorAbgr = colorOf(source)
    const negAbgr = source.negColor
      ? normalizedRgbToABGR(...source.negColor)
      : colorAbgr
    const positions = source.featurePositions
    const scores = source.featureScores
    const n = source.numFeatures
    const gapLimitBp = source.gapLimitBp ?? Number.POSITIVE_INFINITY
    for (let i = 0; i < n; i++) {
      const pi = i * 2
      const linked = centerLinksToPrevious(positions, i, gapLimitBp)
      u32[off] = positions[pi]!
      u32[off + 1] = positions[pi + 1]!
      f32[off + 2] = scores[i]!
      u32[off + 3] = colorAbgr
      f32[off + 4] = row
      u32[off + 5] = linked ? positions[pi - 2]! : NO_PREV_START
      u32[off + 6] = linked ? positions[pi - 1]! : 0
      f32[off + 7] = linked ? scores[i - 1]! : 0
      u32[off + 8] = negAbgr
      off += 9
    }
  }
  return buf
}

// center line, colour table, 28 bytes: startEnd, score, prevStartEnd,
// prevScoreLine, row word.
export function packCenterLine28(sources: SourceRenderData[]) {
  const buf = new ArrayBuffer(countOf(sources, false) * 28)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let off = 0
  for (const source of sources) {
    if (source.band) {
      continue
    }
    const rowWord = source.rowIndex << 1
    const positions = source.featurePositions
    const scores = source.featureScores
    const n = source.numFeatures
    const gapLimitBp = source.gapLimitBp ?? Number.POSITIVE_INFINITY
    for (let i = 0; i < n; i++) {
      const pi = i * 2
      const linked = centerLinksToPrevious(positions, i, gapLimitBp)
      u32[off] = positions[pi]!
      u32[off + 1] = positions[pi + 1]!
      f32[off + 2] = scores[i]!
      u32[off + 3] = linked ? positions[pi - 2]! : NO_PREV_START
      u32[off + 4] = linked ? positions[pi - 1]! : 0
      f32[off + 5] = linked ? scores[i - 1]! : 0
      u32[off + 6] = rowWord
      off += 7
    }
  }
  return buf
}

// whiskers band, colour table, 36 bytes: the production record less posColor
// and negColor. Last source first, as production packs it.
export function packBand36(sources: SourceRenderData[]) {
  const buf = new ArrayBuffer(countOf(sources, true) * 36)
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
      const centerLine = source.renderingType === RENDERING_TYPE_LINE_CENTER
      const gapLimitBp = source.gapLimitBp ?? Number.POSITIVE_INFINITY
      for (let i = 0; i < source.numFeatures; i++) {
        const linked =
          centerLine && centerLinksToPrevious(positions, i, gapLimitBp)
        u32[off] = positions[i * 2]!
        u32[off + 1] = positions[i * 2 + 1]!
        u32[off + 2] = linked ? positions[i * 2 - 2]! : NO_PREV_START
        u32[off + 3] = linked ? positions[i * 2 - 1]! : 0
        f32[off + 4] = minScores[i]!
        f32[off + 5] = maxScores[i]!
        f32[off + 6] = linked ? minScores[i - 1]! : 0
        f32[off + 7] = linked ? maxScores[i - 1]! : 0
        f32[off + 8] = source.rowIndex
        off += 9
      }
    }
  }
  return buf
}

// Worker-side decimation into power-of-two bins, span-weighted mean plus
// min/max, for the raw section below a BigWig's first zoom level. Output rows
// are bins with any coverage; a bin's span is clipped to the covered extent.
export function decimateRaw(raw: RawFeatureArrays, binBp: number) {
  const { starts, ends, scores, count } = raw
  const outStarts = new Uint32Array(count)
  const outEnds = new Uint32Array(count)
  const outMean = new Float32Array(count)
  const outMin = new Float32Array(count)
  const outMax = new Float32Array(count)
  let n = -1
  let bin = -1
  let sum = 0
  let weight = 0
  for (let i = 0; i < count; i++) {
    const s = starts[i]!
    const e = ends[i]!
    const score = scores[i]!
    const b = Math.floor(s / binBp)
    if (b !== bin) {
      if (n >= 0) {
        outMean[n] = sum / weight
      }
      n++
      bin = b
      sum = 0
      weight = 0
      outStarts[n] = s
      outMin[n] = score
      outMax[n] = score
    }
    const w = e - s
    sum += score * w
    weight += w
    outEnds[n] = e
    if (score < outMin[n]!) {
      outMin[n] = score
    }
    if (score > outMax[n]!) {
      outMax[n] = score
    }
  }
  if (n >= 0) {
    outMean[n] = sum / weight
  }
  const len = n + 1
  return {
    starts: outStarts.subarray(0, len),
    ends: outEnds.subarray(0, len),
    scores: outMean.subarray(0, len),
    minScores: outMin.subarray(0, len),
    maxScores: outMax.subarray(0, len),
    count: len,
  }
}
