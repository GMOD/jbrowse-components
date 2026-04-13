import { getMethBins } from './getMethBins.ts'
import { getModPositions } from './getModPositions.ts'
import { parseCigar2 } from '../MismatchParser/index.ts'

import type { ParsedModData } from './getMethBins.ts'

function makeModData(
  seq: string,
  mm: string,
  ml: number[],
  strand: 1 | -1 = 1,
  cigar = `${seq.length}M`,
): ParsedModData {
  const fstrand = strand as -1 | 0 | 1
  const cigarOps = parseCigar2(cigar)
  const modifications = getModPositions(mm, seq, fstrand)
  const probabilities = ml.map(v => v / 255)
  return {
    modifications,
    probabilities,
    cigarOps,
    seq,
    fstrand,
    flen: seq.length,
  }
}

function bins(
  seq: string,
  mm: string,
  ml: number[],
  strand: 1 | -1 = 1,
  cigar = `${seq.length}M`,
) {
  return getMethBins(makeModData(seq, mm, ml, strand, cigar))
}

describe('getMethBins CpG filtering', () => {
  test('forward strand: C followed by G is stored', () => {
    // seq AACGAA: C at index 2, next base G → CpG
    const { methBins } = bins('AACGAA', 'C+m,0;', [200])
    expect(methBins[2]).toBe(1)
  })

  test('forward strand: C not followed by G is skipped', () => {
    // seq AACAAA: C at index 2, next base A → not CpG
    const { methBins } = bins('AACAAA', 'C+m,0;', [200])
    expect(methBins[2]).toBeUndefined()
  })

  test('forward strand: C at last position (no next base) is skipped', () => {
    const { methBins } = bins('AAAC', 'C+m,0;', [200])
    expect(methBins[3]).toBeUndefined()
  })

  test('reverse strand: G preceded by C in read is stored', () => {
    // seq TTCGTT → revcom = AACGAA: C at revcom index 2, next G → CpG
    // getModPositions uses revcom(seq)='AACGAA', finds C at index 2
    // pos = seqLen - currPos = 6 - 3 = 3
    // CpG check: seq[pos-1] = seq[2] = 'C' ✓
    // getNextRefPos maps pos=3 → ref=3 for 6M CIGAR
    const { methBins } = bins('TTCGTT', 'C+m,0;', [200], -1)
    expect(methBins[3]).toBe(1)
  })

  test('reverse strand: G not preceded by C in read is skipped', () => {
    // seq = TTAGTT → revcom = AACTAA: C at revcom index 2, next base T → not CpG
    const { methBins } = bins('TTAGTT', 'C+m,0;', [200], -1)
    expect(Object.keys(methBins).length).toBe(0)
  })

  test('probability is stored correctly at CpG position', () => {
    // ML value 204 → prob ≈ 204/255 ≈ 0.8
    const { methProbs } = bins('AACGAA', 'C+m,0;', [204])
    expect(methProbs[2]).toBeCloseTo(204 / 255, 5)
  })

  test('hydroxymethylation stored separately from methylation', () => {
    const { methBins, hydroxyMethBins } = bins('AACGAA', 'C+m,0;C+h,0;', [200, 100])
    expect(methBins[2]).toBe(1)
    expect(hydroxyMethBins[2]).toBe(1)
  })

  test('non-CpG modification types are ignored', () => {
    // 6mA modification (type 'a') should not populate methBins
    const { methBins, hydroxyMethBins } = bins('AAAGAA', 'A+a,0;', [200])
    expect(Object.keys(methBins).length).toBe(0)
    expect(Object.keys(hydroxyMethBins).length).toBe(0)
  })

  test('two CpGs on same forward strand read both stored', () => {
    // seq AACGATCGAA: CpG at index 2 and 6
    const { methBins } = bins('AACGATCGAA', 'C+m,0,0;', [230, 50])
    expect(methBins[2]).toBe(1)
    expect(methBins[6]).toBe(1)
  })

  test('two CpGs on reverse strand read both stored', () => {
    // seq TTCGATCGTT → revcom AACGATCGAA: CpGs at revcom indices 2 and 6
    // pos values: 10-3=7 and 10-7=3 → ref offsets 3 and 7 via 10M CIGAR
    const { methBins } = bins('TTCGATCGTT', 'C+m,0,0;', [230, 50], -1)
    expect(methBins[3]).toBe(1)
    expect(methBins[7]).toBe(1)
  })
})
