// Shared GPU buffer packing for coverage-related passes. Strides match the
// Slang-generated INSTANCE_STRIDE_BYTES in the alignments plugin. Multi-
// synteny has its own packers (different layouts — min/max band bars vs
// single-depth bars).

export interface CoverageBinsGpuUpload {
  buffer: ArrayBuffer
  binCount: number
}

// Layout per bin: [position(f32), normalizedDepth(f32)] = 8 bytes.
// Matches alignments plugin coverage.slang Instance.
export function packCoverageBinsForGpu(
  depths: Float32Array,
  maxDepth: number,
  startOffset: number,
  binCount: number,
): CoverageBinsGpuUpload {
  if (binCount === 0 || maxDepth <= 0) {
    return { buffer: new ArrayBuffer(0), binCount: 0 }
  }
  const buffer = new ArrayBuffer(binCount * 8)
  const f32 = new Float32Array(buffer)
  for (let i = 0; i < binCount; i++) {
    const o = i * 2
    f32[o] = startOffset + i
    f32[o + 1] = (depths[i] ?? 0) / maxDepth
  }
  return { buffer, binCount }
}

export interface SnpGpuUpload {
  buffer: ArrayBuffer
  segmentCount: number
}

// Layout per segment: [position, yOffset, height, colorType] = 16 bytes.
// Matches alignments plugin snpCoverage.slang + noncovHistogram.slang.
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

// Layout per indicator: [position(f32), colorType(f32)] = 8 bytes.
// Matches alignments plugin indicator.slang.
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
    const o = i * 2
    f32[o] = positionOffset + positions[i]!
    f32[o + 1] = colorTypes ? colorTypes[i]! : 1
  }
  return { buffer, indicatorCount: count }
}

export interface ModCovGpuUpload {
  buffer: ArrayBuffer
  segmentCount: number
}

// Layout per segment: [position, yOffset, height, rgbaColor(u32)] = 16 bytes.
// Matches alignments plugin modCoverage.slang. `colors` is pre-packed ABGR
// u32 per segment (one slot).
export function packModCovSegmentsForGpu(
  positions: Uint32Array,
  yOffsets: Float32Array,
  heights: Float32Array,
  colors: Uint32Array,
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
    u32[idx + 3] = colors[i]!
  }
  return { buffer, segmentCount: count }
}

export interface NoncovGpuUpload {
  buffer: ArrayBuffer
  segmentCount: number
}

// Layout: [position, yOffset, height, colorType] = 16 bytes.
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
