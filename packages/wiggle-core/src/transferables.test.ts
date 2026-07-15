import { collectWiggleTransferables } from './transferables.ts'

import type { WiggleSourceData } from './dataTypes.ts'

function makeSource(name: string, numFeatures = 4): WiggleSourceData {
  return {
    name,
    featurePositions: new Uint32Array(numFeatures * 2),
    featureScores: new Float32Array(numFeatures),
    featureMinScores: new Float32Array(numFeatures),
    featureMaxScores: new Float32Array(numFeatures),
    numFeatures,
    hasSummaryScores: false,
    posFeaturePositions: new Uint32Array(numFeatures * 2),
    posFeatureScores: new Float32Array(numFeatures),
    posNumFeatures: numFeatures,
    negFeaturePositions: new Uint32Array(0),
    negFeatureScores: new Float32Array(0),
    negNumFeatures: 0,
  }
}

describe('collectWiggleTransferables', () => {
  it('returns 8 buffers for a single source with distinct arrays', () => {
    const source = makeSource('a')
    const result = collectWiggleTransferables({ sources: [source] })
    expect(result).toHaveLength(8)
    expect(result).toContain(source.featurePositions.buffer)
    expect(result).toContain(source.featureScores.buffer)
    expect(result).toContain(source.featureMinScores.buffer)
    expect(result).toContain(source.featureMaxScores.buffer)
    expect(result).toContain(source.posFeaturePositions.buffer)
    expect(result).toContain(source.posFeatureScores.buffer)
    expect(result).toContain(source.negFeaturePositions.buffer)
    expect(result).toContain(source.negFeatureScores.buffer)
  })

  it('returns empty list for zero sources', () => {
    expect(collectWiggleTransferables({ sources: [] })).toEqual([])
  })

  it('accumulates across multiple sources', () => {
    const a = makeSource('a')
    const b = makeSource('b')
    expect(collectWiggleTransferables({ sources: [a, b] })).toHaveLength(16)
  })

  it('dedupes buffers shared between fields via subarray', () => {
    const a = makeSource('a')
    a.posFeaturePositions = a.featurePositions.subarray(0, 4)
    a.posFeatureScores = a.featureScores.subarray(0, 2)
    const result = collectWiggleTransferables({ sources: [a] })
    // 8 fields - 2 dedup'd shared buffers = 6 unique
    expect(result).toHaveLength(6)
    expect(result).toContain(a.featurePositions.buffer)
    expect(result).toContain(a.featureScores.buffer)
  })
})
