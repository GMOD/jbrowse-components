import { downsampleMinMax } from '@jbrowse/alignments-core'

import {
  FIELD_OFFSET_F32 as COVERAGE_FIELD,
  INSTANCE_STRIDE_F32 as COVERAGE_STRIDE,
} from '../../shaders/slang/multiSyntenyCoverage.generated.ts'

export interface BlockCoverageUploadData {
  buffer: ArrayBuffer
  binCount: number
}

// Pack per-bp coverage depths into a GPU buffer for a single block.
// Returns downsampled min/max bands: [position: f32, minDepth: f32, maxDepth: f32] per bin.
// Positions are absolute genome coordinates so the shader can map bins to
// any content block by subtracting block.start (bpRangeHi+bpRangeLo).
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
  const f32 = new Float32Array(buffer)
  for (let i = 0; i < ds.count; i++) {
    const o = i * COVERAGE_STRIDE
    f32[o + COVERAGE_FIELD.position] = ds.positions[i]!
    f32[o + COVERAGE_FIELD.minDepth] = ds.mins[i]!
    f32[o + COVERAGE_FIELD.maxDepth] = ds.maxs[i]!
  }

  return { buffer, binCount: ds.count }
}
