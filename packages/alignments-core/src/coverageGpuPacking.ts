// Shared GPU buffer packing for coverage-related passes. Strides and field
// offsets are imported from Slang-codegen layout files in this package so they
// stay in sync with the shaders automatically. Multi-synteny has its own
// packers (different layouts — min/max band bars vs single-depth bars).

import {
  FIELD_OFFSET_F32 as COVERAGE_FIELD,
  INSTANCE_STRIDE_F32 as COVERAGE_STRIDE,
} from './coverageLayout.generated.ts'
import {
  FIELD_OFFSET_F32 as INDICATOR_FIELD,
  INSTANCE_STRIDE_F32 as INDICATOR_STRIDE,
} from './indicatorLayout.generated.ts'
import {
  FIELD_OFFSET_F32 as MOD_COV_FIELD,
  INSTANCE_STRIDE_F32 as MOD_COV_STRIDE,
} from './modCoverageLayout.generated.ts'
import {
  FIELD_OFFSET_F32 as NONCOV_FIELD,
  INSTANCE_STRIDE_F32 as NONCOV_STRIDE,
} from './noncovHistogramLayout.generated.ts'
import {
  FIELD_OFFSET_F32 as SNP_FIELD,
  INSTANCE_STRIDE_F32 as SNP_STRIDE,
} from './snpCoverageLayout.generated.ts'

export interface CoverageBinsGpuUpload {
  buffer: ArrayBuffer
  binCount: number
}

// Layout per bin: [position(u32), normalizedDepth(f32)] = 8 bytes.
// Matches alignments plugin coverage.slang Instance. Position is absolute
// genomic uint32 (exact up to 4 Gbp); shader uses hp-math for clip-space
// conversion.
export function packCoverageBinsForGpu(
  depths: Float32Array,
  maxDepth: number,
  startOffset: number,
  binCount: number,
): CoverageBinsGpuUpload {
  if (binCount === 0 || maxDepth <= 0) {
    return { buffer: new ArrayBuffer(0), binCount: 0 }
  }
  const buffer = new ArrayBuffer(binCount * COVERAGE_STRIDE * 4)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < binCount; i++) {
    const o = i * COVERAGE_STRIDE
    u32[o + COVERAGE_FIELD.position] = startOffset + i
    f32[o + COVERAGE_FIELD.depth] = (depths[i] ?? 0) / maxDepth
  }
  return { buffer, binCount }
}

export interface SnpGpuUpload {
  buffer: ArrayBuffer
  segmentCount: number
}

// Layout per segment: [position(u32), yOffset(f32), height(f32), colorType(f32)]
// = 16 bytes. Matches alignments plugin snpCoverage.slang. Position is
// absolute genomic uint32.
export function packSnpSegmentsForGpu(
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colorTypes: Uint8Array,
  count: number,
): SnpGpuUpload {
  if (count === 0) {
    return { buffer: new ArrayBuffer(0), segmentCount: 0 }
  }
  const buffer = new ArrayBuffer(count * SNP_STRIDE * 4)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < count; i++) {
    const o = i * SNP_STRIDE
    u32[o + SNP_FIELD.position] = positions[i]!
    f32[o + SNP_FIELD.yOffset] = yOffsets[i]!
    f32[o + SNP_FIELD.segHeight] = heights[i]!
    f32[o + SNP_FIELD.colorType] = colorTypes[i]!
  }
  return { buffer, segmentCount: count }
}

export interface IndicatorGpuUpload {
  buffer: ArrayBuffer
  indicatorCount: number
}

// Layout per indicator: [position(u32), colorType(f32)] = 8 bytes.
// Matches alignments plugin indicator.slang. Position is absolute uint32.
export function packIndicatorsForGpu(
  positions: Uint32Array,
  colorTypes: Uint8Array | undefined,
  count: number,
): IndicatorGpuUpload {
  if (count === 0) {
    return { buffer: new ArrayBuffer(0), indicatorCount: 0 }
  }
  const buffer = new ArrayBuffer(count * INDICATOR_STRIDE * 4)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < count; i++) {
    const o = i * INDICATOR_STRIDE
    u32[o + INDICATOR_FIELD.position] = positions[i]!
    f32[o + INDICATOR_FIELD.colorType] = colorTypes ? colorTypes[i]! : 1
  }
  return { buffer, indicatorCount: count }
}

export interface ModCovGpuUpload {
  buffer: ArrayBuffer
  segmentCount: number
}

// Layout per segment: [position(u32), yOffset(f32), height(f32), rgbaColor(u32)]
// = 16 bytes. Matches alignments plugin modCoverage.slang. Position is
// absolute uint32; `colors` is pre-packed ABGR u32.
export function packModCovSegmentsForGpu(
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colors: Uint32Array,
  count: number,
): ModCovGpuUpload {
  if (count === 0) {
    return { buffer: new ArrayBuffer(0), segmentCount: 0 }
  }
  const buffer = new ArrayBuffer(count * MOD_COV_STRIDE * 4)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < count; i++) {
    const o = i * MOD_COV_STRIDE
    u32[o + MOD_COV_FIELD.position] = positions[i]!
    f32[o + MOD_COV_FIELD.yOffset] = yOffsets[i]!
    f32[o + MOD_COV_FIELD.segHeight] = heights[i]!
    u32[o + MOD_COV_FIELD.packedColor] = colors[i]!
  }
  return { buffer, segmentCount: count }
}

export interface NoncovGpuUpload {
  buffer: ArrayBuffer
  segmentCount: number
}

// Layout per segment: [position(u32), yOffset(f32), height(f32), colorType(f32)]
// = 16 bytes. Matches alignments plugin noncovHistogram.slang. Position is
// absolute uint32.
export function packNoncovSegmentsForGpu(
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colorTypes: Uint8Array,
  count: number,
): NoncovGpuUpload {
  if (count === 0) {
    return { buffer: new ArrayBuffer(0), segmentCount: 0 }
  }
  const buffer = new ArrayBuffer(count * NONCOV_STRIDE * 4)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < count; i++) {
    const o = i * NONCOV_STRIDE
    u32[o + NONCOV_FIELD.position] = positions[i]!
    f32[o + NONCOV_FIELD.yOffset] = yOffsets[i]!
    f32[o + NONCOV_FIELD.segHeight] = heights[i]!
    f32[o + NONCOV_FIELD.colorType] = colorTypes[i]!
  }
  return { buffer, segmentCount: count }
}

// Canvas2D variants — position stored as uint32 (absolute genomic coord) so
// large coordinates (>16M bp) are exact. Worker sends absolute positions;
// GPU variants subtract regionStart to keep float32 relative for shaders.

export function packSnpSegmentsForCanvas2D(
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colorTypes: Uint8Array,
  count: number,
): SnpGpuUpload {
  if (count === 0) {
    return { buffer: new ArrayBuffer(0), segmentCount: 0 }
  }
  const buffer = new ArrayBuffer(count * SNP_STRIDE * 4)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < count; i++) {
    const o = i * SNP_STRIDE
    u32[o + SNP_FIELD.position] = positions[i]!
    f32[o + SNP_FIELD.yOffset] = yOffsets[i]!
    f32[o + SNP_FIELD.segHeight] = heights[i]!
    f32[o + SNP_FIELD.colorType] = colorTypes[i]!
  }
  return { buffer, segmentCount: count }
}

export function packIndicatorsForCanvas2D(
  positions: Uint32Array,
  colorTypes: Uint8Array | undefined,
  count: number,
): IndicatorGpuUpload {
  if (count === 0) {
    return { buffer: new ArrayBuffer(0), indicatorCount: 0 }
  }
  const buffer = new ArrayBuffer(count * INDICATOR_STRIDE * 4)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < count; i++) {
    const o = i * INDICATOR_STRIDE
    u32[o + INDICATOR_FIELD.position] = positions[i]!
    f32[o + INDICATOR_FIELD.colorType] = colorTypes ? colorTypes[i]! : 1
  }
  return { buffer, indicatorCount: count }
}

export function packNoncovSegmentsForCanvas2D(
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colorTypes: Uint8Array,
  count: number,
): NoncovGpuUpload {
  if (count === 0) {
    return { buffer: new ArrayBuffer(0), segmentCount: 0 }
  }
  const buffer = new ArrayBuffer(count * NONCOV_STRIDE * 4)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < count; i++) {
    const o = i * NONCOV_STRIDE
    u32[o + NONCOV_FIELD.position] = positions[i]!
    f32[o + NONCOV_FIELD.yOffset] = yOffsets[i]!
    f32[o + NONCOV_FIELD.segHeight] = heights[i]!
    f32[o + NONCOV_FIELD.colorType] = colorTypes[i]!
  }
  return { buffer, segmentCount: count }
}

export function packModCovSegmentsForCanvas2D(
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colors: Uint32Array,
  count: number,
): ModCovGpuUpload {
  if (count === 0) {
    return { buffer: new ArrayBuffer(0), segmentCount: 0 }
  }
  const buffer = new ArrayBuffer(count * MOD_COV_STRIDE * 4)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < count; i++) {
    const o = i * MOD_COV_STRIDE
    u32[o + MOD_COV_FIELD.position] = positions[i]!
    f32[o + MOD_COV_FIELD.yOffset] = yOffsets[i]!
    f32[o + MOD_COV_FIELD.segHeight] = heights[i]!
    u32[o + MOD_COV_FIELD.packedColor] = colors[i]!
  }
  return { buffer, segmentCount: count }
}
