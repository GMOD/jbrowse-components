import { buildSnpCoverageFields, emptySnpCoverageFields } from './buildRegion.ts'

function makeCoverageUploadData(
  coverageDepths: number[],
  coverageStartPos: number,
  snpPositions: number[],
  snpYOffsets: number[],
  snpHeights: number[],
  snpColorTypes: number[],
) {
  const n = snpPositions.length
  return {
    coverageDepths: new Float32Array(coverageDepths),
    coverageMaxDepth: Math.max(...coverageDepths),
    coverageStartPos,
    coveragePackedBuffer: new ArrayBuffer(0),
    snpPositions: new Uint32Array(snpPositions),
    snpYOffsets: new Float32Array(snpYOffsets),
    snpHeights: new Float32Array(snpHeights),
    snpColorTypes: new Uint8Array(snpColorTypes),
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
    snpCount: n,
  }
}

describe('buildSnpCoverageFields', () => {
  it('returns empty fields when no SNPs', () => {
    const data = makeCoverageUploadData([10, 20, 30], 100, [], [], [], [])
    const result = emptySnpCoverageFields()
    expect(result.snpSegmentCount).toBe(0)
    expect(result.snpTotalDepths.length).toBe(0)
    const built = buildSnpCoverageFields(data)
    expect(built.snpSegmentCount).toBe(0)
    expect(built.snpTotalDepths.length).toBe(0)
  })

  it('looks up total coverage depth for each SNP position', () => {
    // coverage: pos 100→10 reads, 101→50 reads, 102→30 reads
    const data = makeCoverageUploadData(
      [10, 50, 30],
      100,
      [100, 101, 102],
      [0, 0, 0],
      [0.1, 0.2, 0.1],
      [1, 2, 3],
    )
    const result = buildSnpCoverageFields(data)
    expect(result.snpSegmentCount).toBe(3)
    expect(result.snpTotalDepths[0]).toBeCloseTo(10)
    expect(result.snpTotalDepths[1]).toBeCloseTo(50)
    expect(result.snpTotalDepths[2]).toBeCloseTo(30)
  })

  it('stores 0 for SNP positions outside coverage range', () => {
    const data = makeCoverageUploadData(
      [10, 20],
      100,
      [99, 100, 102], // 99 is before start, 102 is past end
      [0, 0, 0],
      [0.1, 0.1, 0.1],
      [1, 1, 1],
    )
    const result = buildSnpCoverageFields(data)
    expect(result.snpTotalDepths[0]).toBe(0) // before range
    expect(result.snpTotalDepths[1]).toBeCloseTo(10) // in range
    expect(result.snpTotalDepths[2]).toBe(0) // past end
  })
})
