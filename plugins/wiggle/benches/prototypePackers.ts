// PROTOTYPES, measured by instanceBuffer.bench.ts and drawn by no shader. Each
// packs the fields the production record carries minus the ones a per-row
// colour table would make redundant, so the bench can price bytes and encode
// time before anyone writes the Slang.
//
// They write literal word offsets where production reads the generated offset
// objects, and on node 24 that alone is worth 20-40% of a line packer's encode
// (measured 2026-09-17: the 32-byte step packer took 225ms with literals and
// 350ms with the generated offsets, byte-identical output). An encode delta
// against a production arm mixes the record size with that, so price the
// record's time with offsets written the same way on both sides.
//
// Row word: `row << 1 | side`, side 1 below the pivot. Every colour a
// production record carries is `table[row][side]` in the cases the bench
// checks, which is what lets the colour leave the instance.
import {
  cssColorToNormalizedRgb,
  normalizedRgbToABGR,
} from '@jbrowse/core/util/colorBits'
import { NO_PREV_START, RENDERING_TYPE_LINE_CENTER } from '@jbrowse/wiggle-core'

import { centerLinksToPrevious } from '../src/shared/wiggleComponentUtils.ts'

import type { WiggleGpuProps } from '../src/shared/buildSourceRenderData.ts'
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

// What a colour change would upload instead of re-encoding every region: two
// ABGR words per row, 8 bytes a row, straight off gpuProps — the same rule
// buildSourceRenderData applies per layer (a source's own colour above the
// pivot, the shared negColor below it, the pos colour on both sides where
// several sources share one plot).
export function buildRowColorTable(gpuProps: WiggleGpuProps) {
  const { sources, wiggleColor } = gpuProps
  const sharedPlot = wiggleColor.perSource
  const defaultPos = cssColorToNormalizedRgb(wiggleColor.posColor)
  const defaultNeg = normalizedRgbToABGR(
    ...cssColorToNormalizedRgb(wiggleColor.negColor),
  )
  const table = new Uint32Array(sources.length * 2)
  for (let i = 0; i < sources.length; i++) {
    const color = sources[i]!.color
    const pos = normalizedRgbToABGR(
      ...(color ? cssColorToNormalizedRgb(color) : defaultPos),
    )
    table[i * 2] = pos
    table[i * 2 + 1] = sharedPlot ? pos : defaultNeg
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
