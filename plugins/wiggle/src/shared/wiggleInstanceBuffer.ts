import { normalizedRgbToABGR } from '@jbrowse/core/util/colorBits'

import {
  FIELD_OFFSET_F32,
  INSTANCE_STRIDE_BYTES,
  INSTANCE_STRIDE_F32,
} from './shaders/wiggle.generated.ts'

import type { SourceRenderData } from './wiggleBackendTypes.ts'

export function interleaveInstances(
  sources: SourceRenderData[],
  totalFeatures: number,
) {
  const buf = new ArrayBuffer(totalFeatures * INSTANCE_STRIDE_BYTES)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  let offset = 0
  for (let idx = 0, l = sources.length; idx < l; idx++) {
    const source = sources[idx]!
    const row = source.rowIndex
    const colorAbgr = normalizedRgbToABGR(
      source.color[0],
      source.color[1],
      source.color[2],
    )
    const positions = source.featurePositions
    const scores = source.featureScores
    const n = source.numFeatures
    let prev = scores[0]!
    for (let i = 0; i < n; i++) {
      const off = (offset + i) * INSTANCE_STRIDE_F32
      const score = scores[i]!
      u32[off + FIELD_OFFSET_F32.startEnd] = positions[i * 2]!
      u32[off + FIELD_OFFSET_F32.startEnd + 1] = positions[i * 2 + 1]!
      f32[off + FIELD_OFFSET_F32.score] = score
      f32[off + FIELD_OFFSET_F32.prevScore] = prev
      u32[off + FIELD_OFFSET_F32.color] = colorAbgr
      f32[off + FIELD_OFFSET_F32.rowIndex] = row
      prev = score
    }
    offset += n
  }
  return buf
}

export function computeNumRows(sources: SourceRenderData[]) {
  let numRows = 0
  for (const source of sources) {
    const r = source.rowIndex + 1
    if (r > numRows) {
      numRows = r
    }
  }
  return numRows
}
