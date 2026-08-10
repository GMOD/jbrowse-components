// Buffer packing for coverage-related passes. Strides and field offsets are
// imported from Slang-codegen layout files in this package so they stay in sync
// with the shaders automatically. The same buffer layout is used for both GPU
// upload and Canvas2D draw — Canvas2D draw fns read positions/yOffsets/etc by
// the same field offsets, so a single pack fn serves both. Multi-synteny has
// its own packers (different layouts — min/max band bars vs single-depth bars).
//
// Offsets come in through `INSTANCE_OFFSET_U32` / `_F32` — one map per
// typed-array view, holding only the fields whose Slang type takes that view —
// so `SNP_F32.position` on a `uint position` doesn't compile, and the view a
// field wants is legible at the call site instead of being this file's guess.
// (A deliberate `f32[o + SNP_U32.position]` still type-checks; the split ends
// the drift, it doesn't prove the pairing.)
//
// Every packer here used to head a prose restatement of the struct
// ("[position(u32), yOffset(f32), …] = 20 bytes"). That is the hand-kept
// parallel declaration the codegen exists to delete — nothing checked it, and
// this package deliberately can't import the plugin that owns the .slang, so
// nothing here could have.
//
// Pack fns return ArrayBuffer directly; callers already know the record count
// from the input, so echoing it back as a wrapper struct adds nothing.

import {
  INSTANCE_OFFSET_F32 as COVERAGE_F32,
  INSTANCE_OFFSET_U32 as COVERAGE_U32,
  INSTANCE_STRIDE_F32 as COVERAGE_STRIDE,
} from './coverageLayout.generated.ts'
import {
  INSTANCE_OFFSET_F32 as INDICATOR_F32,
  INSTANCE_OFFSET_U32 as INDICATOR_U32,
  INSTANCE_STRIDE_F32 as INDICATOR_STRIDE,
} from './indicatorLayout.generated.ts'
import {
  INSTANCE_OFFSET_F32 as INTERBASE_F32,
  INSTANCE_OFFSET_U32 as INTERBASE_U32,
  INSTANCE_STRIDE_F32 as INTERBASE_STRIDE,
} from './interbaseHistogramLayout.generated.ts'
import {
  INSTANCE_OFFSET_F32 as MOD_COV_F32,
  INSTANCE_OFFSET_U32 as MOD_COV_U32,
  INSTANCE_STRIDE_F32 as MOD_COV_STRIDE,
} from './modCoverageLayout.generated.ts'
import {
  INSTANCE_OFFSET_F32 as SNP_F32,
  INSTANCE_OFFSET_U32 as SNP_U32,
  INSTANCE_STRIDE_F32 as SNP_STRIDE,
} from './snpCoverageLayout.generated.ts'

import type { SNPCoverageResult } from './coverageDownsampling.ts'
import type { computeInterbaseCoverage } from './interbaseCoverage.ts'

// Position is absolute
// genomic uint32 (exact up to 4 Gbp); shader uses hp-math for clip-space
// conversion. `binSize` is the bin width in bp: bin i spans
// [startOffset + i*binSize, startOffset + (i+1)*binSize) and the shader draws
// the bar that wide off the matching `binSize` uniform. It is 1 for per-bp
// coverage; the worker downsamples to a wider binSize at whole-chromosome scale
// (see packCoverageArea) so this buffer's record count tracks screen pixels
// rather than base pairs — otherwise it overflows the GPU device limit.
export function packCoverageBinsForGpu(
  depths: Float32Array,
  maxDepth: number,
  startOffset: number,
  binCount: number,
  binSize = 1,
) {
  if (binCount === 0 || maxDepth <= 0) {
    return new ArrayBuffer(0)
  }
  const buffer = new ArrayBuffer(binCount * COVERAGE_STRIDE * 4)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < binCount; i++) {
    const o = i * COVERAGE_STRIDE
    u32[o + COVERAGE_U32.position] = startOffset + i * binSize
    f32[o + COVERAGE_F32.depth] = (depths[i] ?? 0) / maxDepth
  }
  return buffer
}

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
    u32[o + SNP_U32.position] = positions[i]!
    f32[o + SNP_F32.yOffset] = yOffsets[i]!
    f32[o + SNP_F32.segHeight] = heights[i]!
    f32[o + SNP_F32.colorType] = colorTypes[i]!
    f32[o + SNP_F32.relDepth] = relDepths[i] ?? 1
  }
  return buffer
}

// Position is absolute uint32.
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
    u32[o + INDICATOR_U32.position] = positions[i]!
    f32[o + INDICATOR_F32.colorType] = colorTypes ? colorTypes[i]! : 1
  }
  return buffer
}

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
    u32[o + MOD_COV_U32.position] = positions[i]!
    f32[o + MOD_COV_F32.yOffset] = yOffsets[i]!
    f32[o + MOD_COV_F32.segHeight] = heights[i]!
    u32[o + MOD_COV_U32.packedColor] = colors[i]!
    f32[o + MOD_COV_F32.relDepth] = relDepths[i] ?? 1
  }
  return buffer
}

// Position is absolute uint32.
export function packInterbaseSegmentsForGpu(
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colorTypes: Uint8Array,
  count: number,
) {
  const buffer = new ArrayBuffer(count * INTERBASE_STRIDE * 4)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < count; i++) {
    const o = i * INTERBASE_STRIDE
    u32[o + INTERBASE_U32.position] = positions[i]!
    f32[o + INTERBASE_F32.yOffset] = yOffsets[i]!
    f32[o + INTERBASE_F32.segHeight] = heights[i]!
    f32[o + INTERBASE_F32.colorType] = colorTypes[i]!
  }
  return buffer
}

// The SNP + interbase-histogram + indicator GPU segment buffers are the coverage
// area's position-aggregate passes, packed identically for every backend (the
// pileup worker and the MAF worker both feed the same three shaders). Grouping
// them here keeps the field order in one place so the two callers can't drift.
export function packCoverageSegmentsForGpu(
  snp: SNPCoverageResult,
  interbase: ReturnType<typeof computeInterbaseCoverage>,
) {
  return {
    snpPackedBuffer: packSnpSegmentsForGpu(
      snp.positions,
      snp.yOffsets,
      snp.heights,
      snp.colorTypes,
      snp.relDepths,
      snp.count,
    ),
    interbasePackedBuffer: packInterbaseSegmentsForGpu(
      interbase.positions,
      interbase.yOffsets,
      interbase.heights,
      interbase.colorTypes,
      interbase.segmentCount,
    ),
    indicatorPackedBuffer: packIndicatorsForGpu(
      interbase.indicatorPositions,
      interbase.indicatorColorTypes,
      interbase.indicatorCount,
    ),
  }
}
