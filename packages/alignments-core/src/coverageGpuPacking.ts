// Shared GPU buffer packing for coverage-related passes.
// Both MultiLGVSyntenyDisplay and LinearAlignmentsDisplay use these
// to prepare data for the HAL's uploadBuffer().

export interface CoverageBinsGpuUpload {
  buffer: ArrayBuffer
  binCount: number
}

// Pack per-bp coverage bins for the PASS_COVERAGE GPU buffer (GPU renderer
// layout). Layout per bin: [positionOffset(f32), normalizedDepth(f32), _pad(f32), _pad(f32)] = 16 bytes.
// positionOffset is the bp offset from regionStart; maxDepth is used to
// normalize depth into [0,1].
export function packCoverageBinsForGpu(
  depths: Float32Array,
  maxDepth: number,
  startOffset: number,
  binCount: number,
): CoverageBinsGpuUpload {
  if (binCount === 0 || maxDepth <= 0) {
    return { buffer: new ArrayBuffer(0), binCount: 0 }
  }
  const buffer = new ArrayBuffer(binCount * 16)
  const f32 = new Float32Array(buffer)
  for (let i = 0; i < binCount; i++) {
    const o = i * 4
    f32[o] = startOffset + i
    f32[o + 1] = (depths[i] ?? 0) / maxDepth
  }
  return { buffer, binCount }
}

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
// Layout per indicator: [position(f32), colorType(f32), _pad(f32), _pad(f32)] = 16 bytes.
export function packIndicatorsForGpu(
  positions: Uint32Array,
  colorTypes: Uint8Array | undefined,
  count: number,
  positionOffset = 0,
): IndicatorGpuUpload {
  if (count === 0) {
    return { buffer: new ArrayBuffer(0), indicatorCount: 0 }
  }
  const buffer = new ArrayBuffer(count * 16)
  const f32 = new Float32Array(buffer)
  for (let i = 0; i < count; i++) {
    f32[i * 4] = positionOffset + positions[i]!
    f32[i * 4 + 1] = colorTypes ? colorTypes[i]! : 1 // default: insertion type
  }
  return { buffer, indicatorCount: count }
}

export interface ModCovGpuUpload {
  buffer: ArrayBuffer
  segmentCount: number
}

// Pack mod-coverage segments into a GPU buffer.
// Layout per segment: [position(f32), yOffset(f32), height(f32), rgbaColor(u32)] = 16 bytes.
export function packModCovSegmentsForGpu(
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colors: Uint8Array,
  count: number,
  positionOffset = 0,
): ModCovGpuUpload {
  if (count === 0) {
    return { buffer: new ArrayBuffer(0), segmentCount: 0 }
  }
  const buffer = new ArrayBuffer(count * 16)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < count; i++) {
    const idx = i * 4
    f32[idx] = positionOffset + positions[i]!
    f32[idx + 1] = yOffsets[i]!
    f32[idx + 2] = heights[i]!
    u32[idx + 3] =
      colors[idx]! |
      (colors[idx + 1]! << 8) |
      (colors[idx + 2]! << 16) |
      (colors[idx + 3]! << 24)
  }
  return { buffer, segmentCount: count }
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
