// Pack all coverage-area GPU buffers (per-bp coverage, SNP, noncov histogram,
// indicators, mod-coverage) for transfer to the GPU renderer.
//
// Why this runs in the RPC worker: none of these passes reference
// main-thread-computed read Y values (unlike PASS_READ and friends), so they
// can be pre-packed in the worker and uploaded directly via writeBuffer. This
// removes the equivalent pack loops from the main thread during refetches.
// See ADR-004.

import {
  packCoverageBinsForGpu,
  packIndicatorsForGpu,
  packModCovSegmentsForGpu,
  packNoncovSegmentsForGpu,
  packSnpSegmentsForGpu,
} from '@jbrowse/alignments-core'

export interface CoverageAreaPackedBuffers {
  coveragePackedBuffer: ArrayBuffer
  snpPackedBuffer: ArrayBuffer
  noncovPackedBuffer: ArrayBuffer
  indicatorPackedBuffer: ArrayBuffer
  modCovPackedBuffer: ArrayBuffer
}

interface CoverageInput {
  depths: Float32Array
  maxDepth: number
  startOffset: number
}
interface SnpInput {
  positions: Uint32Array
  yOffsets: Float32Array
  heights: Float32Array
  colorTypes: Uint8Array
  count: number
}
interface NoncovInput {
  positions: Uint32Array
  yOffsets: Float32Array
  heights: Float32Array
  colorTypes: Uint8Array
  segmentCount: number
  indicatorPositions: Uint32Array
  indicatorColorTypes: Uint8Array
  indicatorCount: number
}
interface ModCovInput {
  positions: Uint32Array
  yOffsets: Float32Array
  heights: Float32Array
  colors: Uint32Array
  count: number
}

export function packCoverageAreaForGpu(
  coverage: CoverageInput,
  snp: SnpInput,
  noncov: NoncovInput,
  modCov: ModCovInput | undefined,
  regionStart: number,
): CoverageAreaPackedBuffers {
  return {
    coveragePackedBuffer: packCoverageBinsForGpu(
      coverage.depths,
      coverage.maxDepth,
      coverage.startOffset,
      coverage.depths.length,
    ).buffer,
    snpPackedBuffer: packSnpSegmentsForGpu(
      snp.positions,
      snp.yOffsets,
      snp.heights,
      snp.colorTypes,
      snp.count,
      -regionStart,
    ).buffer,
    noncovPackedBuffer: packNoncovSegmentsForGpu(
      noncov.positions,
      noncov.yOffsets,
      noncov.heights,
      noncov.colorTypes,
      noncov.segmentCount,
      -regionStart,
    ).buffer,
    indicatorPackedBuffer: packIndicatorsForGpu(
      noncov.indicatorPositions,
      noncov.indicatorColorTypes,
      noncov.indicatorCount,
      -regionStart,
    ).buffer,
    modCovPackedBuffer: modCov
      ? packModCovSegmentsForGpu(
          modCov.positions,
          modCov.yOffsets,
          modCov.heights,
          modCov.colors,
          modCov.count,
          -regionStart,
        ).buffer
      : new ArrayBuffer(0),
  }
}
