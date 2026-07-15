import { parseCigar2 } from '@jbrowse/cigar-utils'

import { getMethBins } from './getMethBins.ts'
import { getModPositions } from './getModPositions.ts'

import type { CytosineContext } from './cytosineContext.ts'
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
  context: CytosineContext = 'CG',
) {
  return getMethBins(makeModData(seq, mm, ml, strand, cigar), context)
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
    const { methBins, hydroxyMethBins } = bins(
      'AACGAA',
      'C+m,0;C+h,0;',
      [200, 100],
    )
    expect(methBins[2]).toBe(1)
    expect(hydroxyMethBins[2]).toBe(1)
  })

  test('combined code C+mh keeps m and h probabilities un-scrambled', () => {
    // CpGs at read index 2 and 6. For a combined 'C+mh' code the ML array is
    // interleaved per position: [m@2, h@2, m@6, h@6].
    const { methProbs, hydroxyMethProbs } = bins(
      'AACGATCGAA',
      'C+mh,0,0;',
      [250, 10, 20, 240],
    )
    expect(methProbs[2]).toBeCloseTo(250 / 255, 5)
    expect(methProbs[6]).toBeCloseTo(20 / 255, 5)
    expect(hydroxyMethProbs[2]).toBeCloseTo(10 / 255, 5)
    expect(hydroxyMethProbs[6]).toBeCloseTo(240 / 255, 5)
  })

  test('non-CpG modification types are ignored', () => {
    // 6mA modification (type 'a') should not populate methBins
    const { methBins, hydroxyMethBins } = bins('AAAGAA', 'A+a,0;', [200])
    expect(Object.keys(methBins).length).toBe(0)
    expect(Object.keys(hydroxyMethBins).length).toBe(0)
  })

  test('read with CpGs but no 5mC call does not invent unmethylated CpGs', () => {
    // 6mA-only read that happens to contain a CpG at index 2 must not be
    // painted as having an unmethylated cytosine — methylation was never called.
    const { methBins } = bins('AACGAA', 'A+a,0;', [200])
    expect(Object.keys(methBins).length).toBe(0)
  })

  test('two CpGs on same forward strand read both stored', () => {
    // seq AACGATCGAA: CpG at index 2 and 6
    const { methBins } = bins('AACGATCGAA', 'C+m,0,0;', [230, 50])
    expect(methBins[2]).toBe(1)
    expect(methBins[6]).toBe(1)
  })

  test("'.' skip flag fills uncalled CpGs as unmethylated (prob 0)", () => {
    // CpGs at index 2 and 6; only index 2 is listed in the MM tag. With the
    // default '.'/absent flag, the skipped CpG is assumed unmodified.
    const { methBins, methProbs } = bins('AACGATCGAA', 'C+m,0;', [230])
    expect(methBins[2]).toBe(1)
    expect(methBins[6]).toBe(1)
    expect(methProbs[6]).toBe(0)
  })

  test("'?' skip flag leaves uncalled CpGs unknown (not filled)", () => {
    // Same read, but '?' means the status of skipped bases is unknown, so the
    // uncalled CpG at index 6 must NOT be painted unmethylated.
    const { methBins } = bins('AACGATCGAA', 'C+m?,0;', [230])
    expect(methBins[2]).toBe(1)
    expect(methBins[6]).toBeUndefined()
  })

  test('CHG context: forward CHG site stored, dropped under default CpG', () => {
    // seq CAGAA: C@0 in CHG context (C,A,G). Methylation call at C@0.
    expect(bins('CAGAA', 'C+m,0;', [200], 1, '5M', 'CHG').methBins[0]).toBe(1)
    // same call under the default CpG context is not a CpG, so it is dropped
    expect(bins('CAGAA', 'C+m,0;', [200]).methBins[0]).toBeUndefined()
  })

  test('CHH context: forward CHH site stored', () => {
    // seq CATAA: C@0 in CHH context (C,A,T)
    expect(bins('CATAA', 'C+m,0;', [200], 1, '5M', 'CHH').methBins[0]).toBe(1)
    expect(bins('CATAA', 'C+m,0;', [200]).methBins[0]).toBeUndefined()
  })

  test('CHG context on reverse strand', () => {
    // stored CAGT, reverse: getModPositions places the modified C at stored
    // index 2 (the G). Reading backwards+complement gives C,H,G → CHG match.
    expect(bins('CAGT', 'C+m,0;', [200], -1, '4M', 'CHG').methBins[2]).toBe(1)
    // under default CpG the backward neighbour is H (T after complement), not G
    expect(bins('CAGT', 'C+m,0;', [200], -1).methBins[2]).toBeUndefined()
  })

  test('two CpGs on reverse strand read both stored', () => {
    // seq TTCGATCGTT → revcom AACGATCGAA: CpGs at revcom indices 2 and 6
    // pos values: 10-3=7 and 10-7=3 → ref offsets 3 and 7 via 10M CIGAR
    const { methBins } = bins('TTCGATCGTT', 'C+m,0,0;', [230, 50], -1)
    expect(methBins[3]).toBe(1)
    expect(methBins[7]).toBe(1)
  })
})
