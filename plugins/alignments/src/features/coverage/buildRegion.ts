import { CANVAS2D_COVERAGE } from '@jbrowse/alignments-core'

import type { CoverageUploadData } from '../../LinearAlignmentsDisplay/components/rendererTypes.ts'

// Empty ArrayBuffers must be allocated per-call: the worker transfers them,
// which detaches them. A module-level singleton causes DataCloneError on
// the second RPC reply.

export interface CoverageRegionFields {
  coverageBuffer: ArrayBuffer
  coverageBinCount: number
  coverageMaxDepth: number
}

// Pack coverage depth bins into a Canvas2D-friendly buffer once per region.
// Single linear pass over the depths array.
export function buildCoverageFields(
  data: CoverageUploadData,
): CoverageRegionFields {
  const n = data.coverageDepths.length
  if (!(n > 0 && data.coverageMaxDepth > 0)) {
    return {
      coverageBuffer: new ArrayBuffer(0),
      coverageBinCount: 0,
      coverageMaxDepth: 0,
    }
  }
  const { STRIDE_F32, FIELD } = CANVAS2D_COVERAGE
  const buf = new ArrayBuffer(n * STRIDE_F32 * 4)
  const u32 = new Uint32Array(buf)
  const f32 = new Float32Array(buf)
  const startPos = data.coverageStartPos
  const depths = data.coverageDepths
  for (let i = 0; i < n; i++) {
    const off = i * STRIDE_F32
    u32[off + FIELD.position] = startPos + i
    f32[off + FIELD.bandBottom] = 0
    f32[off + FIELD.bandTop] = depths[i]!
  }
  return {
    coverageBuffer: buf,
    coverageBinCount: n,
    coverageMaxDepth: data.coverageMaxDepth,
  }
}

export function emptyCoverageFields(): CoverageRegionFields {
  return {
    coverageBuffer: new ArrayBuffer(0),
    coverageBinCount: 0,
    coverageMaxDepth: 0,
  }
}
