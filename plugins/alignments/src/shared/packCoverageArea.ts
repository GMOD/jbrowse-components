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

// All packed buffers store absolute genomic uint32 positions. Shaders
// read via hp-math (hpSplitUint + hpClipX) for precision at 3+ Gbp.
export function packCoverageAreaForGpu(
  coverage: CoverageInput,
  snp: SnpInput,
  noncov: NoncovInput,
  modCov: ModCovInput | undefined,
): CoverageAreaPackedBuffers {
  return {
    coveragePackedBuffer: packCoverageBinsForGpu(
      coverage.depths,
      coverage.maxDepth,
      coverage.startPos,
      coverage.depths.length,
    ).buffer,
    snpPackedBuffer: packSnpSegmentsForGpu(
      snp.positions,
      snp.yOffsets,
      snp.heights,
      snp.colorTypes,
      snp.count,
    ).buffer,
    noncovPackedBuffer: packNoncovSegmentsForGpu(
      noncov.positions,
      noncov.yOffsets,
      noncov.heights,
      noncov.colorTypes,
      noncov.segmentCount,
    ).buffer,
    indicatorPackedBuffer: packIndicatorsForGpu(
      noncov.indicatorPositions,
      noncov.indicatorColorTypes,
      noncov.indicatorCount,
    ).buffer,
    modCovPackedBuffer: modCov
      ? packModCovSegmentsForGpu(
          modCov.positions,
          modCov.yOffsets,
          modCov.heights,
          modCov.colors,
          modCov.count,
        ).buffer
      : new ArrayBuffer(0),
  }
}
