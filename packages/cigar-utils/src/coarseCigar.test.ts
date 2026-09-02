import {
  CIGAR_D,
  CIGAR_I,
  CIGAR_M,
  CIGAR_N,
  CIGAR_RUN,
} from './cigarConstants.ts'
import {
  coarsenCigar,
  flipCoarseCigar,
  parseCoarseCigar,
  swapCoarseCigar,
} from './coarseCigar.ts'

const pack = (len: number, op: number) => ((len << 4) | op) >>> 0
const words = (s: string) => [...parseCoarseCigar(s)]

describe('coarsenCigar', () => {
  test('folds indels under the gap into one unequal run', () => {
    expect(coarsenCigar('100M5D100M', 10)).toEqual({
      ops: '205:200M',
      ownLen: 205,
      mateLen: 200,
      gapCount: 0,
    })
  })

  test('keeps a gap at or above the minimum and the runs around it', () => {
    expect(coarsenCigar('100M5000D100M', 1000)).toEqual({
      ops: '100M5000D100M',
      ownLen: 5200,
      mateLen: 200,
      gapCount: 1,
    })
    expect(coarsenCigar('100M1000D100M', 1000).ops).toBe('100M1000D100M')
  })

  test('= and X count as match, small I folds into the mate length', () => {
    expect(coarsenCigar('10=2X8M3I7M20000I5M', 10000)).toEqual({
      ops: '27:30M20000I5M',
      ownLen: 32,
      mateLen: 20035,
      gapCount: 1,
    })
  })

  test('a kept N keeps its letter, and a gap at either end stays', () => {
    expect(coarsenCigar('10M50000N10M', 1000).ops).toBe('10M50000N10M')
    expect(coarsenCigar('50000D10M20000I', 1000).ops).toBe('50000D10M20000I')
  })

  test('a CIGAR with nothing to keep is one square run', () => {
    expect(coarsenCigar('100M', 10).ops).toBe('100M')
  })

  test('a run closes before its folded skew would pass half the gap', () => {
    // gap 10, so a run may lean by 5: the first 5D folds, the second would make
    // it 10 and starts a new run instead
    expect(coarsenCigar('100M5D100M5D100M', 10)).toEqual({
      ops: '205:200M105:100M',
      ownLen: 310,
      mateLen: 300,
      gapCount: 0,
    })
    // balanced indels never lean far, so they fold into one run
    expect(coarsenCigar('100M5D100M5I100M5D100M5I100M', 10).ops).toBe('510M')
  })
})

describe('parseCoarseCigar', () => {
  test('packs a square run as one M word and an unequal run as a RUN pair', () => {
    expect(words('27:30M20000I5M')).toEqual([
      pack(27, CIGAR_RUN),
      pack(30, CIGAR_RUN),
      pack(20000, CIGAR_I),
      pack(5, CIGAR_M),
    ])
  })

  test('D and N keep their BAM op codes', () => {
    expect(words('100D7N')).toEqual([pack(100, CIGAR_D), pack(7, CIGAR_N)])
  })

  test('an op longer than 28 bits is written as words that sum to it', () => {
    const max = 2 ** 28 - 1
    expect(words(`${2 ** 28}M`)).toEqual([pack(max, CIGAR_M), pack(1, CIGAR_M)])
  })

  test('a run longer than 28 bits is split with both axes in proportion', () => {
    const own = 2 ** 29
    const mate = 2 ** 28
    const w = words(`${own}:${mate}M`)
    expect(w.length % 2).toBe(0)
    const owns = w.filter((_, i) => i % 2 === 0).map(x => x >>> 4)
    const mates = w.filter((_, i) => i % 2 === 1).map(x => x >>> 4)
    expect(w.every(x => (x & 0xf) === CIGAR_RUN)).toBe(true)
    expect(owns.reduce((a, b) => a + b, 0)).toBe(own)
    expect(mates.reduce((a, b) => a + b, 0)).toBe(mate)
    expect(Math.max(...owns, ...mates)).toBeLessThanOrEqual(2 ** 28 - 1)
  })
})

describe('reorienting a coarse CIGAR for the other axis', () => {
  test('swap trades the run lengths and D<->I in place', () => {
    expect(swapCoarseCigar('27:30M20000I5M')).toBe('30:27M20000D5M')
    expect(swapCoarseCigar('7N')).toBe('7N')
  })

  test('flip also reverses op order', () => {
    expect(flipCoarseCigar('27:30M20000I5M')).toBe('5M20000D30:27M')
  })

  test('both are their own inverse', () => {
    const s = '100D27:30M20000I5M'
    expect(swapCoarseCigar(swapCoarseCigar(s))).toBe(s)
    expect(flipCoarseCigar(flipCoarseCigar(s))).toBe(s)
  })
})
