import { downsampleMinMax } from '@jbrowse/alignments-core'

import {
  FIELD_OFFSET_F32 as COVERAGE_FIELD,
  INSTANCE_STRIDE_F32 as COVERAGE_STRIDE,
} from '../../shaders/slang/multiSyntenyCoverage.generated.ts'

export interface BlockCoverageUploadData {
  buffer: ArrayBuffer
  binCount: number
}

// Pack downsampled min/max coverage bands for a single block.
// Layout (matches multiSyntenyCoverage.slang stride 3):
//   position: uint32  (absolute genomic coord, exact at 3 Gbp)
//   minDepth: float32 (0..1, normalized against globalMaxDepth)
//   maxDepth: float32 (0..1, normalized against globalMaxDepth)
export function packCoverageForGpu(
  depths: Float32Array,
  startOffset: number,
  maxDepth: number,
  viewWidthPx = 2000,
): BlockCoverageUploadData {
  if (maxDepth === 0 || depths.length === 0) {
    return { buffer: new ArrayBuffer(0), binCount: 0 }
  }

  const ds = downsampleMinMax(depths, startOffset, viewWidthPx, maxDepth)
  if (ds.count === 0) {
    return { buffer: new ArrayBuffer(0), binCount: 0 }
  }

  const buffer = new ArrayBuffer(ds.count * COVERAGE_STRIDE * 4)
  const u32 = new Uint32Array(buffer)
  const f32 = new Float32Array(buffer)
  for (let i = 0; i < ds.count; i++) {
    const o = i * COVERAGE_STRIDE
    u32[o + COVERAGE_FIELD.position] = ds.positions[i]!
    f32[o + COVERAGE_FIELD.minDepth] = ds.mins[i]!
    f32[o + COVERAGE_FIELD.maxDepth] = ds.maxs[i]!
  }

  return { buffer, binCount: ds.count }
}
