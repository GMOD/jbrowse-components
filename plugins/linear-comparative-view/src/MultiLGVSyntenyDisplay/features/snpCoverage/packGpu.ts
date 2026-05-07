import { packSnpSegmentsForGpu } from '@jbrowse/alignments-core'

export interface BlockSnpUploadData {
  buffer: ArrayBuffer
  segmentCount: number
}

// Pack SNP coverage segments for GPU upload.
// Positions are absolute genome coordinates from the worker.
export function packSnpCoverageForGpu(
  snpPositions: Uint32Array,
  snpYOffsets: Float32Array,
  snpHeights: Float32Array,
  snpColorTypes: Uint8Array,
  snpCount: number,
): BlockSnpUploadData {
  return packSnpSegmentsForGpu(
    snpPositions,
    snpYOffsets,
    snpHeights,
    snpColorTypes,
    snpCount,
  )
}
