// Buffer packing for coverage-related passes. Strides and field offsets are
// imported from Slang-codegen layout files in this package so they stay in sync
// with the shaders automatically. The same buffer layout is used for both GPU
// upload and Canvas2D draw — Canvas2D draw fns read positions/yOffsets/etc by
// the same field offsets, so a single pack fn serves both. Multi-synteny has
// its own packers (different layouts — min/max band bars vs single-depth bars).
//
// Offsets come in through `INSTANCE_OFFSET_U32` / `_F32` — one map per
// typed-array view, holding only the fields whose Slang type takes that view —
// so `COVERAGE_F32.position` on a `uint position` doesn't compile, and the view
// a field wants is legible at the call site instead of being this file's guess.
// (A deliberate `f32[o + COVERAGE_U32.position]` still type-checks; the split
// ends the drift, it doesn't prove the pairing.)
//
// The generated `packInstances` DOES prove it, and where a packer is a straight
// interleave — one input array per field, no scaling on the way in — it is what
// runs: the whole loop is generated, its body is this file's own inline form,
// and it measured 0.99-1.15x (`benches/instanceAccessors.bench.ts`, controls
// 0.93-1.05 across three runs). That is the shape to reach for first.
//
// `packCoverageBinsForGpu` cannot use it and stays hand-written, for the reason
// the codegen's own header gives: it SCALES on the way in (`depths[i] /
// maxDepth`) and COMPUTES a field (`startOffset + i * binSize`), so feeding
// `packInstances` would mean materializing two arrays it does not otherwise
// need. It writes its own loop over the offset maps instead.
//
// What it must not reach for is the generated per-field `setInstance<Field>`
// accessors, which measured 0.43-0.47x. The cost is the call rather than the
// arithmetic, so no accessor shape recovers it — an offset-taking variant
// measured no better, and neither did the two generated forms that call once
// per RECORD. Generate the loop, not the field access.
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
  INSTANCE_STRIDE_BYTES as COVERAGE_STRIDE_BYTES,
  INSTANCE_STRIDE_WORDS as COVERAGE_STRIDE,
} from './coverageLayout.generated.ts'
import { packInstances as packModCovInstances } from './modCoverageLayout.generated.ts'

import type { computeInterbaseCoverage } from './interbaseCoverage.ts'
import type { computeSNPCoverage } from './snpCoverage.ts'

// Position is absolute genomic uint32 (exact up to 4 Gbp); the shader uses
// hp-math for clip-space conversion. `binSize` is the bin width in bp: bin i spans
// [startOffset + i*binSize, startOffset + (i+1)*binSize) and the shader draws
// the bar that wide off the matching `binSize` uniform. It is 1 for per-bp
// coverage; the worker downsamples to a wider binSize at whole-chromosome scale
// (see packCoverageArea) so this buffer's record count tracks screen pixels
// rather than base pairs — otherwise it overflows the GPU device limit.
//
// `relDepth` is depth/regionMaxDepth, the same packing the SNP and modification
// segments carry: every coverage-band pass hands it to the shader's
// `normalizeDepth`, which recovers the raw depth and applies the display's
// autoscaled domain. Storing the raw depth here instead would bake the region's
// peak into the buffer and need a repack on every autoscale change.
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
  const buffer = new ArrayBuffer(binCount * COVERAGE_STRIDE_BYTES)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < binCount; i++) {
    const o = i * COVERAGE_STRIDE
    u32[o + COVERAGE_U32.position] = startOffset + i * binSize
    f32[o + COVERAGE_F32.relDepth] = (depths[i] ?? 0) / maxDepth
  }
  return buffer
}

// Position is absolute uint32; `colors` is pre-packed ABGR u32. relDepth =
// totalDepthAtPos / regionMaxDepth (see snpCoverage.slang for details).
//
// This used to spell `relDepths[i] ?? 1`. That default was unreachable — the
// producer allocates `relDepths` at exactly `count`, and an in-range read of a
// Float32Array is a number — and it was worse than unreachable: had `count`
// ever exceeded the array (the crossed (array, count) pairing
// `packCoverageArea.test.ts` guards), it would have packed a plausible 1
// instead of the NaN that shows.
export function packModCovSegmentsForGpu(
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colors: Uint32Array,
  relDepths: Float32Array,
  count: number,
) {
  return packModCovInstances(
    {
      position: positions,
      yOffset: yOffsets,
      segHeight: heights,
      packedColor: colors,
      relDepth: relDepths,
    },
    count,
  )
}

// The SNP + interbase-histogram + indicator GPU segment buffers are the coverage
// area's position-aggregate passes, shipped identically for every backend (the
// pileup worker and the MAF worker both feed the same three shaders). Grouping
// them here keeps the field naming in one place so the two callers can't drift.
//
// Nothing is packed here any more: all three computes write their own instance
// buffer, so there is no intermediate array form to pack from and no separable
// count to pair with the wrong array. This is a rename of three fields.
export function coverageSegmentBuffers(
  snp: ReturnType<typeof computeSNPCoverage>,
  interbase: ReturnType<typeof computeInterbaseCoverage>,
) {
  return {
    snpPackedBuffer: snp.snpPackedBuffer,
    interbasePackedBuffer: interbase.interbasePackedBuffer,
    indicatorPackedBuffer: interbase.indicatorPackedBuffer,
  }
}
