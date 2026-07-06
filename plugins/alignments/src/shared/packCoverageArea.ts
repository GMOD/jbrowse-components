// Pack all coverage-area GPU buffers (per-bp coverage, SNP, interbase histogram,
// indicators, mod-coverage) for transfer to the GPU renderer.
//
// Why this runs in the RPC worker: none of these passes reference
// main-thread-computed read Y values (unlike PASS_READ and friends), so they
// can be pre-packed in the worker and uploaded directly via writeBuffer. This
// removes the equivalent pack loops from the main thread during refetches.
// See ADR-004.

import {
  downsampleDenseMax,
  packCoverageBinsForGpu,
  packCoverageSegmentsForGpu,
} from '@jbrowse/alignments-core'

import { packModCovSegmentsForGpu } from '../features/modCoverage/packGpu.ts'

import type { computeModificationCoverage } from '../features/modCoverage/compute.ts'
import type {
  SNPCoverageResult,
  computeCoverage,
  computeInterbaseCoverage,
} from '@jbrowse/alignments-core'

// The GPU coverage-depth buffer is one 8-byte record per bin. At per-bp
// resolution that is regionWidth×8 bytes, which overflows the GPU device limit
// (~1 GiB) at whole-chromosome scale. So the depth bars — and ONLY the depth
// bars — are downsampled to a fixed bin cap here.
//
// This is deliberately NOT a bin-per-pixel cap: the cap is huge, so per-bp
// detail persists far past any zoom where it's individually resolvable.
// binSize stays 1 for every region up to the cap (~256 kb), so any view zoomed
// in enough to see individual bases (bpPerPx ≤ 1, i.e. region < screen width)
// is always literal per-bp — the on-screen depth bar is untouched. Above the
// cap each bin is already many bp per pixel (thousands of bins/pixel at
// whole-chromosome), so the reduction is invisible; it only ever bins depth
// that was already sub-pixel. The per-base signal you actually read at those
// zooms — mismatch/SNP/interbase segments — keeps its EXACT per-bp positions
// (sparse, bounded by data not region width), and the shipped per-bp
// coverageDepths array (hit-test / tooltip) is likewise untouched, so hovering
// reports true per-base depth at every zoom level.
const MAX_GPU_COVERAGE_BINS = 262144

// All packed buffers store absolute genomic uint32 positions. Shaders read via
// hp-math (hpSplitUint + hpClipX) for precision at 3+ Gbp. Input shapes are
// the compute fns' return types — this fn is the worker's last step before
// transferring the packed buffers to the main thread.
export function packCoverageAreaForGpu(
  coverage: ReturnType<typeof computeCoverage>,
  snp: SNPCoverageResult,
  interbase: ReturnType<typeof computeInterbaseCoverage>,
  modCov: ReturnType<typeof computeModificationCoverage> | undefined,
) {
  const { depths: coverageBins, binSize: coverageBinSize } = downsampleDenseMax(
    coverage.depths,
    MAX_GPU_COVERAGE_BINS,
  )
  return {
    coverageBinSize,
    coverageGpuBinCount: coverageBins.length,
    coveragePackedBuffer: packCoverageBinsForGpu(
      coverageBins,
      coverage.maxDepth,
      coverage.startPos,
      coverageBins.length,
      coverageBinSize,
    ),
    ...packCoverageSegmentsForGpu(snp, interbase),
    modCovPackedBuffer: modCov
      ? packModCovSegmentsForGpu(
          modCov.positions,
          modCov.yOffsets,
          modCov.heights,
          modCov.colors,
          modCov.relDepths,
          modCov.count,
        )
      : new ArrayBuffer(0),
  }
}
