import { INSTANCE_STRIDE_BYTES as INDICATOR_STRIDE_BYTES } from '../../shaders/multiSyntenyIndicator.generated.ts'

export interface BlockIndicatorUploadData {
  buffer: ArrayBuffer
  indicatorCount: number
}

export function packIndicatorsForGpu(
  indicatorPositions: Uint32Array,
  numIndicators: number,
): BlockIndicatorUploadData {
  if (numIndicators === 0) {
    return { buffer: new ArrayBuffer(0), indicatorCount: 0 }
  }

  const buffer = new ArrayBuffer(numIndicators * INDICATOR_STRIDE_BYTES)
  const f32 = new Float32Array(buffer)
  for (let i = 0; i < numIndicators; i++) {
    f32[i] = indicatorPositions[i]!
  }

  return { buffer, indicatorCount: numIndicators }
}
