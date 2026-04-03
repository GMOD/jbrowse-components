// Shared GPU buffer packing for coverage-related passes.
// Both MultiLGVSyntenyDisplay and LinearAlignmentsDisplay use these
// to prepare data for the HAL's uploadBuffer().

export interface SnpGpuUpload {
  buffer: ArrayBuffer
  segmentCount: number
}

// Pack SNP coverage segments into a GPU buffer.
// Layout per segment: [position(f32), yOffset(f32), height(f32), colorType(f32)] = 16 bytes.
export function packSnpSegmentsForGpu(
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colorTypes: Uint8Array,
  count: number,
  positionOffset = 0,
): SnpGpuUpload {
  if (count === 0) {
    return { buffer: new ArrayBuffer(0), segmentCount: 0 }
  }
  const buffer = new ArrayBuffer(count * 16)
  const f32 = new Float32Array(buffer)
  for (let i = 0; i < count; i++) {
    const idx = i * 4
    f32[idx] = positionOffset + positions[i]!
    f32[idx + 1] = yOffsets[i]!
    f32[idx + 2] = heights[i]!
    f32[idx + 3] = colorTypes[i]!
  }
  return { buffer, segmentCount: count }
}

export interface IndicatorGpuUpload {
  buffer: ArrayBuffer
  indicatorCount: number
}

// Pack indicator positions into a GPU buffer.
// Layout per indicator: [position(f32), colorType(f32)] = 8 bytes.
export function packIndicatorsForGpu(
  positions: Uint32Array,
  colorTypes: Uint8Array | undefined,
  count: number,
  positionOffset = 0,
): IndicatorGpuUpload {
  if (count === 0) {
    return { buffer: new ArrayBuffer(0), indicatorCount: 0 }
  }
  const buffer = new ArrayBuffer(count * 8)
  const f32 = new Float32Array(buffer)
  for (let i = 0; i < count; i++) {
    f32[i * 2] = positionOffset + positions[i]!
    f32[i * 2 + 1] = colorTypes ? colorTypes[i]! : 1 // default: insertion type
  }
  return { buffer, indicatorCount: count }
}

export interface NoncovGpuUpload {
  buffer: ArrayBuffer
  segmentCount: number
}

// Pack noncov histogram segments into a GPU buffer.
// Layout: [position(f32), yOffset(f32), height(f32), colorType(f32)] = 16 bytes.
export function packNoncovSegmentsForGpu(
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colorTypes: Uint8Array,
  count: number,
  positionOffset = 0,
): NoncovGpuUpload {
  if (count === 0) {
    return { buffer: new ArrayBuffer(0), segmentCount: 0 }
  }
  const buffer = new ArrayBuffer(count * 16)
  const f32 = new Float32Array(buffer)
  for (let i = 0; i < count; i++) {
    const idx = i * 4
    f32[idx] = positionOffset + positions[i]!
    f32[idx + 1] = yOffsets[i]!
    f32[idx + 2] = heights[i]!
    f32[idx + 3] = colorTypes[i]!
  }
  return { buffer, segmentCount: count }
}
