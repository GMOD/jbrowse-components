// Pack all coverage-area GPU buffers (per-bp coverage, SNP, noncov histogram,
// indicators, mod-coverage) for transfer to the GPU renderer.
//
// Why this runs in the RPC worker: none of these passes reference
// main-thread-computed read Y values (unlike PASS_READ and friends), so they
// can be pre-packed in the worker and uploaded directly via writeBuffer. This
// removes the equivalent pack loops from the main thread during refetches.
// See ADR-004.

import { packCoverageBinsForGpu } from '@jbrowse/alignments-core'

import { computeCoverage } from '../features/coverage/compute.ts'
import { packIndicatorsForGpu } from '../features/indicator/packGpu.ts'
import { computeModificationCoverage } from '../features/modCoverage/compute.ts'
import { packModCovSegmentsForGpu } from '../features/modCoverage/packGpu.ts'
import { computeNoncovCoverage } from '../features/noncov/compute.ts'
import { packNoncovSegmentsForGpu } from '../features/noncov/packGpu.ts'
import { packSnpSegmentsForGpu } from '../features/snpCoverage/packGpu.ts'

import type { SNPCoverageResult } from '@jbrowse/alignments-core'

// All packed buffers store absolute genomic uint32 positions. Shaders read via
// hp-math (hpSplitUint + hpClipX) for precision at 3+ Gbp. Input shapes are
// the compute fns' return types — this fn is the worker's last step before
// transferring the packed buffers to the main thread.
export function packCoverageAreaForGpu(
  coverage: ReturnType<typeof computeCoverage>,
  snp: SNPCoverageResult,
  noncov: ReturnType<typeof computeNoncovCoverage>,
  modCov: ReturnType<typeof computeModificationCoverage> | undefined,
) {
  return {
    coveragePackedBuffer: packCoverageBinsForGpu(
      coverage.depths,
      coverage.maxDepth,
      coverage.startPos,
      coverage.depths.length,
    ),
    snpPackedBuffer: packSnpSegmentsForGpu(
      snp.positions,
      snp.yOffsets,
      snp.heights,
      snp.colorTypes,
      snp.relDepths,
      snp.count,
    ),
    noncovPackedBuffer: packNoncovSegmentsForGpu(
      noncov.positions,
      noncov.yOffsets,
      noncov.heights,
      noncov.colorTypes,
      noncov.segmentCount,
    ),
    indicatorPackedBuffer: packIndicatorsForGpu(
      noncov.indicatorPositions,
      noncov.indicatorColorTypes,
      noncov.indicatorCount,
    ),
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
