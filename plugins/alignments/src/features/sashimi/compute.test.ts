import {
  SASHIMI_FORWARD,
  SASHIMI_REVERSE,
  SASHIMI_UNKNOWN,
  computeSashimiJunctions,
} from './compute.ts'

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
  const { sashimiX1, sashimiX2, sashimiCounts, sashimiColorTypes } =
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
  expect([...sashimiColorTypes]).toEqual([SASHIMI_FORWARD])
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
  const { sashimiColorTypes } = computeSashimiJunctions(
    skips(rep(5, 100, 1100, 0)),
  )
  expect([...sashimiColorTypes]).toEqual([SASHIMI_UNKNOWN])
})

test('untagged reads abstain rather than outvoting a tagged strand', () => {
  // 3 forward-tagged + 3 untagged is a forward junction: "no tag" is a missing
  // vote, not a third competing strand.
  const { sashimiColorTypes, sashimiCounts } = computeSashimiJunctions(
    skips([...rep(3, 100, 1100, 1), ...rep(3, 100, 1100, 0)]),
  )
  expect([...sashimiColorTypes]).toEqual([SASHIMI_FORWARD])
  expect([...sashimiCounts]).toEqual([6])
})

test('contradictory strand tags tint the junction as ambiguous', () => {
  // Equal forward/reverse support (overlapping antisense genes) genuinely can't
  // be called, so it gets the neutral color rather than an arbitrary winner.
  const { sashimiColorTypes } = computeSashimiJunctions(
    skips([...rep(4, 100, 1100, 1), ...rep(4, 100, 1100, -1)]),
  )
  expect([...sashimiColorTypes]).toEqual([SASHIMI_UNKNOWN])
})

test('the dominant strand tints a junction whose reads mostly agree', () => {
  const { sashimiColorTypes } = computeSashimiJunctions(
    skips([...rep(2, 100, 1100, 1), ...rep(9, 100, 1100, -1)]),
  )
  expect([...sashimiColorTypes]).toEqual([SASHIMI_REVERSE])
})
