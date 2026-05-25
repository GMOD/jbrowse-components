// Buffer packing for coverage-related passes. Strides and field offsets are
// imported from Slang-codegen layout files in this package so they stay in sync
// with the shaders automatically. The same buffer layout is used for both GPU
// upload and Canvas2D draw — Canvas2D draw fns read positions/yOffsets/etc by
// the same field offsets, so a single pack fn serves both. Multi-synteny has
// its own packers (different layouts — min/max band bars vs single-depth bars).
//
// Pack fns return ArrayBuffer directly; callers already know the record count
// from the input, so echoing it back as a wrapper struct adds nothing.

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

// Layout per bin: [position(u32), normalizedDepth(f32)] = 8 bytes.
// Matches alignments plugin coverage.slang Instance. Position is absolute
// genomic uint32 (exact up to 4 Gbp); shader uses hp-math for clip-space
// conversion.
export function packCoverageBinsForGpu(
  depths: Float32Array,
  maxDepth: number,
  startOffset: number,
  binCount: number,
) {
  if (binCount === 0 || maxDepth <= 0) {
    return new ArrayBuffer(0)
  }
  const buffer = new ArrayBuffer(binCount * COVERAGE_STRIDE * 4)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < binCount; i++) {
    const o = i * COVERAGE_STRIDE
    u32[o + COVERAGE_FIELD.position] = startOffset + i
    f32[o + COVERAGE_FIELD.depth] = (depths[i] ?? 0) / maxDepth
  }
  return buffer
}

// Layout per segment: [position(u32), yOffset(f32), height(f32), colorType(f32),
// relDepth(f32)] = 20 bytes. Matches alignments plugin snpCoverage.slang.
// relDepth = totalDepthAtPos / regionMaxDepth lets the shader draw segments as
// a linear fraction of a possibly-log-scaled coverage bar at this position.
export function packSnpSegmentsForGpu(
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colorTypes: Uint8Array,
  relDepths: Float32Array,
  count: number,
) {
  const buffer = new ArrayBuffer(count * SNP_STRIDE * 4)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < count; i++) {
    const o = i * SNP_STRIDE
    u32[o + SNP_FIELD.position] = positions[i]!
    f32[o + SNP_FIELD.yOffset] = yOffsets[i]!
    f32[o + SNP_FIELD.segHeight] = heights[i]!
    f32[o + SNP_FIELD.colorType] = colorTypes[i]!
    f32[o + SNP_FIELD.relDepth] = relDepths[i] ?? 1
  }
  return buffer
}

// Layout per indicator: [position(u32), colorType(f32)] = 8 bytes.
// Matches alignments plugin indicator.slang. Position is absolute uint32.
export function packIndicatorsForGpu(
  positions: Uint32Array,
  colorTypes: Uint8Array | undefined,
  count: number,
) {
  const buffer = new ArrayBuffer(count * INDICATOR_STRIDE * 4)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < count; i++) {
    const o = i * INDICATOR_STRIDE
    u32[o + INDICATOR_FIELD.position] = positions[i]!
    f32[o + INDICATOR_FIELD.colorType] = colorTypes ? colorTypes[i]! : 1
  }
  return buffer
}

// Layout per segment: [position(u32), yOffset(f32), height(f32), rgbaColor(u32),
// relDepth(f32)] = 20 bytes. Matches alignments plugin modCoverage.slang.
// Position is absolute uint32; `colors` is pre-packed ABGR u32. relDepth =
// totalDepthAtPos / regionMaxDepth (see snpCoverage.slang for details).
export function packModCovSegmentsForGpu(
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colors: Uint32Array,
  relDepths: Float32Array,
  count: number,
) {
  const buffer = new ArrayBuffer(count * MOD_COV_STRIDE * 4)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < count; i++) {
    const o = i * MOD_COV_STRIDE
    u32[o + MOD_COV_FIELD.position] = positions[i]!
    f32[o + MOD_COV_FIELD.yOffset] = yOffsets[i]!
    f32[o + MOD_COV_FIELD.segHeight] = heights[i]!
    u32[o + MOD_COV_FIELD.packedColor] = colors[i]!
    f32[o + MOD_COV_FIELD.relDepth] = relDepths[i] ?? 1
  }
  return buffer
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
) {
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
  return buffer
}
