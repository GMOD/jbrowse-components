import { cigarToMismatches } from './cigarToMismatches.ts'
import { cigarToMismatches2 } from './cigarToMismatches2.ts'
import { parseCigar2, parseCigar } from './index.ts'
import {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_H,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_S,
  CIGAR_X,
} from '../shared/cigarUtil.ts'

const ml = (currLen: number, opIndex: number) => (currLen << 4) | opIndex
const parseCigar3 = (args: string) => [...parseCigar2(args)]

describe('parseCigar3', () => {
  test('simple CIGAR', () => {
    const result = parseCigar3('100M')
    expect(result).toEqual([ml(100, CIGAR_M)])
  })

  test('medium CIGAR', () => {
    const result = parseCigar3('50M5I45M')
    expect(result).toEqual([ml(50, CIGAR_M), ml(5, CIGAR_I), ml(45, CIGAR_M)])
  })

  test('complex CIGAR with all operations', () => {
    const result = parseCigar3('5H10M1I5M1D20M100N5M10S')
    expect(result).toEqual([
      ml(5, CIGAR_H),
      ml(10, CIGAR_M),
      ml(1, CIGAR_I),
      ml(5, CIGAR_M),
      ml(1, CIGAR_D),
      ml(20, CIGAR_M),
      ml(100, CIGAR_N),
      ml(5, CIGAR_M),
      ml(10, CIGAR_S),
    ])
  })

  test('large numbers', () => {
    const result = parseCigar3('10000M5678I')
    expect(result).toEqual([ml(10000, CIGAR_M), ml(5678, CIGAR_I)])
  })

  test('with = and X operations', () => {
    const result = parseCigar3('50=5X45M')
    expect(result).toEqual([ml(50, CIGAR_EQ), ml(5, CIGAR_X), ml(45, CIGAR_M)])
  })
})

describe('cigarToMismatches2', () => {
  const seq =
    'AAAAAAAAAACAAAAAAAAAAAAAACCCCCCCCCCCCCCCCCCCCCCCCCGGGGGGGGGGGGGGGGGGGGGGGGGTTTTTTTTTTTTTTTTTTTTTTTTT'

  test('simple deletion', () => {
    const ops = parseCigar2('56M1D45M')
    const result = cigarToMismatches2(ops, seq)
    expect(result).toEqual([{ start: 56, type: 'deletion', length: 1 }])
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
        insertlen: 1,
        insertedBases: 'T',
        length: 0,
      },
    ])
  })

  test('skip operation', () => {
    const ops = parseCigar2('50M100N50M')
    const result = cigarToMismatches2(ops, seq)
    expect(result).toContainEqual({
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
      length: 1,
      start: 0,
      type: 'softclip',
    })

    expect(result).toContainEqual({
      cliplen: 10,
      length: 1,
      start: 90,
      type: 'softclip',
    })
  })

  test('compatibility: parseCigar vs parseCigar3', () => {
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
