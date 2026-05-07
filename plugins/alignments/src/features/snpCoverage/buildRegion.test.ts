import {
  SNP_COVERAGE_FIELD_OFFSET_F32 as SNP_FIELD,
  SNP_COVERAGE_STRIDE_F32 as SNP_STRIDE,
} from '@jbrowse/alignments-core'

import { buildSnpCoverageFields, emptySnpCoverageFields } from './buildRegion.ts'

import type { CoverageUploadData } from '../../shared/uploadTypes.ts'

function makeCoverageUploadData(
  snpPositions: number[],
  snpYOffsets: number[],
  snpHeights: number[],
  snpColorTypes: number[],
  snpRelDepths: number[],
): CoverageUploadData {
  return {
    coverageDepths: new Float32Array(0),
    coverageMaxDepth: 0,
    coverageStartPos: 0,
    coveragePackedBuffer: new ArrayBuffer(0),
    snpPositions: new Uint32Array(snpPositions),
    snpYOffsets: new Float32Array(snpYOffsets),
    snpHeights: new Float32Array(snpHeights),
    snpColorTypes: new Uint8Array(snpColorTypes),
    snpRelDepths: new Float32Array(snpRelDepths),
    snpPackedBuffer: new ArrayBuffer(0),
    noncovPositions: new Uint32Array(0),
    noncovYOffsets: new Float32Array(0),
    noncovHeights: new Float32Array(0),
    noncovColorTypes: new Uint8Array(0),
    noncovMaxCount: 0,
    noncovPackedBuffer: new ArrayBuffer(0),
    indicatorPositions: new Uint32Array(0),
    indicatorColorTypes: new Uint8Array(0),
    indicatorPackedBuffer: new ArrayBuffer(0),
  }
}

describe('buildSnpCoverageFields', () => {
  it('returns empty buffer when no SNPs', () => {
    expect(emptySnpCoverageFields().snpBuffer.byteLength).toBe(0)
    const built = buildSnpCoverageFields(makeCoverageUploadData([], [], [], [], []))
    expect(built.snpBuffer.byteLength).toBe(0)
  })

  it('packs relDepth into the buffer at slot 4', () => {
    const data = makeCoverageUploadData(
      [100, 101, 102],
      [0, 0, 0],
      [0.5, 0.4, 0.6],
      [1, 2, 3],
      [0.2, 1.0, 0.6],
    )
    const built = buildSnpCoverageFields(data)
    expect(built.snpBuffer.byteLength).toBe(3 * SNP_STRIDE * 4)
    const f32 = new Float32Array(built.snpBuffer)
    expect(f32[0 * SNP_STRIDE + SNP_FIELD.relDepth]).toBeCloseTo(0.2)
    expect(f32[1 * SNP_STRIDE + SNP_FIELD.relDepth]).toBeCloseTo(1.0)
    expect(f32[2 * SNP_STRIDE + SNP_FIELD.relDepth]).toBeCloseTo(0.6)
  })
})
