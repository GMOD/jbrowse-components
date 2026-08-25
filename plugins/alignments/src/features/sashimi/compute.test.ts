import { computeSashimiJunctions } from './compute.ts'
import {
  SPLICE_MOTIF_NON_CANONICAL,
  SPLICE_MOTIF_UNKNOWN,
  spliceMotifLabel,
} from './motif.ts'

import type { CoverageGap } from '@jbrowse/alignments-core'

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
  const { sashimiX1, sashimiX2, sashimiCounts, sashimiStrands } =
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
  expect([...sashimiStrands]).toEqual([1])
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
  const { sashimiStrands } = computeSashimiJunctions(
    skips(rep(5, 100, 1100, 0)),
  )
  expect([...sashimiStrands]).toEqual([0])
})

test('untagged reads abstain rather than outvoting a tagged strand', () => {
  // 3 forward-tagged + 3 untagged is a forward junction: "no tag" is a missing
  // vote, not a third competing strand.
  const { sashimiStrands, sashimiCounts } = computeSashimiJunctions(
    skips([...rep(3, 100, 1100, 1), ...rep(3, 100, 1100, 0)]),
  )
  expect([...sashimiStrands]).toEqual([1])
  expect([...sashimiCounts]).toEqual([6])
})

test('contradictory strand tags tint the junction as ambiguous', () => {
  // Equal forward/reverse support (overlapping antisense genes) genuinely can't
  // be called, so it gets the neutral color rather than an arbitrary winner.
  const { sashimiStrands } = computeSashimiJunctions(
    skips([...rep(4, 100, 1100, 1), ...rep(4, 100, 1100, -1)]),
  )
  expect([...sashimiStrands]).toEqual([0])
})

test('the dominant strand tints a junction whose reads mostly agree', () => {
  const { sashimiStrands } = computeSashimiJunctions(
    skips([...rep(2, 100, 1100, 1), ...rep(9, 100, 1100, -1)]),
  )
  expect([...sashimiStrands]).toEqual([-1])
})

describe('splice motifs', () => {
  // A 20 bp reference starting at absolute bp 1000. The intron [1004, 1016)
  // starts with GT and ends with AG on the plus strand.
  const plus = { sequence: 'ACCAGTAAGTCCCTAGCCTT', start: 1000 }

  test('reads the donor and acceptor dinucleotides off the reference', () => {
    const { sashimiMotifs, sashimiStrands } = computeSashimiJunctions(
      skips(rep(3, 1004, 1016, 0)),
      plus,
    )
    expect([...sashimiMotifs]).toEqual([1])
    expect(spliceMotifLabel(sashimiMotifs[0]!)).toBe('GT-AG')
    // untagged reads take the strand the motif implies
    expect([...sashimiStrands]).toEqual([1])
  })

  test('a reverse-strand motif is the same label on the other strand', () => {
    // CT...AC is GT-AG read on the minus strand
    const minus = { sequence: 'ACCACTAAGTCCCTACCCTT', start: 1000 }
    const { sashimiMotifs, sashimiStrands } = computeSashimiJunctions(
      skips(rep(3, 1004, 1016, 0)),
      minus,
    )
    expect([...sashimiMotifs]).toEqual([2])
    expect(spliceMotifLabel(sashimiMotifs[0]!)).toBe('GT-AG')
    expect([...sashimiStrands]).toEqual([-1])
  })

  test('strand tags outvote the motif', () => {
    const { sashimiStrands } = computeSashimiJunctions(
      skips(rep(3, 1004, 1016, -1)),
      plus,
    )
    expect([...sashimiStrands]).toEqual([-1])
  })

  test('anything else is non-canonical, and case does not matter', () => {
    const { sashimiMotifs } = computeSashimiJunctions(
      skips(rep(1, 1004, 1016, 0)),
      { sequence: 'accaggaagtcccttgcctt', start: 1000 },
    )
    expect([...sashimiMotifs]).toEqual([SPLICE_MOTIF_NON_CANONICAL])
    expect(spliceMotifLabel(sashimiMotifs[0]!)).toBe('non-canonical')
  })

  test('an end outside the fetched sequence leaves the motif unknown', () => {
    const { sashimiMotifs, sashimiStrands } = computeSashimiJunctions(
      skips([...rep(1, 1004, 1030, 0), ...rep(1, 990, 1016, 0)]),
      plus,
    )
    expect([...sashimiMotifs]).toEqual([
      SPLICE_MOTIF_UNKNOWN,
      SPLICE_MOTIF_UNKNOWN,
    ])
    expect([...sashimiStrands]).toEqual([0, 0])
  })

  test('no reference means every motif is unknown', () => {
    const { sashimiMotifs } = computeSashimiJunctions(
      skips(rep(1, 1004, 1016, 0)),
    )
    expect([...sashimiMotifs]).toEqual([SPLICE_MOTIF_UNKNOWN])
    expect(spliceMotifLabel(SPLICE_MOTIF_UNKNOWN)).toBeUndefined()
  })
})
