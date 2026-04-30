import { INSTANCE_STRIDE_BYTES as INDICATOR_STRIDE_BYTES } from '../../shaders/slang/multiSyntenyIndicator.generated.ts'

export interface BlockIndicatorUploadData {
  buffer: ArrayBuffer
  indicatorCount: number
}

// Pack insertion-indicator positions for GPU upload. One uint32 position
// per indicator (no per-instance color — synteny indicators are always
// purple). Matches multiSyntenyIndicator.slang stride 1.
export function packIndicatorsForGpu(
  indicatorPositions: Uint32Array,
  numIndicators: number,
): BlockIndicatorUploadData {
  if (numIndicators === 0) {
    return { buffer: new ArrayBuffer(0), indicatorCount: 0 }
  }

  const buffer = new ArrayBuffer(numIndicators * INDICATOR_STRIDE_BYTES)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < numIndicators; i++) {
    u32[i] = indicatorPositions[i]!
  }

  return { buffer, indicatorCount: numIndicators }
}
