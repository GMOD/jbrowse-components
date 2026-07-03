// Pack all coverage-area GPU buffers (per-bp coverage, SNP, interbase histogram,
// indicators, mod-coverage) for transfer to the GPU renderer.
//
// Why this runs in the RPC worker: none of these passes reference
// main-thread-computed read Y values (unlike PASS_READ and friends), so they
// can be pre-packed in the worker and uploaded directly via writeBuffer. This
// removes the equivalent pack loops from the main thread during refetches.
// See ADR-004.

import {
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
  return {
    coveragePackedBuffer: packCoverageBinsForGpu(
      coverage.depths,
      coverage.maxDepth,
      coverage.startPos,
      coverage.depths.length,
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
