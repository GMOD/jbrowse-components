import { SimpleFeature } from '@jbrowse/core/util'

import { parseCigar2 } from '../MismatchParser/index.ts'
import { getMethBins } from './getMethBins.ts'

function makeFeature(
  seq: string,
  mm: string,
  ml: number[],
  strand: 1 | -1 = 1,
  cigar = `${seq.length}M`,
) {
  return new SimpleFeature({
    uniqueId: 'f1',
    refName: 'chr1',
    start: 100,
    end: 100 + seq.length,
    strand,
    CIGAR: cigar,
    seq,
    tags: { MM: mm, ML: ml },
  })
}

function bins(feature: ReturnType<typeof makeFeature>) {
  const cigar = feature.get('CIGAR') as string
  return getMethBins(feature, parseCigar2(cigar))
}

describe('getMethBins CpG filtering', () => {
  test('forward strand: C followed by G is stored', () => {
    // seq AACGAA: C at index 2, next base G → CpG
    const f = makeFeature('AACGAA', 'C+m,0;', [200])
    const { methBins } = bins(f)
    expect(methBins[2]).toBe(1)
  })

  test('forward strand: C not followed by G is skipped', () => {
    // seq AACAAA: C at index 2, next base A → not CpG
    const f = makeFeature('AACAAA', 'C+m,0;', [200])
    const { methBins } = bins(f)
    expect(methBins[2]).toBeUndefined()
  })

  test('forward strand: C at last position (no next base) is skipped', () => {
    const f = makeFeature('AAAC', 'C+m,0;', [200])
    const { methBins } = bins(f)
    expect(methBins[3]).toBeUndefined()
  })

  test('reverse strand: G preceded by C in read is stored', () => {
    // seq TTCGAA (reverse strand read). revcom = TTCGAA... wait.
    // Need a reverse strand read where revcom has a CpG.
    // seq = TTCGAA → revcom = TTCGAA... no.
    // seq = TTCGTT → revcom = AACGAA: C at revcom index 2, next G → CpG
    // getModPositions uses revcom(seq)='AACGAA', finds C at index 2
    // pos = seqLen - currPos = 6 - 3 = 3
    // CpG check: seq[pos-1] = seq[2] = 'C' ✓
    // getNextRefPos maps pos=3 → ref=3 for 6M CIGAR
    const f = makeFeature('TTCGTT', 'C+m,0;', [200], -1)
    const { methBins } = bins(f)
    expect(methBins[3]).toBe(1)
  })

  test('reverse strand: G not preceded by C in read is skipped', () => {
    // seq = TTAGTT → revcom = AACTAA: C at revcom index 2, next base T → not CpG
    const f = makeFeature('TTAGTT', 'C+m,0;', [200], -1)
    const { methBins } = bins(f)
    expect(Object.keys(methBins).length).toBe(0)
  })

  test('probability is stored correctly at CpG position', () => {
    // ML value 204 → prob ≈ 204/255 ≈ 0.8
    const f = makeFeature('AACGAA', 'C+m,0;', [204])
    const { methProbs } = bins(f)
    expect(methProbs[2]).toBeCloseTo(204 / 255, 5)
  })

  test('hydroxymethylation stored separately from methylation', () => {
    // seq AACGAA: C at index 2 is both methylated and hydroxymethylated
    const f = makeFeature('AACGAA', 'C+m,0;C+h,0;', [200, 100])
    const { methBins, hydroxyMethBins } = bins(f)
    expect(methBins[2]).toBe(1)
    expect(hydroxyMethBins[2]).toBe(1)
  })

  test('non-CpG modification types are ignored', () => {
    // 6mA modification (type 'a') should not populate methBins
    const f = makeFeature('AAAGAA', 'A+a,0;', [200])
    const { methBins, hydroxyMethBins } = bins(f)
    expect(Object.keys(methBins).length).toBe(0)
    expect(Object.keys(hydroxyMethBins).length).toBe(0)
  })

  test('two CpGs on same forward strand read both stored', () => {
    // seq AACGATCGAA: CpG at index 2 and 6
    const f = makeFeature('AACGATCGAA', 'C+m,0,0;', [230, 50])
    const { methBins } = bins(f)
    expect(methBins[2]).toBe(1)
    expect(methBins[6]).toBe(1)
  })

  test('two CpGs on reverse strand read both stored', () => {
    // seq TTCGATCGTT → revcom AACGATCGAA: CpGs at revcom indices 2 and 6
    // pos values: 10-3=7 and 10-7=3 → ref offsets 3 and 7 via 10M CIGAR
    const f = makeFeature('TTCGATCGTT', 'C+m,0,0;', [230, 50], -1)
    const { methBins } = bins(f)
    expect(methBins[3]).toBe(1)
    expect(methBins[7]).toBe(1)
  })
})
