import { calculateLDStats } from './calculateLDStats.ts'
import {
  calculateLDStatsDosageBits,
  packDosages,
} from './calculateLDStatsDosage.ts'

// The bit-packed kernel reaches calculateLDStats' six moments a different way,
// but reaches the SAME integers — so parity here is exact equality, not
// toBeCloseTo. A tolerance would hide the one failure mode that matters: a
// plane masked against the wrong locus's `valid`, which shifts a moment by the
// handful of samples missing at only one of the two loci and would still land
// within any reasonable epsilon.

function agree(g1: Int8Array, g2: Int8Array, signedLD: boolean) {
  const scalar = calculateLDStats(g1, g2, signedLD)
  const bits = calculateLDStatsDosageBits(
    packDosages(g1),
    packDosages(g2),
    signedLD,
  )
  expect(bits.r2).toBe(scalar.r2)
  expect(bits.dprime).toBe(scalar.dprime)
}

let seed = 20260824
function rnd() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}

function randomDosages(numSamples: number, maf: number, missingRate: number) {
  const out = new Int8Array(numSamples)
  for (let i = 0; i < numSamples; i++) {
    out[i] =
      rnd() < missingRate ? -1 : (rnd() < maf ? 1 : 0) + (rnd() < maf ? 1 : 0)
  }
  return out
}

describe('calculateLDStatsDosageBits', () => {
  // 31/32/33 and 63/64/65 are the word boundaries: an off-by-one in the bit
  // index shows up only in the partial trailing word.
  test.each([1, 2, 31, 32, 33, 63, 64, 65, 100, 2504])(
    'matches calculateLDStats exactly at %i samples',
    numSamples => {
      for (const signedLD of [false, true]) {
        for (const maf of [0.05, 0.2, 0.5, 0.8]) {
          for (const missingRate of [0, 0.05, 0.4]) {
            agree(
              randomDosages(numSamples, maf, missingRate),
              randomDosages(numSamples, maf, missingRate),
              signedLD,
            )
          }
        }
      }
    },
  )

  test('matches on perfect LD, inverse LD and independence', () => {
    const g1 = new Int8Array([0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2])
    for (const signedLD of [false, true]) {
      agree(g1, g1, signedLD)
      agree(
        g1,
        g1.map(g => 2 - g),
        signedLD,
      )
      agree(g1, new Int8Array([0, 0, 1, 2, 2, 1, 0, 2, 1, 1, 0, 2]), signedLD)
    }
  })

  test('matches on the degenerate cases', () => {
    const cases: [Int8Array, Int8Array][] = [
      // monomorphic: pA collapses to 0, then to 1
      [new Int8Array([0, 0, 0, 0]), new Int8Array([0, 1, 2, 1])],
      [new Int8Array([2, 2, 2, 2]), new Int8Array([0, 1, 2, 1])],
      // no sample called at both loci
      [new Int8Array([0, 1, -1, -1]), new Int8Array([-1, -1, 0, 1])],
      // all missing, and fewer than two called
      [new Int8Array([-1, -1, -1]), new Int8Array([-1, -1, -1])],
      [new Int8Array([0, -1, -1]), new Int8Array([1, -1, -1])],
      // one locus with no variance among the pairwise-complete samples
      [new Int8Array([1, 1, 1, 1]), new Int8Array([0, 1, 2, 0])],
    ]
    for (const [g1, g2] of cases) {
      for (const signedLD of [false, true]) {
        agree(g1, g2, signedLD)
      }
    }
  })

  test('missingness at only one locus still restricts both moments', () => {
    // g1 is called everywhere, g2 only on the first half. The samples g2 drops
    // must leave g1's Sigma-g too, which is the mask an unrestricted plane gets
    // wrong.
    const g1 = new Int8Array([0, 0, 0, 0, 2, 2, 2, 2])
    const g2 = new Int8Array([0, 1, 2, 1, -1, -1, -1, -1])
    agree(g1, g2, false)
    agree(g2, g1, false)
  })
})

describe('packDosages', () => {
  test('planes are disjoint subsets of valid', () => {
    const g = randomDosages(200, 0.3, 0.2)
    const { het, homAlt, valid, words } = packDosages(g)
    expect(words).toBe(Math.ceil(200 / 32))
    for (let w = 0; w < words; w++) {
      expect(het[w]! & homAlt[w]!).toBe(0)
      expect(het[w]! & ~valid[w]!).toBe(0)
      expect(homAlt[w]! & ~valid[w]!).toBe(0)
    }
  })

  test('bits land on the sample they came from', () => {
    const g = new Int8Array(64)
    g.fill(-1)
    g[0] = 0
    g[31] = 1
    g[32] = 2
    g[63] = 1
    const { het, homAlt, valid } = packDosages(g)
    expect(valid[0]! >>> 0).toBe((1 | (1 << 31)) >>> 0)
    expect(het[0]! >>> 0).toBe((1 << 31) >>> 0)
    expect(homAlt[0]).toBe(0)
    expect(valid[1]! >>> 0).toBe((1 | (1 << 31)) >>> 0)
    expect(het[1]! >>> 0).toBe((1 << 31) >>> 0)
    expect(homAlt[1]).toBe(1)
  })
})
