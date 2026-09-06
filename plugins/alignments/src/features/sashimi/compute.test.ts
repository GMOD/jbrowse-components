import { computeSashimiJunctions } from './compute.ts'
import { mergeJunctions } from './junctions.ts'
import {
  DINUCLEOTIDE_UNKNOWN,
  SPLICE_MOTIF_NON_CANONICAL,
  SPLICE_MOTIF_UNKNOWN,
  spliceMotifLabel,
} from './motif.ts'

import type { CoverageGap } from '@jbrowse/alignments-core'

// The strand and the motif are `mergeJunctions`' calls, not compute's — compute
// ships the raw votes and the two dinucleotides because a region holding one end
// of a junction can settle neither. One region through the merge is what these
// tests read them back through.
function merged(
  gaps: CoverageGap[],
  reference?: Parameters<typeof computeSashimiJunctions>[1],
) {
  return [
    ...mergeJunctions(
      [{ refName: 'chr1', data: computeSashimiJunctions(gaps, reference) }],
      { minSashimiScore: 0, hideNonCanonicalJunctions: false },
    ).values(),
  ]
}

// `strand` here is getEffectiveStrand's output: +1/-1 for an XS/TS/ts-tagged
// read, 0 for an untagged one.
function skips(specs: { start: number; end: number; strand: number }[]) {
  return specs.map(s => ({
    ...s,
    type: 'skip',
    featureStrand: 1,
  })) as CoverageGap[]
}

function rep(n: number, start: number, end: number, strand: number) {
  return Array.from({ length: n }, () => ({ start, end, strand }))
}

test('emits one arc per junction, counting reads on every strand', () => {
  // A junction whose reads disagree used to become three arcs (fwd/rev/unknown)
  // with a byte-identical path — stacked on the same pixels with their count
  // labels piled on one point, the visible one advertising 20 of 25 reads.
  const { sashimiX1, sashimiX2, sashimiCounts, sashimiFwd, sashimiRev } =
    computeSashimiJunctions(
      skips([
        ...rep(20, 100, 1100, 1),
        ...rep(3, 100, 1100, -1),
        ...rep(2, 100, 1100, 0),
      ]),
    )
  expect([...sashimiX1]).toEqual([100])
  expect([...sashimiX2]).toEqual([1100])
  expect([...sashimiCounts]).toEqual([25])
  expect([...sashimiFwd]).toEqual([20])
  expect([...sashimiRev]).toEqual([3])
})

test('keeps distinct junctions apart', () => {
  const { sashimiX1, sashimiCounts } = computeSashimiJunctions(
    skips([...rep(4, 100, 300, 1), ...rep(7, 500, 900, 1)]),
  )
  expect([...sashimiX1]).toEqual([100, 500])
  expect([...sashimiCounts]).toEqual([4, 7])
})

test('ignores deletion gaps', () => {
  const gaps = [
    { start: 100, end: 200, type: 'deletion', strand: 1, featureStrand: 1 },
    { start: 100, end: 200, type: 'skip', strand: 1, featureStrand: 1 },
  ] as CoverageGap[]
  expect([...computeSashimiJunctions(gaps).sashimiCounts]).toEqual([1])
})

test('an untagged junction is unknown, not reverse', () => {
  // No read carries a strand tag (e.g. default STAR output without
  // --outSAMstrandField), so there is no vote either way.
  expect(merged(skips(rep(5, 100, 1100, 0)))[0]!.strand).toBe(0)
})

test('untagged reads abstain rather than outvoting a tagged strand', () => {
  // 3 forward-tagged + 3 untagged is a forward junction: "no tag" is a missing
  // vote, not a third competing strand.
  const [j] = merged(skips([...rep(3, 100, 1100, 1), ...rep(3, 100, 1100, 0)]))
  expect(j!.strand).toBe(1)
  expect(j!.count).toBe(6)
})

test('contradictory strand tags tint the junction as ambiguous', () => {
  // Equal forward/reverse support (overlapping antisense genes) genuinely can't
  // be called, so it gets the neutral color rather than an arbitrary winner.
  expect(
    merged(skips([...rep(4, 100, 1100, 1), ...rep(4, 100, 1100, -1)]))[0]!
      .strand,
  ).toBe(0)
})

test('the dominant strand tints a junction whose reads mostly agree', () => {
  expect(
    merged(skips([...rep(2, 100, 1100, 1), ...rep(9, 100, 1100, -1)]))[0]!
      .strand,
  ).toBe(-1)
})

describe('splice motifs', () => {
  // A 20 bp reference starting at absolute bp 1000. The intron [1004, 1016)
  // starts with GT and ends with AG on the plus strand.
  const plus = { sequence: 'ACCAGTAAGTCCCTAGCCTT', start: 1000 }

  test('reads the donor and acceptor dinucleotides off the reference', () => {
    const [j] = merged(skips(rep(3, 1004, 1016, 0)), plus)
    expect(j!.motif).toBe(1)
    expect(spliceMotifLabel(j!.motif)).toBe('GT-AG (canonical)')
    // untagged reads take the strand the motif implies
    expect(j!.strand).toBe(1)
  })

  test('a reverse-strand motif is the same label on the other strand', () => {
    // CT...AC is GT-AG read on the minus strand
    const minus = { sequence: 'ACCACTAAGTCCCTACCCTT', start: 1000 }
    const [j] = merged(skips(rep(3, 1004, 1016, 0)), minus)
    expect(j!.motif).toBe(2)
    expect(spliceMotifLabel(j!.motif)).toBe('GT-AG (canonical)')
    expect(j!.strand).toBe(-1)
  })

  test('strand tags outvote the motif', () => {
    expect(merged(skips(rep(3, 1004, 1016, -1)), plus)[0]!.strand).toBe(-1)
  })

  test('anything else is non-canonical, and case does not matter', () => {
    const [j] = merged(skips(rep(1, 1004, 1016, 0)), {
      sequence: 'accaggaagtcccttgcctt',
      start: 1000,
    })
    expect(j!.motif).toBe(SPLICE_MOTIF_NON_CANONICAL)
    expect(spliceMotifLabel(j!.motif)).toBe('non-canonical')
  })

  test('an end outside the fetched sequence leaves that half unknown', () => {
    // Each half is reported on its own: the acceptor of the first junction and
    // the donor of the second fall outside the window, and the OTHER end of
    // each is still read, ready for a region that covers its partner.
    const { sashimiDonors, sashimiAcceptors } = computeSashimiJunctions(
      skips([...rep(1, 1004, 1030, 0), ...rep(1, 990, 1016, 0)]),
      plus,
    )
    expect(sashimiDonors[0]).not.toBe(DINUCLEOTIDE_UNKNOWN)
    expect(sashimiAcceptors[0]).toBe(DINUCLEOTIDE_UNKNOWN)
    expect(sashimiDonors[1]).toBe(DINUCLEOTIDE_UNKNOWN)
    expect(sashimiAcceptors[1]).not.toBe(DINUCLEOTIDE_UNKNOWN)
    expect(
      merged(
        skips([...rep(1, 1004, 1030, 0), ...rep(1, 990, 1016, 0)]),
        plus,
      ).map(j => [j.motif, j.strand]),
    ).toEqual([
      [SPLICE_MOTIF_UNKNOWN, 0],
      [SPLICE_MOTIF_UNKNOWN, 0],
    ])
  })

  test('an intron too short to hold two distinct dinucleotides is unknown', () => {
    const { sashimiDonors, sashimiAcceptors } = computeSashimiJunctions(
      skips(rep(1, 1004, 1007, 0)),
      plus,
    )
    expect([...sashimiDonors]).toEqual([DINUCLEOTIDE_UNKNOWN])
    expect([...sashimiAcceptors]).toEqual([DINUCLEOTIDE_UNKNOWN])
  })

  test('no reference means every motif is unknown', () => {
    expect(merged(skips(rep(1, 1004, 1016, 0)))[0]!.motif).toBe(
      SPLICE_MOTIF_UNKNOWN,
    )
    expect(spliceMotifLabel(SPLICE_MOTIF_UNKNOWN)).toBeUndefined()
  })
})
