import { cigarToMismatches } from './cigarToMismatches'
import { cigarToMismatches2 } from './cigarToMismatches2'
import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_H,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
  parseCigar2,
  parseCigar,
} from './index'

describe('parseCigar2', () => {
  test('simple CIGAR', () => {
    const result = parseCigar2('100M')
    expect(result).toEqual([100, CIGAR_M])
  })

  test('medium CIGAR', () => {
    const result = parseCigar2('50M5I45M')
    expect(result).toEqual([50, CIGAR_M, 5, CIGAR_I, 45, CIGAR_M])
  })

  test('complex CIGAR with all operations', () => {
    const result = parseCigar2('10M1I5M1D20M100N5M10S5H')
    expect(result).toEqual([
      10,
      CIGAR_M,
      1,
      CIGAR_I,
      5,
      CIGAR_M,
      1,
      CIGAR_D,
      20,
      CIGAR_M,
      100,
      CIGAR_N,
      5,
      CIGAR_M,
      10,
      CIGAR_S,
      5,
      CIGAR_H,
    ])
  })

  test('large numbers', () => {
    const result = parseCigar2('10000M5678I')
    expect(result).toEqual([10000, CIGAR_M, 5678, CIGAR_I])
  })

  test('with = and X operations', () => {
    const result = parseCigar2('50=5X45M')
    expect(result).toEqual([50, CIGAR_EQ, 5, CIGAR_X, 45, CIGAR_M])
  })

  test('CIGAR constants have correct values', () => {
    expect(CIGAR_M).toBe(77) // 'M'.charCodeAt(0)
    expect(CIGAR_I).toBe(73) // 'I'.charCodeAt(0)
    expect(CIGAR_D).toBe(68) // 'D'.charCodeAt(0)
    expect(CIGAR_N).toBe(78) // 'N'.charCodeAt(0)
    expect(CIGAR_S).toBe(83) // 'S'.charCodeAt(0)
    expect(CIGAR_H).toBe(72) // 'H'.charCodeAt(0)
    expect(CIGAR_X).toBe(88) // 'X'.charCodeAt(0)
    expect(CIGAR_EQ).toBe(61) // '='.charCodeAt(0)
  })
})

describe('cigarToMismatches2', () => {
  const seq =
    'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTT'

  test('simple deletion', () => {
    const ops = parseCigar2('56M1D45M')
    const result = cigarToMismatches2(ops, seq)
    expect(result).toEqual([
      { start: 56, type: 'deletion', base: '*', length: 1 },
    ])
  })

  test('simple insertion', () => {
    const ops = parseCigar2('89M1I11M')
    const seq2 =
      'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTTA'
    const result = cigarToMismatches2(ops, seq2)
    expect(result).toEqual([
      {
        start: 89,
        type: 'insertion',
        insertedBases: 'T',
        base: '1',
        length: 0,
      },
    ])
  })

  test('skip operation', () => {
    const ops = parseCigar2('50M100N50M')
    const result = cigarToMismatches2(ops, seq)
    expect(result).toContainEqual({
      base: 'N',
      length: 100,
      start: 50,
      type: 'skip',
    })
  })

  test('clipping operations', () => {
    const ops = parseCigar2('10S90M10S')
    const result = cigarToMismatches2(ops, seq)

    expect(result).toContainEqual({
      cliplen: 10,
      base: 'S10',
      length: 1,
      start: 0,
      type: 'softclip',
    })

    expect(result).toContainEqual({
      cliplen: 10,
      base: 'S10',
      length: 1,
      start: 90,
      type: 'softclip',
    })
  })

  test('compatibility: parseCigar vs parseCigar2', () => {
    const cigar = '50M5I45M10D40M'
    const ops1 = parseCigar(cigar)
    const ops2 = parseCigar2(cigar)

    const result1 = cigarToMismatches(ops1, seq, undefined, undefined)
    const result2 = cigarToMismatches2(ops2, seq, undefined, undefined)

    expect(result1.length).toBe(result2.length)

    for (const [idx, m1] of result1.entries()) {
      const m2 = result2[idx]
      expect(m2).toBeDefined()
      expect(m1.start).toBe(m2!.start)
      expect(m1.type).toBe(m2!.type)
      expect(m1.length).toBe(m2!.length)
    }
  })

  test('case-insensitive base matching', () => {
    const ops = parseCigar2('10M')
    const seq = 'ACGTACGTAC'
    const ref = 'acgtACGTac'

    const result = cigarToMismatches2(ops, seq, ref)
    expect(result.length).toBe(0) // All should match case-insensitively
  })

  test('with mismatches', () => {
    const ops = parseCigar2('10M')
    const seq = 'ACGTACGTAC'
    const ref = 'TCGTACGTAG'

    const result = cigarToMismatches2(ops, seq, ref)
    expect(result.length).toBe(2)
    expect(result[0]).toMatchObject({
      start: 0,
      type: 'mismatch',
      base: 'A',
      altbase: 'T',
      length: 1,
    })
    expect(result[1]).toMatchObject({
      start: 9,
      type: 'mismatch',
      base: 'C',
      altbase: 'G',
      length: 1,
    })
  })
})

describe('performance characteristics', () => {
  test('parseCigar2 returns all numbers', () => {
    const result = parseCigar2('100M5I45M')

    for (const [idx, val] of result.entries()) {
      expect(typeof val).toBe('number')
    }
  })

  test('parseCigar returns mixed types', () => {
    const result = parseCigar('100M5I45M')

    for (const [idx, val] of result.entries()) {
      if (idx % 2 === 0) {
        expect(typeof val).toBe('string')
      } else {
        expect(typeof val).toBe('string')
      }
    }
  })
})
