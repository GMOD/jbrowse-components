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
  }
}

describe('collectWiggleTransferables', () => {
  it('returns 4 buffers for a single source with distinct arrays', () => {
    const source = makeSource('a')
    const result = collectWiggleTransferables([{ sources: [source] }])
    expect(result).toHaveLength(4)
    expect(result).toContain(source.featurePositions.buffer)
    expect(result).toContain(source.featureScores.buffer)
    expect(result).toContain(source.featureMinScores.buffer)
    expect(result).toContain(source.featureMaxScores.buffer)
  })

  it('returns empty list for zero sources and for zero results', () => {
    expect(collectWiggleTransferables([{ sources: [] }])).toEqual([])
    expect(collectWiggleTransferables([])).toEqual([])
  })

  it('accumulates across multiple sources', () => {
    const a = makeSource('a')
    const b = makeSource('b')
    expect(collectWiggleTransferables([{ sources: [a, b] }])).toHaveLength(8)
  })

  it('dedupes buffers shared between fields via aliasing', () => {
    const a = makeSource('a')
    a.featureMinScores = a.featureScores
    a.featureMaxScores = a.featureScores
    const result = collectWiggleTransferables([{ sources: [a] }])
    // 4 fields - 2 dedup'd shared buffers = 2 unique
    expect(result).toHaveLength(2)
    expect(result).toContain(a.featurePositions.buffer)
    expect(result).toContain(a.featureScores.buffer)
  })

  it('accumulates across results', () => {
    const a = makeSource('a')
    const b = makeSource('b')
    expect(
      collectWiggleTransferables([{ sources: [a] }, { sources: [b] }]),
    ).toHaveLength(8)
  })

  // The reason this takes every result at once. Two regions slicing one backing
  // buffer is what aliasing an adapter's arrays instead of copying them would
  // produce — and postMessage throws on a repeated transferable, at the send
  // rather than anywhere near the aliasing.
  it('dedupes a buffer shared BETWEEN two results', () => {
    const shared = new Uint32Array(16)
    const a = makeSource('a')
    const b = makeSource('b')
    a.featurePositions = shared.subarray(0, 8)
    b.featurePositions = shared.subarray(8, 16)

    const result = collectWiggleTransferables([
      { sources: [a] },
      { sources: [b] },
    ])
    expect(result.filter(x => x === shared.buffer)).toHaveLength(1)
    // 8 fields across the two sources, minus the one now shared
    expect(result).toHaveLength(7)
  })
})
