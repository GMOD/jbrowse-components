import {
  FIELD_OFFSET_F32 as SNP_FIELD,
  INSTANCE_STRIDE_F32 as SNP_STRIDE,
} from '../../shaders/slang/multiSyntenySnp.generated.ts'

export interface BlockSnpUploadData {
  buffer: ArrayBuffer
  segmentCount: number
}

// Pack SNP coverage segments for GPU upload. Synteny owns its own slang +
// pack + draw so the layout can evolve independently from plugins/alignments.
// yOffset/segHeight are per-position fractions (see multiSyntenySnp.slang);
// relDepth = totalDepthAtPos / regionMaxDepth scales the bar at draw time.
export function packSnpCoverageForGpu(
  snpPositions: Uint32Array,
  snpYOffsets: Float32Array,
  snpHeights: Float32Array,
  snpColorTypes: Uint8Array,
  snpRelDepths: Float32Array,
  snpCount: number,
): BlockSnpUploadData {
  if (snpCount === 0) {
    return { buffer: new ArrayBuffer(0), segmentCount: 0 }
  }
  const buffer = new ArrayBuffer(snpCount * SNP_STRIDE * 4)
  const f32 = new Float32Array(buffer)
  const u32 = new Uint32Array(buffer)
  for (let i = 0; i < snpCount; i++) {
    const o = i * SNP_STRIDE
    u32[o + SNP_FIELD.position] = snpPositions[i]!
    f32[o + SNP_FIELD.yOffset] = snpYOffsets[i]!
    f32[o + SNP_FIELD.segHeight] = snpHeights[i]!
    f32[o + SNP_FIELD.colorType] = snpColorTypes[i]!
    f32[o + SNP_FIELD.relDepth] = snpRelDepths[i] ?? 1
  }
  return { buffer, segmentCount: snpCount }
}
